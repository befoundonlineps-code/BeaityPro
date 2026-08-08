import {
  fetchProductOrders, createProductOrder, updateProductOrder, deleteProductOrder,
} from './productOrderIO'

// A stand-in for the PostgREST client, recording every call and answering from
// a script keyed `table.op`. Each key holds a queue, so the second insert into
// the same table can answer differently from the first — which is the whole
// point here: the compensation paths only exist because one of two writes fails
// after the other succeeded.
function fakeClient(script) {
  const calls = []
  const queues = Object.fromEntries(
    Object.entries(script).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]])
  )

  const from = (table) => {
    const state = { table, op: 'select' }
    const chain = {
      select(columns) { state.columns = columns; return chain },
      insert(rows) { state.op = 'insert'; state.rows = rows; return chain },
      update(payload) { state.op = 'update'; state.payload = payload; return chain },
      delete() { state.op = 'delete'; return chain },
      eq(column, value) { state.eq = [column, value]; return chain },
      order() { return chain },
      // Thenable rather than a promise, so both shapes work: awaiting the chain
      // after .select() and awaiting it after .order().order().
      then(resolve) {
        const key = `${state.table}.${state.op}`
        calls.push({ ...state, key })
        const queue = queues[key] || []
        const answer = queue.length > 1 ? queue.shift() : (queue[0] || { data: [], error: null })
        resolve({ data: null, error: null, ...answer })
      },
    }
    return chain
  }

  return { from, calls }
}

const LINES = [
  { product_id: 'p1', entered_quantity: 2, entered_uom: 'package', entered_unit_price: 100, sort_order: 0 },
  { product_id: 'p2', entered_quantity: 5, entered_uom: 'unit', entered_unit_price: null, sort_order: 1 },
]
const ORDER = { supplier_id: 's1', order_date: '2020-01-01', note: null }

const opsOn = (client, table) => client.calls.filter((c) => c.table === table).map((c) => c.op)

describe('creating an order', () => {
  it('stamps the salon on the order AND on every line', () => {
    // ⚠️ The line's salon_id is written here, not inherited. The composite
    // foreign key is what stops it disagreeing with the parent — but only if
    // something writes it at all, and NOT NULL would be the loud half.
    const client = fakeClient({
      'product_orders.insert': { data: [{ id: 'o1' }] },
      'product_order_lines.insert': { data: LINES },
    })

    return createProductOrder({ order: ORDER, lines: LINES, salonId: 'sal1' }, client)
      .then((result) => {
        expect(result).toMatchObject({ ok: true, orderId: 'o1' })
        const [orderInsert] = client.calls.filter((c) => c.key === 'product_orders.insert')
        expect(orderInsert.rows[0]).toMatchObject({ ...ORDER, salon_id: 'sal1' })

        const [lineInsert] = client.calls.filter((c) => c.key === 'product_order_lines.insert')
        expect(lineInsert.rows).toHaveLength(2)
        for (const row of lineInsert.rows) {
          expect(row.salon_id).toBe('sal1')
          expect(row.order_id).toBe('o1')
        }
      })
  })

  it('treats no error and no rows as a refusal, and writes no lines', async () => {
    // ⚠️ RLS declining an insert normally raises 42501 — but a policy that
    // matches nothing on the way BACK returns 200 with an empty body. Reading
    // that as success would then insert lines against `undefined`.
    const client = fakeClient({ 'product_orders.insert': { data: [] } })

    expect(await createProductOrder({ order: ORDER, lines: LINES, salonId: 'sal1' }, client))
      .toMatchObject({ ok: false, orderId: null })
    expect(opsOn(client, 'product_order_lines')).toEqual([])
  })

  it('removes the order it just made when the lines will not go in', async () => {
    // There is no transaction from a browser. This is the closest thing, and it
    // matters because orderPayload refuses to CREATE an empty order — so an
    // order with no lines is a state only a half-failure can produce.
    const client = fakeClient({
      'product_orders.insert': { data: [{ id: 'o1' }] },
      'product_order_lines.insert': { data: null, error: { message: 'boom' } },
      'product_orders.delete': { data: [{ id: 'o1' }] },
    })

    const result = await createProductOrder({ order: ORDER, lines: LINES, salonId: 'sal1' }, client)
    expect(result).toMatchObject({ ok: false, orphaned: false, orderId: null })
    expect(result.error).toEqual({ message: 'boom' })
    expect(opsOn(client, 'product_orders')).toEqual(['insert', 'delete'])
  })

  it('says so when even the cleanup fails, instead of reporting a plain failure', async () => {
    // ⚠️ The half nobody writes. Without it the screen says "could not save"
    // while an order it did save sits in the list — and the person makes it
    // again, which is how one failure becomes two rows.
    const client = fakeClient({
      'product_orders.insert': { data: [{ id: 'o1' }] },
      'product_order_lines.insert': { data: null, error: { message: 'boom' } },
      'product_orders.delete': { data: [] },
    })

    expect(await createProductOrder({ order: ORDER, lines: LINES, salonId: 'sal1' }, client))
      .toMatchObject({ ok: false, orphaned: true, orderId: 'o1' })
  })

  it('writes no lines at all when there are none to write', async () => {
    const client = fakeClient({ 'product_orders.insert': { data: [{ id: 'o1' }] } })
    await createProductOrder({ order: ORDER, lines: [], salonId: 'sal1' }, client)
    expect(opsOn(client, 'product_order_lines')).toEqual([])
  })
})

describe('editing an order', () => {
  it('reads the old lines, replaces them, and reports success', async () => {
    const client = fakeClient({
      'product_orders.update': { data: [{ id: 'o1' }] },
      'product_order_lines.select': { data: [LINES[0]] },
      'product_order_lines.delete': { data: [LINES[0]] },
      'product_order_lines.insert': { data: LINES },
    })

    expect(await updateProductOrder({ id: 'o1', order: ORDER, lines: LINES, salonId: 'sal1' }, client))
      .toMatchObject({ ok: true, orderId: 'o1' })
    // The read comes BEFORE the delete. Reversed, there would be nothing left
    // to restore from.
    expect(opsOn(client, 'product_order_lines')).toEqual(['select', 'delete', 'insert'])
  })

  it('puts the old lines back when the new ones will not go in', async () => {
    // ⚠️ The one outcome here that destroys something a person typed rather
    // than merely failing to save it: delete succeeded, insert did not.
    const client = fakeClient({
      'product_orders.update': { data: [{ id: 'o1' }] },
      'product_order_lines.select': { data: [LINES[0]] },
      'product_order_lines.delete': { data: [LINES[0]] },
      'product_order_lines.insert': [
        { data: null, error: { message: 'boom' } },
        { data: [LINES[0]] },
      ],
    })

    const result = await updateProductOrder(
      { id: 'o1', order: ORDER, lines: LINES, salonId: 'sal1' }, client
    )
    expect(result).toMatchObject({ ok: false, linesLost: false })

    const inserts = client.calls.filter((c) => c.key === 'product_order_lines.insert')
    expect(inserts).toHaveLength(2)
    // The restore sends back exactly what was read, through the same door.
    expect(inserts[1].rows[0]).toMatchObject({ product_id: 'p1', order_id: 'o1', salon_id: 'sal1' })
  })

  it('reports the lines as lost when the restore fails too', async () => {
    // Best effort is not a guarantee, and the screen has to say which of the
    // two sentences is true: "the save failed" or "the lines are gone".
    const client = fakeClient({
      'product_orders.update': { data: [{ id: 'o1' }] },
      'product_order_lines.select': { data: [LINES[0]] },
      'product_order_lines.delete': { data: [LINES[0]] },
      'product_order_lines.insert': { data: null, error: { message: 'boom' } },
    })

    expect(await updateProductOrder({ id: 'o1', order: ORDER, lines: LINES, salonId: 'sal1' }, client))
      .toMatchObject({ ok: false, linesLost: true })
  })

  it('stops before touching any line when the order update is refused', async () => {
    const client = fakeClient({ 'product_orders.update': { data: [] } })
    expect(await updateProductOrder({ id: 'o1', order: ORDER, lines: LINES, salonId: 'sal1' }, client))
      .toMatchObject({ ok: false, orderId: null })
    expect(opsOn(client, 'product_order_lines')).toEqual([])
  })
})

describe('deleting an order', () => {
  it('counts the rows, because a refused delete looks like a successful one', async () => {
    // Under RLS a DELETE nobody is allowed returns 200 with an empty body and
    // no error. Only .select() can tell them apart.
    expect(await deleteProductOrder('o1', fakeClient({ 'product_orders.delete': { data: [] } })))
      .toMatchObject({ ok: false })

    expect(await deleteProductOrder('o1', fakeClient({ 'product_orders.delete': { data: [{ id: 'o1' }] } })))
      .toMatchObject({ ok: true })
  })

  it('does not delete the lines itself — the cascade does', async () => {
    const client = fakeClient({ 'product_orders.delete': { data: [{ id: 'o1' }] } })
    await deleteProductOrder('o1', client)
    expect(opsOn(client, 'product_order_lines')).toEqual([])
  })
})

describe('reading them back', () => {
  it('fails whole rather than returning orders with no lines', async () => {
    // ⚠️ An order with no lines is a state this screen legitimately draws, so
    // half a read would look like data instead of like a failure — item 26's
    // rule, earned again because these tables are new.
    const client = fakeClient({
      'product_orders.select': { data: [{ id: 'o1' }] },
      'product_order_lines.select': { data: null, error: { message: 'boom' } },
    })

    expect(await fetchProductOrders(client)).toMatchObject({ ok: false, orders: [], lines: [] })
  })

  it('returns both lists when both reads succeed', async () => {
    const client = fakeClient({
      'product_orders.select': { data: [{ id: 'o1' }] },
      'product_order_lines.select': { data: LINES },
    })

    const result = await fetchProductOrders(client)
    expect(result.ok).toBe(true)
    expect(result.orders).toHaveLength(1)
    expect(result.lines).toHaveLength(2)
  })
})

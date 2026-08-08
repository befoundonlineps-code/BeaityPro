import {
  fetchOpenSession, openSession, saveCount, removeCount, discardSession,
} from './stocktakeSessionIO'
import { postStocktakeSession } from './stockIO'

// The same scripted stand-in productOrderIO's tests use: every call recorded,
// answers keyed `table.op`, each key a queue so the second call to one table can
// answer differently from the first. That is what the race path needs.
function fakeClient(script) {
  const calls = []
  const queues = Object.fromEntries(
    Object.entries(script).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]])
  )

  const from = (table) => {
    const state = { table, op: 'select', filters: {} }
    const chain = {
      select() { return chain },
      insert(rows) { state.op = 'insert'; state.rows = rows; return chain },
      upsert(rows, options) { state.op = 'upsert'; state.rows = rows; state.options = options; return chain },
      delete() { state.op = 'delete'; return chain },
      eq(column, value) { state.filters[column] = value; return chain },
      is(column, value) { state.filters[column] = value; return chain },
      limit() { return chain },
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

  return { from, rpc: (fn, args) => { calls.push({ key: 'rpc.' + fn, args }); const q = queues['rpc.' + fn] || [{}]; return Promise.resolve({ data: null, error: null, ...(q.length > 1 ? q.shift() : q[0]) }) }, calls }
}

const SESSION = { id: 's1', salon_id: 'sal1', storage_id: 'st1' }
const keys = (client) => client.calls.map((c) => c.key)

describe('finding the count open on a storage', () => {
  it('asks for an OPEN one — a posted session is history, not a sheet', () => {
    const client = fakeClient({ 'stocktake_sessions.select': { data: [SESSION] } })
    return fetchOpenSession('st1', client).then(() => {
      const [read] = client.calls.filter((c) => c.key === 'stocktake_sessions.select')
      // ⚠️ Without the document_id filter this returns the last stocktake ever
      // posted on the storage, and the screen offers to resume a finished one.
      expect(read.filters).toMatchObject({ storage_id: 'st1', document_id: null })
    })
  })

  it('returns no session and no error when nothing is open', async () => {
    const client = fakeClient({ 'stocktake_sessions.select': { data: [] } })
    expect(await fetchOpenSession('st1', client)).toMatchObject({ ok: true, session: null, counts: [] })
    // And does not go looking for counts belonging to nothing.
    expect(keys(client)).toEqual(['stocktake_sessions.select'])
  })

  it('fails whole rather than returning a session with no counts', async () => {
    // ⚠️ "Nothing has been counted yet" is a real state this screen draws, so
    // half a read would look like data instead of like a failure.
    const client = fakeClient({
      'stocktake_sessions.select': { data: [SESSION] },
      'stocktake_counts.select': { data: null, error: { message: 'boom' } },
    })
    expect(await fetchOpenSession('st1', client)).toMatchObject({ ok: false, session: null, counts: [] })
  })
})

describe('starting a count', () => {
  it('joins the one already open instead of making a second', async () => {
    const client = fakeClient({
      'stocktake_sessions.select': { data: [SESSION] },
      'stocktake_counts.select': { data: [{ id: 'c1', product_id: 'p1', counted_base: 3 }] },
    })
    const result = await openSession({ salonId: 'sal1', storageId: 'st1' }, client)
    expect(result).toMatchObject({ ok: true, joined: true })
    expect(result.counts).toHaveLength(1)
    // Nothing was inserted — the index would have refused it anyway, and the
    // person would have seen an error where they should see a sheet.
    expect(keys(client)).not.toContain('stocktake_sessions.insert')
  })

  it('creates one when the storage has none', async () => {
    const client = fakeClient({
      'stocktake_sessions.select': { data: [] },
      'stocktake_sessions.insert': { data: [SESSION] },
    })
    const result = await openSession({ salonId: 'sal1', storageId: 'st1' }, client)
    expect(result).toMatchObject({ ok: true, joined: false, counts: [] })
    expect(result.session.id).toBe('s1')
  })

  it('turns the race into the other person’s sheet, not into an error', async () => {
    // ⚠️ THE WINDOW CHECKING-FIRST CANNOT CLOSE. Two people press start at the
    // same instant, both read nothing open, both insert; one gets 23505 from the
    // partial unique index. The honest answer to that refusal is not a message —
    // it is the session the other one just made.
    const client = fakeClient({
      'stocktake_sessions.select': [{ data: [] }, { data: [SESSION] }],
      'stocktake_sessions.insert': { data: null, error: { code: '23505', message: 'duplicate' } },
      'stocktake_counts.select': { data: [] },
    })
    expect(await openSession({ salonId: 'sal1', storageId: 'st1' }, client))
      .toMatchObject({ ok: true, joined: true })
  })

  it('reports any other insert failure rather than swallowing it', async () => {
    const client = fakeClient({
      'stocktake_sessions.select': { data: [] },
      'stocktake_sessions.insert': { data: null, error: { code: '42501', message: 'denied' } },
    })
    expect(await openSession({ salonId: 'sal1', storageId: 'st1' }, client))
      .toMatchObject({ ok: false, session: null })
  })

  it('treats no error and no rows as a refusal', async () => {
    const client = fakeClient({
      'stocktake_sessions.select': { data: [] },
      'stocktake_sessions.insert': { data: [] },
    })
    expect(await openSession({ salonId: 'sal1', storageId: 'st1' }, client))
      .toMatchObject({ ok: false, session: null })
  })
})

describe('writing one product’s count', () => {
  it('upserts on the pair, so counting twice corrects rather than accumulates', () => {
    const client = fakeClient({ 'stocktake_counts.upsert': { data: [{ id: 'c1' }] } })
    return saveCount({
      sessionId: 's1', salonId: 'sal1', productId: 'p1',
      countedBase: 7, enteredQuantity: 3, enteredUom: 'package',
    }, client).then((result) => {
      expect(result.ok).toBe(true)
      const [write] = client.calls.filter((c) => c.key === 'stocktake_counts.upsert')
      // ⚠️ Without the conflict target the sheet accumulates a row per
      // correction and the stocktake is decided by row order.
      expect(write.options).toEqual({ onConflict: 'session_id,product_id' })
      expect(write.rows[0]).toMatchObject({
        session_id: 's1', salon_id: 'sal1', product_id: 'p1', counted_base: 7,
        counted_entered_quantity: 3, counted_entered_uom: 'package',
      })
    })
  })

  it('writes the salon on every count, because the column is not inherited', async () => {
    const client = fakeClient({ 'stocktake_counts.upsert': { data: [{ id: 'c1' }] } })
    await saveCount({ sessionId: 's1', salonId: 'sal1', productId: 'p1', countedBase: 0 }, client)
    expect(client.calls[0].rows[0].salon_id).toBe('sal1')
  })

  it('sends null rather than undefined for a frame nobody chose', async () => {
    const client = fakeClient({ 'stocktake_counts.upsert': { data: [{ id: 'c1' }] } })
    await saveCount({ sessionId: 's1', salonId: 'sal1', productId: 'p1', countedBase: 0 }, client)
    expect(client.calls[0].rows[0]).toMatchObject({
      counted_entered_quantity: null, counted_entered_uom: null,
    })
  })

  it('keeps a counted zero, which is the most important count there is', async () => {
    // It says the shelf is empty — the finding most likely to differ from the
    // record. A falsy-check anywhere in this path would drop it.
    const client = fakeClient({ 'stocktake_counts.upsert': { data: [{ id: 'c1' }] } })
    await saveCount({ sessionId: 's1', salonId: 'sal1', productId: 'p1', countedBase: 0 }, client)
    expect(client.calls[0].rows[0].counted_base).toBe(0)
  })
})

describe('taking a product back off the sheet', () => {
  it('deletes by the pair, never by product alone', () => {
    const client = fakeClient({ 'stocktake_counts.delete': { data: [{ id: 'c1' }] } })
    return removeCount({ sessionId: 's1', productId: 'p1' }, client).then(() => {
      // ⚠️ Without session_id this removes that product's count from every open
      // sheet in the salon.
      expect(client.calls[0].filters).toEqual({ session_id: 's1', product_id: 'p1' })
    })
  })

  it('counts the rows, because a refused delete looks like a successful one', async () => {
    expect(await removeCount({ sessionId: 's1', productId: 'p1' },
      fakeClient({ 'stocktake_counts.delete': { data: [] } }))).toMatchObject({ ok: false })
  })
})

describe('discarding the whole count', () => {
  it('deletes the session and leaves the counts to the cascade', async () => {
    const client = fakeClient({ 'stocktake_sessions.delete': { data: [SESSION] } })
    expect(await discardSession('s1', client)).toMatchObject({ ok: true })
    // ⚠️ ON DELETE CASCADE bypasses row security, so the gate is the session's
    // own policy — narrowed in 054a to document_id is null. Deleting the counts
    // here as well would be a second path to the same thing, ungated.
    expect(keys(client)).toEqual(['stocktake_sessions.delete'])
  })

  it('reports the refusal a posted session gets from the database', async () => {
    // The narrowed policy matches no row, so this comes back 200 with an empty
    // body — the silent shape, made loud by counting.
    expect(await discardSession('s1', fakeClient({ 'stocktake_sessions.delete': { data: [] } })))
      .toMatchObject({ ok: false })
  })
})

describe('posting from a session', () => {
  it('sends the session id and no lines at all', async () => {
    const client = fakeClient({ 'rpc.post_stocktake_session': { data: 'doc1' } })
    expect(await postStocktakeSession({ sessionId: 's1' }, client))
      .toMatchObject({ ok: true, documentId: 'doc1' })
    // ⚠️ The whole point: the browser contributes the id of rows that already
    // exist, not an array it is holding. A reload before pressing the button
    // loses nothing.
    expect(client.calls[0].args).toEqual({
      p_session_id: 's1', p_employee_id: null, p_doc_date: null, p_note: null,
    })
  })

  it('treats a null return as a refusal that did not announce itself', async () => {
    const client = fakeClient({ 'rpc.post_stocktake_session': { data: null } })
    expect(await postStocktakeSession({ sessionId: 's1' }, client)).toMatchObject({ ok: false })
  })
})

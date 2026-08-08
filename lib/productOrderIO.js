import { supabase } from './supabaseClient'

// The order's reads and writes. Two tables, written STRAIGHT FROM HERE rather
// than through a database function — the first thing in this module that is.
//
// ⚠️ AND THAT HAS ONE CONSEQUENCE WORTH STATING BEFORE ANY CODE: PostgREST has
// no transaction. `post_stock_document` writes a document and its movements
// atomically because it is one function under one lock; an order and its lines
// are two requests, and the second can fail after the first succeeded.
//
// Two things make that proportionate here rather than a reason to write a
// sixth function:
//
//   1. An order records no event. Losing one costs retyping, not integrity —
//      no stock moved, no money was recorded, no balance depends on it, and
//      nothing points back at it (there is no from_order_id, deliberately).
//   2. Every partial state is VISIBLE. An order with no lines shows "0 lines"
//      in the list and can be deleted; there is no silent version of this.
//
// So each write compensates on failure and REPORTS what it could not undo,
// rather than pretending the pair was atomic. What is refused here is the third
// option — failing quietly and leaving somebody to find it later.

// Every column the screen needs, in one read per table.
//
// ⚠️ Two reads and not a nested select. PostgREST can embed the lines inside
// each order, and it is the wrong shape for this screen: the list draws
// totals from the lines, so an embed would make the list depend on a join that
// RLS filters on BOTH sides — and a line whose salon_id disagreed with its
// order would silently vanish from a total rather than showing up as a fault.
// The composite foreign key makes that disagreement impossible, which is
// exactly why nobody would ever look for it.
export async function fetchProductOrders(client = supabase) {
  const orders = await client
    .from('product_orders')
    .select('id, salon_id, supplier_id, order_date, note, created_at')
    .order('order_date', { ascending: false })
    .order('id', { ascending: false })

  if (orders.error) return { ok: false, error: orders.error, orders: [], lines: [] }

  const lines = await client
    .from('product_order_lines')
    .select('id, order_id, product_id, entered_quantity, entered_uom, entered_unit_price, sort_order')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (lines.error) return { ok: false, error: lines.error, orders: [], lines: [] }

  // ⚠️ Both or neither. Orders drawn with no lines read as "these orders are
  // empty", which is a real state this screen shows — so half a read would look
  // exactly like data rather than like a failure. Item 26's rule, earned again
  // because these are new tables.
  return { ok: true, error: null, orders: orders.data || [], lines: lines.data || [] }
}

export async function createProductOrder({ order, lines, salonId }, client = supabase) {
  const created = await client
    .from('product_orders')
    .insert([{ ...order, salon_id: salonId }])
    .select()

  if (created.error) return { ok: false, error: created.error, orderId: null }
  // No error and no rows is RLS declining, which from here looks exactly like
  // success. The same guard every write in this module keeps.
  if (!created.data || created.data.length === 0) {
    return { ok: false, error: null, orderId: null }
  }

  const orderId = created.data[0].id
  const written = await insertLines({ orderId, lines, salonId }, client)

  if (!written.ok) {
    // ⚠️ COMPENSATION, AND IT IS NAMED AS SUCH. The order exists and its lines
    // do not, which orderPayload refuses to create on purpose. Removing it is
    // the closest thing to the transaction that is not available — and if the
    // removal ALSO fails, that is reported rather than swallowed, because the
    // list is about to show an order nobody asked for.
    const undone = await client.from('product_orders').delete().eq('id', orderId).select()
    const orphaned = !!undone.error || !undone.data || undone.data.length === 0
    return { ok: false, error: written.error, orderId: orphaned ? orderId : null, orphaned }
  }

  return { ok: true, error: null, orderId }
}

export async function updateProductOrder({ id, order, lines, salonId }, client = supabase) {
  const saved = await client.from('product_orders').update(order).eq('id', id).select()

  if (saved.error) return { ok: false, error: saved.error, orderId: null }
  if (!saved.data || saved.data.length === 0) return { ok: false, error: null, orderId: null }

  // ⚠️ THE OLD LINES ARE READ BEFORE THEY ARE DELETED, and only for the restore
  // below. Without it, a failed insert after a successful delete leaves an
  // order whose lines are simply gone — the one outcome here that destroys
  // something a person typed rather than merely failing to save it.
  const existing = await client
    .from('product_order_lines')
    .select('product_id, entered_quantity, entered_uom, entered_unit_price, sort_order')
    .eq('order_id', id)

  if (existing.error) return { ok: false, error: existing.error, orderId: null }

  const removed = await client.from('product_order_lines').delete().eq('order_id', id).select()
  if (removed.error) return { ok: false, error: removed.error, orderId: null }

  const written = await insertLines({ orderId: id, lines, salonId }, client)
  if (written.ok) return { ok: true, error: null, orderId: id }

  // Best effort, and reported as such. The restore can fail too, and then the
  // screen has to say the lines are gone rather than that the save failed.
  // The rows read above already carry the four columns plus sort_order, so they
  // go back through the same door the new ones did — no second shape to keep in
  // step with this one.
  const restored = await insertLines({ orderId: id, lines: existing.data || [], salonId }, client)
  return {
    ok: false,
    error: written.error,
    orderId: id,
    linesLost: !restored.ok,
  }
}

// Deleting an order deletes its lines, and NOT because this function does it.
//
// ⚠️ ON DELETE CASCADE does that, and cascades bypass row security — so the
// lines go whether or not the child's DELETE policy would have allowed it. The
// gate is the parent delete, which RLS does check. Said here because somebody
// will one day test the child policy by deleting a parent, and get a pass that
// means nothing.
export async function deleteProductOrder(id, client = supabase) {
  const { data, error } = await client.from('product_orders').delete().eq('id', id).select()
  if (error) return { ok: false, error }
  // Under RLS a delete nobody is allowed comes back 200 with an empty body and
  // no error. Only .select() can tell that from success.
  if (!data || data.length === 0) return { ok: false, error: null }
  return { ok: true, error: null }
}

async function insertLines({ orderId, lines, salonId }, client) {
  if (!lines || lines.length === 0) return { ok: true, error: null }

  const rows = lines.map((line) => ({
    ...line,
    order_id: orderId,
    // ⚠️ WRITTEN ON EVERY LINE, not inherited from the order. The column exists
    // because stock_movements has one; the composite foreign key to
    // (product_orders.id, salon_id) is what stops this value disagreeing with
    // the parent's — so a wrong salon here is refused by the database rather
    // than stored.
    salon_id: salonId,
  }))

  const { data, error } = await client.from('product_order_lines').insert(rows).select()
  if (error) return { ok: false, error }
  if (!data || data.length !== rows.length) return { ok: false, error: null }
  return { ok: true, error: null }
}

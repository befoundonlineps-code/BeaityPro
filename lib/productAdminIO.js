import { supabase } from './supabaseClient'
import { wroteAll } from './writeCheck'

// Every write the catalogue screens make, out here rather than inside the
// dialogs — the same move saveCategory and saveService made, and for the same
// reason. Inline, the payload is invisible to every test, and the first time
// that matters is the first time a row comes back looking wrong.
//
// There is no delete anywhere in this file, and that is not an omission.
// products, product_categories, storages and suppliers have no RLS delete
// policy, so a delete returns zero rows rather than an error — silent success
// from the client's side. Archiving is the only act, and the screens show no
// delete button at all.

export async function saveProductCategory({ id, payload, salonId }, client = supabase) {
  const { data, error } = id
    ? await client.from('product_categories').update(payload).eq('id', id).select()
    : await client.from('product_categories').insert([{ ...payload, salon_id: salonId }]).select()

  if (error) return { ok: false, error, row: null }
  // No error and no data is a refusal, not a success: RLS declining looks
  // exactly like this from here.
  if (!data || data.length === 0) return { ok: false, error: null, row: null }
  return { ok: true, error: null, row: data[0] }
}

export async function saveProduct({ id, payload, salonId, categoryId }, client = supabase) {
  const { data, error } = id
    ? await client.from('products').update(payload).eq('id', id).select()
    : await client.from('products').insert([{ ...payload, salon_id: salonId, category_id: categoryId }]).select()

  if (error) return { ok: false, error, row: null }
  if (!data || data.length === 0) return { ok: false, error: null, row: null }
  return { ok: true, error: null, row: data[0] }
}

// Taking a folder out of circulation, or putting it back.
//
// Its own row only. The subtree follows because every screen resolves
// archiving by walking up the parent chain (lib/categoryVisibility.js), so
// writing the flag onto children would be both redundant and lossy — a child
// archived on its own would come back when its parent did.
export async function setProductCategoryArchived(categoryId, archived, client = supabase) {
  const { data, error } = await client
    .from('product_categories')
    .update({ is_active: !archived })
    .eq('id', categoryId)
    .select()

  if (error) return { ok: false, error }
  if (!data || data.length === 0) return { ok: false, error: null }
  return { ok: true, error: null }
}

// The same for a product, which is what "delete" means here: stock_movements
// holds product_id with ON DELETE RESTRICT, so anything ever moved can never
// be removed and archiving is the only honest verb.
export async function setProductArchived(productId, archived, client = supabase) {
  const { data, error } = await client
    .from('products')
    .update({ is_active: !archived })
    .eq('id', productId)
    .select()

  if (error) return { ok: false, error }
  if (!data || data.length === 0) return { ok: false, error: null }
  return { ok: true, error: null }
}

// The components of a set, made to match what was chosen.
//
// Same diff as the service↔resource link, and it uses the same lib for the
// same reason — one copy of "what to insert and what to delete" rather than
// two that drift. The delete runs first: unique(set_product_id,
// component_product_id) would reject a component removed and re-added in one
// save, which is what swapping one for another looks like from here.
//
// ⚠️ Three separate writes with no transaction around them, deliberately, and
// the line this sits on the far side of is worth stating because the same
// project draws it the other way a few files over.
//
// Definitional data, not a journal. If the delete lands and the insert fails,
// the set comes back with components missing, nothing derived anything from
// the half-written state in the meantime, and saving again fixes it — because
// the diff is computed from a fresh read of the table rather than from a
// picture of what used to be there.
//
// ⚠️ Not because the partial state is "visible". The window draws `components`,
// which is what the person typed, not what the table holds; after a partial
// failure they see their list intact with an error above it and cannot tell
// which row survived until they close and reopen. Visibility was never part of
// the argument, and the argument stands without it.
//
// A stock movement is the opposite on every one of those counts — nobody reads
// the movements, they read a balance computed from them, so half a document
// leaves a number that is wrong, believable, and permanent. That is why
// lib/stockDocument.js hands its lines to an RPC and this hands its rows to
// the client one at a time. Not inconsistency: the cost of a partial write is
// visible-and-correctable here and silent-and-permanent there.
export async function saveSetComponents(
  { setProductId, salonId, existingRows, components },
  client = supabase
) {
  // Position in the array is the order the person put them in, so it is what
  // sort_order has to carry. Leaving it out let the column's default stand,
  // and a table where every row says 0 comes back from .order('sort_order') in
  // whatever order the planner felt like — a set reopened twice looked
  // shuffled for no reason anyone could see.
  const wanted = new Map((components || []).map((c, index) => [
    c.productId,
    { quantityBase: Number(c.quantityBase), sortOrder: index },
  ]))
  const present = new Map((existingRows || []).map((r) => [r.component_product_id, r]))

  const toRemoveIds = []
  const toInsert = []
  const toUpdate = []

  for (const [productId, row] of present) {
    if (!wanted.has(productId)) {
      toRemoveIds.push(row.id)
      continue
    }
    const want = wanted.get(productId)
    const patch = {}
    // Both sides through Number: the row arrives from PostgREST with numerics
    // that may be strings, and '2' !== 2 would rewrite every row every save.
    if (Number(row.quantity_base) !== want.quantityBase) patch.quantity_base = want.quantityBase
    if (Number(row.sort_order) !== want.sortOrder) patch.sort_order = want.sortOrder
    if (Object.keys(patch).length > 0) toUpdate.push({ id: row.id, patch })
  }
  for (const [productId, want] of wanted) {
    if (!present.has(productId)) {
      toInsert.push({
        salon_id: salonId,
        set_product_id: setProductId,
        component_product_id: productId,
        quantity_base: want.quantityBase,
        sort_order: want.sortOrder,
      })
    }
  }

  // Every write asks for its rows back and counts them. See lib/writeCheck.js:
  // the delete and the update here are the only two calls in this file that
  // could come back 200 with an empty body under RLS and be read as success.
  if (toRemoveIds.length > 0) {
    const { data, error } = await client
      .from('product_set_components').delete().in('id', toRemoveIds).select()
    if (error) return { ok: false, error }
    if (!wroteAll(data, toRemoveIds.length)) return { ok: false, error: null }
  }
  for (const row of toUpdate) {
    const { data, error } = await client
      .from('product_set_components')
      .update(row.patch)
      .eq('id', row.id)
      .select()
    if (error) return { ok: false, error }
    if (!wroteAll(data, 1)) return { ok: false, error: null }
  }
  if (toInsert.length > 0) {
    const { data, error } = await client
      .from('product_set_components').insert(toInsert).select()
    if (error) return { ok: false, error }
    if (!wroteAll(data, toInsert.length)) return { ok: false, error: null }
  }

  return { ok: true, error: null }
}

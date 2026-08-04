import { supabase } from './supabaseClient'

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
export async function saveSetComponents(
  { setProductId, salonId, existingRows, components },
  client = supabase
) {
  const wanted = new Map((components || []).map((c) => [c.productId, Number(c.quantityBase)]))
  const present = new Map((existingRows || []).map((r) => [r.component_product_id, r]))

  const toRemoveIds = []
  const toInsert = []
  const toUpdate = []

  for (const [productId, row] of present) {
    if (!wanted.has(productId)) toRemoveIds.push(row.id)
    else if (Number(row.quantity_base) !== wanted.get(productId)) {
      toUpdate.push({ id: row.id, quantity_base: wanted.get(productId) })
    }
  }
  for (const [productId, quantityBase] of wanted) {
    if (!present.has(productId)) {
      toInsert.push({
        salon_id: salonId,
        set_product_id: setProductId,
        component_product_id: productId,
        quantity_base: quantityBase,
      })
    }
  }

  if (toRemoveIds.length > 0) {
    const { error } = await client.from('product_set_components').delete().in('id', toRemoveIds)
    if (error) return { ok: false, error }
  }
  for (const row of toUpdate) {
    const { error } = await client
      .from('product_set_components')
      .update({ quantity_base: row.quantity_base })
      .eq('id', row.id)
    if (error) return { ok: false, error }
  }
  if (toInsert.length > 0) {
    const { error } = await client.from('product_set_components').insert(toInsert)
    if (error) return { ok: false, error }
  }

  return { ok: true, error: null }
}

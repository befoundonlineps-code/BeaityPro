import { supabase } from './supabaseClient'
import { linkDiff } from './resourceLinks'

// Creating a service or editing one.
//
// It lived inside ServiceFormDialog, where the payload was invisible to every
// test because the write used the imported client directly. That was tolerable
// while the form set five columns; it stopped being tolerable at thirteen.
// Same move, and same reason, as saveCategory.
export async function saveService({ id, payload, salonId, categoryId }, client = supabase) {
  const { data, error } = id
    ? await client.from('services').update(payload).eq('id', id).select()
    : await client.from('services').insert([{ ...payload, salon_id: salonId, category_id: categoryId }]).select()

  if (error) return { ok: false, error, row: null }
  // No error and no data is a refusal, not a success: this is exactly what RLS
  // declining an update looks like from here.
  if (!data || data.length === 0) return { ok: false, error: null, row: null }
  return { ok: true, error: null, row: data[0] }
}

// The picture, once the row exists and its id can go in the storage path.
export async function setServiceImagePath(serviceId, imagePath, client = supabase) {
  const { data, error } = await client
    .from('services')
    .update({ image_path: imagePath })
    .eq('id', serviceId)
    .select()

  if (error) return { ok: false, error }
  if (!data || data.length === 0) return { ok: false, error: null }
  return { ok: true, error: null }
}

// Making the service's resource links match what was ticked.
//
// The delete runs before the insert on purpose. The table holds
// unique(service_id, resource_id), and doing it the other way round would
// reject a link that is being removed and re-added in the same save — which is
// what a resource swapped for another one looks like from here.
export async function saveServiceResources(
  { serviceId, salonId, existingLinks, selectedResourceIds },
  client = supabase
) {
  const { toAdd, toRemoveIds } = linkDiff(existingLinks, selectedResourceIds, 'resource_id')

  if (toRemoveIds.length > 0) {
    const { error } = await client.from('service_resources').delete().in('id', toRemoveIds)
    if (error) return { ok: false, error }
  }

  if (toAdd.length > 0) {
    const rows = toAdd.map((resourceId) => ({ salon_id: salonId, service_id: serviceId, resource_id: resourceId }))
    const { error } = await client.from('service_resources').insert(rows)
    if (error) return { ok: false, error }
  }

  return { ok: true, error: null }
}

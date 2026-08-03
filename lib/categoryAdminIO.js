import { supabase } from './supabaseClient'

// Taking a folder out of circulation, or putting it back.
//
// Its own row only. The subtree follows because every screen resolves
// archiving by walking up the parent chain (lib/categoryVisibility.js), so
// writing the flag onto children would be both redundant and lossy — a child
// archived on its own would come back when its parent did.
export async function setCategoryArchived(categoryId, archived, client = supabase) {
  const { data, error } = await client
    .from('service_categories')
    .update({ is_active: !archived })
    .eq('id', categoryId)
    .select()

  if (error) return { ok: false, error }
  // A write that matched no row returns no error and no data. Silence is not
  // success: RLS refusing an update looks exactly like this.
  if (!data || data.length === 0) return { ok: false, error: null }
  return { ok: true, error: null }
}

// The same for a service, which is what "delete" means here: appointments
// hold service_id with ON DELETE RESTRICT, so anything ever booked can never
// be removed and archiving is the only honest verb.
export async function setServiceArchived(serviceId, archived, client = supabase) {
  const { data, error } = await client
    .from('services')
    .update({ is_active: !archived })
    .eq('id', serviceId)
    .select()

  if (error) return { ok: false, error }
  if (!data || data.length === 0) return { ok: false, error: null }
  return { ok: true, error: null }
}

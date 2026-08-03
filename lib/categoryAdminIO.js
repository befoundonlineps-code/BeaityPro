import { supabase } from './supabaseClient'

// Creating a folder or renaming one.
//
// It lived inside CategoryFormDialog until a category came back at the wrong
// place in the tree and there was no way to ask what had actually been sent —
// the write used the imported client directly, so the payload was invisible
// to every test. The archiving functions below had already been moved out for
// exactly this reason; this one had not, and that was the gap.
//
// The type is whatever was chosen, at any depth. This used to null it out for
// anything with a parent, which re-imposed a rule ADR-019 withdrew and no
// constraint enforces: a category at any depth may declare its own type, and
// an empty one inherits from the nearest ancestor that has one. Nulling it on
// save made the mixed folder that ADR exists to allow — bridal packages
// holding hair, makeup and nails — impossible to build from this screen.
//
// Both keys are always present, never omitted. A folder moved out from under
// a parent has to lose it, and a key left out of an update leaves the old
// value in place: the row would keep pointing at a parent it was meant to
// leave, and nothing would say so.
export async function saveCategory({ id, name, parentId, businessType, salonId }, client = supabase) {
  const payload = {
    name: (name || '').trim(),
    parent_id: parentId || null,
    business_type: businessType || null,
  }

  const { data, error } = id
    ? await client.from('service_categories').update(payload).eq('id', id).select()
    : await client.from('service_categories').insert([{ ...payload, salon_id: salonId }]).select()

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

// Inserting the duplicate the copy button builds.
//
// Takes a payload rather than building one, so what gets written is decided
// in lib/serviceCopy.js where it can be read and tested — the columns a copy
// carries are a judgement (everything the form can set) and the ones it must
// not (id, created_at, the original's active flag) are the part that goes
// wrong quietly.
export async function insertServiceCopy(payload, client = supabase) {
  if (!payload) return { ok: false, error: null, row: null }

  const { data, error } = await client.from('services').insert([payload]).select()

  if (error) return { ok: false, error, row: null }
  if (!data || data.length === 0) return { ok: false, error: null, row: null }
  return { ok: true, error: null, row: data[0] }
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

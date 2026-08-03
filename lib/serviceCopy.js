// What a copied service carries over, and what it must not.
//
// Every column the service form can set comes across, so the copy is a real
// starting point rather than a blank row wearing a name. What stays behind is
// anything the database owns: id, created_at, and the salon and category the
// caller decides — a copy always lands where the person doing the copying is
// standing, not where the original happened to live.
const COPIED_COLUMNS = ['name', 'duration_minutes', 'price', 'color', 'sex', 'sort_order']

// " — نسخة" appended, and a number after that if the name is already taken.
//
// A duplicate name is legal in this table, which is exactly why this bothers:
// two identical rows in a list nobody can tell apart is worse than a clumsy
// label, and the receptionist renames it in the dialog a moment later anyway.
export function copyName(original, existingNames, suffix, numbered) {
  const base = `${original}${suffix}`
  const taken = new Set(existingNames || [])
  if (!taken.has(base)) return base

  let n = 2
  while (taken.has(numbered(base, n))) n += 1
  return numbered(base, n)
}

// The row to insert, given the service being copied and where it should land.
//
// is_active is deliberately not copied from the original: a copy is something
// being set up, and starting it live means an archived service can be brought
// back to the price list by an act that never said so. It starts active,
// which is the default for anything new here.
export function serviceCopyPayload(service, { categoryId, salonId, name }) {
  if (!service) return null

  const payload = { name, category_id: categoryId, salon_id: salonId, is_active: true }
  for (const column of COPIED_COLUMNS) {
    if (column === 'name') continue
    if (service[column] !== undefined && service[column] !== null) payload[column] = service[column]
  }
  return payload
}

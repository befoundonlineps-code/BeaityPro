import { indexCategoriesById } from './categoryTypes'
import { visibleCategories } from './categoryVisibility'

// The seven columns of the price matrix, in the order the reference screen
// puts them. These are employee_role values, not a list of their own: the
// column a service sits in is the role that performs it.
export const PRICING_COLUMNS = [
  'stylist',
  'hairdresser',
  'cosmetologist',
  'manicure_professional',
  'pedicure_professional',
  'makeup_artist',
  'masseur',
]

// Which column a category's services belong to.
//
// The same walk as effectiveBusinessType, and for the same reason: a role is
// declared on the root category and inherited by everything under it, so
// "hair colouring" and "kids' haircut" both land in Stylist without either
// one being told. A sub-category may declare its own and win — which is the
// whole of the nails case, where hand care is a manicurist's column and foot
// care is a pedicurist's.
//
// Null all the way up means the category has no column at all. Tanning is
// the one that does: it has no matching role, so its services stay out of
// the matrix entirely and keep being priced from the catalogue screen.
export function resolvePricingRole(category, categoriesById) {
  let current = category
  const seen = new Set()

  while (current) {
    if (current.pricing_role) return current.pricing_role
    if (!current.parent_id || seen.has(current.id)) return null
    seen.add(current.id)
    current = (categoriesById || {})[current.parent_id]
  }

  return null
}

// The root a category belongs to, so every service can be grouped under one
// heading however deep its own folder sits.
function rootOf(category, categoriesById) {
  let current = category
  const seen = new Set()

  while (current && current.parent_id) {
    if (seen.has(current.id)) return current
    seen.add(current.id)
    const parent = (categoriesById || {})[current.parent_id]
    if (!parent) return current
    current = parent
  }

  return current || null
}

function byOrder(a, b) {
  if (a.sort_order !== b.sort_order) return (a.sort_order || 0) - (b.sort_order || 0)
  return (a.name || '').localeCompare(b.name || '', 'ar')
}

// The matrix: one group per root category, each holding the services that
// resolve to a column.
//
// A service with no column is left out rather than shown with seven empty
// cells — a row nothing can be typed into is a row that only raises the
// question of why. Inactive services go too: the matrix is for what is being
// sold, and the catalogue screen is where something comes back to life.
export function buildPricingMatrix({ categories, services }) {
  // Archived folders drop out here, not at the call site: a price nobody can
  // sell at is a row that only invites the question of why it is there.
  const byId = indexCategoriesById(visibleCategories(categories))
  const groups = new Map()

  for (const service of (services || []).filter((s) => s.is_active)) {
    const category = byId[service.category_id]
    if (!category) continue

    const role = resolvePricingRole(category, byId)
    if (!role) continue

    const root = rootOf(category, byId)
    if (!root) continue

    if (!groups.has(root.id)) groups.set(root.id, { root, rows: [] })
    groups.get(root.id).rows.push({ service, role, category })
  }

  return [...groups.values()]
    .sort((a, b) => byOrder(a.root, b.root))
    .map((g) => ({
      ...g,
      rows: g.rows.sort((a, b) => {
        const cat = byOrder(a.category, b.category)
        return cat !== 0 ? cat : byOrder(a.service, b.service)
      }),
    }))
}

// Search narrows to services by name and drops any heading left holding
// none. Category names are not matched, for the same reason as the booking
// picker: typing a folder's name and being handed everything inside it reads
// as a search that ignored what was typed.
export function filterPricingMatrix(groups, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return groups || []

  return (groups || [])
    .map((g) => ({ ...g, rows: g.rows.filter((r) => (r.service.name || '').toLowerCase().includes(q)) }))
    .filter((g) => g.rows.length > 0)
}

// Which of the edited values actually differ from what is stored.
//
// Only these get written. A dialog that saves every row it drew would touch
// two hundred rows to change one, and every one of those writes is a chance
// to fail on a row nobody meant to edit.
export function changedPrices(groups, edits) {
  const changes = []

  for (const group of groups || []) {
    for (const { service } of group.rows) {
      if (!Object.prototype.hasOwnProperty.call(edits || {}, service.id)) continue

      // An emptied cell is not a price of zero. Number('') is 0, so without
      // this a receptionist who clears a cell to retype it and then closes
      // the dialog would have wiped the price instead of leaving it alone.
      const raw = edits[service.id]
      if (typeof raw === 'string' && raw.trim() === '') continue
      if (raw === null || raw === undefined) continue

      const next = Number(raw)
      if (!Number.isFinite(next) || next < 0) continue
      if (next === Number(service.price)) continue
      changes.push({ id: service.id, price: next })
    }
  }

  return changes
}

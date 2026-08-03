import { indexCategoriesById } from './categoryTypes'

// Whether a category is out of circulation — its own flag, or any ancestor's.
//
// Archiving a root has to take its whole subtree with it, and the walk is how
// rather than writing false onto every child: a category that was already
// archived on its own stays archived when the parent comes back, and one that
// was not comes back with it. Copying the flag downwards would lose that
// distinction the moment it was undone.
//
// Same shape as effectiveBusinessType and resolvePricingRole, which is the
// point — the tree answers three questions the same way.
export function isCategoryArchived(category, categoriesById) {
  let current = category
  const seen = new Set()

  while (current) {
    if (current.is_active === false) return true
    if (!current.parent_id || seen.has(current.id)) return false
    seen.add(current.id)
    current = (categoriesById || {})[current.parent_id]
  }

  return false
}

// The categories still in circulation, for the screens that sell rather than
// the one that manages.
//
// The catalogue screen deliberately does not use this: archiving is undone
// from there, and a folder you cannot see is a folder you cannot restore.
export function visibleCategories(categories) {
  const byId = indexCategoriesById(categories)
  return (categories || []).filter((c) => !isCategoryArchived(c, byId))
}

// How many services a folder takes with it — its own and every descendant's.
//
// The number is the whole point of asking before archiving: taking out a root
// with a hundred services under it is a different act from taking out an empty
// one, and the confirmation has no other way to say which this is.
export function countAffectedServices(category, categories, services) {
  if (!category) return 0

  // Widen the set until it stops growing, rather than recursing: the depth is
  // whatever the data happens to be, and a malformed parent chain cannot make
  // this loop forever because ids only ever get added.
  const ids = new Set([category.id])
  let grew = true
  while (grew) {
    grew = false
    for (const c of categories || []) {
      if (!ids.has(c.id) && c.parent_id && ids.has(c.parent_id)) {
        ids.add(c.id)
        grew = true
      }
    }
  }

  return (services || []).filter((s) => ids.has(s.category_id)).length
}

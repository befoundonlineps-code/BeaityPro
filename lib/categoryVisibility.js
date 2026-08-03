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

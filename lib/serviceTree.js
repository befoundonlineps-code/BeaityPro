import { effectiveBusinessType, indexCategoriesById } from './categoryTypes'

export const BUSINESS_TYPES = [
  'hairdressing',
  'barbershop',
  'cosmetology',
  'nails',
  'makeup',
  'massage',
  'tanning',
]

function byOrder(a, b) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
  return (a.name || '').localeCompare(b.name || '', 'ar')
}

// Turns the two flat tables into the root -> sub-category -> service tree,
// keeping only the categories the salon's selected business types cover.
//
// Visibility is decided per category rather than per root, using the
// category's effective type (its own, else its nearest typed ancestor's).
// A category with no typed ancestor is general and always shows. That way a
// mixed folder — say "bridal packages" holding hair, makeup and nail
// sub-categories — shows exactly the sub-categories the salon offers,
// instead of the whole folder living or dying by its root's single type.
export function buildServiceTree(categories, services, selectedTypes) {
  const cats = categories || []
  const svcs = services || []
  const types = selectedTypes || []
  const byId = indexCategoriesById(cats)

  const isVisible = (category) => {
    const type = effectiveBusinessType(category, byId)
    return type === null || types.includes(type)
  }

  const servicesFor = (categoryId) => svcs.filter((s) => s.category_id === categoryId).sort(byOrder)

  // Any depth, not two. This used to build roots and their direct children
  // only, which was true of the seeded catalogue and stopped being true the
  // moment the screen could create a folder inside a folder: a third level
  // was saved correctly and then dropped here, appearing nowhere at all.
  //
  // `seen` is not tidiness. parent_id is a real column and a cycle in it would
  // otherwise recurse until the stack gave out, taking the whole screen with
  // it rather than showing one folder in the wrong place.
  const childrenOf = (parentId, seen) =>
    cats
      .filter((c) => c.parent_id === parentId && isVisible(c) && !seen.has(c.id))
      .sort(byOrder)
      .map((child) => {
        const next = new Set(seen).add(child.id)
        return { ...child, services: servicesFor(child.id), children: childrenOf(child.id, next) }
      })

  return cats
    .filter((c) => !c.parent_id && isVisible(c))
    .sort(byOrder)
    .map((root) => ({
      ...root,
      services: servicesFor(root.id),
      children: childrenOf(root.id, new Set([root.id])),
    }))
}

// Total services under a folder, at every depth beneath it.
export function countServices(node) {
  const own = node.services ? node.services.length : 0
  return (node.children || []).reduce((sum, child) => sum + countServices(child), own)
}

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

  return cats
    .filter((c) => !c.parent_id && isVisible(c))
    .sort(byOrder)
    .map((root) => ({
      ...root,
      services: servicesFor(root.id),
      children: cats
        .filter((c) => c.parent_id === root.id && isVisible(c))
        .sort(byOrder)
        .map((sub) => ({ ...sub, services: servicesFor(sub.id) })),
    }))
}

// Total services under a root, including any hanging directly off it.
export function countServices(root) {
  const own = root.services ? root.services.length : 0
  return (root.children || []).reduce((sum, sub) => sum + sub.services.length, own)
}

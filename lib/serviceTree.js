import { effectiveBusinessType, indexCategoriesById } from './categoryTypes'
import { buildCategoryTree, byOrder, countItems } from './categoryTree'

export const BUSINESS_TYPES = [
  'hairdressing',
  'barbershop',
  'cosmetology',
  'nails',
  'makeup',
  'massage',
  'tanning',
]

// Turns the two flat tables into the root -> sub-category -> service tree,
// keeping only the categories the salon's selected business types cover.
//
// Visibility is decided per category rather than per root, using the
// category's effective type (its own, else its nearest typed ancestor's).
// A category with no typed ancestor is general and always shows. That way a
// mixed folder — say "bridal packages" holding hair, makeup and nail
// sub-categories — shows exactly the sub-categories the salon offers,
// instead of the whole folder living or dying by its root's single type.
//
// The walk itself lives in lib/categoryTree.js, shared with the products
// catalogue: the recursion and the cycle guard have each been wrong once
// already, and one copy is one place to fix them.
export function buildServiceTree(categories, services, selectedTypes) {
  const cats = categories || []
  const svcs = services || []
  const types = selectedTypes || []
  const byId = indexCategoriesById(cats)

  return buildCategoryTree(cats, {
    isVisible: (category) => {
      const type = effectiveBusinessType(category, byId)
      return type === null || types.includes(type)
    },
    itemsFor: (categoryId) => svcs.filter((s) => s.category_id === categoryId).sort(byOrder),
    itemsKey: 'services',
  })
}

// Total services under a folder, at every depth beneath it.
export function countServices(node) {
  return countItems(node, 'services')
}

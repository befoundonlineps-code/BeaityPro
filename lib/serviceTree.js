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
// keeping only the roots whose business type the salon actually selected.
export function buildServiceTree(categories, services, selectedTypes) {
  const cats = categories || []
  const svcs = services || []
  const types = selectedTypes || []

  const servicesFor = (categoryId) => svcs.filter((s) => s.category_id === categoryId).sort(byOrder)

  return cats
    .filter((c) => !c.parent_id && types.includes(c.business_type))
    .sort(byOrder)
    .map((root) => ({
      ...root,
      services: servicesFor(root.id),
      children: cats
        .filter((c) => c.parent_id === root.id)
        .sort(byOrder)
        .map((sub) => ({ ...sub, services: servicesFor(sub.id) })),
    }))
}

// Total services under a root, including any hanging directly off it.
export function countServices(root) {
  const own = root.services ? root.services.length : 0
  return (root.children || []).reduce((sum, sub) => sum + sub.services.length, own)
}

import { buildCategoryTree, byOrder, countItems } from './categoryTree'

// The products catalogue's folders, with each folder's products hanging off
// it. The walk is the one the services catalogue uses (lib/categoryTree.js).
//
// No visibility filter, unlike services. business_type on a service category
// decides who sees it — a nails folder is hidden from a salon that does not do
// nails (ADR-019) — and that question has no meaning for a product: shampoo is
// shampoo whoever is asking. This is the reason there is no business_type
// column on product_categories, and it is worth saying out loud because the
// same column is easy to confuse with accounting_direction, which is on the
// product and is about revenue, not visibility.
export function buildProductTree(categories, products) {
  const items = products || []
  return buildCategoryTree(categories, {
    itemsFor: (categoryId) => items.filter((p) => p.category_id === categoryId).sort(byOrder),
    itemsKey: 'products',
  })
}

// Total products under a folder, at every depth beneath it.
export function countProducts(node) {
  return countItems(node, 'products')
}

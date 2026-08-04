import { buildCategoryTree, byOrder, countItems } from './categoryTree'
import { visibleCategories } from './categoryVisibility'

// The products catalogue's folders, with each folder's products hanging off
// it. The walk is the one the services catalogue uses (lib/categoryTree.js).
//
// No business-type filter, unlike services. business_type on a service
// category decides who sees it — a nails folder is hidden from a salon that
// does not do nails (ADR-019) — and that question has no meaning for a
// product: shampoo is shampoo whoever is asking. This is why there is no
// business_type column on product_categories, and it is worth saying out loud
// because that column is easy to confuse with accounting_direction, which is
// on the product and is about revenue rather than visibility.
//
// hideArchived thins the flat list *before* the walk, and the difference from
// filtering afterwards is smaller than it looks and still real.
//
// It is not that post-filtering would strand children as roots — a folder with
// a parent_id is never a root, so it vanishes with its parent either way. That
// was the first justification written here, and mutation testing proved it
// wrong: swapping to a post-filter passed every test that existed, because
// every one of them put the archived folder at the top level, where the two
// approaches agree.
//
// What actually separates them is an archived folder nested under a live one.
// A filter applied to the result only ever sees roots, so a live root keeps
// its archived child and everything beneath it, in a tree that was asked to
// hide precisely that. Thinning the input catches it wherever it sits, because
// visibleCategories drops a folder whose ancestor is archived even when its
// own is_active is true — the same rule isCategoryArchived resolves by
// climbing.
//
// The rule lives here rather than in the screen so it is the thing under test.
// Inside the component it could only be checked by reading it, which is how
// the wrong justification survived being written down in the first place.
export function buildProductTree(categories, products, { hideArchived = false } = {}) {
  const cats = hideArchived ? visibleCategories(categories) : (categories || [])
  const items = products || []

  return buildCategoryTree(cats, {
    itemsFor: (categoryId) => items.filter((p) => p.category_id === categoryId).sort(byOrder),
    itemsKey: 'products',
  })
}

// Total products under a folder, at every depth beneath it.
export function countProducts(node) {
  return countItems(node, 'products')
}

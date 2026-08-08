import { descendantIds } from './categoryVisibility'
import { buildCategoryTree } from './categoryTree'

// Which products the catalogue is showing, and how they are grouped.
//
// ⚠️ THE FOLDER MEANT TWO DIFFERENT THINGS IN TWO SCREENS. The catalogue filtered
// on `p.category_id === selectedId` — direct children only — while the stocktake
// sheet and the archive dialog both walk `descendantIds`. So choosing «شعر» on
// one screen included «شعر / شامبو» and on the other did not, and nobody could
// tell which answer they were looking at.
//
// It is the same class the storage lens closed one stage ago: one question with
// two answers. The walk is IMPORTED rather than restated, because a second copy
// is a second answer the day one of them learns something.

// The set of category ids in scope, or null for "everything".
//
// ⚠️ null and not "all the ids". A salon whose catalogue is unfiltered should
// show products whose category was deleted or never set as well — and a set
// built from the category list cannot contain an id that is not in it. null
// says "do not narrow", which is a different statement from "narrow to
// everything I could find".
export function catalogueScope(categoryId, categories) {
  if (!categoryId) return null
  const category = (categories || []).find((c) => c.id === categoryId)
  // A folder that no longer exists narrows to nothing rather than to
  // everything, the same way the counting sheet fails closed. Silently widening
  // is worse than an empty list, because the empty list is noticed.
  return category ? descendantIds(category, categories) : new Set()
}

// ⚠️ ONE LIST FEEDING THE TABLE AND THE SEARCH ALIKE.
//
// The search box was always drawn and searched only inside the selected folder
// — and returned nothing at all before one was chosen, because the rows were
// empty by then. So somebody looking for a product whose folder they did not
// know, which is the only reason to search, was told «ما في نتائج» about a
// product that exists. Not silent: a confident wrong answer.
//
// It is fixed by the scope rather than by touching the search, because both
// read this one list.
export function catalogueRows({ products, categories, categoryId, search, hideArchived }) {
  const scope = catalogueScope(categoryId, categories)
  const q = String(search || '').trim().toLowerCase()

  return (products || [])
    .filter((p) => !scope || scope.has(p.category_id))
    .filter((p) => !hideArchived || p.is_active !== false)
    .filter((p) => !q || String(p.name || '').toLowerCase().includes(q))
    .sort(byFolderThenOrder(categories))
}

// The folders in the order the tree on the left draws them: depth first, each
// level by its own sort_order.
//
// ⚠️ MEASURED BY RENDERING, NOT REASONED. The first version compared category
// ids, which is stable and defensible in the counting sheet — and here it put
// the headings «شعر | أظافر | شامبو», with «شامبو» separated from the «شعر» it
// lives inside. On a screen showing that same hierarchy two panes to the left,
// a table that contradicts it is a table the reader has to reconcile.
//
// The walk is buildCategoryTree, the one the pane itself uses. Reading the
// order from the tree rather than re-deriving it means the two cannot disagree.
//
// ⚠️ AND THE GUARANTEE IS AGREEMENT, NOT IMMOBILITY — a first draft of this
// comment claimed renaming a folder moves nothing, which is false. byOrder
// sorts on sort_order and falls back to the NAME when two folders share one,
// which they do by default. So renaming can reorder — and it reorders the tree
// and the table together, in the same direction, because they are one walk.
// That is the property worth having; "nothing moves" was never on offer.
export function categoryOrder(categories) {
  const order = new Map()
  const walk = (nodes) => {
    for (const node of nodes || []) {
      order.set(node.id, order.size)
      walk(node.children)
    }
  }
  walk(buildCategoryTree(categories))
  return order
}

// ⚠️ GROUPS, DOES NOT RANK BY PROBLEM — the rule the counting sheet settled.
// What matters is that a folder's products are ADJACENT so the table can head
// each run; the order between folders now follows the tree, which is the one
// place that order is already decided.
//
// ⚠️ category_id is a tie-break BEFORE sort_order, and only that keeps
// adjacency true for folders the tree does not know: two products in two
// different deleted folders both score Infinity, and without this they would
// interleave with each other — producing two runs the grouping cannot merge and
// a heading repeated for no reason.
function byFolderThenOrder(categories) {
  const order = categoryOrder(categories)
  const rank = (id) => (order.has(id) ? order.get(id) : Infinity)
  return (a, b) => {
    const byFolder = rank(a.category_id) - rank(b.category_id)
    if (byFolder !== 0 && Number.isFinite(byFolder)) return byFolder
    const byId = String(a.category_id || '').localeCompare(String(b.category_id || ''))
    if (byId !== 0) return byId
    const byOrder = (a.sort_order || 0) - (b.sort_order || 0)
    if (byOrder !== 0) return byOrder
    return String(a.name || '').localeCompare(String(b.name || ''), 'ar')
  }
}

// The rows in runs, each run carrying the folder it belongs to.
//
// ⚠️ A PRODUCT WHOSE FOLDER IS UNKNOWN KEEPS ITS ROW. The form requires a
// category, so this should not happen — and "should not happen" is exactly the
// condition under which dropping a row is invisible. A catalogue that silently
// omits a product is a catalogue somebody re-creates the product in.
export function catalogueGroups(rows, categories) {
  const groups = []
  for (const product of rows || []) {
    const last = groups[groups.length - 1]
    if (last && last.categoryId === product.category_id) {
      last.products.push(product)
      continue
    }
    const category = (categories || []).find((c) => c.id === product.category_id) || null
    groups.push({ categoryId: product.category_id || null, category, products: [product] })
  }
  return groups
}

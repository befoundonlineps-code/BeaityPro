// Turning a flat table of folders — anything with an id, a parent_id, a name
// and a sort_order — into the nested tree a two-pane screen draws.
//
// Extracted from lib/serviceTree.js when the products catalogue needed the
// same walk. What it carries is the part that has already been wrong twice:
// the recursion that has to go to any depth rather than two, and the guard
// that survives a cycle in parent_id instead of recursing until the stack
// gives out. Copying either into a second module would have been a second
// chance to get them wrong, in a file nobody would think to check.
export function byOrder(a, b) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
  return (a.name || '').localeCompare(b.name || '', 'ar')
}

// isVisible decides which folders survive at all — the services catalogue
// filters by the salon's business types, the products catalogue filters by
// nothing. itemsFor hangs each folder's own rows off it under itemsKey.
export function buildCategoryTree(categories, options = {}) {
  const cats = categories || []
  const { isVisible = () => true, itemsFor = () => [], itemsKey = 'items' } = options

  // Any depth, not two. This used to build roots and their direct children
  // only, which was true of the seeded catalogue and stopped being true the
  // moment a screen could create a folder inside a folder: a third level was
  // saved correctly and then dropped here, appearing nowhere at all.
  //
  // `seen` cannot fire *here*, and the comment it replaces claimed it stopped
  // the stack from giving out on a cycle in parent_id. Measured: not in this
  // walk. This one descends from folders with no parent, and every folder
  // inside a cycle has a parent pointing back into the cycle, so no cycle is
  // ever entered. What a cycle does here is quieter and worse — the whole
  // branch is simply absent, with nothing on screen to say why.
  //
  // ⚠️ Read that as narrowly as it is written. It is a fact about descending
  // from roots, NOT about cycles in general, and the difference is a real
  // guard somewhere else: isCategoryArchived in lib/categoryVisibility.js
  // climbs the parent chain *upwards*, and it starts from whatever category
  // it is handed rather than from a root. A category whose ancestors enter a
  // cycle is an ordinary category — measured, that walk spins forever without
  // its own `seen`. Do not carry this conclusion over there and delete it.
  //
  // This one stays anyway, cheap and inert, because the day the root rule
  // widens — "a folder whose parent is missing is also a root" is the obvious
  // next step — a cycle becomes reachable in that same edit, and the guard is
  // already here. What changed is the claim, not the code.
  const childrenOf = (parentId, seen) =>
    cats
      .filter((c) => c.parent_id === parentId && isVisible(c) && !seen.has(c.id))
      .sort(byOrder)
      .map((child) => {
        const next = new Set(seen).add(child.id)
        return { ...child, [itemsKey]: itemsFor(child.id), children: childrenOf(child.id, next) }
      })

  return cats
    .filter((c) => !c.parent_id && isVisible(c))
    .sort(byOrder)
    .map((root) => ({
      ...root,
      [itemsKey]: itemsFor(root.id),
      children: childrenOf(root.id, new Set([root.id])),
    }))
}

// Total rows under a folder, at every depth beneath it.
export function countItems(node, itemsKey = 'items') {
  const own = node[itemsKey] ? node[itemsKey].length : 0
  return (node.children || []).reduce((sum, child) => sum + countItems(child, itemsKey), own)
}

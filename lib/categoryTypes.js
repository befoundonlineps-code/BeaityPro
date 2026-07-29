// A category's business type is whatever it declares itself, or — when it
// declares none — the one belonging to its nearest ancestor that does.
// A category with no typed ancestor at all is "general": it isn't tied to
// any single business type, so it stays visible to every role.
//
// This is what lets a folder mix categories from different types, e.g. a
// "bridal packages" root holding hair, makeup and nail sub-categories, each
// resolving to its own type instead of inheriting one from the root.
export function effectiveBusinessType(category, categoriesById) {
  let current = category
  const seen = new Set()

  while (current) {
    if (current.business_type) return current.business_type
    // Guard against a malformed parent chain looping forever.
    if (!current.parent_id || seen.has(current.id)) return null
    seen.add(current.id)
    current = (categoriesById || {})[current.parent_id]
  }

  return null
}

export function indexCategoriesById(categories) {
  return Object.fromEntries((categories || []).map((c) => [c.id, c]))
}

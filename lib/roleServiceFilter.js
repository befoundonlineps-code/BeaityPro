// The set of business_type values a role is allowed to perform.
export function businessTypesForRole(role, roleBusinessTypes) {
  return new Set((roleBusinessTypes || []).filter((r) => r.role === role).map((r) => r.business_type))
}

// Narrows `services` (each carrying category_id) down to the ones whose
// root category's business_type the given role covers. No role selected
// yet -> everything is shown, unfiltered; a role with zero linked
// categories (administrator, executive, ...) -> nothing is shown.
export function servicesForRole(role, services, categories, roleBusinessTypes) {
  if (!role) return services || []

  const allowedTypes = businessTypesForRole(role, roleBusinessTypes)
  if (allowedTypes.size === 0) return []

  const categoryById = Object.fromEntries((categories || []).map((c) => [c.id, c]))
  return (services || []).filter((s) => {
    const category = categoryById[s.category_id]
    return category && allowedTypes.has(category.business_type)
  })
}

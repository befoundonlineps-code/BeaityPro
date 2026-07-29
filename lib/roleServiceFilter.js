import { effectiveBusinessType, indexCategoriesById } from './categoryTypes'

// The set of business_type values a role is allowed to perform.
export function businessTypesForRole(role, roleBusinessTypes) {
  return new Set((roleBusinessTypes || []).filter((r) => r.role === role).map((r) => r.business_type))
}

// Narrows `services` down to the ones the given role can perform, matching
// each service's category against the role's business types. The category's
// type is its effective one — its own, else its nearest typed ancestor's —
// so a service sitting under an untyped folder still resolves correctly.
//
// No role selected yet -> everything is shown, unfiltered. A service whose
// category has no typed ancestor at all is general and stays available to
// every role, including ones with no linked categories.
export function servicesForRole(role, services, categories, roleBusinessTypes) {
  if (!role) return services || []

  const allowedTypes = businessTypesForRole(role, roleBusinessTypes)
  const byId = indexCategoriesById(categories)

  return (services || []).filter((s) => {
    const category = byId[s.category_id]
    if (!category) return false
    const type = effectiveBusinessType(category, byId)
    if (type === null) return true
    return allowedTypes.has(type)
  })
}

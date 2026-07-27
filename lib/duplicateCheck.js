export function getDuplicateWarningMessage(matches) {
  if (!matches || matches.length === 0) return null
  return `${matches[0].first_name} ${matches[0].last_name}`
}

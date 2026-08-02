const PALETTE = ['#2E5AAC', '#C2410C', '#0F766E', '#9333EA', '#B91C1C', '#0369A1', '#65A30D', '#BE185D']

export function getAvatarColor(seed) {
  const str = String(seed || '')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

// Initials from a single name field.
//
// Employees are stored as one `name`, not a first and last pair, so the split
// happens here rather than at each call site guessing where the surname
// starts. Anything past the first two words is ignored: a circle 24px across
// holds two letters and no more.
export function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return getInitials(parts[0], parts[1])
}

export function getInitials(firstName, lastName) {
  const a = (firstName || '').trim().charAt(0)
  const b = (lastName || '').trim().charAt(0)
  return (a + b).toUpperCase() || '?'
}

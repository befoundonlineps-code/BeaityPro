const PALETTE = ['#2E5AAC', '#C2410C', '#0F766E', '#9333EA', '#B91C1C', '#0369A1', '#65A30D', '#BE185D']

export function getAvatarColor(seed) {
  const str = String(seed || '')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

export function getInitials(firstName, lastName) {
  const a = (firstName || '').trim().charAt(0)
  const b = (lastName || '').trim().charAt(0)
  return (a + b).toUpperCase() || '?'
}

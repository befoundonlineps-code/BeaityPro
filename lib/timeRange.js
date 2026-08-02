// "10:44 – 11:29" from the two ends of anything that has two ends.
//
// Every dialog in the appointments module used to carry its own four-line
// copy of this, which is how five of them ended up painting the range
// backwards and nobody noticed: there was no single place the question
// "how do we print a range?" could be asked, so there was no single place to
// answer it.
//
// Twenty-four hour, like the calendar's own rail (08:00 … 22:00) and like
// every other clock in this codebase. No AM/PM marker is needed at that
// width and none is printed.

function at(value) {
  if (value === null || value === undefined) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Both ends or nothing. A waiting-list entry has neither, and a half-drawn
// range is worse than no range at all — it reads as a start with a missing
// end rather than as an entry that was never scheduled.
//
// Local time throughout, deliberately: these are the same Date values the
// calendar positions its blocks from, so a label and a position can never
// disagree about which hour a booking is in.
export function formatTimeRange(start, end, separator = ' – ') {
  const from = at(start)
  const to = at(end)
  if (!from || !to) return null
  return `${from}${separator}${to}`
}

// The one-line answer to "when is this person in today?", for a button that
// has to say it without opening anything.
//
// Built from the windows the calendar has already worked out, so the
// recurring pattern, the dated shift exceptions and the absence veto are all
// folded in: somebody marked off has no windows, and gets `null` here rather
// than a range that would contradict their own column.

function timeLabel(hhmm, locale) {
  const [hours, minutes] = String(hhmm).split(':').map(Number)
  const d = new Date(2000, 0, 1, hours, minutes)
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

// One window becomes "9:00 – 6:00 PM"; a split shift keeps both halves rather
// than collapsing to first-start and last-end, which would claim the gap in
// the middle is working time.
//
// Returns null when there are no windows at all. That is a different
// statement from "0:00 – 0:00" and the caller renders it as its own label,
// not as an empty range.
export function shiftSummary(windows, locale, separator = ' – ', between = '، ') {
  const list = windows || []
  if (list.length === 0) return null
  return list
    .map((w) => `${timeLabel(w.startTime, locale)}${separator}${timeLabel(w.endTime, locale)}`)
    .join(between)
}

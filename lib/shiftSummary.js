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
// The twelve-hour clock and the ص/م marker are deliberate here, and the only
// place in the app that has them. Everything else prints twenty-four hour
// through components/TimeRange.js, because a calendar grid is an operational
// instrument. This is a sentence a person reads once — "دوامك ٩ صباحًا لـ٦
// مساءً" lands faster than "09:00 – 18:00" — so the two formats each suit
// their own context and consistency is not the goal.
//
// Two consequences, both measured, both easy to undo by accident: the ص/م
// make this an Arabic line, so it already paints right to left correctly and
// an ltr isolate would garble it; and lib/timeRangeDirection.test.js lists
// this line as the one range that is knowingly left alone.
//
// The attribute is spelled out nowhere above on purpose — that guard reads
// raw text, so naming it in prose here would register as a seventh isolate.
export function shiftSummary(windows, locale, separator = ' – ', between = '، ') {
  const list = windows || []
  if (list.length === 0) return null
  return list
    .map((w) => `${timeLabel(w.startTime, locale)}${separator}${timeLabel(w.endTime, locale)}`)
    .join(between)
}

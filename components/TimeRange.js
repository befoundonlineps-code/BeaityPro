import { formatTimeRange } from '../lib/timeRange'

// The only thing in the app allowed to print a range of clock times.
//
// Not because printing one is hard, but because it carries a rule that is
// invisible at the call site and impossible to catch by reading a value:
// European digits either side of a neutral dash get their two halves swapped
// on a right-to-left page, so "10:44 – 11:29" is stored, is in the DOM, and
// reaches the eye as "11:29 – 10:44". Six separate call sites each got this
// wrong, and the seventh would have too. Now there is one.
//
// The isolate only ever sits on an inline element. On a block it would
// resolve `text-align: start` against ltr and drag the range to the far
// edge, away from whatever it belongs under — which is why `block` wraps in
// a plain div and keeps dir on the span inside it.
//
// It does not apply to Arabic-Indic digits, which are a different bidi class
// and never adopt their parent's direction; nothing here produces them, and
// lib/localePinned.test.js is what keeps that true.
export default function TimeRange({ start, end, separator, className, block = false }) {
  const label = formatTimeRange(start, end, separator)
  if (!label) return null

  if (block) {
    return (
      <div className={className}>
        <span dir="ltr">{label}</span>
      </div>
    )
  }
  return <span dir="ltr" className={className}>{label}</span>
}

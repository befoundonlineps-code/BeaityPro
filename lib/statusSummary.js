// The day's standing, counted once: how many bookings are confirmed, waiting
// on approval, running right now, done, cancelled, or never turned up.
//
// Counted off the rows the calendar has already fetched for the day, which
// are the whole salon's — filtering to one professional happens later, when
// columns are drawn. So the bar reads the salon whatever the board is
// narrowed to, without a query of its own.

export const CONFIRMED = 'confirmed'
export const PENDING = 'pending'
export const IN_PROGRESS = 'inProgress'
export const COMPLETED = 'completed'
export const CANCELLED = 'cancelled'
export const NO_SHOW = 'noShow'

// The order they are shown in: a booking's life from agreed, through
// happening, to over — then the two ways it can end badly.
export const SUMMARY_KEYS = [CONFIRMED, PENDING, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW]

// A session under way right now.
//
// Not a stored status — nothing writes "in progress" anywhere. It is the same
// question the actions dialog asks before offering to record a real end:
// booked, started, and not yet due to finish.
export function isInProgress(appointment, now) {
  if (!appointment || appointment.status !== 'booked') return false
  const start = new Date(appointment.start_time)
  const end = new Date(appointment.end_time)
  return start <= now && end > now
}

// How far through a running session we are, or null when it is not running.
//
// Built on isInProgress rather than beside it, so "is this happening now" has
// one answer in the whole codebase — the summary bar and the block on the
// grid can never disagree about which sessions are under way.
//
// Worked out at render from whatever `now` the caller holds. Nothing here
// ticks: the calendar already refreshes `now` on its own for the current-time
// line, and the figure rides along with that rather than starting a second
// clock for a number nobody reads to the second.
export function sessionProgress(appointment, now) {
  if (!isInProgress(appointment, now)) return null

  const start = new Date(appointment.start_time)
  const end = new Date(appointment.end_time)
  const totalMinutes = Math.round((end - start) / 60000)
  if (totalMinutes <= 0) return null

  // Clamped because a session is never less than begun or more than whole:
  // isInProgress already put `now` inside the window, and this keeps a bar
  // width honest if it ever does not.
  const elapsedMinutes = Math.min(Math.max(Math.round((now - start) / 60000), 0), totalMinutes)

  return { elapsedMinutes, totalMinutes, ratio: elapsedMinutes / totalMinutes }
}

// Which bucket a row belongs to, or null when it belongs in none.
//
// `rescheduled` and `adjusted` are history: each was replaced by a new row
// that carries the booking forward, and superseded_by_id points at it. The
// replacement is what gets counted, in whatever state it is now — counting
// both would report a booking twice for having been moved.
export function bucketFor(appointment, now) {
  switch (appointment?.status) {
    case 'booked':
      // Confirmed and in-progress are deliberately disjoint, so the six
      // buckets add up to the total rather than overlapping in the middle.
      return isInProgress(appointment, now) ? IN_PROGRESS : CONFIRMED
    case 'pending_approval':
      return PENDING
    case 'completed':
      return COMPLETED
    case 'cancelled':
      return CANCELLED
    case 'no_show':
      return NO_SHOW
    default:
      return null
  }
}

// Counts per bucket plus the total, from a day's rows.
//
// Only primaries are counted. A row per professional is how the database
// holds a session worked by two people, but "eleven appointments today" means
// eleven clients coming in, not thirteen pairs of hands — a four-hands
// massage is one appointment to everybody who says the word.
export function summariseDay(appointments, now) {
  const counts = Object.fromEntries(SUMMARY_KEYS.map((k) => [k, 0]))
  let total = 0

  for (const a of appointments || []) {
    if (a.is_primary === false) continue
    const bucket = bucketFor(a, now)
    if (!bucket) continue
    counts[bucket] += 1
    total += 1
  }

  return { counts, total }
}

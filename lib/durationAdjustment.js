// Adjusting when a running session actually ended — longer than planned, or
// cut short by something that went wrong.
//
// Deliberately does NOT reuse resolvePlacementWindow: that helper refuses
// any start already in the past, which is the whole point of the past-time
// guard for *new* bookings. An adjustment is always about a session that
// began in the past, so running it through that guard would refuse every
// single adjustment. The start here is never in question — it comes from
// the appointment itself and is left untouched.

function sameCalendarDay(a, b) {
  return a.toDateString() === b.toDateString()
}

// Turns the "HH:MM" a receptionist types into the actual new end instant.
//
// The typed time is read against the session's own day. Landing at or
// before the start only makes sense for a session that already runs past
// midnight — for any ordinary session it means the typed time simply comes
// before the session began, which is a mistake rather than a next-day end.
export function resolveAdjustedEnd(start, currentEnd, timeValue) {
  if (!start || !currentEnd || !timeValue) return null

  const [hours, minutes] = String(timeValue).split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null

  const candidate = new Date(start)
  candidate.setHours(hours, minutes, 0, 0)
  if (candidate > start) return candidate

  if (sameCalendarDay(start, currentEnd)) return null // typed before the session began

  const nextDay = new Date(candidate)
  nextDay.setDate(nextDay.getDate() + 1)
  return nextDay
}

// What kind of adjustment this is, and whether anything needs checking.
//
// Shortening strictly hands time back, so nothing can be in the way and no
// round-trip is needed. Extending reaches into time nobody has cleared yet,
// so it goes through the same availability rules as any other booking.
export function planDurationAdjustment({ start, currentEnd, newEnd }) {
  if (!newEnd) return { ok: false, reason: 'invalidEnd' }
  if (newEnd <= start) return { ok: false, reason: 'endBeforeStart' }
  if (newEnd.getTime() === currentEnd.getTime()) return { ok: false, reason: 'noChange' }

  const extending = newEnd > currentEnd
  return {
    ok: true,
    direction: extending ? 'extend' : 'shorten',
    needsAvailabilityCheck: extending,
    minutes: Math.round((newEnd - start) / 60000),
  }
}

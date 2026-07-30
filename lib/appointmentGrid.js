export const GRID_START_HOUR = 8
export const GRID_END_HOUR = 22
export const SLOT_MINUTES = 30

export function totalGridMinutes() {
  return (GRID_END_HOUR - GRID_START_HOUR) * 60
}

// "HH:MM" for a given offset from GRID_START_HOUR, e.g. 90 -> "09:30".
export function minutesToLabel(minutesFromStart) {
  const hour = GRID_START_HOUR + Math.floor(minutesFromStart / 60)
  const minute = minutesFromStart % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// One entry per row of the calendar: { minutesFromStart, label }.
export function buildTimeSlots() {
  const slots = []
  for (let m = 0; m < totalGridMinutes(); m += SLOT_MINUTES) {
    slots.push({ minutesFromStart: m, label: minutesToLabel(m) })
  }
  return slots
}

// Builds the Date for a given day (YYYY-MM-DD) at GRID_START_HOUR + an offset.
export function slotStartTime(dateISO, minutesFromStart) {
  const d = new Date(`${dateISO}T00:00:00`)
  d.setHours(GRID_START_HOUR, minutesFromStart, 0, 0)
  return d
}

// Minutes between GRID_START_HOUR (on `date`'s own day) and `date` itself.
// Negative or beyond totalGridMinutes() means outside the visible grid.
export function minutesFromGridStart(date) {
  const gridStart = new Date(date)
  gridStart.setHours(GRID_START_HOUR, 0, 0, 0)
  return (date.getTime() - gridStart.getTime()) / 60000
}

export function isWithinGrid(minutes) {
  return minutes >= 0 && minutes <= totalGridMinutes()
}

// Rounds up to the next whole minute. Rounding down would place a start a
// few seconds behind the moment it was created — the very thing the
// past-time rule exists to prevent.
export function ceilToMinute(date) {
  const d = new Date(date)
  if (d.getSeconds() === 0 && d.getMilliseconds() === 0) return d
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() + 1)
  return d
}

// End of the grid slot containing `date`. Slots are SLOT_MINUTES long and
// aligned to the hour, so boundaries land on :00 and :30.
export function slotEndContaining(date) {
  const d = new Date(date)
  d.setSeconds(0, 0)
  const boundary = Math.floor(d.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES + SLOT_MINUTES
  d.setMinutes(boundary) // 60 rolls into the next hour
  return d
}

// A slot is closed once its whole span is behind us.
export function isSlotPast(slotEnd, now) {
  return slotEnd <= now
}

// When a booking actually starts. A slot still running keeps its place but
// starts from this instant rather than from the displayed slot boundary, so
// the recorded duration matches the session actually delivered. Returns null
// when the containing slot has already finished, which callers treat as a
// refusal rather than a clamp.
export function resolveBookingStart(requestedStart, now) {
  if (isSlotPast(slotEndContaining(requestedStart), now)) return null
  if (requestedStart >= now) return requestedStart
  return ceilToMinute(now)
}

// Where a dragged booking should land, in minutes from the top of the grid.
//
// The pointer is not the booking's start: it sits wherever inside the block
// it happened to be grabbed, so that offset comes off first. Without it,
// grabbing the middle of a two-hour block and dropping would shove the
// booking an hour further than it was actually dragged.
//
// The result snaps to the nearest slot boundary, and is held back far
// enough that the whole booking still fits on the grid — a booking dragged
// past the bottom edge lands flush against it rather than hanging off.
export function dropTargetMinutes({ pointerOffsetY, grabOffsetY, rowHeight, durationMinutes }) {
  const pixelsPerMinute = rowHeight / SLOT_MINUTES
  const raw = (pointerOffsetY - grabOffsetY) / pixelsPerMinute
  const snapped = Math.round(raw / SLOT_MINUTES) * SLOT_MINUTES
  const latest = Math.max(totalGridMinutes() - durationMinutes, 0)
  return Math.min(Math.max(snapped, 0), latest)
}

// The statuses that actually hold a slot. This mirrors the WHERE clause of
// both exclusion constraints in the database (appointments_no_overlap and
// appointments_resource_no_overlap) and is the single place the rule is
// written on this side — every query filter and every in-memory check reads
// it, so the two can't drift apart.
//
// A pending booking holds its time as firmly as a confirmed one: it is a
// real commitment awaiting a yes, and nobody else may take that slot
// meanwhile. Cancelled, no-show and waiting rows hold nothing, which is why
// cancelling frees the time the instant it happens.
export const OCCUPYING_STATUSES = ['booked', 'completed', 'pending_approval']

export function occupiesSlot(status) {
  return OCCUPYING_STATUSES.includes(status)
}

export function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA
}

// True if [candidateStart, candidateEnd) overlaps any slot-holding
// appointment already in `existingAppointments` (rows with start_time /
// end_time / status / id).
export function hasConflict(candidateStart, candidateEnd, existingAppointments, excludeId) {
  return (existingAppointments || []).some((a) => {
    if (excludeId && a.id === excludeId) return false
    if (!occupiesSlot(a.status)) return false
    if (!a.start_time || !a.end_time) return false
    return rangesOverlap(candidateStart, candidateEnd, new Date(a.start_time), new Date(a.end_time))
  })
}

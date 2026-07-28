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

export function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA
}

// True if [candidateStart, candidateEnd) overlaps any booked/completed
// appointment already in `existingAppointments` (rows with start_time /
// end_time / status / id). Waiting-list, cancelled and no-show rows never
// occupy a slot, matching the DB exclusion constraint's own WHERE clause.
export function hasConflict(candidateStart, candidateEnd, existingAppointments, excludeId) {
  return (existingAppointments || []).some((a) => {
    if (excludeId && a.id === excludeId) return false
    if (a.status !== 'booked' && a.status !== 'completed') return false
    if (!a.start_time || !a.end_time) return false
    return rangesOverlap(candidateStart, candidateEnd, new Date(a.start_time), new Date(a.end_time))
  })
}

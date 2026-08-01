// Minutes of setup time a confirmation grants before the booking itself.
// The employee is coming in outside her shift, so the shift has to open a
// little earlier than the client arrives — not later.
export const PREP_MINUTES = 10

function toDateKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toTimeKey(date) {
  const d = new Date(date)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

// Given an employee's schedule row + its slots (raw DB rows, may be
// undefined/null if the employee has no schedule at all) and a target
// Date, returns the { startTime, endTime } ("HH:MM") window the recurring
// pattern puts them on that specific calendar day, or null if the pattern
// doesn't work at all that day — no schedule row, a day off, or before the
// schedule's starts_on anchor all collapse to the same "not available"
// result.
//
// This is the repeating pattern only. Dated exceptions are added on top by
// availableWindowsForDate.
export function recurringWindowForDate(schedule, slots, date) {
  if (!schedule) return null

  let slotKey
  if (schedule.pattern_type === 'weekly') {
    slotKey = String(date.getDay())
  } else {
    const start = new Date(`${schedule.starts_on}T00:00:00`)
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const daysSince = Math.round((dayStart.getTime() - start.getTime()) / 86400000)
    if (daysSince < 0) return null

    if (schedule.pattern_type === 'even_odd') {
      slotKey = daysSince % 2 === 0 ? 'even' : 'odd'
    } else if (schedule.pattern_type === 'cycle') {
      const cycleLen = schedule.cycle_length_days
      const pos = ((daysSince % cycleLen) + cycleLen) % cycleLen
      if (pos >= schedule.work_days_count) return null
      slotKey = 'work'
    } else {
      return null
    }
  }

  const slot = (slots || []).find((s) => s.slot_key === slotKey)
  if (!slot || !slot.is_active) return null
  return { startTime: slot.start_time.slice(0, 5), endTime: slot.end_time.slice(0, 5) }
}

// Merges windows that overlap or merely touch, and leaves a real gap alone.
// Both halves matter: without merging, a booking straddling the seam between
// a shift and the exception that extends it would be read as outside both;
// with gaps merged, confirming an early-morning booking and a late-evening
// one would wrongly declare the whole day open.
function mergeWindows(windows) {
  const sorted = (windows || []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime))
  const merged = []
  for (const w of sorted) {
    const last = merged[merged.length - 1]
    if (last && w.startTime <= last.endTime) {
      if (w.endTime > last.endTime) last.endTime = w.endTime
    } else {
      merged.push({ ...w })
    }
  }
  return merged
}

// Is this employee recorded absent on that calendar day?
//
// Rows come from employee_absences, one per absent day, and their mere
// existence is the statement — there is no "present" row to look for.
export function isAbsentOn(absences, date) {
  const dateKey = toDateKey(date)
  return (absences || []).some((a) => a.absence_date === dateKey)
}

// Every window an employee is available on a given day: the recurring
// pattern plus any dated exception rows for that exact date. Exceptions are
// additive — each one was opened by confirming a single out-of-hours booking
// — and they never alter the recurring pattern itself.
//
// An absence is the one thing here that subtracts, and it subtracts
// everything. It is applied as a veto over the finished answer rather than
// as another entry in the list, because the two are opposite operations and
// mixing them would let a shift exception argue with an absence — a booking
// confirmed out-of-hours last week would keep a window open on a day the
// employee is off. Nothing that adds can outvote the fact that she is not
// coming in.
export function availableWindowsForDate(schedule, slots, exceptions, date, absences) {
  if (isAbsentOn(absences, date)) return []

  const windows = []
  const recurring = recurringWindowForDate(schedule, slots, date)
  if (recurring) windows.push(recurring)

  const dateKey = toDateKey(date)
  for (const e of exceptions || []) {
    if (e.exception_date !== dateKey) continue
    windows.push({ startTime: e.start_time.slice(0, 5), endTime: e.end_time.slice(0, 5) })
  }

  return mergeWindows(windows)
}

// Is the ["HH:MM", "HH:MM") candidate range fully inside `window`?
export function isWithinWindow(window, startTimeHHMM, endTimeHHMM) {
  if (!window) return false
  return startTimeHHMM >= window.startTime && endTimeHHMM <= window.endTime
}

// Same question against a whole day's windows. Since availableWindowsForDate
// merges anything contiguous, a range that fits in the union always fits in
// one of these entries.
export function isWithinAnyWindow(windows, startTimeHHMM, endTimeHHMM) {
  return (windows || []).some((w) => isWithinWindow(w, startTimeHHMM, endTimeHHMM))
}

// The exception a confirmation writes: the booking's own span widened by
// PREP_MINUTES at the front, for that one calendar day.
//
// Both ends are clamped inside the day. Backing into the previous day or
// spilling into the next one would produce end_time <= start_time, which the
// table rejects outright — and a shift exception is a statement about one
// day by definition.
export function exceptionWindowFor(start, end) {
  const withPrep = new Date(start.getTime() - PREP_MINUTES * 60000)
  const dayStart = new Date(start)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(start)
  dayEnd.setHours(23, 59, 59, 0)

  return {
    date: toDateKey(start),
    startTime: toTimeKey(withPrep < dayStart ? dayStart : withPrep),
    endTime: toTimeKey(end > dayEnd ? dayEnd : end),
  }
}

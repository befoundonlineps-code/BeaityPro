// Given an employee's schedule row + its slots (raw DB rows, may be
// undefined/null if the employee has no schedule at all) and a target
// Date, returns the { startTime, endTime } ("HH:MM") window the employee
// works that specific calendar day, or null if they don't work at all
// that day — no schedule row, a day off, or before the schedule's
// starts_on anchor all collapse to the same "not available" result.
export function availableWindowForDate(schedule, slots, date) {
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

// Is the ["HH:MM", "HH:MM") candidate range fully inside `window`?
export function isWithinWindow(window, startTimeHHMM, endTimeHHMM) {
  if (!window) return false
  return startTimeHHMM >= window.startTime && endTimeHHMM <= window.endTime
}

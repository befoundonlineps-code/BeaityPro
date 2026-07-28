export const SCHEDULE_PATTERNS = ['weekly', 'even_odd', 'cycle']

const WEEKLY_KEYS = ['0', '1', '2', '3', '4', '5', '6']
const EVEN_ODD_KEYS = ['even', 'odd']
const CYCLE_KEY = 'work'

function keysForPattern(pattern) {
  if (pattern === 'weekly') return WEEKLY_KEYS
  if (pattern === 'even_odd') return EVEN_ODD_KEYS
  return [CYCLE_KEY]
}

// The default shape a pattern gets when it has no saved slots yet
// (a brand new employee, or switching pattern away from what was saved).
export function defaultSlotsForPattern(pattern) {
  return keysForPattern(pattern).map((slotKey) => ({
    slotKey,
    isActive: true,
    startTime: '09:00',
    endTime: '18:00',
  }))
}

// Maps raw employee_schedule_slots rows onto the slot shape a pattern
// expects, falling back to the default for any slot that has no row yet.
export function slotsFromRows(pattern, rows) {
  const byKey = Object.fromEntries((rows || []).map((r) => [r.slot_key, r]))
  return keysForPattern(pattern).map((slotKey) => {
    const row = byKey[slotKey]
    if (!row) return { slotKey, isActive: true, startTime: '09:00', endTime: '18:00' }
    return {
      slotKey,
      isActive: row.is_active,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
    }
  })
}

// Errors keyed by slotKey, for any active slot whose end time isn't after its start time.
export function validateSlots(slots) {
  const errors = {}
  for (const s of slots) {
    if (s.isActive && s.endTime <= s.startTime) errors[s.slotKey] = true
  }
  return errors
}

// Cycle-pattern fields live on the parent schedule row, not on a slot,
// so they get their own validator: whole positive numbers, and a
// working stretch that can't be longer than the cycle itself.
export function validateCycleFields(workDaysCount, cycleLengthDays) {
  const work = Number(workDaysCount)
  const cycle = Number(cycleLengthDays)
  if (!Number.isInteger(work) || work <= 0) return 'workDaysInvalid'
  if (!Number.isInteger(cycle) || cycle <= 0) return 'cycleLengthInvalid'
  if (work >= cycle) return 'workDaysExceedsCycle'
  return null
}

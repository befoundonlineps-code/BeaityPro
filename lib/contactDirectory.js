// Who the receptionist can ring right now, in one list.
//
// Two very different sources end up looking the same here: professionals
// working today, read off the windows the calendar already worked out, and
// fixed contacts who have no shift at all. Keeping the merge in one tested
// place is what stops the panel growing its own idea of "on shift" beside the
// calendar's.

import { isOnShift } from './calendarView'

export const SOURCE_EMPLOYEE = 'employee'
export const SOURCE_CONTACT = 'contact'

// Professionals whose day has any window at all.
//
// Deliberately the same test the view menu's "on shift" uses, on the same
// pre-computed windows: the recurring pattern, the dated exceptions, the
// hand-set hours and the absence veto are all already folded in, so somebody
// marked off today drops out without this knowing absences exist.
export function onShiftEntries(employees, windowsByEmployee) {
  return (employees || [])
    .filter((e) => isOnShift((windowsByEmployee || {})[e.id]))
    .map((e) => ({
      key: `employee:${e.id}`,
      source: SOURCE_EMPLOYEE,
      name: e.name,
      phone: e.phone_number || null,
      role: e.role || null,
    }))
}

export function contactEntries(contacts) {
  return (contacts || []).map((c) => ({
    key: `contact:${c.id}`,
    source: SOURCE_CONTACT,
    name: c.name,
    phone: c.phone_number || null,
    role: null,
  }))
}

// Matches a name or a number, so "the woman whose number ends 442" is findable
// without remembering how her name is spelled. Digits are compared with the
// punctuation stripped: a number saved as 059-123-4567 has to answer to
// 0591234567, which is how anybody actually types a phone number.
export function matchesQuery(entry, query) {
  const q = String(query || '').trim()
  if (!q) return true
  if (String(entry.name || '').toLowerCase().includes(q.toLowerCase())) return true
  const digits = (value) => String(value || '').replace(/\D/g, '')
  const qDigits = digits(q)
  return qDigits.length > 0 && digits(entry.phone).includes(qDigits)
}

// The whole directory: everyone on shift, then the fixed contacts, filtered.
//
// Professionals come first because the panel exists for the day in progress —
// the owner's number does not change, and the roster does.
export function buildDirectory({ employees, windowsByEmployee, contacts, query }) {
  return [...onShiftEntries(employees, windowsByEmployee), ...contactEntries(contacts)]
    .filter((entry) => matchesQuery(entry, query))
}

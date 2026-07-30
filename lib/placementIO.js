import { supabase } from './supabaseClient'
import { OCCUPYING_STATUSES } from './appointmentGrid'
import { conflictKind } from './resourceAllocation'

// The database half of placing a booking, kept beside the pure half in
// bookingPlacement.js. Booking, dragging and rescheduling all need exactly
// these two round-trips and exactly this retry behaviour, so none of it is
// written down three times.

// Rows that might occupy [start, end): the employee's own, and every row
// holding a resource unit. Both filters only narrow what gets fetched —
// whether a row actually occupies the window is decided by the pure layer,
// so the half-open rule never gets restated in query syntax.
//
// employeeId may be null, for callers that only care about resource
// pressure (the "X remaining" hint while the form is still being filled).
export async function loadOccupancy({ employeeId, start, end }) {
  const overlapping = (query) => query
    .in('status', OCCUPYING_STATUSES)
    .lt('start_time', end.toISOString())
    .gt('end_time', start.toISOString())

  const [employeeRes, unitRes] = await Promise.all([
    employeeId
      ? overlapping(supabase.from('appointments').select('id, start_time, end_time, status').eq('employee_id', employeeId))
      : Promise.resolve({ data: [], error: null }),
    overlapping(
      supabase
        .from('appointments')
        .select('resource_unit_id, start_time, end_time, status')
        .not('resource_unit_id', 'is', null)
    ),
  ])

  if (employeeRes.error) return { error: employeeRes.error }
  if (unitRes.error) return { error: unitRes.error }
  return { employeeRows: employeeRes.data || [], unitRows: unitRes.data || [] }
}

// Tries `attempt` on each candidate unit until one sticks.
//
// The occupancy scan above can go stale between reading and writing, so a
// unit that looked free may be taken by the time we write. The exclusion
// constraint catches that, and we move on to the next unit rather than
// rejecting a booking another unit could still take. Only once every
// candidate is genuinely gone do we give up — `exhausted` says so, which
// callers report differently from a plain refusal.
export async function attemptOnEachUnit(candidateUnits, attempt) {
  let lastError = null

  for (const unit of candidateUnits || []) {
    const { data, error } = await attempt(unit)
    if (!error) return { data }

    lastError = error
    const kind = conflictKind(error)
    if (kind === 'resource') continue // this unit just got taken — try the next
    return { error, kind }
  }

  return { error: lastError, kind: 'resource', exhausted: true }
}

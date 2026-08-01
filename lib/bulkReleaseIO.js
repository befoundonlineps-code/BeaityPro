import { supabase } from './supabaseClient'
import { RELEASABLE_STATUSES } from './bulkRelease'

// The database half of marking somebody off, or a machine down, and clearing
// what that invalidates. The pure half is in bulkRelease.js, the same way
// placementIO sits beside bookingPlacement.

// Rows that might be affected: everything live in the window that belongs to
// the target. Both filters only narrow what gets fetched — whether a row is
// really affected, and which of the two things happens to it, is decided by
// classifyBulkRelease, so the cutoff rule never gets restated in query
// syntax.
//
// No salon filter: RLS already scopes every appointment query to the
// caller's own salon, and adding one here would only say it twice.
export async function loadReleaseCandidates({ target, from, to }) {
  let query = supabase
    .from('appointments')
    .select('*')
    .in('status', RELEASABLE_STATUSES)
    .gte('start_time', from.toISOString())
    .lt('start_time', to.toISOString())

  if (target.kind === 'employee') {
    query = query.eq('employee_id', target.employeeId)
  } else {
    query = query.in('resource_unit_id', target.unitIds || [])
  }

  const { data, error } = await query
  if (error) return { error }
  return { rows: data || [] }
}

// Records the absence and clears the day in one transaction.
//
// Two writes that must not come apart: an absence whose bookings are still
// live shows a professional who is not coming in as booked solid, and cleared
// bookings with no absence row destroy the answer to why they went.
//
// Neither call carries the target's booking ids: the function re-derives its
// own set under FOR UPDATE, so a booking made while the dialog sat open is
// still caught rather than stranded on an absent professional's column.
//
// Nor does either carry a cancellation reason. That one is resolved inside
// the function from system_key — the receptionist answers why somebody is
// *away*, which is a different question from why a booking died, and both
// end up recorded without a name or a magic string travelling from here.
export async function markEmployeeAbsent({ employeeId, dateISO, absenceReasonId, from, to }) {
  return supabase.rpc('mark_employee_absent', {
    p_employee_id: employeeId,
    p_absence_date: dateISO,
    p_absence_reason_id: absenceReasonId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })
}

// The same for one or more units of a resource, so ticking two machines off
// at once stays a single atomic change rather than two half-applied ones.
export async function markResourceUnitsOut({ unitIds, dateISO, from, to }) {
  return supabase.rpc('mark_resource_units_out', {
    p_resource_unit_ids: unitIds,
    p_outage_date: dateISO,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })
}

// Undoing the *record*, not its consequences. Deleting these rows reopens the
// day for booking; nothing brings back the sessions that were released. That
// asymmetry is why the dialog spells it out before the release rather than
// offering this afterwards as an undo.
export async function clearEmployeeAbsence({ employeeId, dateISO }) {
  return supabase
    .from('employee_absences')
    .delete()
    .eq('employee_id', employeeId)
    .eq('absence_date', dateISO)
}

export async function clearResourceUnitOutages({ unitIds, dateISO }) {
  return supabase
    .from('resource_unit_outages')
    .delete()
    .in('resource_unit_id', unitIds)
    .eq('outage_date', dateISO)
}

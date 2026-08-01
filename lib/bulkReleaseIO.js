import { supabase } from './supabaseClient'
import { RELEASABLE_STATUSES } from './bulkRelease'

// The database half of a bulk release, kept beside the pure half in
// bulkRelease.js the same way placementIO sits beside bookingPlacement.

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

// Hands the *target* over, never the list of ids the preview happened to
// show. The function re-derives its own set under FOR UPDATE, so a booking
// made while the dialog sat open is still caught — which is the whole point
// of a bulk release, and the one thing a list of ids could not do.
export async function commitBulkRelease({ target, from, to, cancellationReasonId }) {
  return supabase.rpc('bulk_release_to_waiting', {
    p_target_kind: target.kind === 'employee' ? 'employee' : 'resource_units',
    p_employee_id: target.kind === 'employee' ? target.employeeId : null,
    p_resource_unit_ids: target.kind === 'employee' ? null : target.unitIds,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_cancellation_reason_id: cancellationReasonId,
  })
}

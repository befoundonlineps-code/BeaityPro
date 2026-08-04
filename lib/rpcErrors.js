import { dbErrorKey, isUnexpectedDbError } from './dbErrors'

// Turning an exception a database function raised on purpose into a sentence.
//
// dbErrors.js already does this for SQLSTATE — the faults Postgres names
// itself, like a unique violation. This is the other half: the faults our own
// functions raise, as `raise exception 'appointment_not_cancellable'`, which
// arrive with SQLSTATE P0001 and the code sitting in the message.
//
// It exists because that message was being read by hand in eighteen places:
//
//   rpcError.message?.includes('appointment_not_cancellable') ? … : …
//
// Every one of them is a silent single point of failure. Rename a raised code,
// or wrap it in a longer sentence, and the match stops hitting — no error, no
// warning, just a specific explanation quietly replaced by "something went
// wrong". The screen still works, so nothing ever draws attention to it.
//
// Matching is on a whole word rather than a substring, which `includes` could
// not do. No code in the list is currently a prefix of another, but the day
// one is — `stock_document_empty` beside `stock_document_empty_lines` is the
// obvious shape — a substring match would answer with whichever came first.
const RAISED_CODES = {
  // Appointments
  appointment_not_found: 'common:rpcError.appointmentNotFound',
  appointment_not_pending: 'appointments:actionsDialog.notPendingError',
  appointment_not_cancellable: 'appointments:actionsDialog.notCancellableError',
  appointment_not_adjustable: 'appointments:adjustDialog.notAdjustableError',
  appointment_not_reschedulable: 'appointments:rescheduleDialog.notReschedulableError',
  appointment_not_waiting: 'appointments:formDialog.notWaitingError',
  appointment_not_markable_no_show: 'common:rpcError.notMarkableNoShow',
  participant_is_primary: 'appointments:actionsDialog.isPrimaryError',
  participant_not_removable: 'appointments:actionsDialog.notRemovableError',

  // Reasons a write refuses to happen without
  cancellation_reason_required: 'common:rpcError.cancellationReasonRequired',
  reschedule_reason_required: 'common:rpcError.rescheduleReasonRequired',
  adjustment_reason_required: 'common:rpcError.adjustmentReasonRequired',
  missing_system_cancellation_reason: 'appointments:dayStatus.missingSystemReasonError',

  // Duration adjustment
  adjusted_end_before_start: 'common:rpcError.endBeforeStart',
  adjustment_no_change: 'common:rpcError.noChange',

  // Bulk release / day status
  employee_already_absent: 'appointments:dayStatus.alreadyAbsentError',
  resource_unit_already_out: 'appointments:dayStatus.alreadyOutError',
  invalid_target_kind: 'common:rpcError.invalidTarget',
  invalid_time_range: 'common:rpcError.invalidTimeRange',
  range_entirely_past: 'common:rpcError.rangeEntirelyPast',
  employee_required: 'common:rpcError.employeeRequired',
  resource_units_required: 'common:rpcError.resourceUnitsRequired',
  service_required: 'common:rpcError.serviceRequired',
}

// The raised code inside an error, or null when there is none.
export function raisedCode(error) {
  const message = error && error.message
  if (!message) return null

  for (const code of Object.keys(RAISED_CODES)) {
    if (new RegExp(`(^|[^a-z_])${code}([^a-z_]|$)`).test(message)) return code
  }
  return null
}

// The i18n key for an error from a database function.
//
// `overrides` is how one code says different things on different screens, and
// it is not a nicety: appointment_not_cancellable means "this booking cannot
// be cancelled" in the actions dialog and "your view is out of date" in the
// day-status dialogs, because there somebody is releasing a whole day and a
// booking that moved underneath them is stale news, not a refusal. Collapsing
// those into one sentence would have been a behaviour change smuggled inside
// a refactor.
//
// Anything with no raised code falls through to dbErrors, so a constraint
// violation still gets its own wording rather than a generic one.
export function rpcErrorKey(error, overrides) {
  const code = raisedCode(error)
  if (!code) return dbErrorKey(error)
  return (overrides && overrides[code]) || RAISED_CODES[code]
}

// The one call sites should use.
//
// An error that is neither a code we raise nor a SQLSTATE we recognise still
// reaches the console, for the same reason reportDbError does it: translating
// without recording trades a confused user for a fault nobody can find.
export function reportRpcError(error, context, overrides) {
  if (!raisedCode(error) && isUnexpectedDbError(error)) {
    // eslint-disable-next-line no-console
    console.error(`[rpc] unexpected error${context ? ` — ${context}` : ''}`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
  }
  return rpcErrorKey(error, overrides)
}

export { RAISED_CODES }

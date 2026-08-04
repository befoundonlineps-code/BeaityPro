// The faults our own database code raises on purpose, as
// `raise exception 'appointment_not_cancellable'` — arriving with SQLSTATE
// P0001 and the code sitting in the message.
//
// ⚠️ This is its own module, and the reason is a bug the owner measured. It
// used to live inside rpcErrors.js, so only callers of an RPC ever consulted
// it. But a raised exception does not only come from an RPC: a TRIGGER on an
// ordinary UPDATE raises one too. Archiving a storage that still holds stock,
// and changing the supplier of a consignment product that has already moved,
// are both refused by triggers — and both screens call plain client writes and
// report through dbErrors, which knew nothing about this table. Both refusals
// reached the screen as "something went wrong", measured on a real session.
//
// Worse than a missing sentence: the product window explains the rule under the
// field ("one supplier only, and it does not change after the first movement"),
// so the application explained, the database forbade, and the forbidding was
// the only part that could not speak — the part that shows up exactly when
// somebody needs it.
//
// Living here, both dbErrors.js and rpcErrors.js can read it without either
// importing the other.
export const RAISED_CODES = {
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

  // Stock. ⚠️ These four were MEASURED — called from outside until each guard
  // fired and the code came back — and the list stops there rather than being
  // completed from the design. RLS hides every real storage, so the very first
  // lookup answers storage_not_found and nothing behind it can be reached from
  // outside: whatever post_stock_document raises about quantities, costs, a
  // negative balance, an archived storage or a frozen consignment product is
  // still unread. The two trigger codes are unread for the same reason and are
  // what the owner is fetching from the browser console now.
  stock_document_empty: 'products:stock.documentEmpty',
  wrong_function_for_doc_type: 'products:stock.docTypeNotSupported',
  storage_not_found: 'products:stock.storageNotFound',
  transfer_same_storage: 'products:stock.transferSameStorage',
}

// The raised code inside an error, or null when there is none.
//
// Matching is on a whole word rather than a substring, which `includes` could
// not do. No code in the list is currently a prefix of another, but the day one
// is — `stock_document_empty` beside `stock_document_empty_lines` is the
// obvious shape — a substring match would answer with whichever came first.
export function raisedCode(error) {
  const message = error && error.message
  if (!message) return null

  for (const code of Object.keys(RAISED_CODES)) {
    if (new RegExp(`(^|[^a-z_])${code}([^a-z_]|$)`).test(message)) return code
  }
  return null
}

// P0001 is the SQLSTATE every `raise exception` without an explicit code gets.
// Seeing it with a code we have not named yet is a different fact from an
// unrecognised database fault: it means a rule we wrote refused this on
// purpose and nobody has written its sentence. Saying so is more useful than
// "something went wrong", and it is the honest description of the state.
export const RAISED_SQLSTATE = 'P0001'

export function isUnnamedRaise(error) {
  return !!error && error.code === RAISED_SQLSTATE && !raisedCode(error)
}

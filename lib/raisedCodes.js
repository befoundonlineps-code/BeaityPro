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

  // Stock. ⚠️ Four of these were MEASURED first — called from outside until
  // each guard fired and the code came back. RLS hides every real storage, so
  // the very first lookup answers storage_not_found and nothing behind it
  // could be reached from outside, which is why the list stopped there for a
  // long while.
  //
  // ✅ THE STOCK MODULE'S ENTRY IS NOW CLOSED, and closed is a stronger claim
  // than complete-so-far. All four functions arrived whole from
  // pg_get_functiondef, so this is not "every code we have seen" but "every
  // code these functions can raise" — read off the text, counted:
  //
  //   post_stock_document     wrong_function_for_doc_type, stock_document_empty,
  //                           storage_not_found, product_not_found,
  //                           stock_line_zero, unit_cost_required,
  //                           bonus_supply_only, bonus_negative,
  //                           bonus_over_quantity
  //   post_stocktake          storage_not_found, product_not_found, count_invalid
  //   transfer_stock          transfer_same_storage, stock_document_empty,
  //                           storage_not_found, product_not_found, stock_line_zero
  //   reverse_stock_document  stock_document_not_found, cannot_reverse_a_reversal,
  //                           already_reversed
  //   two triggers            storage_not_empty, consignment_locked
  //
  // Sixteen distinct codes, all named below, and lib/raisedCodes.test.js
  // reads the SQL rather than trusting this comment — which is how the three
  // bonus codes were caught the moment 051b was written, before any of it ran.
  //
  // ⚠️ Closed for these four only. Any function whose text has not been read
  // is still unknown, and the rule the header states holds: absence from this
  // list means NOT MEASURED, never "does not exist".
  stock_document_empty: 'products:stock.documentEmpty',
  wrong_function_for_doc_type: 'products:stock.docTypeNotSupported',
  storage_not_found: 'products:stock.storageNotFound',
  transfer_same_storage: 'products:stock.transferSameStorage',

  // Read from the text of post_stock_document and post_stocktake.
  product_not_found: 'products:stock.productNotFound',
  stock_line_zero: 'products:stock.lineZero',
  count_invalid: 'products:stock.countInvalid',

  // ⚠️ Read from post_stocktake_session (054c), and CAUGHT BY THIS FILE'S OWN
  // TEST the moment the script was written — before it ran, exactly as the
  // three bonus codes were. The comment above says "closed for these four
  // only"; a fifth function arrived and the guard, not the comment, is what
  // noticed.
  //
  // Both are reachable without a race, which is what the reversal codes above
  // are not: the session is the idempotency key, so a double submit — the
  // ordinary double click, or a retry after a reply that never arrived — meets
  // session_already_posted rather than posting a second stocktake. That is the
  // refusal being WORKING, so its sentence has to say so rather than sound like
  // a fault.
  session_not_found: 'products:stocktake.sessionNotFound',
  session_already_posted: 'products:stocktake.sessionAlreadyPosted',

  // ⚠️ Read from 056c, and CAUGHT BY THIS FILE'S OWN TEST AGAIN — third time,
  // and the first where the raise was written to close a gap the guard's own
  // reasoning had missed. It refuses a storage with no fine policy rather than
  // letting stock_fines.fine_percent's NOT NULL abort the posting with 23502:
  // `fine_percent >= 0 and fine_percent <= 100` on storages returns UNKNOWN for
  // a null and a CHECK refuses only FALSE, so "the range constraint makes this
  // impossible" was true of the range and silent about the absence.
  //
  // Unlike the two above, this one is FIXABLE BY THE PERSON WHO MEETS IT, which
  // is why it earns a sentence naming the field rather than the generic
  // "a rule refused this".
  fine_policy_missing: 'products:stocktake.finePolicyMissing',
  // Raised by refuse_unlinking_stocked_folder (068a) when a folder is unticked
  // out of a storage that still holds its products.
  //
  // ⚠️ It carries a runtime list of product names in its hint, and the named
  // sentence deliberately does NOT try to reproduce it. The key wins over the
  // hint by design, so the screen must say enough on its own — it names the way
  // out, and the storage window is already showing which folder was unticked.
  // A sentence that promised a list it could not deliver would be worse than
  // one that never mentions it.
  folder_still_stocked: 'products:storageDialog.folderStillStocked',
  // Raised by refuse_archiving_stocked_storage (077a) when a storage holding
  // stock is archived.
  //
  // ⚠️ THIS CODE HAS BEEN RAISEABLE FOR MONTHS AND WAS INVISIBLE TO THIS FILE'S
  // OWN GUARD. raisedCodes.test.js reads docs/sql, and the function lived only
  // in the database — created in the editor before that folder existed. So the
  // check that refuses a raised code with no sentence could not see the one
  // code in the schema that had none. Depositing 077a is what brings it under
  // the guard; the entry below is what the guard then demands.
  storage_not_empty: 'products:storageDialog.storageNotEmpty',
  // Read from reverse_stock_document. ⚠️ All three are guarded by a disabled
  // button, so the only way to see one is a race — two people, or one double
  // click, or a stale page. That is the argument FOR the sentence rather than
  // against it: whoever meets them meets them at the worst moment, and a
  // refusal nobody planned for is the last thing anybody explains.
  stock_document_not_found: 'products:stock.documentNotFound',
  cannot_reverse_a_reversal: 'products:stock.cannotReverseAReversal',
  already_reversed: 'products:stock.alreadyReversed',
  // ⚠️ This one is a lesson as much as a code. The database DOES require a
  // cost on a receipt — and it did not stop the poisoning, because an
  // untouched box arrived as 0 and 0 passes `v_cost >= 0`. A constraint on the
  // RANGE cannot guard against a legitimate value carrying the wrong meaning;
  // only the screen could, by refusing blank before Number() ever saw it.
  unit_cost_required: 'products:stock.unitCostRequired',

  // ⚠️ Stage 4b. THE SAME KEYS THE SCREEN'S OWN GUARD RETURNS, not new
  // sentences saying the same thing differently. One rule refused in two
  // layers has to read identically, or the person who meets it twice — once
  // typing, once on a race — is told two things about one mistake.
  //
  // And the two layers are not redundant. `bonus_supply_only` cannot be a
  // CHECK constraint at all: doc_type lives on stock_documents and a CHECK
  // cannot read another table, so the database enforces it inside the function
  // or not at all (051a's header).
  bonus_supply_only: 'products:money.bonusSupplyOnly',
  bonus_negative: 'products:money.bonusNegative',
  bonus_over_quantity: 'products:money.bonusOverQuantity',

  // ⚠️ storage_not_empty USED TO BE DECLARED A SECOND TIME HERE, and a
  // duplicate key in an object literal is not an error in JavaScript — the
  // last one silently wins. So the sentence written for 077a above was
  // UNREACHABLE, and an older, shorter one reached the screen instead: no way
  // out named, and no word about the storage coming back when it is
  // un-archived. Nothing failed anywhere.
  //
  // ⚠️ And the test agreed with the bug, which is the part worth keeping in
  // mind: it asserted products:storages.notEmptyError because that is what the
  // code did, so the guard confirmed the accident rather than the intent. A
  // test written from observed behaviour cannot notice that the behaviour is
  // wrong.
  //
  // The class is now guarded rather than the instance — raisedCodes.test.js
  // reads THIS FILE'S TEXT for repeated keys, because reading the object
  // cannot see a duplicate that has already collapsed.

  // ⚠️ THREE CODES FOR ONE TRIGGER, AND THE THIRD IS A RETIREMENT IN PROGRESS.
  //
  // freeze_consignment_after_use raised ONE code for two fields, because it
  // applied one condition to two fields. 079a splits it: the consignment flag
  // is frozen by HISTORY — any movement whose document still stands — and the
  // supplier by CURRENT OWNERSHIP — a live balance, and only while the product
  // is consignment at all.
  //
  // Two tests force two sentences rather than merely suggesting them, because
  // the ways out differ in kind. A live balance CAN be emptied — transfer,
  // write off, return to supplier — so its sentence names the action. History
  // cannot be emptied, so its sentence has to say there is no way back and
  // offer the only real move: a new product with the right flag, and this one
  // archived. One sentence covering both would have been wrong for whichever
  // half of the people read it.
  consignment_flag_locked: 'products:productDialog.consignmentFlagLockedError',
  consignment_supplier_locked: 'products:productDialog.consignmentSupplierLockedError',
  // ⚠️ AND THE OLD CODE STAYS UNTIL THE OWNER CONFIRMS 079a HAS RUN. The old
  // function is live in this database right now and raises exactly this.
  // Deleting it the moment the replacement was WRITTEN would leave the refusal
  // that is actually reachable today with no sentence — and run state lives
  // with the owner, never in this repository (docs/sql/README.md, and the
  // first SQL rule in CLAUDE.md). It goes when README records 079a as run.
  consignment_locked: 'products:productDialog.consignmentLockedError',
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
//
// ⚠️ And an unnamed raise is usually not silent at all: the trigger that
// raised it carries `using hint = '…'`, an Arabic sentence written for a
// person, which was sitting unread while the screen said "something went
// wrong". Both trigger codes arrived that way.
//
// So the fallback order is: named key → hint → generic. The hint is a
// fallback and never the first answer, because a named key is translatable
// and a hint is Arabic living in the database — a second language would get
// Arabic back.
//
// The condition is that a hint EXISTS, not that a message does. An internal
// raise with a technical message and no hint is not written for anybody's
// eyes and must stay on the generic sentence.
export function raisedHint(error) {
  const hint = error && typeof error.hint === 'string' ? error.hint.trim() : ''
  return hint === '' ? null : hint
}

// P0001 is the SQLSTATE every `raise exception` without an explicit code gets.
export const RAISED_SQLSTATE = 'P0001'

export function isUnnamedRaise(error) {
  return !!error && error.code === RAISED_SQLSTATE && !raisedCode(error)
}

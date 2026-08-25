// What the storage window sends, and what it refuses to send.
//
// Same split as productForm.js and serviceForm.js: the payload has to be
// something a test can ask about, because sixteen columns decided inside a
// component are sixteen columns nobody can check.
import { dropAction } from './dropConfirm'

export const STORAGE_KINDS = ['common', 'professional']
export const FINE_BASES = ['purchase_price', 'sales_price']

const trimmed = (value) => String(value ?? '').trim()

const numberOrNull = (value) => {
  const text = trimmed(value)
  return text === '' ? null : Number(text)
}

// A responsible row names an employee or a role. "Which one is this" is a
// question about two columns, and both screens ask it, so it is written once.
//
// The prefix is not decoration: an employee id and a role are different kinds
// of thing, and without it a role called like a uuid would collide. It also
// makes the two halves of a mixed selection sortable and comparable as plain
// strings, which is what keyedLinkDiff needs.
//
// ⚠️ The third case is a row naming NEITHER. This code has always said the
// table forbids it with an exclusive-or CHECK, and that claim came from the
// design rather than from reading the database — it is unverified, and the
// composite key would not catch it either, because a foreign key with a NULL
// in it passes for free under MATCH SIMPLE. Nor do the two unique constraints:
// unique(storage_id, employee_id) does not see two rows that are both NULL
// there.
//
// So it is handled here rather than assumed away. Such a row appears in no
// list, belongs to nobody, and would have the fine calculation deducting from
// nobody. Keying it on its own id means it can never match anything selected,
// so the next save of that storage removes it — a row that says nothing is
// cleaned up rather than preserved.
export const responsibleKey = (row) => {
  if (row.employee_id) return `employee:${row.employee_id}`
  if (row.role) return `role:${row.role}`
  return `orphan:${row.id}`
}

export function responsibleRowFor(key) {
  const [kind, value] = String(key).split(/:(.*)/s)
  return kind === 'employee'
    ? { employee_id: value, role: null }
    : { employee_id: null, role: value }
}

// Returns a translation key, or '' when the form is fit to send.
export function validateStorage(values) {
  const v = values || {}

  if (!trimmed(v.name)) return 'products:storageDialog.nameRequiredError'

  if (!STORAGE_KINDS.includes(v.kind)) return 'products:storageDialog.kindRequiredError'

  // storages_owner_matches_kind_check says the same thing structurally:
  // (kind='professional') = (owner_employee_id IS NOT NULL). Saying it here
  // first is the difference between a sentence beside the field and a CHECK
  // violation in Postgres English — the database still refuses either way,
  // which is the point of saying it twice.
  if (v.kind === 'professional' && !v.ownerEmployeeId) {
    return 'products:storageDialog.ownerRequiredError'
  }

  // ⚠️ BLANK IS ALLOWED, AND IT MEANS SOMETHING THE OTHER VALUES CANNOT SAY.
  //
  // This used to demand a number. The reason written here was that "0 already
  // means charge nothing, so an empty box would be a second way to say the same
  // thing" — and that both halves of that were unmeasured is why it is gone:
  //
  //   0     -> a decision: record the fine, charge nothing
  //   null  -> no decision yet, and post_stocktake_session refuses to fine on
  //            a shortage until somebody makes one (fine_policy_missing)
  //
  // Those are different states and the database distinguishes them. The second
  // half — "the only way to find out which one the column accepts would be to
  // send it and see" — was answered by 056d_4: both columns are nullable.
  //
  // ⚠️ AND THE COST OF DEMANDING A NUMBER WAS NOT THEORETICAL. The dialog
  // pre-filled 100 and purchase_price, so both live storages carry a 100% wage
  // deduction that nobody chose — the owner's words were that it was written to
  // fill the box. This is unit_cost_required mirrored: there, an untouched box
  // arrived as 0 and passed every range check; here, an untouched box arrives as
  // the maximum of the range and passes just as cleanly. The most reassuring
  // value in a range is the one written by someone who does not want to think
  // about it.
  // ⚠️ THE CHECKBOX IS THE POLICY'S EXISTENCE, so a storage with it OFF has no
  // policy to validate — whatever numbers the two boxes still hold are the
  // user's own, kept so unticking is undoable, and they are never written.
  //
  // `undefined` means ON. Every caller written before the box existed passes
  // values without the key and must keep behaving exactly as it did.
  //
  // 🔴 A GUARDED BLOCK, NOT AN EARLY RETURN. `return ''` here would skip
  // everything after it, and these checks are last only today — the next check
  // appended below would silently stop running for an unticked storage, and
  // nothing would fail.
  const finePolicyOn = v.fineEnabled !== false
  const fine = numberOrNull(v.finePercent)
  const hasPercent = finePolicyOn && trimmed(v.finePercent) !== ''
  const hasBasis = finePolicyOn && trimmed(v.fineBasis) !== ''

  if (hasPercent && (!Number.isFinite(fine) || fine < 0 || fine > 100)) {
    return 'products:storageDialog.finePercentError'
  }
  if (hasBasis && !FINE_BASES.includes(v.fineBasis)) {
    return 'products:storageDialog.fineBasisError'
  }

  // ⚠️ Both or neither, because a half-set policy is indistinguishable from no
  // policy to the database — post_stocktake_session refuses on `percent is null
  // OR basis is null` — while looking on screen like a decision that was made.
  // Refusing it here is the difference between a stored row that says what it
  // means and one that reads as a policy and behaves as its absence.
  //
  // ⚠️ TWO MESSAGES, NOT ONE, AND THE OWNER MET THE PROOF. A single sentence
  // explained "a percentage with no basis reads as a policy and behaves as its
  // absence" — and the owner had done the opposite, chosen a basis and left the
  // percentage empty. The refusal was right and the reason shown was not its
  // reason: the half that says WHY described the case that had not happened.
  //
  // The screen knows which box is empty, so it says that one. Same fault this
  // whole thread has been chasing — a correct answer wearing the wrong
  // explanation — and it reached a real screen.
  if (hasPercent && !hasBasis) return 'products:storageDialog.finePercentWithoutBasisError'
  if (!hasPercent && hasBasis) return 'products:storageDialog.fineBasisWithoutPercentError'

  // 🔴 TICKED AND BOTH EMPTY — a fourth state the row cannot hold, and the box
  // is what created it. The checkbox was added so "no policy" would be an
  // explicit choice rather than an implicit blank; without this refusal it
  // manufactures a new implicit blank in the opposite direction.
  //
  // ⚠️ AND ITS FAILURE IS SILENT, WHICH IS WORSE THAN A REFUSAL. Measured by
  // tracing: validate passes, the payload writes null/null, and reopening
  // derives the tick from the row and shows it UNticked. The user ticked a box,
  // saved, and came back to find it undone — with no message and no trace. A
  // refusal teaches; a silent undo confuses.
  //
  // With this, the invariant the owner named holds for everything the SCREEN
  // stores: ticked ⟺ both filled. The OR-derivation on load stays as it is,
  // because it guards a different case — the half-row written straight into the
  // SQL editor, which no screen validation can reach.
  //
  // 🔴 `=== true`, NOT `finePolicyOn`, AND A STANDING TEST CAUGHT THE
  // DIFFERENCE. `finePolicyOn` is true for `undefined` too, and for a caller
  // that predates the box "both blank" is how it says "no policy" — the exact
  // save this rule is meant to permit. Refusing it would have broken the
  // contract promised three comments up, in the same edit that promised it.
  //
  // So the fourth state is only reachable through the box: somebody ticked it,
  // and a caller that never sends the key never ticked anything.
  if (v.fineEnabled === true && !hasPercent && !hasBasis) {
    return 'products:storageDialog.fineEnabledButEmptyError'
  }

  return ''
}

export function storagePayload(values) {
  const v = values || {}
  const isProfessional = v.kind === 'professional'

  // The three unit switches are children of "sale from storage" on screen, and
  // have to be children in the row too. Leaving them true under a parent that
  // is off would let a later screen offer a way to sell from a storage that
  // does not sell — the same fault as a stale portion size on a product that
  // stopped selling by portions.
  const saleEnabled = !!v.saleEnabled

  return {
    name: trimmed(v.name),
    kind: v.kind,
    // A common storage has no owner, and the CHECK is an equivalence rather
    // than an implication: leaving a stale owner on a storage switched back to
    // common is refused by the database, not merely untidy.
    owner_employee_id: isProfessional ? (v.ownerEmployeeId || null) : null,
    packages_only: !!v.packagesOnly,
    sale_enabled: saleEnabled,
    sale_by_volume: saleEnabled && !!v.saleByVolume,
    sale_by_portion: saleEnabled && !!v.saleByPortion,
    sale_by_units: saleEnabled && !!v.saleByUnits,
    // ⚠️ Blank goes to the column as null, not as a coerced number or an empty
    // string. `null` is the only way the row can say "not decided yet", and it
    // is what post_stocktake_session reads to raise fine_policy_missing instead
    // of deducting a percentage nobody chose. The validator has already refused
    // one-of-two, so these are set together or null together.
    //
    // ⚠️ And the checkbox OFF sends both as null whatever the boxes hold — the
    // numbers stay on screen so unticking is undoable, and "kept on screen" is
    // not "kept in the row". The two must not be confused: one is a draft the
    // user can still change their mind about, the other is a policy that
    // deducts from somebody's salary.
    fine_percent: v.fineEnabled === false ? null : numberOrNull(v.finePercent),
    fine_basis: v.fineEnabled === false || trimmed(v.fineBasis) === ''
      ? null
      : v.fineBasis,
  }
}

// Who the storage window offers as financially responsible.
//
// A professional storage has exactly one: its owner. The reference collapses
// the whole picker for that kind, and the reason is not screen space — a
// storage that belongs to one person cannot have somebody else answerable for
// what goes missing from it.
//
// ⚠️ This file used to say that switching common → professional leaves the
// responsible rows alone, on the grounds that nothing refuses them and nothing
// reads them. The second half was the mistake. A woman ticked a year ago would
// find a deduction on her wages for a shortage in a storage she has never seen,
// and nothing on any screen would ever have shown her the link.
//
// 🔴 AND THE WORD «YET» IN THAT CORRECTION HAS SINCE EXPIRED — it read "the
// fine is computed when a stocktake finds a shortage, THAT CODE DOES NOT
// EXIST". It exists: post_stocktake_session carries the fine block (056c, run),
// and its ladder reads storage_responsibles by name — storage_owner,
// named_responsible, role_responsible, many_responsibles.
//
// ⇒ Which makes the deletion MORE necessary rather than less. The comment
// argued from a risk in the future tense; the code that would have read those
// leftover rows is live now, so the argument is simply true. Nothing here
// changes — the sentence does.
//
// So the rows go, and the mirror foreign key on (storage_id, storage_kind)
// makes it structural rather than a habit. Keeping them was not a conservative
// choice — it was leaving a silent table for future code to read.
export function responsiblesVisible(kind) {
  return kind !== 'professional'
}

// Switching a storage to professional while people are still answerable for it.
//
// Same shape as the product window's set → product switch, and the same three
// answers, because it is the same situation: a field changes, rows that hang
// off the row become illegal, and the database refuses the update while they
// exist. See lib/dropConfirm.js.
export function storageSaveAction({ kind, isEdit, responsibleCount, confirmed }) {
  return dropAction({
    dropping: kind === 'professional' && !!isEdit && responsibleCount > 0,
    confirmed,
  })
}

// Two counts, never one.
//
// "Responsible: 2" hides the only distinction that matters here. Two people
// named is two people; two roles ticked is everybody holding them today and
// everybody hired into them next year — and the second is a standing rule
// somebody wrote without being shown that they were writing one.
export function responsibleCounts(rows) {
  return {
    people: (rows || []).filter((r) => r.employee_id).length,
    roles: (rows || []).filter((r) => r.role).length,
  }
}

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

  // Always a number, never blank. The column takes a percentage and 0 already
  // means "charge nothing", so an empty box would be a second way to say the
  // same thing — and the only way to find out which one the column accepts
  // would be to send it and see.
  const fine = numberOrNull(v.finePercent)
  if (fine === null || !Number.isFinite(fine) || fine < 0 || fine > 100) {
    return 'products:storageDialog.finePercentError'
  }

  if (!FINE_BASES.includes(v.fineBasis)) return 'products:storageDialog.fineBasisError'

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
    fine_percent: numberOrNull(v.finePercent),
    fine_basis: v.fineBasis,
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
// reads them. The second half was the mistake. Nothing reads them *yet*: the
// fine is computed when a stocktake finds a shortage, that code does not exist,
// and it will have to choose between owner_employee_id and storage_responsibles
// with no way to tell that some of those rows were left over from when the
// storage was common. A woman ticked a year ago would find a deduction on her
// wages for a shortage in a storage she has never seen, and nothing on any
// screen would ever have shown her the link.
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

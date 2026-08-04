// What the storage window sends, and what it refuses to send.
//
// Same split as productForm.js and serviceForm.js: the payload has to be
// something a test can ask about, because sixteen columns decided inside a
// component are sixteen columns nobody can check.
export const STORAGE_KINDS = ['common', 'professional']
export const FINE_BASES = ['purchase_price', 'sales_price']

const trimmed = (value) => String(value ?? '').trim()

const numberOrNull = (value) => {
  const text = trimmed(value)
  return text === '' ? null : Number(text)
}

// A responsible row names an employee or a role, never both — the CHECK on the
// table is an exclusive or. So "which one is this" is a question about two
// columns, and both screens ask it, so it is written once here.
//
// The prefix is not decoration: an employee id and a role are different kinds
// of thing, and without it a role called like a uuid would collide. It also
// makes the two halves of a mixed selection sortable and comparable as plain
// strings, which is what keyedLinkDiff needs.
export const responsibleKey = (row) =>
  row.employee_id ? `employee:${row.employee_id}` : `role:${row.role}`

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
// ⚠️ Switching common → professional does NOT delete the responsible rows,
// which is the opposite of what the product window does to a set's components,
// and the difference is real rather than an inconsistency. There a foreign key
// refused the rows outright; here nothing does, nothing reads them while the
// storage is professional, and switching back restores exactly what was there.
// Deleting would be a destructive act with no one asking for it.
export function responsiblesVisible(kind) {
  return kind !== 'professional'
}

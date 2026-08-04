// What the supplier window sends.
//
// Four columns and a list of contacts, which is less than the reference's
// window by a long way — its Requisites block (legal and actual address, bank
// account type and number, bank name) and its "Payments to suppliers" currency
// are deliberately absent, not postponed. Those are the fields a Russian
// accounting package needs to file a payment order; nothing in this system
// files anything, and a form that collects data no code reads teaches people
// to fill in boxes that do not matter.
const trimmed = (value) => String(value ?? '').trim()
const trimmedOrNull = (value) => {
  const text = trimmed(value)
  return text === '' ? null : text
}

export function validateSupplier(values) {
  const v = values || {}
  if (!trimmed(v.name)) return 'products:supplierDialog.nameRequiredError'
  return ''
}

export function supplierPayload(values) {
  const v = values || {}
  // Every column every time, so clearing a field clears it. A key left out of
  // an update leaves the old value in the row, which is the one failure of the
  // set that is silent.
  return {
    name: trimmed(v.name),
    phone: trimmedOrNull(v.phone),
    email: trimmedOrNull(v.email),
    website: trimmedOrNull(v.website),
    notes: trimmedOrNull(v.notes),
  }
}

// A contact row is worth keeping when it says who or how to reach them.
//
// The reference lets a contact be saved with nothing but a position, and a row
// that says "Sales manager" and no way to reach one is a row that will be read
// as a working contact by whoever opens the window next.
export function contactIsEmpty(contact) {
  const c = contact || {}
  return !trimmed(c.lastName) && !trimmed(c.firstName) && !trimmed(c.position)
    && !trimmed(c.phone) && !trimmed(c.email) && !trimmed(c.notes)
}

export function validateSupplierContacts(contacts) {
  const rows = (contacts || []).filter((c) => !contactIsEmpty(c))
  // A name or a phone number. Position alone describes a job, not a person.
  const nameless = rows.some(
    (c) => !trimmed(c.lastName) && !trimmed(c.firstName) && !trimmed(c.phone) && !trimmed(c.email)
  )
  return nameless ? 'products:supplierDialog.contactIdentityError' : ''
}

export function supplierContactPayload(contact, index) {
  const c = contact || {}
  return {
    last_name: trimmedOrNull(c.lastName),
    first_name: trimmedOrNull(c.firstName),
    position: trimmedOrNull(c.position),
    phone: trimmedOrNull(c.phone),
    email: trimmedOrNull(c.email),
    notes: trimmedOrNull(c.notes),
    // Position in the list, for the same reason the set's components carry it:
    // the column defaults to 0, and a table where every row claims to be first
    // comes back from .order('sort_order') in whatever order the planner likes.
    sort_order: index,
  }
}

// What the product window's consignment dropdown shows, and the supplier list
// on its own screen.
//
// Archived suppliers are dropped from the choice but an already-chosen one is
// kept, so that opening a product whose supplier was archived does not silently
// reassign it to nobody the moment somebody presses save.
export function supplierChoices(suppliers, selectedId) {
  return (suppliers || []).filter((s) => s.is_active !== false || s.id === selectedId)
}

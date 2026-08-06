// Narrowing the stock document list, and the number that comes off a supplier's
// paper.
//
// ⚠️⚠️ FILTERING HAPPENS ON THE LOADED ARRAY, NEVER IN THE QUERY — and this is
// a safety property, not a preference.
//
// reversalState answers "was this reversed?" by looking for a document that
// points at it, which is only correct while the whole set is in memory.
// useStockDocuments loads everything with no paging, deliberately. If the
// filters became a `.eq()` on the query, a document whose reversal fell outside
// the filter would read as never reversed, the reverse button would light up on
// it, and reverse_stock_document would answer already_reversed to a screen that
// did not expect it. That is the exact hazard pinned by the test named "says
// yes to a reversed document whose reversal was not loaded" — and filtering in
// the query would fire it without touching that code.
//
// So: the hook keeps loading everything, this narrows what is DRAWN, and the
// reversal question keeps seeing the whole set.

// The two document types that have a counterparty outside the salon.
//
// ⚠️ The supplier filter and the number field are BOTH scoped to exactly this
// list, and that is not a coincidence — they are the same fact seen twice. A
// transfer moves between two of our own storages, a stocktake and a write-off
// involve nobody outside, and a reversal is our own correction. None of them
// has a supplier, so none of them can have a supplier's invoice number.
export const SUPPLIER_TYPES = ['supply', 'return_to_supplier']

export function hasSupplier(docType) {
  return SUPPLIER_TYPES.includes(docType)
}

// Whether the supplier filter can mean anything for the chosen type.
//
// ⚠️ It is DISABLED rather than ignored when the answer is no. A filter that is
// silently ignored is a filter that lies: it shows rows that do not match what
// was asked for, and nothing on screen says so. Greying it out is the same
// language the reference uses when it dims the document buttons under "all
// storages" — the control says "not here" instead of quietly doing nothing.
export function supplierFilterApplies(typeFilter) {
  if (!typeFilter) return true          // "all types" — some of them have one
  return hasSupplier(typeFilter)
}

export const EMPTY_FILTERS = {
  from: '',        // doc_date, inclusive
  to: '',          // doc_date, inclusive
  docType: '',
  docNumber: '',
  supplierId: '',
  storageId: '',
}

const text = (value) => String(value ?? '').trim()

// ⚠️ The period runs on doc_date, NOT created_at, because doc_date is the day
// the person chose and it is what they mean by "when". created_at only breaks
// ties in the sort.
//
// A consequence worth saying rather than discovering: a document entered today
// and dated last month does NOT appear under this month. That is correct, and
// it surprises people.
//
// doc_date arrives as a timestamptz string ('2026-08-04T00:00:00+00:00') and
// the bounds are plain days, so the comparison is on the first ten characters —
// exact for YYYY-MM-DD, and no timezone conversion anywhere. The `to` bound is
// INCLUSIVE: somebody typing the same day in both boxes means that day.
function withinPeriod(document, from, to) {
  const day = String(document.doc_date || '').slice(0, 10)
  if (!day) return !from && !to
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

// A storage filter has to see BOTH ends of a transfer.
//
// Matching storage_id alone would drop every transfer from the destination
// storage's list — the goods arrived there and the document that brought them
// would be invisible.
function inStorage(document, storageId) {
  return document.storage_id === storageId || document.to_storage_id === storageId
}

// The number is matched as a SUBSTRING, because it is text somebody copied off
// a piece of paper rather than a key. Typing 01 should find 01-A/2026.
function numberMatches(document, needle) {
  const value = text(document.supplier_doc_number).toLowerCase()
  return value.includes(needle.toLowerCase())
}

export function filterDocuments(documents, filters) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) }
  const from = text(f.from)
  const to = text(f.to)
  const docNumber = text(f.docNumber)
  // The supplier filter is dropped when it cannot apply, so a stale value left
  // behind by switching type never narrows anything invisibly.
  const supplierId = supplierFilterApplies(f.docType) ? text(f.supplierId) : ''

  return (documents || []).filter((document) => {
    if (!withinPeriod(document, from, to)) return false
    if (f.docType && document.doc_type !== f.docType) return false
    if (docNumber && !numberMatches(document, docNumber)) return false
    if (supplierId && document.supplier_id !== supplierId) return false
    if (f.storageId && !inStorage(document, f.storageId)) return false
    return true
  })
}

export function hasActiveFilters(filters) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) }
  return Object.keys(EMPTY_FILTERS).some((key) => text(f[key]) !== '')
}

// ⚠️ Why an empty RESULT needs its own reasons, on top of the empty SCREEN.
//
// "No documents yet" and "nothing matches what you asked for" are different
// facts and send a person to different actions — the first to post a document,
// the second to widen the filter. And one combination is not merely empty but
// CONTRADICTORY: asking for a supplier's stocktakes returns nothing forever,
// because a stocktake has no supplier. Drawing that as a plain empty list
// invites somebody to conclude the stocktakes are missing.
export const FILTER_EMPTY = {
  NOT_FILTERED: 'notFiltered',       // genuinely no documents
  CONTRADICTORY: 'contradictory',    // a supplier asked of types that have none
  NO_MATCH: 'noMatch',               // a legitimate narrowing that found nothing
  NONE: 'none',                      // there are rows to draw
}

export function filterEmptyReason({ documents, filtered, filters }) {
  if ((filtered || []).length > 0) return FILTER_EMPTY.NONE
  if ((documents || []).length === 0) return FILTER_EMPTY.NOT_FILTERED
  if (!hasActiveFilters(filters)) return FILTER_EMPTY.NOT_FILTERED

  // Only reachable with "all types" selected — the control is disabled
  // otherwise — and it is exactly the case a disabled control cannot catch.
  const f = { ...EMPTY_FILTERS, ...(filters || {}) }
  if (text(f.supplierId) && !f.docType) {
    const anyWithSupplier = (documents || []).some((d) => hasSupplier(d.doc_type))
    if (!anyWithSupplier) return FILTER_EMPTY.CONTRADICTORY
  }

  return FILTER_EMPTY.NO_MATCH
}

// ── the duplicate warning ───────────────────────────────────────────────────
//
// ⚠️ A WARNING AND NEVER A REFUSAL, and the reason is the one that killed the
// idea of a unique constraint: the person is standing at the delivery with the
// paper in front of them. If the real number is refused they will type a made-up
// one to get past the box, and the field that exists to match two pieces of
// paper ends up holding a fiction — silently, and looking perfectly filled in.
//
// Same shape as item 47's archive notice: explain, name what already exists,
// and let the person decide. They are the one holding the paper.
//
// Scoped to the same supplier, because two suppliers both using 01 is ordinary
// and warning about it would be noise — and noise is how a warning stops being
// read.
export function duplicateDocNumber({ documents, supplierId, docNumber, excludeId }) {
  const needle = text(docNumber)
  if (!needle || !supplierId) return null

  const match = (documents || []).find((d) => (
    d.id !== excludeId
    && d.supplier_id === supplierId
    && text(d.supplier_doc_number).toLowerCase() === needle.toLowerCase()
  ))

  return match || null
}

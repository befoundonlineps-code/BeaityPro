import { stockDocumentLines } from './stockDocument'

// The supply document, at the level of the whole form rather than one line.
//
// lib/stockDocument.js already turns rows into lines and refuses the ones that
// cannot become movements. What is left is what only the document knows: where
// the goods went, who they came from, and whether there is anything to record
// at all.
export const SUPPLY_DOC_TYPE = 'supply'

// Returns a translation key, or '' when the document is fit to send.
export function validateSupplyDocument(values) {
  const v = values || {}

  if (!v.storageId) return 'products:supply.storageRequiredError'

  // ⚠️ The database may or may not demand this — stock_documents.supplier_id is
  // nullable and no CHECK on it has been read back. It is demanded here anyway,
  // and not for tidiness: a supply is a receipt FROM somebody. Without the
  // supplier there is nothing to return the goods to, nothing to owe, and no
  // way to answer "what did we buy from them this year" — and the answer would
  // be silently wrong rather than missing, because the document would still
  // count towards the storage's balance.
  if (!v.supplierId) return 'products:supply.supplierRequiredError'

  if (!v.docDate) return 'products:supply.dateRequiredError'

  return ''
}

// What the document costs, and what it holds.
//
// unit_cost on a line is per BASE unit, because that is what the moving average
// is kept in. The money somebody typed is per entered unit, so the line total is
// entered × typed — which is also quantity_base × unit_cost, the same number
// reached the other way. Multiplying the base quantity by the typed price would
// give the packaging factor times too much, which is the shape of mistake that
// looks plausible on every line and only shows up in a yearly total.
export function supplyTotals(rows) {
  let lineCount = 0
  let total = 0

  for (const row of rows || []) {
    const quantity = Number(row.enteredQuantity)
    const cost = Number(row.unitCost)
    if (!row.productId) continue
    lineCount += 1
    if (!Number.isFinite(quantity) || !Number.isFinite(cost)) continue
    total += quantity * cost
  }

  return { lineCount, total }
}

// The payload for post_stock_document, or the first reason there is none.
//
// Validation runs before the lines are built, so somebody who forgot the
// supplier is told that rather than being told about the third row's units.
export function supplyDocumentPayload(values, productsById) {
  const validationKey = validateSupplyDocument(values)
  if (validationKey) return { error: validationKey }

  const { lines, error } = stockDocumentLines({
    docType: SUPPLY_DOC_TYPE,
    rows: values.rows,
    productsById,
  })
  if (error) return { error }

  return {
    payload: {
      docType: SUPPLY_DOC_TYPE,
      storageId: values.storageId,
      supplierId: values.supplierId,
      docDate: values.docDate,
      note: values.note || null,
      lines,
    },
  }
}

// Which storages a supply may be received into.
//
// An archived storage is dropped, and one already chosen is kept — the same
// rescue as supplierChoices, for the same reason: a select whose value matches
// no option shows its first one instead, which here would silently move the
// document to a different storage.
export function storageChoices(storages, selectedId) {
  return (storages || []).filter((s) => s.is_active !== false || s.id === selectedId)
}

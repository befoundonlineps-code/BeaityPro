import { stockDocumentLines, transferLines, stocktakeLines } from './stockDocument'
import { documentDateError } from './documentDate'
import { hasSupplier } from './documentFilters'

// The stock documents, at the level of the whole form rather than one line.
//
// lib/stockDocument.js turns rows into lines and refuses the ones that cannot
// become movements. What is left is what only a document knows: where the goods
// went, who they came from, and whether there is anything to record at all.
//
// Four documents share this because they differ in three facts and nothing
// else — whether a supplier is named, whether a price is typed, and whether
// there are two storages. Four screens would be the same validation written
// four times, with three of them free to drift.
//
// ⚠️ Stocktaking is deliberately not here. It sends counts rather than
// movements and its own function works the difference out under a lock, so
// folding it in would make `rows` mean something different depending on the
// doc type — the payload shape that was already refused once.
export const DOC_FORMS = {
  supply: { supplier: 'required', cost: true, twoStorages: false },
  // A write-off names nobody: the goods are gone, not returned.
  write_off: { supplier: 'none', cost: false, twoStorages: false },
  return_to_supplier: { supplier: 'required', cost: false, twoStorages: false },
  // Transfer has no supplier and no price — the goods keep the cost they were
  // received at, which the function copies from the source storage's average.
  transfer: { supplier: 'none', cost: false, twoStorages: true },
}

export const DOC_TYPES = Object.keys(DOC_FORMS)

export function docForm(docType) {
  return DOC_FORMS[docType] || null
}

// Returns a translation key, or '' when the document is fit to send.
export function validateStockDocument(docType, values) {
  const form = docForm(docType)
  if (!form) return 'products:stock.docTypeNotSupported'

  const v = values || {}

  if (!v.storageId) {
    return form.twoStorages
      ? 'products:docs.fromStorageRequiredError'
      : 'products:docs.storageRequiredError'
  }

  if (form.twoStorages) {
    if (!v.toStorageId) return 'products:docs.toStorageRequiredError'
    // Said here as well as in the function, which raises transfer_same_storage
    // — measured. The database still refuses it; this is the difference
    // between a sentence beside the field and a round trip in Postgres English.
    if (v.toStorageId === v.storageId) return 'products:stock.transferSameStorage'
  }

  // ⚠️ The database may or may not demand a supplier — stock_documents
  // .supplier_id is nullable and no CHECK on it has been read back. It is
  // demanded here anyway for the two documents that have one: a supply is a
  // receipt FROM somebody and a return goes back TO somebody. Without the name
  // there is nothing to owe, nothing to return to, and no way to answer "what
  // did we buy from them this year" — and the answer would be quietly wrong
  // rather than missing, because the document still moves the balance.
  if (form.supplier === 'required' && !v.supplierId) {
    return 'products:docs.supplierRequiredError'
  }

  // Missing, unreadable, or in the future — one decision in one place, shared
  // with the stocktake below rather than written twice.
  return documentDateError(v.docDate)
}

// What the document holds, and what it costs when it costs anything.
//
// unit_cost on a line is per BASE unit, because that is what the moving average
// is kept in. The money somebody typed is per entered unit, so the line total is
// entered × typed — which is also quantity_base × unit_cost, the same number
// reached the other way. Multiplying the base quantity by the typed price would
// be the packaging factor times too much: plausible on every line, and only
// visible in a yearly total.
//
// A document with no prices reports null for the money rather than 0. An
// issue's cost is the moving average at that instant, which only the function
// knows — and "nothing was typed" is not the statement "it costs nothing".
export function documentTotals(docType, rows) {
  const form = docForm(docType)
  let lineCount = 0
  let total = 0

  for (const row of rows || []) {
    if (!row.productId) continue
    lineCount += 1
    if (!form || !form.cost) continue
    const quantity = Number(row.enteredQuantity)
    const cost = Number(row.unitCost)
    if (!Number.isFinite(quantity) || !Number.isFinite(cost)) continue
    total += quantity * cost
  }

  return { lineCount, total: form && form.cost ? total : null }
}

// The payload for the function that owns this document, or the first reason
// there is none.
//
// Validation runs before the lines are built, so somebody who forgot the
// supplier is told that rather than being told about the third row's units.
export function stockDocumentPayload(docType, values, productsById) {
  const validationKey = validateStockDocument(docType, values)
  if (validationKey) return { error: validationKey }

  const form = docForm(docType)

  // Two storages means a different function with a different signature, not a
  // flag on this one. That was settled when transfer was kept out of
  // post_stock_document: a signature accepting invalid combinations turns the
  // guard back into application code.
  if (form.twoStorages) {
    const { lines, error } = transferLines({ rows: values.rows, productsById })
    if (error) return { error }
    return {
      payload: {
        fromStorageId: values.storageId,
        toStorageId: values.toStorageId,
        docDate: values.docDate,
        note: values.note || null,
        lines,
      },
    }
  }

  const { lines, error } = stockDocumentLines({ docType, rows: values.rows, productsById })
  if (error) return { error }

  return {
    payload: {
      docType,
      storageId: values.storageId,
      supplierId: form.supplier === 'none' ? null : values.supplierId,
      docDate: values.docDate,
      note: values.note || null,
      // The supplier's own invoice number, and only where there is a supplier
      // to have one. ⚠️ Blank becomes null, never '': two ways to say "no
      // reference" would mean the filter sees one of them and not the other,
      // and every count of "documents with a number" would be wrong.
      supplierDocNumber: hasSupplier(docType)
        ? (String(values.supplierDocNumber ?? '').trim() || null)
        : null,
      lines,
    },
  }
}

// The stocktake's payload, and the reason it exists before its screen does.
//
// ⚠️ The owner's condition on the future-date ban was "one shared place
// covering all five writers INCLUDING the stocktake". The stocktake is
// deliberately not in DOC_FORMS — it sends counts rather than movements, and
// folding it in would make `rows` mean two things (the comment at the top of
// this file). So sharing the rule needed a second door rather than a wider one.
//
// ⚠️ And a rule written for a screen that does not exist yet is a rule nobody
// applies. post_stocktake and stocktakeLines have both been sitting unused —
// the pattern items 49 and 50 name, where the engine ran ahead of the screens.
// Building the door now means the screen walks through a validated entrance
// instead of assembling a payload beside one.
//
// An empty stocktake is allowed, unlike every other document: counting fifty
// products and finding forty-seven right is the ordinary result, and the fact
// that a count HAPPENED is worth recording with its date even when nothing
// moved (item 44).
export function stocktakePayload(values, productsById) {
  const v = values || {}

  if (!v.storageId) return { error: 'products:docs.storageRequiredError' }

  const dateError = documentDateError(v.docDate)
  if (dateError) return { error: dateError }

  const { lines, error } = stocktakeLines({ rows: v.rows, productsById })
  if (error) return { error }

  return {
    payload: {
      storageId: v.storageId,
      docDate: v.docDate,
      note: v.note || null,
      lines,
    },
  }
}

// Which storages a document may name.
//
// An archived storage is dropped, and one already chosen is kept — the same
// rescue as supplierChoices, for the same reason: a select whose value matches
// no option shows its first one instead, which here would silently move the
// document to a different storage.
export function storageChoices(storages, selectedId) {
  return (storages || []).filter((s) => s.is_active !== false || s.id === selectedId)
}

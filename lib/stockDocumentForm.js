import { stockDocumentLines, transferLines, stocktakeLines } from './stockDocument'
import { documentDateError } from './documentDate'
import { hasSupplier } from './documentFilters'
import { validateDocumentMoney, allocateDocument } from './documentMoney'

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
// ⚠️ TWO FLAGS, BECAUSE `cost` WAS ANSWERING TWO QUESTIONS AND ONLY ONE OF THEM
// OUT LOUD. It meant "a price is typed here" and was also read as "there is
// money on this document" — the same word for both, which was harmless for as
// long as the two were true together. Stage 4 pulled them apart: a return is
// priced (the supplier credits a price back) and its cost is NOT that price
// (the goods leave at the storage average). One flag could only answer one way,
// and it answered the old question, so the return screen kept the old shape.
//
//   money      — there is a priced conversation with a counterparty. Prices are
//                typed, discounts apply, the ladder is drawn, a balance moves.
//   stampsCost — the typed price becomes the stamped unit_cost. Receipts only;
//                an issue's cost comes from the chain and never from a box.
//
// The old name is deliberately GONE rather than kept with a narrowed meaning: a
// reader who still writes `form.cost` gets undefined, and undefined is falsy —
// the failure would be silent and would look exactly like this one.
export const DOC_FORMS = {
  supply: { supplier: 'required', money: true, stampsCost: true, twoStorages: false },
  // A write-off names nobody: the goods are gone, not returned. No counterparty
  // means no money — there is nobody for a discount to be a discount from.
  write_off: { supplier: 'none', money: false, stampsCost: false, twoStorages: false },
  // ⚠️ Priced, but not costed. What is typed here decides what the supplier
  // gives back; what the goods COST leaving is the storage average, which only
  // the function knows. Both facts about one document, and neither implies the
  // other.
  return_to_supplier: { supplier: 'required', money: true, stampsCost: false, twoStorages: false },
  // Transfer has no supplier and no price — the goods keep the cost they were
  // received at, which the function copies from the source storage's average.
  transfer: { supplier: 'none', money: false, stampsCost: false, twoStorages: true },
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
export function documentTotals(docType, rows, money) {
  const form = docForm(docType)
  const lineCount = (rows || []).filter((r) => r.productId).length
  // ⚠️ `money`, not `stampsCost`. A return draws the full ladder — it is the
  // refund being computed, not a cost. Gating this on the cost flag is what
  // left the return screen with no money on it at all.
  if (!form || !form.money) return { lineCount, total: null, ladder: null }

  // ⚠️ THE SAME ALLOCATION THE PAYLOAD USES, not a second sum beside it. The
  // ladder drawn on screen and the cost that gets stamped have to be one
  // computation, or the figure somebody agreed to is not the figure that was
  // posted — and unit_cost is stamped for good (ADR-051), so the disagreement
  // would be permanent.
  const ladder = allocateDocument({ lines: rows, ...(money || {}) })
  return { lineCount, total: ladder.net, ladder }
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

  // ⚠️ THE BONUS BELONGS TO A RECEIPT, and this runs BEFORE the transfer branch
  // rather than after it. Placed lower it read as universal and was not: a
  // transfer returns from this function early, so a bonus on one was dropped in
  // silence instead of refused — the line simply did not carry the field to a
  // function that never reads it. Nothing was corrupted, and nobody was told
  // either, which is the half that matters.
  //
  // This is the only layer that can say it: documentMoney sees a line and never
  // the document it sits on, and the database cannot see it either — doc_type
  // lives on stock_documents and a CHECK cannot read another table (051a). So
  // the rule has exactly two homes, here and inside post_stock_document.
  //
  // `stampsCost` and not `money`: free goods arrive, they do not leave. A
  // return where the supplier credits less than was sent is a document
  // discount, which already exists.
  if (!form.stampsCost) {
    for (const row of values.rows || []) {
      if (!row.productId) continue
      if (String(row.bonusQuantity ?? '').trim() !== '') {
        return { error: 'products:money.bonusSupplyOnly' }
      }
    }
  }

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

  // ⚠️ THE BLANK PRICE IS REFUSED HERE NOW, not inside stockLine, and the move
  // is forced rather than tidy. stockLine used to receive the typed price and
  // refuse a blank one; it now receives the ALLOCATED price, which is never
  // blank and can legitimately be zero. Left there, the guard would have gone
  // quiet exactly when it still matters — an untouched box would arrive as a
  // computed 0 and stamp the ledger, which is the poisoning that started all of
  // this.
  //
  // Blank before Number() ever sees it: Number('') and Number('   ') are both 0.
  //
  // ⚠️ And on a RETURN too, though nothing there stamps a cost. The harm has
  // the same shape in the other ledger: an untouched box becomes Number('') === 0
  // becomes "the supplier owes us nothing for these goods" — a claim, silently,
  // from a blank. Somebody returning goods with no credit types 0, which is a
  // statement. Blank is never one.
  if (form.money) {
    for (const row of values.rows || []) {
      if (!row.productId) continue
      if (String(row.enteredUnitPrice ?? '').trim() === '') {
        return { error: 'products:stock.unitCostRequired' }
      }
    }
  }

  // Money second, because a line refused for its discount must be refused
  // before its net joins a sum that other lines are divided by.
  const moneyError = validateDocumentMoney({
    lines: values.rows, ...values,
  })
  if (moneyError) return { error: moneyError }

  // ⚠️ The allocation runs HERE and not in the database, and that is deliberate:
  // post_stock_document already accepts a unit cost per line for a supply, and a
  // landed cost is a unit cost. No new arithmetic runs under the lock, and the
  // split stays where tests reach it.
  // ⚠️ `stampsCost` here, and this is the half that must NOT widen. The
  // allocation exists to produce a landed unit_cost, and a return has none to
  // produce: its goods leave at the storage average. Running it would be
  // harmless arithmetic; USING it would overwrite a computed cost with a typed
  // one, permanently (ADR-051).
  const allocation = form.stampsCost
    ? allocateDocument({ lines: values.rows, ...values })
    : null

  const priced = (values.rows || []).map((row, i) => (
    allocation && row.productId
      // stockLine divides by the packaging factor, exactly as it does with a
      // typed price — so it is handed the landed price per ENTERED unit.
      ? { ...row, unitCost: allocation.lines[i].landedUnitPrice }
      : row
  ))

  const { lines, error } = stockDocumentLines({ docType, rows: priced, productsById })
  if (error) return { error }

  // What the invoice said, carried beside what it cost. Neither is derivable
  // from the other: a landed unit_cost cannot say the paper read 100 with 10%
  // off, and the typed price cannot say what the freight added.
  const withLineMoney = lines.map((line, i) => {
    const row = (values.rows || []).filter((r) => r.productId)[i]
    if (!row) return line
    return {
      ...line,
      // ⚠️ `money`: what the paper said is worth keeping on a return too — it
      // is the credit claimed, and no other column records it. The DB stores it
      // for every doc type already (050c inserts one column list), so this
      // needed no script.
      entered_unit_price: form.money ? Number(row.enteredUnitPrice) : null,
      line_discount_kind: row.lineDiscountKind || null,
      line_discount_value: String(row.lineDiscountValue ?? '').trim() === ''
        ? null
        : Number(row.lineDiscountValue),
      // ⚠️ Stored for READING, not for arithmetic: the division already
      // happened above, in the allocation, and unit_cost arrives landed. What
      // this carries is the row's own explanation of a cost that is lower than
      // the price beside it — and at bonus = quantity, of a zero that would
      // otherwise be indistinguishable from an untouched box.
      bonus_quantity: form.stampsCost && String(row.bonusQuantity ?? '').trim() !== ''
        ? Number(row.bonusQuantity)
        : null,
    }
  })

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
      // ⚠️ Blank becomes null throughout, never '' or 0: two ways to say "none"
      // means a filter or a sum sees one of them and not the other.
      discountKind: values.discountKind || null,
      discountValue: numberOrNull(values.discountValue),
      transportAmount: numberOrNull(values.transportAmount),
      transportPaidTo: values.transportPaidTo || null,
      // ⚠️ On a return this is money RECEIVED, not paid. The column is shared
      // and the direction is not — supplierBalanceEffect knows it from docType,
      // and the screen flips the label.
      paidAmount: numberOrNull(values.paidAmount),
      // Null when nothing moved. "On account" is never stored: it is derived
      // from the settled amount falling short of the net.
      paymentMethod: numberOrNull(values.paidAmount) ? (values.paymentMethod || null) : null,
      lines: withLineMoney,
    },
  }
}

const numberOrNull = (value) => {
  const text = String(value ?? '').trim()
  if (text === '') return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
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

import { supabase } from './supabaseClient'

// The three writes that have to happen inside one transaction, each behind the
// database function that owns it.
//
// Nothing here decides anything. The lines were built by lib/stockDocument.js
// and the costing happens inside the function under a lock, because it reads
// the balance before it writes and a read-then-write from the browser is a
// race by construction. What is left is passing the payload and reading the
// answer, which is exactly what an injectable client makes testable.
//
// The client parameter is not decoration: without it these could only be
// checked by talking to a real database, and what needs checking is that the
// right function was called with the right arguments.

export async function postStockDocument(
  {
    docType, storageId, lines, supplierId, employeeId, appointmentId, docDate,
    note, supplierDocNumber,
    discountKind, discountValue, transportAmount, transportPaidTo,
    paidAmount, paymentMethod,
  },
  client = supabase
) {
  const { data, error } = await client.rpc('post_stock_document', {
    p_doc_type: docType,
    p_storage_id: storageId,
    p_lines: lines,
    p_supplier_id: supplierId || null,
    p_employee_id: employeeId || null,
    p_appointment_id: appointmentId || null,
    p_doc_date: docDate || null,
    p_note: note || null,
    // ⚠️ The parameter has DEFAULT NULL in the function, so this call worked
    // before the column existed and works after — the migration and this code
    // do not have to ship together, in either order.
    p_supplier_doc_number: supplierDocNumber || null,
    // ⚠️ Every one of these has DEFAULT NULL in the function, so this call
    // works before the migration and after it, in either order.
    p_discount_kind: discountKind || null,
    p_discount_value: discountValue ?? null,
    p_transport_amount: transportAmount ?? null,
    p_transport_paid_to: transportPaidTo || null,
    p_paid_amount: paidAmount ?? null,
    p_payment_method: paymentMethod || null,
  })

  if (error) return { ok: false, error, documentId: null }
  // The function returns the new document's id. Nothing back is a refusal
  // that did not announce itself — the same rule every write here follows.
  if (!data) return { ok: false, error: null, documentId: null }
  return { ok: true, error: null, documentId: data }
}

// Two storages, so its own function rather than two optional parameters on the
// one above. A signature that accepts invalid combinations turns the guard
// into application code, which is what the set-nesting rule refused.
export async function transferStock(
  { fromStorageId, toStorageId, lines, employeeId, docDate, note },
  client = supabase
) {
  const { data, error } = await client.rpc('transfer_stock', {
    p_from_storage_id: fromStorageId,
    p_to_storage_id: toStorageId,
    p_lines: lines,
    p_employee_id: employeeId || null,
    p_doc_date: docDate || null,
    p_note: note || null,
  })

  if (error) return { ok: false, error, documentId: null }
  if (!data) return { ok: false, error: null, documentId: null }
  return { ok: true, error: null, documentId: data }
}

// Counts, not movements. The difference against the balance is worked out
// inside the function under its lock, because working it out here would mean
// reading the balance and sending an answer that a sale in between makes
// wrong — and the operation that exists to make the record match reality would
// become the one that breaks it.
export async function postStocktake(
  { storageId, lines, employeeId, docDate, note },
  client = supabase
) {
  const { data, error } = await client.rpc('post_stocktake', {
    p_storage_id: storageId,
    p_lines: lines,
    p_employee_id: employeeId || null,
    p_doc_date: docDate || null,
    p_note: note || null,
  })

  if (error) return { ok: false, error, documentId: null }
  if (!data) return { ok: false, error: null, documentId: null }
  return { ok: true, error: null, documentId: data }
}

// The same posting, from a session whose counts were written as they were
// typed rather than from an array assembled in the browser.
//
// ⚠️ NO LINES ARGUMENT, and that is the whole difference. postStocktake above
// sends what the page is holding, so a reload before pressing the button loses
// every count. Here the counts are already rows, and the browser contributes
// only the id of the session they belong to — which is why a count survives a
// reload, a closed browser and a different device.
//
// ⚠️ A SECOND FUNCTION IN THE DATABASE, TEMPORARILY. post_stocktake still
// exists so the current screen keeps working while this one is wired up, and
// 054e drops it once the screen has moved — two functions writing stocktakes is
// two answers to one question.
//
// The session id is also the idempotency key the old call never had: the
// function locks the session and refuses one that already carries a document,
// so a double click or a retry after a reply that never arrived meets
// session_already_posted instead of posting a second stocktake.
export async function postStocktakeSession(
  { sessionId, employeeId, docDate, note },
  client = supabase
) {
  const { data, error } = await client.rpc('post_stocktake_session', {
    p_session_id: sessionId,
    p_employee_id: employeeId || null,
    p_doc_date: docDate || null,
    p_note: note || null,
  })

  if (error) return { ok: false, error, documentId: null }
  if (!data) return { ok: false, error: null, documentId: null }
  return { ok: true, error: null, documentId: data }
}

// No lines at all, deliberately. A reversal copies the stamped cost of what it
// reverses; letting a caller supply lines would let it reverse something else,
// or the same thing at today's average, and the difference would sit in the
// ledger with nothing to explain it.
export async function reverseStockDocument({ documentId, note }, client = supabase) {
  const { data, error } = await client.rpc('reverse_stock_document', {
    p_document_id: documentId,
    p_note: note || null,
  })

  if (error) return { ok: false, error, documentId: null }
  if (!data) return { ok: false, error: null, documentId: null }
  return { ok: true, error: null, documentId: data }
}

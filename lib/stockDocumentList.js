// Reading a stock document back, for a person.
//
// ⚠️ The rule this file exists to hold, and it came from the owner failing to
// recognise his own movement: he entered 5 packages, the row says 75, and he
// said "I don't remember transferring 75 — I transferred 5". Both are true.
//
//   Every quantity shown to a person carries the frame it was entered in.
//
// Not 75 alone: the person who typed it does not recognise it. Not 5 alone: it
// cannot be added to a line entered in pieces. Only both are honest to the
// reader and to the arithmetic at once.
//
// And the number never governs the word after it — "5 عبوات" versus "5 عبوة"
// is a grammar branch we refuse to have (CLAUDE.md), so the unit is named
// first and the number follows it. That is why these return label/value pairs
// rather than a sentence: the screen puts the unit before the number.
export const REVERSIBLE_TYPES = ['supply', 'write_off', 'return_to_supplier', 'transfer', 'stocktake', 'opening']

// One movement, described in both frames at once — and in which direction.
//
// ⚠️ The direction was missing, and "no minus sign" was reported as a good
// thing when it was the gap. On a transfer it is recoverable: the header names
// two storages and the line names one of them. Nowhere else:
//
//   A write-off line reads exactly like a supply line — "75" either way.
//   Worse, a REVERSAL's lines are the exact opposite of the document it
//   undoes, and the list shows the two next to each other. Without direction
//   the correction looks like a copy of the mistake.
//
// It is a word rather than a sign. A minus in front of a number inside an
// Arabic line is a neutral character between two directions, which is the
// whole subject of lib/timeRangeDirection.test.js — and "خارج" cannot be
// rendered backwards.
export function movementFrames(movement, product) {
  const signed = Number(movement.quantity_base)
  const base = Math.abs(signed)
  const entered = movement.entered_quantity == null ? null : Math.abs(Number(movement.entered_quantity))
  const uom = movement.entered_uom || null

  return {
    // 'in' or 'out' of the storage named on this line. Zero is neither, and a
    // zero-quantity movement should not exist — if one does, saying "in" about
    // it would be inventing a direction.
    direction: signed > 0 ? 'in' : signed < 0 ? 'out' : null,
    // What was typed, and in what. Null when the movement was produced by the
    // database rather than typed — a stocktake adjustment has no entered frame
    // because nobody entered it.
    entered,
    uom,
    // What was stored, always in the product's base unit.
    base,
    baseUnit: product ? product.base_unit : null,
    // True only when the two frames are the same STATEMENT, not merely the
    // same number.
    //
    // ⚠️ This used to collapse on equal numbers, and the owner found the hole:
    // a product with units_per_package = 1 stores 10 for "10 packages", so the
    // screen dropped the frame and showed "in pieces: 10" — losing the very
    // thing the rule exists to keep. Packaging factor 1 is most simple
    // products, so the rule was off for the common case and on for the rare
    // one.
    //
    // Entering in the base unit is the only case where the two say the same
    // thing, and then repeating it is noise rather than information.
    sameFrame: uom === 'unit',
  }
}

// What one unit cost, in the frames a person can check.
//
// ⚠️ THE RULE IS ABOUT EVERY NUMBER, NOT EVERY QUANTITY. It was written as
// "every quantity shown to a person carries the frame it was entered in", and
// applied to exactly half a line: the quantity said بالعبوة: 5 · بالقطعة: 5
// and the price beside it said "cost of the unit" without saying which unit.
// A price is read two ways for the same reason a quantity is.
//
// ⚠️ ONE frame here, not two — and the difference from the quantity is the
// whole reason. A quantity shows both because BOTH ARE STORED COLUMNS:
// entered_quantity and quantity_base are each recorded, so showing them side
// by side reports two facts. A price has only one recorded frame — unit_cost,
// per base unit, because lib/stockDocument.js divides the typed figure by the
// packaging factor on the way in. The typed price is not kept anywhere.
//
// Reconstructing it (cost × factor) was built and measured, and the first real
// render printed "تكلفة العبوة: 100.0005 ₪" for a price typed as 100: the
// column keeps four decimals, so 100/15 comes back as 6.6667 and multiplying
// out misses. Rounding hides that at two decimals for ordinary factors, but
// the scale of the column is not something I can read — stock_movements is not
// in DATABASE_DIAGRAM.md and RLS returns nothing — so the error has no bound I
// can state.
//
// A derived number drawn beside a recorded one, on a money line, in the module
// whose whole history is a wrong unit_cost, is the thing ADR-051 refuses.
//
// So: the unit is named, and nothing is invented.
//
// Returns null when there is no cost at all — "0" would be a claim about one.
export function costFrames(movement, product) {
  const raw = movement.unit_cost
  if (raw === null || raw === undefined || String(raw).trim() === '') return null
  const base = Number(raw)
  if (!Number.isFinite(base)) return null

  return {
    base,
    baseUnit: product ? product.base_unit : null,
  }
}

// What a whole document was worth.
//
// ⚠️ The list showed the storage, the supplier, what is in it and how many
// lines — and not what it cost. The entry screen shows a running total while
// somebody types and then it is gone forever, so the number that matters most
// on a supply document is visible only while writing it. Nobody opening a list
// of documents is looking for "how many lines"; they are looking for the
// expensive one.
//
// ⚠️ NOT the net sum. The heavier side.
//
// The net was the first answer and it made a transfer read "الإجمالي: 0 ₪" —
// true, and useless, and colliding with a POISONED supply whose total is also
// 0 but means "this cost nothing", which is the fault this module spent itself
// chasing. Two documents, one badge, opposite meanings.
//
// Hiding the transfer's total was the next idea and it is worse: an absent
// number reads as "not calculated" exactly as it reads as "nothing" — the
// distinction this module has now drawn three times. It trades one ambiguity
// for another.
//
// The heavier side answers every type with one rule and no type knowledge:
//
//   supply      positives 2000, negatives 0     → 2000   what was paid
//   write-off   positives 0,    negatives 300   → 300    what was lost
//   transfer    positives 500,  negatives 500   → 500    what moved
//   reversal    positives 0,    negatives 1000  → 1000   what was undone
//
// And the minus never reaches the screen: a minus inside an Arabic line is a
// neutral character between two directions (lib/timeRangeDirection.test.js).
// The WORD carries the meaning — see DOCUMENT_VALUE_LABEL.
export function documentValue(movements, documentId, productsById) {
  let positive = 0
  let negative = 0
  let priced = false
  for (const m of movementsOf(movements, documentId)) {
    const cost = costFrames(m, (productsById || {})[m.product_id])
    if (!cost) continue
    const quantity = Number(m.quantity_base)
    if (!Number.isFinite(quantity)) continue
    priced = true
    const value = quantity * cost.base
    if (value < 0) negative += -value
    else positive += value
  }
  // Not priced at all is a different thing from priced at zero, and only the
  // first should show nothing. Zero must stay visible — it is the poisoned
  // pair's own signature.
  return priced ? Math.max(positive, negative) : null
}

// ⚠️ "الإجمالي" is "الوحدة" one level up: a word that says "a sum" and never
// says a sum of WHAT. It was fixed on the line an hour earlier and left
// standing on the header.
//
// Each document type answers a different question, and the number is identical
// in all of them — so only the word can tell them apart. A transfer that says
// "قيمة المنقول: 500 ₪" claims nothing about cost, which is precisely what
// removes the collision with a supply that says "كلفة التوريد: 0 ₪" — and that
// one MUST stay visible, because it is the fault itself.
//
// Full keys rather than a built suffix, so lib/translationKeys.test.js sees
// them as the literals they are and checks every one.
export const DOCUMENT_VALUE_LABEL = {
  supply: 'products:documents.valueSupply',
  write_off: 'products:documents.valueWriteOff',
  return_to_supplier: 'products:documents.valueReturn',
  transfer: 'products:documents.valueTransfer',
  reversal: 'products:documents.valueReversal',
  stocktake: 'products:documents.valueStocktake',
  opening: 'products:documents.valueOpening',
}

// A type nobody has written a word for yet says the neutral thing rather than
// a wrong one. Sale and service_consumption reach this today.
export const DOCUMENT_VALUE_FALLBACK = 'products:documents.valueGeneric'

export function documentValueLabel(docType) {
  return DOCUMENT_VALUE_LABEL[docType] || DOCUMENT_VALUE_FALLBACK
}

// Whether this document can still be reversed.
//
// ⚠️ A document already reversed must not offer the button again — pressing it
// twice would post a second counter-document and swing the balance the other
// way, which is worse than the mistake being corrected.
//
// stock_documents has reverses_document_id, and it points from the reversal to
// its original — never the other way. So "was I undone" is genuinely a question
// about other rows rather than a flag on this one, and that is the right
// direction: a document is written once and the thing that undoes it is written
// later, so only the later row can carry the link.
//
// ⚠️ It is answered from the set handed in, which is complete today only
// because the screen loads every document at once. Paging would make a
// reversal on another page invisible here, the button would light up on an
// already-reversed document, and reverse_stock_document would answer
// already_reversed to a screen that did not expect it. Named in a test rather
// than left to this comment — see "says yes to a reversed document whose
// reversal was not loaded".
export function reversalState(document, allDocuments) {
  if (!document) return { canReverse: false, reason: 'missing' }

  if (document.reverses_document_id) {
    // A reversal is not itself reversed — that is just the original again, and
    // it would leave three documents where one mistake happened.
    return { canReverse: false, reason: 'isReversal' }
  }

  const undoneBy = (allDocuments || []).find((d) => d.reverses_document_id === document.id)
  if (undoneBy) return { canReverse: false, reason: 'alreadyReversed', by: undoneBy.id }

  if (!REVERSIBLE_TYPES.includes(document.doc_type)) {
    return { canReverse: false, reason: 'typeNotReversible' }
  }

  return { canReverse: true, reason: null }
}

// Newest first, because the document somebody wants is nearly always the one
// they just posted — and the two that need correcting today are the two most
// recent. Ties broken by created_at, since doc_date is a date the person chose
// and several documents share one.
export function sortDocuments(documents) {
  return [...(documents || [])].sort((a, b) => {
    const byDate = String(b.doc_date || '').localeCompare(String(a.doc_date || ''))
    if (byDate !== 0) return byDate
    return String(b.created_at || '').localeCompare(String(a.created_at || ''))
  })
}

export function movementsOf(movements, documentId) {
  return (movements || []).filter((m) => m.document_id === documentId)
}

// What tells one document apart from another, in words a person can check.
//
// ⚠️ The confirmation box said the type and the date and nothing else, and the
// owner has two supply documents on the same date, into the same storage, from
// the same supplier, with the same line count — so it described both. He could
// not tell them apart from two screenshots taken an hour after posting them.
//
// stock_documents has no doc_number (measured), so there is no human handle to
// print. What distinguishes them is what is in them: the products. So that is
// what the box says.
//
// A destructive confirmation described by something that does not identify its
// target is worse than one with no description, because the first reassures.
export function documentProductNames(movements, documentId, productsById, limit = 3) {
  const seen = []
  for (const m of movementsOf(movements, documentId)) {
    const name = (productsById || {})[m.product_id]?.name
    // A transfer names the same product twice, once per storage.
    if (name && !seen.includes(name)) seen.push(name)
  }
  return { names: seen.slice(0, limit), more: Math.max(0, seen.length - limit) }
}

// The date a person should read, out of a timestamptz.
//
// doc_date arrives as '2026-08-04T00:00:00+00:00' and created_at as
// '...T20:25:54.798153+00:00' — both were being printed raw, machine text in
// the middle of an Arabic sentence. Only the date part is meaningful for a
// document somebody dated themselves.
export function documentDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

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

// One movement, described in both frames at once.
export function movementFrames(movement, product) {
  const base = Math.abs(Number(movement.quantity_base))
  const entered = movement.entered_quantity == null ? null : Math.abs(Number(movement.entered_quantity))
  const uom = movement.entered_uom || null

  return {
    // What was typed, and in what. Null when the movement was produced by the
    // database rather than typed — a stocktake adjustment has no entered frame
    // because nobody entered it.
    entered,
    uom,
    // What was stored, always in the product's base unit.
    base,
    baseUnit: product ? product.base_unit : null,
    // True when the two frames are the same number, so the screen can show one
    // instead of repeating itself: entering 3 pieces of a pcs product stores 3.
    sameFrame: entered !== null && entered === base,
  }
}

// Whether this document can still be reversed.
//
// ⚠️ A document already reversed must not offer the button again — pressing it
// twice would post a second counter-document and swing the balance the other
// way, which is worse than the mistake being corrected.
//
// stock_documents has reverses_document_id (this document undoes that one) and
// no column saying "I was undone". So being reversed is not a flag to read but
// a question to ask of the set: does any document point at me?
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

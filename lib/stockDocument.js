// Turning what somebody typed into the lines a stock document is made of.
//
// The pure half of the write, beside lib/stockIO.js — the same split
// bulkRelease.js and bulkReleaseIO.js already use. What can be decided without
// touching the database is decided here, where it can be tested; the function
// keeps only what has to happen under a lock, which is the costing.

// Receipts carry a price because somebody paid it. Issues do not: their cost
// is the moving average at that instant, worked out inside the function and
// stamped onto the row. The database branches on exactly this list, and a
// second copy of the rule would be a second thing to keep in step — so this
// one decides the sign, and never the cost of an issue.
export const RECEIPT_TYPES = ['supply', 'opening']
export const ISSUE_TYPES = ['write_off', 'return_to_supplier', 'sale', 'service_consumption']

// Three types are absent on purpose, and each has its own function whose
// signature says what it does: transfer needs two storages, reversal needs a
// document to copy, and stocktake sends counts rather than movements.
//
// stocktake used to be here, signed by the caller. That was wrong in the way
// the transfer parameters were wrong: p_lines meaning something different
// depending on p_doc_type is a payload that accepts invalid combinations, and
// the guard against sending the wrong shape goes back to being application
// code. A counted quantity handed to a supply would have been ignored in
// silence, and a movement handed to a stocktake likewise.
const OWN_FUNCTION = ['transfer', 'reversal', 'stocktake']

const UOM = ['package', 'portion', 'unit']

// How many base units one entered unit is worth.
//
// A package is units_per_package of them and a portion is units_per_portion,
// both expressed in the product's own base unit — which is why there are two
// factors and not three levels. Everything stored is base units; packages and
// portions are how people talk, converted at the edge.
export function baseUnitsFor(product, enteredUom) {
  if (!product) return null
  if (enteredUom === 'unit') return 1
  if (enteredUom === 'package') {
    const factor = Number(product.units_per_package)
    return Number.isFinite(factor) && factor > 0 ? factor : null
  }
  if (enteredUom === 'portion') {
    const factor = Number(product.units_per_portion)
    return Number.isFinite(factor) && factor > 0 ? factor : null
  }
  return null
}

// One line, or an error key saying why not.
//
// The whole-number check on pcs lives here because it cannot live in the
// database: stock_movements does not know a product's base unit without a
// join, and a CHECK cannot join. It was promised at the schema and this is
// where the promise gets kept — half a hairpin is not a thing.
export function stockLine({ docType, product, enteredQuantity, enteredUom, unitCost }) {
  if (!product) return { error: 'products:stock.productRequired' }
  if (!UOM.includes(enteredUom)) return { error: 'products:stock.uomInvalid' }

  const entered = Number(enteredQuantity)
  if (!Number.isFinite(entered) || entered === 0) return { error: 'products:stock.quantityRequired' }

  const factor = baseUnitsFor(product, enteredUom)
  if (factor === null) return { error: 'products:stock.uomUnavailable' }

  const magnitude = Math.abs(entered) * factor
  if (product.base_unit === 'pcs' && magnitude !== Math.round(magnitude)) {
    return { error: 'products:stock.wholePiecesOnly' }
  }

  // The sign is the document's, not the typist's — nobody should have to
  // remember that a write-off is negative. With stocktake gone to its own
  // function there is no exception left: every document here is a receipt or
  // an issue, and the rule has no third branch.
  let quantityBase
  if (RECEIPT_TYPES.includes(docType)) quantityBase = magnitude
  else if (ISSUE_TYPES.includes(docType)) quantityBase = -magnitude
  else return { error: 'products:stock.docTypeNotSupported' }

  const line = {
    product_id: product.id,
    quantity_base: quantityBase,
    entered_quantity: entered,
    entered_uom: enteredUom,
  }

  if (RECEIPT_TYPES.includes(docType)) {
    const cost = Number(unitCost)
    if (!Number.isFinite(cost) || cost < 0) return { error: 'products:stock.unitCostRequired' }
    // Per base unit, always. A price typed per package would silently multiply
    // the cost of everything issued from it by the packaging factor.
    line.unit_cost = cost / factor
  }

  return { line }
}

// Every line, or the first reason there is no document to send.
export function stockDocumentLines({ docType, rows, productsById }) {
  if (!rows || rows.length === 0) return { error: 'products:stock.documentEmpty' }

  const lines = []
  const seen = new Set()
  for (const row of rows) {
    const product = (productsById || {})[row.productId]
    // One product twice in one document would be two movements the balance
    // adds up correctly and nobody can read. Kept out here rather than in the
    // database, which has no reason to forbid it.
    if (product && seen.has(product.id)) return { error: 'products:stock.duplicateProduct' }

    const { line, error } = stockLine({ ...row, docType, product })
    if (error) return { error }
    seen.add(product.id)
    lines.push(line)
  }

  return { lines }
}

// ── Transfer ─────────────────────────────────────────────────────────────
//
// One line, two movements, and neither sign is decided here. transfer_stock
// takes the quantity as a magnitude and writes it out of one storage and into
// the other itself — which is the only way the two can be guaranteed to agree.
// A caller that sent −5 and +5 could send −5 and +4, and the difference would
// sit in the balances with nothing to explain it.
//
// ⚠️ This line shape is NOT measured. Every probe from outside stops at
// storage_not_found because RLS hides every real storage, so what
// transfer_stock reads out of p_lines is unread. The fields mirror the other
// documents' lines, which is the reasonable shape and not a verified one — and
// the first real transfer the owner runs is what settles it.
//
// No cost, deliberately: goods keep what they were received at, and the
// function copies it from the source storage's average. A cost typed here
// would be a second opinion about a number that is already known.
export function transferLines({ rows, productsById }) {
  if (!rows || rows.length === 0) return { error: 'products:stock.documentEmpty' }

  const lines = []
  const seen = new Set()

  for (const row of rows) {
    const product = (productsById || {})[row.productId]
    if (!product) return { error: 'products:stock.productRequired' }
    if (seen.has(product.id)) return { error: 'products:stock.duplicateProduct' }
    if (!UOM.includes(row.enteredUom)) return { error: 'products:stock.uomInvalid' }

    const entered = Number(row.enteredQuantity)
    // Zero moves nothing and a negative is a transfer in the other direction
    // wearing a disguise — which is what the two storage fields are for.
    if (!Number.isFinite(entered) || entered <= 0) {
      return { error: 'products:stock.quantityRequired' }
    }

    const factor = baseUnitsFor(product, row.enteredUom)
    if (factor === null) return { error: 'products:stock.uomUnavailable' }

    const magnitude = entered * factor
    if (product.base_unit === 'pcs' && magnitude !== Math.round(magnitude)) {
      return { error: 'products:stock.wholePiecesOnly' }
    }

    seen.add(product.id)
    lines.push({
      product_id: product.id,
      quantity_base: magnitude,
      entered_quantity: entered,
      entered_uom: row.enteredUom,
    })
  }

  return { lines }
}

// ── Stocktaking ──────────────────────────────────────────────────────────
//
// A count, never a movement. "I counted seven" is what somebody knows; the
// difference against the balance is arithmetic they cannot do safely, because
// the balance can move between reading it and sending the answer — and then
// the operation that exists to make the record match reality becomes the thing
// that breaks it, silently. So the difference is worked out inside
// post_stocktake, under the lock it already takes.
//
// No sign here at all. A count is a quantity of things present, and a negative
// one is not a smaller count, it is nonsense.
export function stocktakeLine({ product, countedQuantity, enteredUom }) {
  if (!product) return { error: 'products:stock.productRequired' }
  if (!UOM.includes(enteredUom)) return { error: 'products:stock.uomInvalid' }

  // Blank is refused before Number() ever sees it, and this is not pedantry:
  // Number('') and Number(null) are both 0, so an untouched field would read
  // as "I counted zero" — and zero is the one count that writes the whole
  // balance off. A row nobody filled in must not be able to empty a shelf.
  if (countedQuantity === '' || countedQuantity === null || countedQuantity === undefined) {
    return { error: 'products:stock.countInvalid' }
  }

  const counted = Number(countedQuantity)
  // Zero itself is a real count, and one of the more important ones: it says
  // the shelf is empty, which is the finding most likely to differ from the
  // record. Only a missing or negative number is refused.
  if (!Number.isFinite(counted) || counted < 0) return { error: 'products:stock.countInvalid' }

  const factor = baseUnitsFor(product, enteredUom)
  if (factor === null) return { error: 'products:stock.uomUnavailable' }

  const countedBase = counted * factor
  if (product.base_unit === 'pcs' && countedBase !== Math.round(countedBase)) {
    return { error: 'products:stock.wholePiecesOnly' }
  }

  return {
    line: {
      product_id: product.id,
      counted_base: countedBase,
      entered_quantity: counted,
      entered_uom: enteredUom,
    },
  }
}

// Every counted line.
//
// An empty stocktake is allowed, unlike every other document. Counting fifty
// products and finding forty-seven of them right is the ordinary result, and
// the three that differ are the only movements it produces — so a stocktake
// where everything matched produces none at all, and that is a fact worth
// recording with its date and who did it rather than an error.
export function stocktakeLines({ rows, productsById }) {
  const lines = []
  const seen = new Set()

  for (const row of rows || []) {
    const product = (productsById || {})[row.productId]
    if (product && seen.has(product.id)) return { error: 'products:stock.duplicateProduct' }

    const { line, error } = stocktakeLine({ ...row, product })
    if (error) return { error }
    seen.add(product.id)
    lines.push(line)
  }

  return { lines }
}

export { OWN_FUNCTION }

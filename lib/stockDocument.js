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

// stocktake is neither: a count can come out over or under, so its sign is
// whatever the difference turns out to be. transfer and reversal are not here
// at all — they have their own functions, and this builder refuses them.
export const SIGNED_BY_CALLER = ['stocktake']

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
  // remember that a write-off is negative.
  let quantityBase
  if (RECEIPT_TYPES.includes(docType)) quantityBase = magnitude
  else if (ISSUE_TYPES.includes(docType)) quantityBase = -magnitude
  else if (SIGNED_BY_CALLER.includes(docType)) quantityBase = entered * factor
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

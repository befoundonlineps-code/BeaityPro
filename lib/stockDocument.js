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
// 🔴 «طلب بضاعة» — **ليست قيمةً في `stock_doc_type`، ومكانُها هنا لأنها تُقرأ
// من ثلاثة ملفّاتٍ ولا يجوز أن تُكتب حرفيًّا في أيٍّ منها.**
//
// التسعُ مقيسةٌ بـ`pg_enum` (٠٩٦ب) وليس فيها `order` — **والطلبيّةُ جدولٌ
// منفصلٌ (`product_orders`) لا نوعُ مستند.** فهي معرَّفةٌ هنا بجانب تصنيفات
// الأنواع **لأن السؤالَ عنها يقع دائمًا حيث تُسأل الأنواع**، لا لأنها منها.
//
// ⚠️ **وهي عمدًا خارج الثلاثة أدناه، وهذا أخطرُ سطرٍ في هذا الملفّ:**
// `RECEIPT_TYPES` و`ISSUE_TYPES` و`OWN_FUNCTION` **تغذّي ما يُرحَّل عبر
// `post_stock_document`** — **فإضافةُ `order` إلى أيٍّ منها تفتح بابَ ترحيل
// طلبيّةٍ حركةً فعليّةً في المخزون.** والطلبيّةُ قالبٌ لا تحرّك شيئًا.
export const ORDER_DOC_TYPE = 'order'

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

// Exported because the stocktake sheet asks the same question the document
// screens do — which frames can this product be entered in — and a second list
// would be a second answer.
export const UOM = ['package', 'portion', 'unit']

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

/**
 * Half a hairpin is not a thing — does this base reading split a piece?
 *
 * The whole-number check on pcs lives in this file because it cannot live in
 * the database: stock_movements does not know a product's base unit without a
 * join, and a CHECK cannot join. It was promised at the schema and this is
 * where the promise gets kept.
 *
 * 🔴 ONE HOME, AND IT HAD THREE. The same expression was written out at the
 * supply line, the transfer line and the stocktake line — identical but for the
 * variable name. This project has a recorded bill for exactly that shape
 * (`numberOrNull`, four free copies, CLAUDE.md item ب), and the counting sheet
 * was about to make it four here.
 *
 * ⚠️ And the sheet needs it for a DIFFERENT purpose than the three: they refuse
 * a posting, it warns while somebody types. Two answers to «does this divide a
 * piece?» drifting apart is precisely how a screen ends up permitting what the
 * post then rejects — which is the late-refusal the safety gate's third
 * condition exists to end.
 *
 * ⚠️ The caller passes the BASE reading, already multiplied by the factor. That
 * is deliberate: 0.2 of a 15-piece package is 3 whole pieces and is fine, while
 * 0.5 of it is 7.5 and is not. The rule is about the base, never about what was
 * typed.
 */
export function splitsAPiece(product, base) {
  if (!product || product.base_unit !== 'pcs') return false
  if (base === null || base === undefined || !Number.isFinite(Number(base))) return false
  return Number(base) !== Math.round(Number(base))
}

// One line, or an error key saying why not.
export function stockLine({ docType, product, enteredQuantity, enteredUom, unitCost }) {
  if (!product) return { error: 'products:stock.productRequired' }
  if (!UOM.includes(enteredUom)) return { error: 'products:stock.uomInvalid' }

  const entered = Number(enteredQuantity)
  if (!Number.isFinite(entered) || entered === 0) return { error: 'products:stock.quantityRequired' }

  const factor = baseUnitsFor(product, enteredUom)
  if (factor === null) return { error: 'products:stock.uomUnavailable' }

  const magnitude = Math.abs(entered) * factor
  if (splitsAPiece(product, magnitude)) {
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
    // ⚠️ Blank is refused before Number() ever sees it, and this is the whole
    // point rather than pedantry. Number('') and Number(null) are both 0, and 0
    // is finite and not negative — so an untouched cost box passed every check
    // here and stamped unit_cost: 0 onto a receipt.
    //
    // That is the exact fault the fallback chain inside post_stock_document
    // exists to prevent (last known cost → nominal price → 0, never a plain
    // zero), arriving through the screen instead of through the function. A
    // receipt at zero drags the moving average down permanently, and every
    // issue afterwards is stamped with the poisoned figure — visible months
    // later as a service's cost, with nothing pointing back here.
    //
    // Same trap as the stocktake count, which was fixed and this was not.
    //
    // Trimmed, because Number('   ') is 0 as well — a test written for the
    // empty string caught that while this fix was being made.
    if (String(unitCost ?? '').trim() === '') {
      return { error: 'products:stock.unitCostRequired' }
    }
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
    if (splitsAPiece(product, magnitude)) {
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
  if (splitsAPiece(product, countedBase)) {
    return { error: 'products:stock.wholePiecesOnly' }
  }

  // ⚠️ NO entered_quantity AND NO entered_uom, and this line used to send both.
  //
  // post_stocktake copies whatever arrives in those two fields straight onto
  // the movement, beside a quantity_base it computes itself as
  // `counted - balance`. So sending the count produces a row whose two quantity
  // columns are not two views of one number: counting 10 against a recorded 15
  // would store entered_quantity 10 and quantity_base -5, and every screen that
  // draws a movement would print "بالعبوة: 10 · بالقطعة: -5".
  //
  // Every other document type keeps `entered × factor = |base|` and the display
  // rule depends on it. The stocktake is the one document where the person did
  // not type a movement at all — they typed a count, and the movement is a
  // difference derived from it. Of the three possible answers (the count, the
  // difference, neither) only the last makes no untrue claim.
  //
  // ⚠️ The decision was settled rounds ago, written into CLAUDE.md, and built
  // into the fixture (stocktakeAdjustment sends null for both). This function —
  // the one that actually feeds the database — was never changed, and nothing
  // caught it because nothing calls it yet. The count is genuinely lost as a
  // result, which is item 44 and is not solved by storing it in a field that
  // means something else.
  return {
    line: {
      product_id: product.id,
      counted_base: countedBase,
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

import { UOM, baseUnitsFor } from './stockDocument'
import { documentDateError } from './documentDate'
import { emptyDocumentRow } from './stockDocumentForm'

// The goods order: what we intend to buy, from whom, in the units we will
// receive it in.
//
// ⚠️ IT IS A TEMPLATE, NOT A COMMITMENT. The owner settled this before the
// tables were written: «الطلبية قالب مساعدة، لا التزام كمية». Nothing points
// back at an order — there is deliberately no from_order_id on stock_documents
// — so the same order may fill two supplies, an order may be filled partly or
// not at all, and deleting one destroys the record of no event.
//
// That single decision is why this file is short. There is no state machine, no
// outstanding quantity, no reconciliation: those all exist to answer "was this
// order honoured", which is a question the design says nobody is asking.
//
// ⚠️ AND THE LINE SHAPE MATCHES A SUPPLY ROW EXACTLY, on purpose. Pre-filling a
// supply is then a COPY and not a translation, and a translation is where the
// packaging factor gets applied twice or not at all.

// One line, or a translation key saying why not.
//
// The rules are the ones a supply line already keeps, and they are kept HERE
// rather than only at the supply, because an order that cannot become a supply
// is worse than no order: it is discovered at the counter, with the goods
// already on the table.
export function orderLine({ product, enteredQuantity, enteredUom, enteredUnitPrice }) {
  if (!product) return { error: 'products:stock.productRequired' }
  if (!UOM.includes(enteredUom)) return { error: 'products:stock.uomInvalid' }

  // ⚠️ Blank refused before Number() ever sees it. Number('') and Number('  ')
  // are both 0, so an untouched box would arrive as "I want zero of these" —
  // the same trap the stocktake's count guard exists for, and the reason the
  // supply screen refuses a blank price rather than reading it as free.
  if (String(enteredQuantity ?? '').trim() === '') {
    return { error: 'products:stock.quantityRequired' }
  }
  const quantity = Number(enteredQuantity)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: 'products:stock.quantityRequired' }
  }

  // ⚠️ The unit has to be one this product actually has. Ordering "3 packages"
  // of a product with no units_per_package is an instruction nobody can act on,
  // and the supply screen would refuse the same row later — after somebody has
  // already carried the paper to the supplier.
  if (baseUnitsFor(product, enteredUom) === null) {
    return { error: 'products:stock.uomUnavailable' }
  }

  // ⚠️ THE PRICE IS OPTIONAL HERE AND REQUIRED ON A SUPPLY, and the asymmetry
  // is the point rather than an oversight. An order is frequently written
  // before a price is agreed — that is half of why it is written. A supply
  // records what was actually charged, so a blank there is a claim of zero.
  //
  // The consequence is worth naming: pre-filling a supply from a priceless
  // order produces rows the supply screen refuses until prices are typed. That
  // is the loud direction, and the alternative — carrying a 0 across — would
  // stamp "these goods cost nothing" into the moving average, permanently.
  const priceText = String(enteredUnitPrice ?? '').trim()
  let price = null
  if (priceText !== '') {
    price = Number(priceText)
    if (!Number.isFinite(price) || price < 0) {
      return { error: 'products:stock.unitCostInvalid' }
    }
  }

  return {
    line: {
      product_id: product.id,
      entered_quantity: quantity,
      entered_uom: enteredUom,
      entered_unit_price: price,
    },
  }
}

// The whole order, or the first reason there is none.
//
// Validation runs before the lines are built, so somebody who forgot the
// supplier is told that rather than being told about the third row's units.
export function orderPayload(values, productsById) {
  const v = values || {}

  // ⚠️ Required, matching the table. A supply is a receipt FROM somebody and an
  // order is a request TO somebody; without the name there is nothing to send
  // and no way to answer "what did we order from them".
  if (!v.supplierId) return { error: 'products:docs.supplierRequiredError' }

  // The same rule the five document writers share, not a sixth copy of it.
  //
  // ⚠️ AND THE FUTURE BAN APPLIES HERE TOO, which reads wrong for one second
  // and is right. An order is about goods that have not arrived, so "no future
  // dates" sounds like the wrong rule — but order_date is when the order was
  // PLACED, and placing one is something that happened. There is no delivery
  // date on this table, deliberately: nothing reconciles against it, so a date
  // nobody checks is a date that goes stale in silence.
  const dateError = documentDateError(v.orderDate)
  if (dateError) return { error: dateError }

  const rows = (v.rows || []).filter((row) => row && row.productId)

  // ⚠️ An empty order is refused, and an empty STOCKTAKE is allowed — the
  // difference is what the empty thing records. A stocktake with no differences
  // records that a count happened, which is worth having. An order with no
  // lines records nothing at all, and its only effect is to appear in the list
  // and be pre-filled from, producing nothing.
  if (rows.length === 0) return { error: 'products:orders.emptyError' }

  const lines = []
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const { line, error } = orderLine({
      product: productsById ? productsById[row.productId] : null,
      enteredQuantity: row.enteredQuantity,
      enteredUom: row.enteredUom,
      enteredUnitPrice: row.enteredUnitPrice,
    })
    if (error) return { error }
    // ⚠️ THE POSITION IS WRITTEN EXPLICITLY, and the column's default is a trap
    // the diagram already records: `sort_order integer NOT NULL DEFAULT 0` means
    // every row claims to be first, and ordering by it then returns them in no
    // defined order. The products window writes the position for set components
    // for exactly this reason; this is the same rule, not a new one.
    lines.push({ ...line, sort_order: i })
  }

  return {
    payload: {
      order: {
        supplier_id: v.supplierId,
        order_date: v.orderDate,
        // ⚠️ Blank becomes null, never ''. Two ways to say "no note" means a
        // filter sees one of them and not the other.
        note: String(v.note ?? '').trim() || null,
      },
      lines,
    },
  }
}

// What an order's lines become on the supply screen.
//
// ⚠️ A COPY, NOT A CONVERSION, and the tables were shaped so it could be: the
// quantity and its unit cross unchanged, because both sides mean "this many of
// these, in this frame". Anything that recomputed here would be a second place
// the packaging factor is applied.
//
// Everything is returned as TEXT because that is what the supply screen holds —
// its boxes are controlled inputs, and handing them a number makes the field
// jump when somebody clears it.
// ⚠️ BUILT ON emptyDocumentRow, not written out beside it. A row missing a key
// the screen expects is not an error — it is a select whose value matches no
// option, quietly showing a different one. The discount-kind box is exactly
// that shape, and an order carries no discounts, so this is the row most likely
// to be assembled by hand and most likely to be wrong.
export function orderRowsFromLines(lines) {
  return [...(lines || [])]
    .sort(byPosition)
    .map((line) => ({
      ...emptyDocumentRow(),
      productId: line.product_id,
      enteredQuantity: String(line.entered_quantity ?? ''),
      enteredUom: line.entered_uom || 'unit',
      // ⚠️ null becomes '', not '0'. A price nobody agreed yet must arrive as an
      // empty box the supply screen refuses, not as a zero it accepts.
      enteredUnitPrice: line.entered_unit_price == null ? '' : String(line.entered_unit_price),
      // The discount and the bonus keep their blank defaults: those are things
      // the invoice says, and the order is written before there is an invoice.
    }))
}

// ⚠️ A TOTAL ORDER IS NOT A TOTAL ON THE ORDER. sort_order is written by the
// screen, but two lines of an old order can still share a position — nothing in
// the database forbids it — so the id breaks the tie and the order is total.
// Without it the same order can draw itself in two different sequences on two
// reads, which is the fault the documents list already had.
function byPosition(a, b) {
  const left = Number(a.sort_order ?? 0)
  const right = Number(b.sort_order ?? 0)
  if (left !== right) return left - right
  return String(a.id ?? '').localeCompare(String(b.id ?? ''))
}

// What the order is worth, and null when it cannot say.
//
// ⚠️ null rather than 0 when NO line carries a price, because "nobody has
// agreed prices yet" is not the statement "this costs nothing" — the same
// distinction documentTotals keeps for a document with no prices on it.
//
// A PARTLY priced order reports the sum of what is priced, and says so by
// reporting the count separately. Hiding it would withhold the one figure
// somebody wants when half the prices are known.
export function orderTotal(lines) {
  const rows = (lines || []).filter((line) => line.entered_unit_price != null)
  if (rows.length === 0) return { total: null, pricedLines: 0, lineCount: (lines || []).length }
  const total = rows.reduce(
    (sum, line) => sum + Number(line.entered_quantity) * Number(line.entered_unit_price),
    0
  )
  return { total, pricedLines: rows.length, lineCount: (lines || []).length }
}

// Whether pre-filling would destroy anything somebody typed.
//
// ⚠️ Shared with the screen rather than re-asked there, because the question
// decides whether a confirmation appears — and a screen that answers it
// slightly differently from the test asks in a case the test says it does not.
// A row with no product is an untouched blank, not work.
export function documentRowsHoldWork(rows) {
  return (rows || []).some((row) => row && row.productId)
}

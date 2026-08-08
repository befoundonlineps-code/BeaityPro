import {
  orderLine, orderPayload, orderRowsFromLines, orderTotal, documentRowsHoldWork,
} from './productOrder'
import { stockDocumentPayload, emptyDocumentRow } from './stockDocumentForm'

const PRODUCTS = {
  p1: { id: 'p1', name: 'شامبو', base_unit: 'ml', units_per_package: 250, units_per_portion: 50 },
  p2: { id: 'p2', name: 'مشط', base_unit: 'pcs', units_per_package: 12 },
  loose: { id: 'loose', name: 'صبغة', base_unit: 'ml' },
}

const rows = (over = []) => over.map((o) => ({
  productId: 'p1', enteredQuantity: '2', enteredUom: 'package', enteredUnitPrice: '100', ...o,
}))

const values = (over) => ({
  supplierId: 's1', orderDate: '2020-01-01', note: '', rows: rows([{}]), ...over,
})

describe('one order line', () => {
  const line = (over) => orderLine({
    product: PRODUCTS.p1, enteredQuantity: '2', enteredUom: 'package', enteredUnitPrice: '100', ...over,
  })

  it('builds the four columns the table holds, and nothing else', () => {
    expect(line().line).toEqual({
      product_id: 'p1', entered_quantity: 2, entered_uom: 'package', entered_unit_price: 100,
    })
  })

  it('refuses a blank quantity instead of reading it as zero', () => {
    // ⚠️ Number('') and Number('   ') are both 0. Without the blank check an
    // untouched box becomes "I want zero of these" — a line that passes every
    // numeric rule and asks for nothing.
    expect(line({ enteredQuantity: '' }).error).toBe('products:stock.quantityRequired')
    expect(line({ enteredQuantity: '   ' }).error).toBe('products:stock.quantityRequired')
    expect(line({ enteredQuantity: null }).error).toBe('products:stock.quantityRequired')
  })

  it('refuses zero and negative quantities', () => {
    expect(line({ enteredQuantity: '0' }).error).toBe('products:stock.quantityRequired')
    expect(line({ enteredQuantity: '-3' }).error).toBe('products:stock.quantityRequired')
  })

  it('refuses a unit this product does not have', () => {
    // ⚠️ The case that matters: 'package' is a valid uom and this product has no
    // units_per_package. Refusing it at the ORDER is the whole point — the
    // supply screen would refuse the same row later, at the counter, with the
    // goods already delivered.
    expect(orderLine({
      product: PRODUCTS.loose, enteredQuantity: '2', enteredUom: 'package', enteredUnitPrice: '1',
    }).error).toBe('products:stock.uomUnavailable')

    expect(orderLine({
      product: PRODUCTS.loose, enteredQuantity: '2', enteredUom: 'unit', enteredUnitPrice: '1',
    }).line).toBeTruthy()
  })

  it('refuses a uom that is not one of the three', () => {
    expect(line({ enteredUom: 'box' }).error).toBe('products:stock.uomInvalid')
  })

  it('accepts no price at all, and stores null rather than zero', () => {
    // The asymmetry with a supply, asserted rather than described: an order is
    // often written before a price is agreed.
    expect(line({ enteredUnitPrice: '' }).line.entered_unit_price).toBeNull()
    expect(line({ enteredUnitPrice: null }).line.entered_unit_price).toBeNull()
    // ⚠️ And an explicit zero is NOT turned into null. "They are giving it to
    // us free" is a statement; a blank is not.
    expect(line({ enteredUnitPrice: '0' }).line.entered_unit_price).toBe(0)
  })

  it('refuses a negative price', () => {
    expect(line({ enteredUnitPrice: '-5' }).error).toBe('products:stock.unitCostInvalid')
  })
})

describe('the whole order', () => {
  it('refuses a missing supplier before it looks at any row', () => {
    // The row here is unbuildable too. The supplier must win, or somebody who
    // forgot the name is told about the third row's units.
    expect(orderPayload(
      values({ supplierId: '', rows: rows([{ enteredUom: 'box' }]) }), PRODUCTS
    ).error).toBe('products:docs.supplierRequiredError')
  })

  it('refuses a future date, the same rule the five writers share', () => {
    expect(orderPayload(values({ orderDate: '2099-01-01' }), PRODUCTS).error)
      .toBe('products:docs.dateFutureError')
  })

  it('refuses an order with no lines', () => {
    // ⚠️ Unlike a stocktake, which is allowed to be empty. A stocktake with no
    // differences records that a count happened; an order with no lines records
    // nothing and can only be pre-filled from to produce nothing.
    expect(orderPayload(values({ rows: [] }), PRODUCTS).error).toBe('products:orders.emptyError')
    expect(orderPayload(values({ rows: [{ productId: '' }] }), PRODUCTS).error)
      .toBe('products:orders.emptyError')
  })

  it('writes the position of every line explicitly', () => {
    // ⚠️ The column's default is a trap the diagram records: NOT NULL DEFAULT 0
    // means every row claims to be first and ordering by it returns them in no
    // defined order.
    const { payload } = orderPayload(values({
      rows: rows([{ productId: 'p1' }, { productId: 'p2', enteredUom: 'unit' }, { productId: 'loose', enteredUom: 'unit' }]),
    }), PRODUCTS)
    expect(payload.lines.map((l) => l.sort_order)).toEqual([0, 1, 2])
  })

  it('numbers positions over the KEPT rows, not the typed ones', () => {
    // A blank row between two filled ones must not leave a hole in the
    // sequence, or the row after it sorts as though something were missing.
    const { payload } = orderPayload(values({
      rows: [
        { productId: 'p1', enteredQuantity: '1', enteredUom: 'unit', enteredUnitPrice: '' },
        { productId: '', enteredQuantity: '', enteredUom: 'unit', enteredUnitPrice: '' },
        { productId: 'p2', enteredQuantity: '1', enteredUom: 'unit', enteredUnitPrice: '' },
      ],
    }), PRODUCTS)
    expect(payload.lines.map((l) => l.sort_order)).toEqual([0, 1])
    expect(payload.lines.map((l) => l.product_id)).toEqual(['p1', 'p2'])
  })

  it('turns a blank note into null, never an empty string', () => {
    expect(orderPayload(values({ note: '   ' }), PRODUCTS).payload.order.note).toBeNull()
    expect(orderPayload(values({ note: 'عاجل' }), PRODUCTS).payload.order.note).toBe('عاجل')
  })
})

describe('an order becomes supply rows', () => {
  it('sorts by position, and breaks a tie by id so the order is total', () => {
    // ⚠️ Nothing in the database forbids two lines sharing a position, and an
    // order drawn in two different sequences on two reads is the fault the
    // documents list already had.
    const drawn = orderRowsFromLines([
      { id: 'b', product_id: 'p2', entered_quantity: 1, entered_uom: 'unit', sort_order: 0 },
      { id: 'a', product_id: 'p1', entered_quantity: 1, entered_uom: 'unit', sort_order: 0 },
      { id: 'c', product_id: 'loose', entered_quantity: 1, entered_uom: 'unit', sort_order: 1 },
    ])
    expect(drawn.map((r) => r.productId)).toEqual(['p1', 'p2', 'loose'])
  })

  it('hands the screen text, because its boxes are controlled inputs', () => {
    const [row] = orderRowsFromLines([
      { id: 'a', product_id: 'p1', entered_quantity: 2, entered_uom: 'package', entered_unit_price: 100, sort_order: 0 },
    ])
    expect(row.enteredQuantity).toBe('2')
    expect(row.enteredUnitPrice).toBe('100')
  })

  it('turns an unpriced line into an empty box, not a zero', () => {
    const [row] = orderRowsFromLines([
      { id: 'a', product_id: 'p1', entered_quantity: 2, entered_uom: 'package', entered_unit_price: null, sort_order: 0 },
    ])
    expect(row.enteredUnitPrice).toBe('')
  })

  it('carries no discount and no bonus, because an order predates the invoice', () => {
    const [row] = orderRowsFromLines([
      { id: 'a', product_id: 'p1', entered_quantity: 2, entered_uom: 'package', entered_unit_price: 100, sort_order: 0 },
    ])
    expect(row).toMatchObject({ lineDiscountValue: '', bonusQuantity: '' })
  })

  it('has EVERY key a blank document row has, and the same defaults', () => {
    // ⚠️ The failure this prevents is not an error. A row missing
    // lineDiscountKind gives the select a value matching no option, so it draws
    // 'percent' while the state says '' — and the first line discount somebody
    // types is read as an amount. Asserted against emptyDocumentRow rather than
    // against a list typed here, so adding a field to the row cannot leave this
    // describing the old shape.
    const [row] = orderRowsFromLines([
      { id: 'a', product_id: 'p1', entered_quantity: 2, entered_uom: 'package', entered_unit_price: 100, sort_order: 0 },
    ])
    const blank = emptyDocumentRow()
    expect(Object.keys(row).sort()).toEqual(Object.keys(blank).sort())
    expect(row.lineDiscountKind).toBe(blank.lineDiscountKind)
  })
})

// ==========================================================================
// ⚠️ THE CLAIM THE TWO TABLES WERE SHAPED AROUND, MEASURED RATHER THAN STATED.
//
// 053a says the line shape matches a supply row exactly "so pre-filling is a
// copy, not a translation". Every test above checks one side of that. These
// check that the two sides MEET — which is the only version of the claim that
// can fail, and it would fail silently: a mismatched frame produces a supply
// that posts, at the packaging factor times the wrong cost.
// ==========================================================================
describe('the round trip an order exists for', () => {
  const supply = (rowsIn) => stockDocumentPayload('supply', {
    storageId: 'st1', supplierId: 's1', docDate: '2020-01-01', rows: rowsIn,
  }, PRODUCTS)

  it('a priced order fills a supply that posts, with the numbers unchanged', () => {
    const { payload: order } = orderPayload(values({
      rows: rows([
        { productId: 'p1', enteredQuantity: '2', enteredUom: 'package', enteredUnitPrice: '100' },
        { productId: 'p2', enteredQuantity: '5', enteredUom: 'unit', enteredUnitPrice: '3' },
      ]),
    }), PRODUCTS)

    const { payload: doc, error } = supply(orderRowsFromLines(order.lines))
    expect(error).toBeUndefined()

    // ⚠️ THE FRAME COLUMNS ARE THE ASSERTION. quantity_base is NOT, and this
    // was measured rather than assumed: running a row already converted to base
    // units through the same payload produces base=500 price=100 — IDENTICAL to
    // the correct copy. So `expect(quantity_base).toBe(500)` would pass on the
    // exact mistranslation this test exists to catch.
    //
    // entered_quantity 2 and entered_uom 'package' are what differ (500/'unit'
    // in the converted case), and they are what the screens read to print
    // "بالعبوة: 2 · بالقطعة: 500".
    expect(doc.lines[0]).toMatchObject({
      product_id: 'p1', entered_quantity: 2, entered_uom: 'package', entered_unit_price: 100,
    })
    // Kept, but as a consequence rather than as the guard: it says the factor
    // was applied once, given the frame above is right.
    expect(doc.lines[0].quantity_base).toBe(500)
    expect(doc.lines[1]).toMatchObject({ product_id: 'p2', entered_quantity: 5, entered_uom: 'unit' })
  })

  it('an UNPRICED order fills a supply that is refused until prices are typed', () => {
    // ⚠️ The documented loud direction, pinned. The alternative — carrying a 0
    // across — would stamp "these goods cost nothing" into the moving average,
    // permanently (ADR-051). A test that only checked the happy path would pass
    // just as well with that behaviour.
    const { payload: order } = orderPayload(values({
      rows: rows([{ enteredUnitPrice: '' }]),
    }), PRODUCTS)

    expect(supply(orderRowsFromLines(order.lines)).error)
      .toBe('products:stock.unitCostRequired')
  })
})

describe('what counts as work worth asking about', () => {
  it('an untouched blank row is not work', () => {
    expect(documentRowsHoldWork([])).toBe(false)
    expect(documentRowsHoldWork([{ productId: '', enteredQuantity: '' }])).toBe(false)
  })

  it('a chosen product is work, even with nothing else filled in', () => {
    expect(documentRowsHoldWork([{ productId: 'p1', enteredQuantity: '' }])).toBe(true)
  })
})

describe('what an order is worth', () => {
  const line = (q, p) => ({ entered_quantity: q, entered_unit_price: p })

  it('says null rather than zero when no price has been agreed', () => {
    // ⚠️ The same distinction documentTotals keeps: "nothing was typed" is not
    // the statement "it costs nothing".
    expect(orderTotal([line(2, null), line(5, null)]))
      .toEqual({ total: null, pricedLines: 0, lineCount: 2 })
  })

  it('sums what is priced and says how much of the order that was', () => {
    // Withholding the figure until every price is known would hide the one
    // number somebody wants when half of them are.
    expect(orderTotal([line(2, 100), line(5, null), line(3, 10)]))
      .toEqual({ total: 230, pricedLines: 2, lineCount: 3 })
  })

  it('counts an explicit zero as priced', () => {
    expect(orderTotal([line(2, 0)])).toEqual({ total: 0, pricedLines: 1, lineCount: 1 })
  })
})

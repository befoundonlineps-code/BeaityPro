import {
  baseUnitsFor, stockLine, stockDocumentLines,
  stocktakeLine, stocktakeLines,
  RECEIPT_TYPES, ISSUE_TYPES,
} from './stockDocument'

const dye = { id: 'p1', base_unit: 'ml', units_per_package: 250, units_per_portion: 50 }
const box = { id: 'p2', base_unit: 'pcs', units_per_package: 12, units_per_portion: null }

describe('baseUnitsFor', () => {
  it('is one for a unit', () => {
    expect(baseUnitsFor(dye, 'unit')).toBe(1)
  })

  it('is the packaging factor for a package', () => {
    expect(baseUnitsFor(dye, 'package')).toBe(250)
  })

  it('is the portion size for a portion', () => {
    expect(baseUnitsFor(dye, 'portion')).toBe(50)
  })

  it('is null when the product has no portion defined', () => {
    expect(baseUnitsFor(box, 'portion')).toBe(null)
  })

  it('is null rather than one for a nonsense unit', () => {
    expect(baseUnitsFor(dye, 'crate')).toBe(null)
    expect(baseUnitsFor(null, 'unit')).toBe(null)
  })
})

describe('stockLine — conversion', () => {
  it('turns packages into base units', () => {
    const { line } = stockLine({ docType: 'supply', product: dye, enteredQuantity: 4, enteredUom: 'package', unitCost: 250 })
    expect(line.quantity_base).toBe(1000)
    expect(line.entered_quantity).toBe(4)
    expect(line.entered_uom).toBe('package')
  })

  it('turns portions into base units', () => {
    const { line } = stockLine({ docType: 'write_off', product: dye, enteredQuantity: 3, enteredUom: 'portion' })
    expect(line.quantity_base).toBe(-150)
  })

  it('leaves units alone', () => {
    const { line } = stockLine({ docType: 'write_off', product: dye, enteredQuantity: 40, enteredUom: 'unit' })
    expect(line.quantity_base).toBe(-40)
  })

  it('keeps what was typed alongside what was stored', () => {
    // The document has to be able to show the invoice back: "4 packages", not
    // "1000 ml", which is what somebody would have to reverse-engineer.
    const { line } = stockLine({ docType: 'supply', product: dye, enteredQuantity: 4, enteredUom: 'package', unitCost: 250 })
    expect(line).toMatchObject({ entered_quantity: 4, entered_uom: 'package' })
  })
})

describe('stockLine — sign comes from the document, not the typist', () => {
  it('makes a receipt positive from a positive number', () => {
    for (const docType of RECEIPT_TYPES) {
      const { line } = stockLine({ docType, product: dye, enteredQuantity: 2, enteredUom: 'package', unitCost: 100 })
      expect(line.quantity_base).toBeGreaterThan(0)
    }
  })

  it('makes an issue negative from a positive number', () => {
    // Nobody should have to remember that a write-off is typed as a minus.
    for (const docType of ISSUE_TYPES) {
      const { line } = stockLine({ docType, product: dye, enteredQuantity: 2, enteredUom: 'package' })
      expect(line.quantity_base).toBe(-500)
    }
  })

  it('ignores a minus somebody typed on an issue', () => {
    const { line } = stockLine({ docType: 'write_off', product: dye, enteredQuantity: -2, enteredUom: 'package' })
    expect(line.quantity_base).toBe(-500)
  })

  it('refuses the three document types that have their own functions', () => {
    // stocktake joined the other two: it sends counts, not movements, and a
    // p_lines that means something different depending on p_doc_type is a
    // payload accepting invalid combinations — the same fault the optional
    // transfer parameters had, arriving through the body instead.
    for (const docType of ['transfer', 'reversal', 'stocktake']) {
      expect(stockLine({ docType, product: dye, enteredQuantity: 1, enteredUom: 'unit' }).error)
        .toBe('products:stock.docTypeNotSupported')
    }
  })

  it('has no third branch left in the sign rule', () => {
    // Every type this builder accepts is a receipt or an issue. There is no
    // caller-signed exception any more.
    const all = [...RECEIPT_TYPES, ...ISSUE_TYPES]
    for (const docType of all) {
      const { line } = stockLine({ docType, product: dye, enteredQuantity: 1, enteredUom: 'unit', unitCost: 1 })
      expect(Math.sign(line.quantity_base)).toBe(RECEIPT_TYPES.includes(docType) ? 1 : -1)
    }
  })
})

describe('stockLine — cost is per base unit', () => {
  it('divides a package price by the packaging factor', () => {
    // A tube of 250 ml bought for 250 costs 1 per ml. Storing 250 would
    // multiply the cost of everything ever issued from it by 250.
    const { line } = stockLine({ docType: 'supply', product: dye, enteredQuantity: 1, enteredUom: 'package', unitCost: 250 })
    expect(line.unit_cost).toBe(1)
  })

  it('leaves a unit price alone', () => {
    const { line } = stockLine({ docType: 'supply', product: dye, enteredQuantity: 10, enteredUom: 'unit', unitCost: 3 })
    expect(line.unit_cost).toBe(3)
  })

  it('demands a cost on a receipt and refuses a negative one', () => {
    expect(stockLine({ docType: 'supply', product: dye, enteredQuantity: 1, enteredUom: 'package' }).error)
      .toBe('products:stock.unitCostRequired')
    expect(stockLine({ docType: 'supply', product: dye, enteredQuantity: 1, enteredUom: 'package', unitCost: -1 }).error)
      .toBe('products:stock.unitCostRequired')
  })

  it('refuses an untouched cost box instead of reading it as free', () => {
    // Number('') and Number(null) are both 0, and 0 is finite and not
    // negative — so a blank box passed every check and stamped unit_cost: 0
    // onto a receipt. That is the poisoning the fallback chain inside
    // post_stock_document exists to prevent, coming in through the screen
    // instead: the average is dragged down permanently and every later issue
    // carries the wrong figure, surfacing months afterwards as a service's
    // cost with nothing pointing back here.
    for (const blank of ['', null, undefined, '   ']) {
      expect(stockLine({
        docType: 'supply', product: dye, enteredQuantity: 1, enteredUom: 'package', unitCost: blank,
      }).error).toBe('products:stock.unitCostRequired')
    }
  })

  it('still accepts a deliberate zero, because free goods exist', () => {
    // A sample from a supplier really does cost nothing, and refusing it would
    // push somebody into typing 0.01 to get past the screen.
    const { line, error } = stockLine({
      docType: 'supply', product: dye, enteredQuantity: 1, enteredUom: 'package', unitCost: 0,
    })
    expect(error).toBeUndefined()
    expect(line.unit_cost).toBe(0)
  })

  it('sends no cost at all on an issue', () => {
    // The function works it out from the balance under a lock. A number sent
    // from here would be a second opinion arriving too early.
    const { line } = stockLine({ docType: 'write_off', product: dye, enteredQuantity: 1, enteredUom: 'unit', unitCost: 99 })
    expect(Object.prototype.hasOwnProperty.call(line, 'unit_cost')).toBe(false)
  })
})

describe('stockLine — refusals', () => {
  it('refuses a zero quantity', () => {
    expect(stockLine({ docType: 'supply', product: dye, enteredQuantity: 0, enteredUom: 'unit', unitCost: 1 }).error)
      .toBe('products:stock.quantityRequired')
  })

  it('refuses nonsense in the quantity', () => {
    for (const q of ['', 'abc', null, undefined, NaN]) {
      expect(stockLine({ docType: 'supply', product: dye, enteredQuantity: q, enteredUom: 'unit', unitCost: 1 }).error)
        .toBe('products:stock.quantityRequired')
    }
  })

  it('refuses a portion for a product that has none', () => {
    expect(stockLine({ docType: 'write_off', product: box, enteredQuantity: 1, enteredUom: 'portion' }).error)
      .toBe('products:stock.uomUnavailable')
  })

  it('refuses a fractional count of pieces', () => {
    // The database cannot check this: stock_movements does not know a
    // product's base unit without a join, and a CHECK cannot join. It was
    // promised at the schema and this is where the promise is kept.
    expect(stockLine({ docType: 'write_off', product: box, enteredQuantity: 0.5, enteredUom: 'unit' }).error)
      .toBe('products:stock.wholePiecesOnly')
    // 0.1 of a twelve-pack is 1.2 pieces, which is not a thing.
    expect(stockLine({ docType: 'write_off', product: box, enteredQuantity: 0.1, enteredUom: 'package' }).error)
      .toBe('products:stock.wholePiecesOnly')
  })

  it('allows a fraction of a package that lands on whole pieces', () => {
    // The check is on what gets stored, not on what was typed: half a
    // twelve-pack is six pieces, and refusing it would be refusing arithmetic.
    // An earlier version of this test asserted the opposite and failed before
    // any mutation, because I had checked the input rather than the result.
    expect(stockLine({ docType: 'write_off', product: box, enteredQuantity: 1.5, enteredUom: 'package' }).line.quantity_base)
      .toBe(-18)
    expect(stockLine({ docType: 'write_off', product: box, enteredQuantity: 0.5, enteredUom: 'package' }).line.quantity_base)
      .toBe(-6)
  })

  it('allows a fraction of something measured', () => {
    expect(stockLine({ docType: 'write_off', product: dye, enteredQuantity: 0.5, enteredUom: 'package' }).line.quantity_base)
      .toBe(-125)
  })

  it('allows a whole number of pieces reached through packages', () => {
    expect(stockLine({ docType: 'write_off', product: box, enteredQuantity: 2, enteredUom: 'package' }).line.quantity_base)
      .toBe(-24)
  })

  it('refuses a missing product or unit', () => {
    expect(stockLine({ docType: 'supply', product: null, enteredQuantity: 1, enteredUom: 'unit' }).error)
      .toBe('products:stock.productRequired')
    expect(stockLine({ docType: 'supply', product: dye, enteredQuantity: 1, enteredUom: 'crate' }).error)
      .toBe('products:stock.uomInvalid')
  })
})

describe('stockDocumentLines', () => {
  const productsById = { p1: dye, p2: box }

  it('builds every line', () => {
    const { lines } = stockDocumentLines({
      docType: 'supply',
      productsById,
      rows: [
        { productId: 'p1', enteredQuantity: 2, enteredUom: 'package', unitCost: 250 },
        { productId: 'p2', enteredQuantity: 1, enteredUom: 'package', unitCost: 120 },
      ],
    })
    expect(lines.map((l) => l.quantity_base)).toEqual([500, 12])
    expect(lines.map((l) => l.unit_cost)).toEqual([1, 10])
  })

  it('refuses a document with nothing in it', () => {
    expect(stockDocumentLines({ docType: 'supply', productsById, rows: [] }).error)
      .toBe('products:stock.documentEmpty')
    expect(stockDocumentLines({ docType: 'supply', productsById, rows: null }).error)
      .toBe('products:stock.documentEmpty')
  })

  it('refuses the same product twice in one document', () => {
    // The balance would add them up correctly and nobody could read the
    // document. Kept out here, not in the database, which has no reason to
    // forbid it.
    expect(stockDocumentLines({
      docType: 'supply', productsById,
      rows: [
        { productId: 'p1', enteredQuantity: 1, enteredUom: 'unit', unitCost: 1 },
        { productId: 'p1', enteredQuantity: 2, enteredUom: 'unit', unitCost: 1 },
      ],
    }).error).toBe('products:stock.duplicateProduct')
  })

  it('stops at the first bad line and says why', () => {
    expect(stockDocumentLines({
      docType: 'supply', productsById,
      rows: [
        { productId: 'p1', enteredQuantity: 1, enteredUom: 'unit', unitCost: 1 },
        { productId: 'p2', enteredQuantity: 0, enteredUom: 'unit', unitCost: 1 },
      ],
    }).error).toBe('products:stock.quantityRequired')
  })

  it('refuses a product that is not in the index', () => {
    expect(stockDocumentLines({
      docType: 'supply', productsById,
      rows: [{ productId: 'gone', enteredQuantity: 1, enteredUom: 'unit', unitCost: 1 }],
    }).error).toBe('products:stock.productRequired')
  })
})

describe('stocktakeLine — a count, never a movement', () => {
  it('converts a count of packages into base units', () => {
    const { line } = stocktakeLine({ product: dye, countedQuantity: 3, enteredUom: 'package' })
    expect(line.counted_base).toBe(750)
  })

  it('carries no quantity_base and no sign at all', () => {
    // The difference is arithmetic the caller cannot do safely, so it does not
    // do it. What goes over is what somebody knows: how many are there.
    const { line } = stocktakeLine({ product: dye, countedQuantity: 3, enteredUom: 'package' })
    expect(Object.prototype.hasOwnProperty.call(line, 'quantity_base')).toBe(false)
    expect(Object.keys(line).sort()).toEqual(['counted_base', 'product_id'])
  })

  it('sends NO entered frame, because the movement is a difference', () => {
    // ⚠️ THIS USED TO SEND THE COUNT, and post_stocktake copies those two
    // fields onto the movement beside a quantity_base it computes as
    // `counted - balance`. Counting 3 packages against a recorded 750 would
    // have stored entered_quantity 3 with quantity_base -0, and against a
    // recorded 900 it would store 3 beside -150 — two numbers that are not two
    // views of one quantity, printed on every stocktake row as
    // "بالعبوة: 3 · بالقطعة: -150".
    //
    // Every other document keeps entered × factor = |base|. The stocktake is
    // the one where nobody typed a movement, so the only answer that makes no
    // untrue claim is neither field. Settled rounds ago in CLAUDE.md and built
    // into stocktakeAdjustment; this function was never changed, and nothing
    // caught it because nothing calls it yet.
    const { line } = stocktakeLine({ product: dye, countedQuantity: 3, enteredUom: 'package' })
    expect(Object.prototype.hasOwnProperty.call(line, 'entered_quantity')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(line, 'entered_uom')).toBe(false)
  })

  it('accepts a count of zero, which is one of the important ones', () => {
    // "The shelf is empty" is a real finding, and the one most likely to
    // differ from the record.
    const { line, error } = stocktakeLine({ product: dye, countedQuantity: 0, enteredUom: 'unit' })
    expect(error).toBeUndefined()
    expect(line.counted_base).toBe(0)
  })

  it('refuses a negative count', () => {
    // Not a smaller count. There is no such thing as minus three tubes.
    expect(stocktakeLine({ product: dye, countedQuantity: -1, enteredUom: 'unit' }).error)
      .toBe('products:stock.countInvalid')
  })

  it('refuses nonsense in the count', () => {
    for (const c of ['', 'abc', null, undefined, NaN]) {
      expect(stocktakeLine({ product: dye, countedQuantity: c, enteredUom: 'unit' }).error)
        .toBe('products:stock.countInvalid')
    }
  })

  it('applies the whole-pieces rule to a count too', () => {
    expect(stocktakeLine({ product: box, countedQuantity: 0.1, enteredUom: 'package' }).error)
      .toBe('products:stock.wholePiecesOnly')
    expect(stocktakeLine({ product: box, countedQuantity: 1.5, enteredUom: 'package' }).line.counted_base)
      .toBe(18)
  })

  it('refuses a portion for a product that has none, and a missing product', () => {
    expect(stocktakeLine({ product: box, countedQuantity: 1, enteredUom: 'portion' }).error)
      .toBe('products:stock.uomUnavailable')
    expect(stocktakeLine({ product: null, countedQuantity: 1, enteredUom: 'unit' }).error)
      .toBe('products:stock.productRequired')
  })
})

describe('stocktakeLines', () => {
  const productsById = { p1: dye, p2: box }

  it('builds every counted line', () => {
    const { lines } = stocktakeLines({
      productsById,
      rows: [
        { productId: 'p1', countedQuantity: 2, enteredUom: 'package' },
        { productId: 'p2', countedQuantity: 0, enteredUom: 'unit' },
      ],
    })
    expect(lines.map((l) => l.counted_base)).toEqual([500, 0])
  })

  it('allows a stocktake with nothing in it, unlike every other document', () => {
    // Counting fifty products and finding forty-seven right is the ordinary
    // result. A stocktake where everything matched produces no movements at
    // all, and that is a fact worth recording rather than an error.
    expect(stocktakeLines({ productsById, rows: [] })).toEqual({ lines: [] })
    expect(stocktakeLines({ productsById, rows: null })).toEqual({ lines: [] })
  })

  it('still refuses the same product counted twice', () => {
    expect(stocktakeLines({
      productsById,
      rows: [
        { productId: 'p1', countedQuantity: 1, enteredUom: 'unit' },
        { productId: 'p1', countedQuantity: 2, enteredUom: 'unit' },
      ],
    }).error).toBe('products:stock.duplicateProduct')
  })

  it('stops at the first bad line', () => {
    expect(stocktakeLines({
      productsById,
      rows: [
        { productId: 'p1', countedQuantity: 1, enteredUom: 'unit' },
        { productId: 'p2', countedQuantity: -1, enteredUom: 'unit' },
      ],
    }).error).toBe('products:stock.countInvalid')
  })
})

describe('the document type lists', () => {
  it('never puts one type in two lists', () => {
    // The database branches on the same split. Two lists claiming the same
    // type would make the sign here disagree with the costing there.
    const all = [...RECEIPT_TYPES, ...ISSUE_TYPES]
    expect(new Set(all).size).toBe(all.length)
  })

  it('keeps every type that has its own function out of both', () => {
    const all = [...RECEIPT_TYPES, ...ISSUE_TYPES]
    for (const own of ['transfer', 'reversal', 'stocktake']) {
      expect(all).not.toContain(own)
    }
  })

  it('agrees with the function about which types carry a price', () => {
    // post_stock_document takes unit_cost from the caller for exactly these
    // two and computes it for everything else.
    expect(RECEIPT_TYPES).toEqual(['supply', 'opening'])
  })
})

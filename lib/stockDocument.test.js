import {
  baseUnitsFor, stockLine, stockDocumentLines,
  RECEIPT_TYPES, ISSUE_TYPES, SIGNED_BY_CALLER,
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

  it('keeps the caller’s sign for a stocktake, both ways', () => {
    // A count comes out over or under, and both are real answers.
    for (const docType of SIGNED_BY_CALLER) {
      expect(stockLine({ docType, product: dye, enteredQuantity: 2, enteredUom: 'unit' }).line.quantity_base).toBe(2)
      expect(stockLine({ docType, product: dye, enteredQuantity: -2, enteredUom: 'unit' }).line.quantity_base).toBe(-2)
    }
  })

  it('refuses the two document types that have their own functions', () => {
    for (const docType of ['transfer', 'reversal']) {
      expect(stockLine({ docType, product: dye, enteredQuantity: 1, enteredUom: 'unit' }).error)
        .toBe('products:stock.docTypeNotSupported')
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

describe('the document type lists', () => {
  it('never puts one type in two lists', () => {
    // The database branches on the same split. Two lists claiming the same
    // type would make the sign here disagree with the costing there.
    const all = [...RECEIPT_TYPES, ...ISSUE_TYPES, ...SIGNED_BY_CALLER]
    expect(new Set(all).size).toBe(all.length)
  })

  it('keeps transfer and reversal out of all of them', () => {
    const all = [...RECEIPT_TYPES, ...ISSUE_TYPES, ...SIGNED_BY_CALLER]
    expect(all).not.toContain('transfer')
    expect(all).not.toContain('reversal')
  })

  it('agrees with the function about which types carry a price', () => {
    // post_stock_document takes unit_cost from the caller for exactly these
    // two and computes it for everything else.
    expect(RECEIPT_TYPES).toEqual(['supply', 'opening'])
  })
})

import {
  validateSupplyDocument, supplyTotals, supplyDocumentPayload, storageChoices,
  SUPPLY_DOC_TYPE,
} from './supplyForm'

const PRODUCTS = {
  p1: { id: 'p1', name: 'شامبو', base_unit: 'ml', units_per_package: 250, units_per_portion: 50 },
  p2: { id: 'p2', name: 'مقص', base_unit: 'pcs', units_per_package: 1 },
}

const draft = {
  storageId: 'st1',
  supplierId: 'sup1',
  docDate: '2026-08-04',
  note: '',
  rows: [{ productId: 'p1', enteredQuantity: '2', enteredUom: 'package', unitCost: '30' }],
}

describe('validateSupplyDocument', () => {
  it('passes a filled document', () => {
    expect(validateSupplyDocument(draft)).toBe('')
  })

  it('demands a storage, a supplier and a date', () => {
    expect(validateSupplyDocument({ ...draft, storageId: null }))
      .toBe('products:supply.storageRequiredError')
    expect(validateSupplyDocument({ ...draft, supplierId: '' }))
      .toBe('products:supply.supplierRequiredError')
    expect(validateSupplyDocument({ ...draft, docDate: '' }))
      .toBe('products:supply.dateRequiredError')
  })
})

describe('supplyTotals', () => {
  it('multiplies the typed price by the typed quantity, not by the base quantity', () => {
    // The line's unit_cost is per base unit, so quantity_base × unit_cost is
    // the same number — but reaching it by multiplying the base quantity by
    // the typed price would be 250 times too much on every line here, and a
    // mistake that plausible only surfaces in a yearly total.
    expect(supplyTotals([
      { productId: 'p1', enteredQuantity: '2', unitCost: '30' },
      { productId: 'p2', enteredQuantity: '3', unitCost: '10' },
    ])).toEqual({ lineCount: 2, total: 90 })
  })

  it('counts a row that has a product but no numbers yet, without adding to the total', () => {
    // Somebody mid-typing has a line. It is a line; it is not money yet.
    expect(supplyTotals([{ productId: 'p1', enteredQuantity: '', unitCost: '' }]))
      .toEqual({ lineCount: 1, total: 0 })
  })

  it('ignores a row with no product at all', () => {
    expect(supplyTotals([{ productId: '', enteredQuantity: '5', unitCost: '5' }]))
      .toEqual({ lineCount: 0, total: 0 })
  })

  it('survives no rows', () => {
    expect(supplyTotals(null)).toEqual({ lineCount: 0, total: 0 })
  })
})

describe('supplyDocumentPayload', () => {
  it('builds what post_stock_document takes', () => {
    const { payload, error } = supplyDocumentPayload(draft, PRODUCTS)
    expect(error).toBeUndefined()
    expect(payload).toMatchObject({
      docType: 'supply', storageId: 'st1', supplierId: 'sup1', docDate: '2026-08-04',
    })
    // 2 packages × 250 ml = 500 base units, at 30 per package = 0.12 per ml.
    expect(payload.lines).toEqual([{
      product_id: 'p1',
      quantity_base: 500,
      entered_quantity: 2,
      entered_uom: 'package',
      unit_cost: 30 / 250,
    }])
  })

  it('reports the missing supplier before it reports the third row', () => {
    // Otherwise somebody who forgot the supplier is told about units instead.
    const { error } = supplyDocumentPayload(
      { ...draft, supplierId: null, rows: [{ productId: 'p1', enteredQuantity: '', enteredUom: 'x' }] },
      PRODUCTS
    )
    expect(error).toBe('products:supply.supplierRequiredError')
  })

  it('passes a line refusal straight through', () => {
    const { error } = supplyDocumentPayload(
      { ...draft, rows: [{ productId: 'p2', enteredQuantity: '1.5', enteredUom: 'package', unitCost: '5' }] },
      { p2: { ...PRODUCTS.p2, units_per_package: 3 } }
    )
    // 1.5 packages of 3 pieces is 4.5 pieces, and pieces do not divide.
    expect(error).toBe('products:stock.wholePiecesOnly')
  })

  it('refuses a document with no rows', () => {
    expect(supplyDocumentPayload({ ...draft, rows: [] }, PRODUCTS).error)
      .toBe('products:stock.documentEmpty')
  })

  it('sends a supply, never anything else', () => {
    // The doc type is the function's only branch for the sign and the costing,
    // so this screen must not be able to send another one by accident.
    expect(SUPPLY_DOC_TYPE).toBe('supply')
    expect(supplyDocumentPayload(draft, PRODUCTS).payload.docType).toBe('supply')
  })
})

describe('storageChoices', () => {
  const list = [
    { id: 'st1', name: 'رئيسي', is_active: true },
    { id: 'st2', name: 'مؤرشف', is_active: false },
  ]

  it('drops an archived storage from a fresh choice', () => {
    expect(storageChoices(list, null).map((s) => s.id)).toEqual(['st1'])
  })

  it('keeps the one already chosen, so the document cannot move by itself', () => {
    expect(storageChoices(list, 'st2').map((s) => s.id)).toEqual(['st1', 'st2'])
  })
})

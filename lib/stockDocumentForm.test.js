import {
  validateStockDocument, documentTotals, stockDocumentPayload, storageChoices,
  docForm, DOC_TYPES,
} from './stockDocumentForm'

const PRODUCTS = {
  p1: { id: 'p1', name: 'شامبو', base_unit: 'ml', units_per_package: 250, units_per_portion: 50 },
  p2: { id: 'p2', name: 'مقص', base_unit: 'pcs', units_per_package: 1 },
}

const line = (over = {}) => ({ productId: 'p1', enteredQuantity: '2', enteredUom: 'package', unitCost: '30', ...over })

const draft = {
  storageId: 'st1', toStorageId: '', supplierId: 'sup1',
  docDate: '2026-08-04', note: '', rows: [line()],
}

describe('the four document shapes', () => {
  it('covers exactly the documents that share this form', () => {
    // Stocktaking is not among them on purpose: it sends counts, not
    // movements, so `rows` would mean something different for it.
    expect(DOC_TYPES).toEqual(['supply', 'write_off', 'return_to_supplier', 'transfer'])
  })

  it('says which of the three facts each one carries', () => {
    expect(docForm('supply')).toEqual({ supplier: 'required', cost: true, twoStorages: false })
    expect(docForm('write_off')).toEqual({ supplier: 'none', cost: false, twoStorages: false })
    expect(docForm('return_to_supplier')).toEqual({ supplier: 'required', cost: false, twoStorages: false })
    expect(docForm('transfer')).toEqual({ supplier: 'none', cost: false, twoStorages: true })
  })

  it('refuses a doc type it does not own', () => {
    // stocktake and reversal have their own functions, and a screen must not
    // be able to reach them through this door.
    for (const type of ['stocktake', 'reversal', 'opening', 'nonsense']) {
      expect(validateStockDocument(type, draft)).toBe('products:stock.docTypeNotSupported')
    }
  })
})

describe('validateStockDocument', () => {
  it('passes a filled supply', () => {
    expect(validateStockDocument('supply', draft)).toBe('')
  })

  it('demands a supplier only where there is one to name', () => {
    // A write-off names nobody: the goods are gone, not returned.
    const noSupplier = { ...draft, supplierId: '' }
    expect(validateStockDocument('supply', noSupplier)).toBe('products:docs.supplierRequiredError')
    expect(validateStockDocument('return_to_supplier', noSupplier)).toBe('products:docs.supplierRequiredError')
    expect(validateStockDocument('write_off', noSupplier)).toBe('')
    expect(validateStockDocument('transfer', { ...noSupplier, toStorageId: 'st2' })).toBe('')
  })

  it('names the from-storage differently when there are two of them', () => {
    // "Choose a storage" beside two storage boxes does not say which one is
    // missing.
    expect(validateStockDocument('supply', { ...draft, storageId: '' }))
      .toBe('products:docs.storageRequiredError')
    expect(validateStockDocument('transfer', { ...draft, storageId: '' }))
      .toBe('products:docs.fromStorageRequiredError')
  })

  it('demands the second storage, and refuses it being the first', () => {
    expect(validateStockDocument('transfer', { ...draft, toStorageId: '' }))
      .toBe('products:docs.toStorageRequiredError')
    expect(validateStockDocument('transfer', { ...draft, toStorageId: 'st1' }))
      .toBe('products:stock.transferSameStorage')
    expect(validateStockDocument('transfer', { ...draft, toStorageId: 'st2' })).toBe('')
  })

  it('demands a date for all of them', () => {
    for (const type of DOC_TYPES) {
      expect(validateStockDocument(type, { ...draft, toStorageId: 'st2', docDate: '' }))
        .toBe('products:docs.dateRequiredError')
    }
  })
})

describe('documentTotals', () => {
  it('multiplies the typed price by the typed quantity, not by the base quantity', () => {
    expect(documentTotals('supply', [line(), { productId: 'p2', enteredQuantity: '3', unitCost: '10' }]))
      .toEqual({ lineCount: 2, total: 90 })
  })

  it('reports null money for a document that has no prices, never zero', () => {
    // An issue's cost is the moving average at that instant, which only the
    // function knows. Zero would be a claim; null is the absence of one.
    for (const type of ['write_off', 'return_to_supplier', 'transfer']) {
      expect(documentTotals(type, [line()])).toEqual({ lineCount: 1, total: null })
    }
  })

  it('counts a row mid-typing without adding to the total', () => {
    expect(documentTotals('supply', [line({ enteredQuantity: '', unitCost: '' })]))
      .toEqual({ lineCount: 1, total: 0 })
  })

  it('ignores a row with no product at all', () => {
    expect(documentTotals('supply', [{ productId: '', enteredQuantity: '5', unitCost: '5' }]))
      .toEqual({ lineCount: 0, total: 0 })
  })
})

describe('stockDocumentPayload', () => {
  it('builds a supply the way post_stock_document takes it', () => {
    const { payload } = stockDocumentPayload('supply', draft, PRODUCTS)
    expect(payload).toMatchObject({ docType: 'supply', storageId: 'st1', supplierId: 'sup1' })
    expect(payload.lines).toEqual([{
      product_id: 'p1', quantity_base: 500, entered_quantity: 2,
      entered_uom: 'package', unit_cost: 30 / 250,
    }])
  })

  it('sends an issue negative and without a cost', () => {
    // The sign is the document's, not the typist's, and an issue's cost is
    // stamped inside the function from the average at that instant.
    const { payload } = stockDocumentPayload('write_off', draft, PRODUCTS)
    expect(payload.lines[0].quantity_base).toBe(-500)
    expect(payload.lines[0]).not.toHaveProperty('unit_cost')
    expect(payload.supplierId).toBeNull()
  })

  it('drops the supplier from a document that has none, even if one was picked', () => {
    // Switching from supply to write-off must not leave a supplier attached to
    // goods nobody returned.
    expect(stockDocumentPayload('write_off', draft, PRODUCTS).payload.supplierId).toBeNull()
    expect(stockDocumentPayload('transfer', { ...draft, toStorageId: 'st2' }, PRODUCTS).payload)
      .not.toHaveProperty('supplierId')
  })

  it('builds a transfer for the other function, with a positive quantity', () => {
    // transfer_stock writes both movements itself. A caller that sent −5 and
    // +5 could send −5 and +4, and the difference would sit in the balances
    // with nothing to explain it.
    const { payload } = stockDocumentPayload('transfer', { ...draft, toStorageId: 'st2' }, PRODUCTS)
    expect(payload).toMatchObject({ fromStorageId: 'st1', toStorageId: 'st2' })
    expect(payload).not.toHaveProperty('docType')
    expect(payload.lines).toEqual([{
      product_id: 'p1', quantity_base: 500, entered_quantity: 2, entered_uom: 'package',
    }])
    expect(payload.lines[0]).not.toHaveProperty('unit_cost')
  })

  it('refuses a transfer of nothing or of a negative amount', () => {
    for (const value of ['0', '-2', '']) {
      expect(stockDocumentPayload('transfer',
        { ...draft, toStorageId: 'st2', rows: [line({ enteredQuantity: value })] }, PRODUCTS).error)
        .toBe('products:stock.quantityRequired')
    }
  })

  it('keeps the whole-pieces rule on a transfer too', () => {
    const { error } = stockDocumentPayload('transfer',
      { ...draft, toStorageId: 'st2', rows: [line({ productId: 'p2', enteredQuantity: '1.5' })] },
      { p2: { ...PRODUCTS.p2, units_per_package: 3 } })
    expect(error).toBe('products:stock.wholePiecesOnly')
  })

  it('refuses the same product twice in one transfer', () => {
    const { error } = stockDocumentPayload('transfer',
      { ...draft, toStorageId: 'st2', rows: [line(), line()] }, PRODUCTS)
    expect(error).toBe('products:stock.duplicateProduct')
  })

  it('reports the missing supplier before it reports the third row', () => {
    const { error } = stockDocumentPayload('supply',
      { ...draft, supplierId: null, rows: [line({ enteredUom: 'x' })] }, PRODUCTS)
    expect(error).toBe('products:docs.supplierRequiredError')
  })

  it('refuses a document with no rows, whichever kind', () => {
    for (const type of DOC_TYPES) {
      expect(stockDocumentPayload(type, { ...draft, toStorageId: 'st2', rows: [] }, PRODUCTS).error)
        .toBe('products:stock.documentEmpty')
    }
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

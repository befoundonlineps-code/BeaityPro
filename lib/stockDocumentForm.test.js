import {
  validateStockDocument, documentTotals, stockDocumentPayload, storageChoices,
  docForm, DOC_TYPES,
} from './stockDocumentForm'

const PRODUCTS = {
  p1: { id: 'p1', name: 'شامبو', base_unit: 'ml', units_per_package: 250, units_per_portion: 50 },
  p2: { id: 'p2', name: 'مقص', base_unit: 'pcs', units_per_package: 1 },
}

const line = (over = {}) => ({ productId: 'p1', enteredQuantity: '2', enteredUom: 'package', enteredUnitPrice: '30', ...over })

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

  it('says which of the four facts each one carries', () => {
    expect(docForm('supply')).toEqual({ supplier: 'required', money: true, stampsCost: true, twoStorages: false })
    expect(docForm('write_off')).toEqual({ supplier: 'none', money: false, stampsCost: false, twoStorages: false })
    expect(docForm('return_to_supplier')).toEqual({ supplier: 'required', money: true, stampsCost: false, twoStorages: false })
    expect(docForm('transfer')).toEqual({ supplier: 'none', money: false, stampsCost: false, twoStorages: true })
  })

  // ⚠️ THE FLAG THAT ANSWERED TWO QUESTIONS MUST NOT COME BACK. `cost` meant
  // "a price is typed" and was read as "there is money here"; the two parted
  // company at Stage 4 and the return screen kept the old answer. Anyone
  // re-adding the name gets undefined at every call site — falsy, silent, and
  // shaped exactly like the fault this replaced.
  it('has no flag called `cost` on any document', () => {
    for (const type of DOC_TYPES) {
      expect(Object.keys(docForm(type))).not.toContain('cost')
    }
  })

  // ⚠️ THE RULE, NOT THE LIST. Money exists where there is a counterparty for
  // it to be owed to or by — that is why a write-off and a transfer have none.
  // Written as an equivalence so a fifth document type is covered the day it is
  // added, rather than the day somebody remembers to extend a list of names.
  it('has money exactly where it has a counterparty', () => {
    for (const type of DOC_TYPES) {
      expect(docForm(type).money).toBe(docForm(type).supplier !== 'none')
    }
  })

  // Costing is the narrower fact and must stay inside the wider one: a document
  // whose typed price becomes unit_cost is necessarily a priced document. The
  // reverse is false, and that asymmetry is the whole of the return.
  it('never stamps a cost on a document that has no prices', () => {
    for (const type of DOC_TYPES) {
      if (docForm(type).stampsCost) expect(docForm(type).money).toBe(true)
    }
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
    expect(documentTotals('supply', [line(), { productId: 'p2', enteredQuantity: '3', enteredUnitPrice: '10' }]))
      .toMatchObject({ lineCount: 2, total: 90 })
  })

  it('reports null money for a document that has no prices, never zero', () => {
    // An issue's cost is the moving average at that instant, which only the
    // function knows. Zero would be a claim; null is the absence of one.
    //
    // ⚠️ return_to_supplier USED TO BE IN THIS LIST, and that is how the fault
    // survived a green suite: the test did not miss the bug, it asserted it.
    // Written before Stage 4, when "no typed price" and "no money" were the
    // same sentence, it went on passing after they stopped being — so the one
    // check that could have spoken was the one vouching for the silence.
    for (const type of ['write_off', 'transfer']) {
      expect(documentTotals(type, [line()])).toMatchObject({ lineCount: 1, total: null })
    }
  })

  // ⚠️ THE RULE AGAIN, so no future document type can be priced-but-blank
  // without a test noticing. A ladder is owed to every document that has money.
  it('draws a ladder for every document that has money, and for no other', () => {
    for (const type of DOC_TYPES) {
      const { ladder } = documentTotals(type, [line()], {})
      expect(ladder === null).toBe(!docForm(type).money)
    }
  })

  it('computes a return exactly like a supply — same boxes, same arithmetic', () => {
    // The two differ in what the number MEANS (owed to us, not by us) and in
    // what it does to the ledger (nothing — the cost comes from the chain).
    // They do not differ in how the paper adds up, so asserting them equal is
    // asserting that one screen cannot quietly drift from the other.
    // The kind is stated rather than left to a default: "10" alone is 10% or
    // 10 ₪ depending on a field that is not in front of the reader, and a test
    // whose expected number depends on an unwritten default is asserting the
    // default, not the arithmetic.
    const rows = [line({
      enteredQuantity: '10', enteredUnitPrice: '100',
      lineDiscountKind: 'percent', lineDiscountValue: '10',
    })]
    const money = { discountKind: 'percent', discountValue: '10', transportAmount: '50', transportPaidTo: 'supplier' }

    const supply = documentTotals('supply', rows, money)
    const ret = documentTotals('return_to_supplier', rows, money)

    expect(ret.ladder).toEqual(supply.ladder)
    expect(ret.total).toBe(supply.total)
    // And the figures are the ones on the screen: 1000 gross, 100 off the
    // lines, 900 base, 90 off the document, 50 freight — 860.
    expect(ret.ladder).toMatchObject({ gross: 1000, lineDiscounts: 100, documentDiscount: 90, transport: 50 })
    expect(ret.total).toBe(860)
  })

  it('counts a row mid-typing without adding to the total', () => {
    expect(documentTotals('supply', [line({ enteredQuantity: '', enteredUnitPrice: '' })]))
      .toMatchObject({ lineCount: 1, total: 0 })
  })

  it('ignores a row with no product at all', () => {
    expect(documentTotals('supply', [{ productId: '', enteredQuantity: '5', enteredUnitPrice: '5' }]))
      .toMatchObject({ lineCount: 0, total: 0 })
  })
})

describe('stockDocumentPayload', () => {
  it('builds a supply the way post_stock_document takes it', () => {
    const { payload } = stockDocumentPayload('supply', draft, PRODUCTS)
    expect(payload).toMatchObject({ docType: 'supply', storageId: 'st1', supplierId: 'sup1' })
    expect(payload.lines).toEqual([{
      product_id: 'p1', quantity_base: 500, entered_quantity: 2,
      entered_uom: 'package', unit_cost: 30 / 250,
      entered_unit_price: 30, line_discount_kind: null, line_discount_value: null,
      // ⚠️ Present and null, not absent. toEqual is exact on purpose here: a
      // column added to the line must show up in this list or it is reaching
      // the database unnoticed by any test.
      bonus_quantity: null,
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

  // ⚠️ THE RETURN IS PRICED AND UNCOSTED, AND THE PAYLOAD MUST SAY BOTH.
  describe('a return carries the paper price without stamping it as cost', () => {
    it('sends the typed price as entered_unit_price and no unit_cost at all', () => {
      // Two different facts about one line. entered_unit_price is what the
      // supplier is being asked to credit; unit_cost is what the goods cost
      // leaving, which the function reads from the storage average — and a
      // typed price landing there would overwrite a computed cost permanently.
      const { payload } = stockDocumentPayload('return_to_supplier', draft, PRODUCTS)
      expect(payload.lines[0].entered_unit_price).toBe(30)
      expect(payload.lines[0]).not.toHaveProperty('unit_cost')
      expect(payload.lines[0].quantity_base).toBe(-500)
    })

    it('refuses a blank price on a return, exactly as on a supply', () => {
      // Nothing here would be poisoned by a blank — no cost is stamped. But the
      // harm has the same shape one ledger over: Number('') === 0 becomes "the
      // supplier owes us nothing for these goods", asserted from an untouched
      // box. Somebody returning goods for no credit types 0, which is a claim.
      const blank = { ...draft, rows: [line({ enteredUnitPrice: '' })] }
      expect(stockDocumentPayload('return_to_supplier', blank, PRODUCTS).error)
        .toBe('products:stock.unitCostRequired')
      expect(stockDocumentPayload('supply', blank, PRODUCTS).error)
        .toBe('products:stock.unitCostRequired')

      // And a typed zero is accepted on both, because it was typed.
      const zero = { ...draft, rows: [line({ enteredUnitPrice: '0' })] }
      expect(stockDocumentPayload('return_to_supplier', zero, PRODUCTS).error).toBeUndefined()
    })

    it('leaves a write-off and a transfer with no price at all', () => {
      // The counterparty test in reverse: no supplier, no paper, no price.
      expect(stockDocumentPayload('write_off', draft, PRODUCTS).payload.lines[0].entered_unit_price)
        .toBeNull()
    })
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

describe('free goods reach the payload as a fact, not as arithmetic', () => {
  // p2 is one piece per package, so the base quantity and the typed quantity
  // are the same number and the bonus is the only thing moving.
  const seven = (over) => ({
    ...draft,
    rows: [{
      productId: 'p2', enteredQuantity: '7', enteredUom: 'package',
      enteredUnitPrice: '50', bonusQuantity: '1', ...over,
    }],
  })

  it('moves seven, bills six, and lands the cost across all seven', () => {
    // ⚠️ The three assertions that must hold together. quantity_base is the
    // goods that arrived — a "correction" of it to the paid quantity would
    // short the stock by exactly the free goods, every time, silently.
    const { payload } = stockDocumentPayload('supply', seven(), PRODUCTS)
    expect(payload.lines[0].quantity_base).toBe(7)
    expect(payload.lines[0].bonus_quantity).toBe(1)
    expect(payload.lines[0].entered_unit_price).toBe(50)
    expect(payload.lines[0].unit_cost).toBeCloseTo(42.857142, 4)
  })

  it('stores the four numbers a reader needs to rebuild the story', () => {
    // Seven arrived, one was free, six were charged at 50, so 300 landed
    // across seven. None of the four is derivable from the other three, which
    // is why all four are stored and the net is not.
    const { payload } = stockDocumentPayload('supply', seven(), PRODUCTS)
    const l = payload.lines[0]
    expect((l.entered_quantity - l.bonus_quantity) * l.entered_unit_price).toBe(300)
    expect(l.unit_cost * l.entered_quantity).toBeCloseTo(300, 4)
  })

  it('sends null when no bonus was typed, never zero', () => {
    // Blank is not zero anywhere in this project, and a stored 0 would make
    // "no bonus" and "a bonus of nothing" two different rows saying one thing.
    const { payload } = stockDocumentPayload('supply', seven({ bonusQuantity: '' }), PRODUCTS)
    expect(payload.lines[0].bonus_quantity).toBeNull()
    expect(payload.lines[0].unit_cost).toBe(50)
  })

  it('refuses a bonus on every document that is not a receipt', () => {
    // ⚠️ THE RULE, over the doc types, rather than a test naming the return.
    // Free goods arrive; they do not leave. A return crediting less than was
    // sent is a document discount, which already exists.
    for (const type of DOC_TYPES) {
      const result = stockDocumentPayload(type, { ...seven(), toStorageId: 'st2' }, PRODUCTS)
      if (docForm(type).stampsCost) expect(result.error).toBeUndefined()
      else expect(result.error).toBe('products:money.bonusSupplyOnly')
    }
  })

  it('refuses a bonus bigger than the delivery before anything is built', () => {
    expect(stockDocumentPayload('supply', seven({ bonusQuantity: '8' }), PRODUCTS).error)
      .toBe('products:money.bonusOverQuantity')
  })

  it('accepts a wholly free delivery and stamps a truthful zero', () => {
    const { payload, error } = stockDocumentPayload('supply', seven({ bonusQuantity: '7' }), PRODUCTS)
    expect(error).toBeUndefined()
    expect(payload.lines[0].unit_cost).toBe(0)
    // And the row says why it is zero. Without this field the movement is
    // indistinguishable from the blank-box zero that poisoned the ledger.
    expect(payload.lines[0].bonus_quantity).toBe(7)
    expect(payload.lines[0].entered_unit_price).toBe(50)
  })
})

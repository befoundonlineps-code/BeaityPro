import {
  DISCOUNT_KINDS, PAYMENT_METHODS, TRANSPORT_PAID_TO,
  lineGross, lineDiscountAmount, lineNet, validateLineMoney,
  documentDiscountBase, documentDiscountAmount, validateDocumentMoney,
  spread, allocateDocument, supplierOwed, isOnAccount,
} from './documentMoney'

const line = (over) => ({
  enteredQuantity: '1', enteredUnitPrice: '100',
  lineDiscountKind: 'percent', lineDiscountValue: '', ...over,
})

describe('a line, priced the way the invoice is written', () => {
  it('keeps the typed price and the discount apart', () => {
    // ⚠️ Both are stored and the net is derived, for the same reason
    // entered_quantity is stored beside quantity_base: from the final figure
    // alone the two typed numbers cannot be recovered — one number does not
    // split back into two. The information is lost at posting, not at display.
    const l = line({ enteredQuantity: '10', enteredUnitPrice: '50', lineDiscountValue: '10' })
    expect(lineGross(l)).toBe(500)
    expect(lineDiscountAmount(l)).toBe(50)
    expect(lineNet(l)).toBe(450)
  })

  it('takes a fixed amount off just as readily as a percentage', () => {
    const l = line({ enteredQuantity: '10', enteredUnitPrice: '50', lineDiscountKind: 'amount', lineDiscountValue: '10' })
    expect(lineDiscountAmount(l)).toBe(10)
    expect(lineNet(l)).toBe(490)
  })

  it('treats a blank discount as no discount', () => {
    expect(lineNet(line({ enteredQuantity: '2', enteredUnitPrice: '30' }))).toBe(60)
    expect(validateLineMoney(line({ lineDiscountValue: '  ' }))).toBe('')
  })
})

describe('the line guard protects the divisor, not the line', () => {
  it('refuses a fixed discount bigger than the line', () => {
    // ⚠️ A negative net poisons the allocation for EVERY line, because a
    // line's weight is its share of the sum — one negative weight makes shares
    // exceed one or flip sign. That is why this runs before the nets are summed.
    expect(validateLineMoney(line({
      enteredQuantity: '1', enteredUnitPrice: '100',
      lineDiscountKind: 'amount', lineDiscountValue: '150',
    }))).toBe('products:money.lineDiscountOverLine')
  })

  it('refuses a percentage above one hundred and any negative', () => {
    expect(validateLineMoney(line({ lineDiscountValue: '120' }))).toBe('products:money.discountOverHundred')
    expect(validateLineMoney(line({ lineDiscountValue: '-5' }))).toBe('products:money.discountNegative')
  })

  it('refuses something that is not a number rather than reading it as zero', () => {
    // Number('') is 0 — the trap this module has paid for twice. A blank is
    // "no discount"; anything unreadable is refused.
    expect(validateLineMoney(line({ lineDiscountValue: 'كتير' }))).toBe('products:money.discountInvalid')
  })
})

describe('which total the document discount is measured against', () => {
  it('uses what the line discounts left, not the original prices', () => {
    // ⚠️ THE MEASURED COUNTEREXAMPLE. Two lines of 100, each discounted 50,
    // leaves 100. A document discount of 150 passes a check written against
    // the original 200 and leaves minus fifty.
    const lines = [
      line({ enteredUnitPrice: '100', lineDiscountKind: 'amount', lineDiscountValue: '50' }),
      line({ enteredUnitPrice: '100', lineDiscountKind: 'amount', lineDiscountValue: '50' }),
    ]
    expect(documentDiscountBase(lines)).toBe(100)

    expect(validateDocumentMoney({
      lines, discountKind: 'amount', discountValue: '150',
    })).toBe('products:money.discountOverDocument')

    expect(validateDocumentMoney({
      lines, discountKind: 'amount', discountValue: '100',
    })).toBe('')
  })

  it('is the same quantity the split divides by', () => {
    // One named figure read twice, so the check and the arithmetic cannot
    // drift into disagreeing about what "the total" means.
    const lines = [line({ enteredUnitPrice: '60' }), line({ enteredUnitPrice: '40' })]
    expect(documentDiscountBase(lines)).toBe(100)
    expect(documentDiscountAmount(lines, 'percent', '10')).toBe(10)
  })
})

describe('the split adds up exactly', () => {
  it('gives the remainder to the heaviest line rather than losing it', () => {
    // ⚠️ Three equal weights and 10.00 to spread: 3.33 each leaves a whole
    // agora unaccounted for. Money that vanishes and money that is invented are
    // both lies on a figure somebody reconciles against paper.
    const shares = spread([100, 100, 100], 10)
    expect(shares.reduce((a, b) => a + b, 0)).toBe(10)
    expect(shares).toEqual([3.34, 3.33, 3.33])
  })

  it('adds up exactly for awkward weights too', () => {
    for (const amount of [10, 33.33, 0.07, 1234.56]) {
      for (const weights of [[1, 2, 3], [7, 7, 7, 7], [999, 1], [5]]) {
        const shares = spread(weights, amount)
        expect(Math.round(shares.reduce((a, b) => a + b, 0) * 100) / 100).toBe(amount)
      }
    }
  })

  it('splits evenly when every weight is zero, instead of dividing by it', () => {
    // ⚠️ A document discounted to nothing has zero weights, and transport on
    // it is still real money that has to land somewhere.
    const shares = spread([0, 0], 10)
    expect(shares.reduce((a, b) => a + b, 0)).toBe(10)
    expect(shares).toEqual([5, 5])
  })

  it('spreads nothing when there is nothing to spread', () => {
    expect(spread([1, 2], 0)).toEqual([0, 0])
    expect(spread([], 100)).toEqual([])
  })
})

describe('what a line actually cost', () => {
  it('carries the document discount and the freight down to the unit', () => {
    // 10 × 50 = 500 and 10 × 100 = 1000, so 1500 gross. A 10% document
    // discount is 150, freight is 60, and both land in proportion.
    const lines = [
      line({ enteredQuantity: '10', enteredUnitPrice: '50' }),
      line({ enteredQuantity: '10', enteredUnitPrice: '100' }),
    ]
    const out = allocateDocument({
      lines, discountKind: 'percent', discountValue: '10', transportAmount: '60',
    })

    expect(out.gross).toBe(1500)
    expect(out.documentDiscount).toBe(150)
    expect(out.net).toBe(1410)

    // A third of the value carries a third of both.
    expect(out.lines[0]).toMatchObject({ net: 500, discountShare: 50, transportShare: 20, landed: 470 })
    expect(out.lines[1]).toMatchObject({ net: 1000, discountShare: 100, transportShare: 40, landed: 940 })
    expect(out.lines[0].landedUnitPrice).toBe(47)
    expect(out.lines[1].landedUnitPrice).toBe(94)

    // And the parts reconcile with the whole.
    expect(out.lines.reduce((s, l) => s + l.landed, 0)).toBe(out.net)
  })

  it('creates no zero cost when a line is discounted to nothing', () => {
    // ⚠️ A real zero in unit_cost is indistinguishable from the poisoning this
    // module spent a session removing, and cost_is_estimated would read false
    // on it — a badge saying "trust this zero". Here the zero is honest: it was
    // genuinely free of charge, and freight still lands on it.
    const lines = [line({ enteredQuantity: '2', enteredUnitPrice: '100', lineDiscountKind: 'amount', lineDiscountValue: '200' })]
    const out = allocateDocument({ lines, transportAmount: '10' })
    expect(out.lines[0].net).toBe(0)
    expect(out.lines[0].transportShare).toBe(10)
    expect(out.lines[0].landedUnitPrice).toBe(5)
  })
})

describe('what is owed to the supplier', () => {
  const base = {
    gross: 11900, lineDiscounts: 0, documentDiscount: 0, transport: 200, paidAmount: 0,
  }

  it('includes freight the supplier charged, so our figure matches their paper', () => {
    // ⚠️ The reason is stronger than accuracy: supplier_doc_number exists so
    // our record matches the supplier's invoice. If theirs reads 12,100 because
    // it carries the freight and we compute 11,900, reconciliation fails on
    // every delivery with any — the one job that field has.
    expect(supplierOwed({ ...base, transportPaidTo: 'supplier' })).toBe(12100)
  })

  it('excludes freight paid to a carrier, who is not the supplier', () => {
    expect(supplierOwed({ ...base, transportPaidTo: 'carrier' })).toBe(11900)
  })

  it('subtracts what was actually paid at posting', () => {
    expect(supplierOwed({ ...base, transportPaidTo: 'carrier', paidAmount: '5000' })).toBe(6900)
  })
})

describe('"on account" is derived and never chosen', () => {
  it('appears whenever less was paid than is owed', () => {
    // ⚠️ Three methods, and deferred is not one of them: the first three
    // answer "how did the money move" and deferred answers "it did not". One
    // column holding both makes part-cash part-deferred impossible to describe,
    // which is the ordinary case.
    expect(PAYMENT_METHODS).toEqual(['cash', 'cheque', 'bank_transfer'])
    expect(PAYMENT_METHODS).not.toContain('on_account')
    expect(isOnAccount(6900)).toBe(true)
    expect(isOnAccount(0)).toBe(false)
  })

  it('asks how the money moved only when some of it did', () => {
    const lines = [line()]
    expect(validateDocumentMoney({ lines, paidAmount: '0' })).toBe('')
    expect(validateDocumentMoney({ lines, paidAmount: '' })).toBe('')
    expect(validateDocumentMoney({ lines, paidAmount: '50' }))
      .toBe('products:money.paymentMethodRequired')
    expect(validateDocumentMoney({ lines, paidAmount: '50', paymentMethod: 'cash' })).toBe('')
  })
})

describe('the value lists', () => {
  it('names them once so a screen cannot invent a fourth', () => {
    expect(DISCOUNT_KINDS).toEqual(['percent', 'amount'])
    expect(TRANSPORT_PAID_TO).toEqual(['supplier', 'carrier'])
  })
})

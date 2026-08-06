import {
  DISCOUNT_KINDS, PAYMENT_METHODS, TRANSPORT_PAID_TO,
  lineGross, lineDiscountAmount, lineNet, validateLineMoney, paidQuantity,
  documentDiscountBase, documentDiscountAmount, validateDocumentMoney,
  spread, allocateDocument, supplierBalanceEffect, isOnAccount,
} from './documentMoney'

// ⚠️ productId is not decoration here. allocateDocument drops any row without
// one, because a row still being typed must take no share of the discount or
// the freight — a share stolen from the real lines is a wrong unit_cost stamped
// for good.
const line = (over) => ({
  productId: 'p1', enteredQuantity: '1', enteredUnitPrice: '100',
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

describe('the effect on the supplier balance, which has a direction', () => {
  const base = {
    gross: 11900, lineDiscounts: 0, documentDiscount: 0, transport: 200, settledAmount: 0,
  }

  it('includes freight the supplier charged, so our figure matches their paper', () => {
    // ⚠️ Stronger than accuracy: supplier_doc_number exists so our record
    // matches the supplier's invoice. If theirs reads 12,100 because it carries
    // the freight and we compute 11,900, reconciliation fails on every delivery
    // with any — the one job that field has.
    expect(supplierBalanceEffect({ ...base, docType: 'supply', transportPaidTo: 'supplier' }))
      .toBe(12100)
  })

  it('excludes freight paid to a carrier, who is not the supplier', () => {
    // It still enters unit_cost — a real cost of getting the goods here — and
    // is owed to nobody we track. Complete for costing, silent about the
    // carrier, on purpose.
    expect(supplierBalanceEffect({ ...base, docType: 'supply', transportPaidTo: 'carrier' }))
      .toBe(11900)
  })

  it('subtracts what was paid at posting', () => {
    expect(supplierBalanceEffect({
      ...base, docType: 'supply', transportPaidTo: 'carrier', settledAmount: '5000',
    })).toBe(6900)
  })

  it('turns NEGATIVE on a return, because the money comes the other way', () => {
    // ⚠️ THE DIRECTION THIS FUNCTION USED TO IGNORE. On a return the goods go
    // back and the supplier owes US — the reference shows the same thing, its
    // return row reading -2,380. Written for a supply, the old version would
    // have been wrong on every return.
    expect(supplierBalanceEffect({
      docType: 'return_to_supplier', gross: 1000, lineDiscounts: 0,
      documentDiscount: 0, transport: 0, transportPaidTo: 'carrier', settledAmount: 0,
    })).toBe(-1000)
  })

  it('moves back toward zero as the supplier settles a return', () => {
    // 1000 owed to us, 400 received, 600 still to come.
    expect(supplierBalanceEffect({
      docType: 'return_to_supplier', gross: 1000, lineDiscounts: 0,
      documentDiscount: 0, transport: 0, transportPaidTo: 'carrier', settledAmount: '400',
    })).toBe(-600)
  })

  it('keeps freight positive on a return too, when the supplier billed it', () => {
    // ⚠️ Not an oversight. Whoever carries the goods, if the SUPPLIER charged
    // for the shipping then we owe it — on a delivery and on a return alike.
    expect(supplierBalanceEffect({
      docType: 'return_to_supplier', gross: 1000, lineDiscounts: 0,
      documentDiscount: 0, transport: 50, transportPaidTo: 'supplier', settledAmount: 0,
    })).toBe(-950)
  })

  it('says nothing is outstanding only when the balance is flat', () => {
    expect(isOnAccount(6900)).toBe(true)
    expect(isOnAccount(-600)).toBe(true)
    expect(isOnAccount(0)).toBe(false)
  })
})

describe('"on account" is derived and never chosen', () => {
  it('is not one of the payment methods', () => {
    // ⚠️ The first three answer "how did the money move" and deferred answers
    // "it did not". One column holding both makes part-cash part-deferred
    // impossible to describe, which is the ordinary case.
    expect(PAYMENT_METHODS).toEqual(['cash', 'cheque', 'bank_transfer'])
    expect(PAYMENT_METHODS).not.toContain('on_account')
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

describe('a row still being typed takes no share', () => {
  it('is dropped from the split entirely', () => {
    // ⚠️ Found by a test that expected a total of zero and got 25. A row with
    // no product yet would have weighed in the allocation and carried away part
    // of the discount and part of the freight — taken from the real lines, and
    // stamped into unit_cost permanently.
    const out = allocateDocument({
      lines: [line({ enteredQuantity: '10', enteredUnitPrice: '100' }),
        { productId: '', enteredQuantity: '5', enteredUnitPrice: '5' }],
      transportAmount: '100',
    })
    expect(out.lines).toHaveLength(1)
    expect(out.gross).toBe(1000)
    expect(out.lines[0].transportShare).toBe(100)
  })
})

describe('freight keeps ONE sign, and the two directions are asserted together', () => {
  it('adds exactly the same amount on a supply and on a return', () => {
    // ⚠️ Both cases were already covered, in two separate tests, and neither
    // said the thing they have in common: the return case asserted -950 and
    // left the reader to work out that -1000 + 50 means freight went UP.
    //
    // Stated as a delta instead, in one place: whoever carries the goods, if
    // the SUPPLIER billed for the shipping then we owe it — on a delivery and
    // on a return alike. Nothing about the direction of the goods changes who
    // is owed for the lorry.
    const withoutFreight = (docType) => supplierBalanceEffect({
      docType, gross: 1000, lineDiscounts: 0, documentDiscount: 0,
      transport: 0, transportPaidTo: 'supplier', settledAmount: 0,
    })
    const withFreight = (docType) => supplierBalanceEffect({
      docType, gross: 1000, lineDiscounts: 0, documentDiscount: 0,
      transport: 50, transportPaidTo: 'supplier', settledAmount: 0,
    })

    expect(withFreight('supply') - withoutFreight('supply')).toBe(50)
    expect(withFreight('return_to_supplier') - withoutFreight('return_to_supplier')).toBe(50)

    // And the goods themselves DO flip, which is what makes the freight's
    // steadiness worth asserting rather than assuming.
    expect(withoutFreight('supply')).toBe(1000)
    expect(withoutFreight('return_to_supplier')).toBe(-1000)
  })

  it('adds nothing in either direction when a carrier was paid', () => {
    const effect = (docType) => supplierBalanceEffect({
      docType, gross: 1000, lineDiscounts: 0, documentDiscount: 0,
      transport: 50, transportPaidTo: 'carrier', settledAmount: 0,
    })
    expect(effect('supply')).toBe(1000)
    expect(effect('return_to_supplier')).toBe(-1000)
  })
})

describe('free goods: the money multiplies by what is paid for, the cost divides by what arrived', () => {
  // ⚠️ ONE TEST FOR BOTH HALVES, on purpose. Asserted apart, each half looks
  // like an ordinary multiplication and an ordinary division, and the thing
  // that matters — that they use DIFFERENT quantities — is left for a reader to
  // notice. Taking both from enteredQuantity would make the free piece free of
  // charge and free of cost at once, which is the zero-cost row this whole
  // feature exists to avoid.
  const sevenForSix = line({ enteredQuantity: '7', bonusQuantity: '1', enteredUnitPrice: '50' })

  it('charges for six and costs across seven, in the same case', () => {
    expect(paidQuantity(sevenForSix)).toBe(6)
    expect(lineGross(sevenForSix)).toBe(300)

    const { lines } = allocateDocument({ lines: [sevenForSix] })
    expect(lines[0].landed).toBe(300)
    // 300 / 7, and NOT 300 / 6 (which would be 50, the price nobody landed at)
    // and NOT 350 / 7 (which would be 50 again, from goods nobody paid for).
    expect(lines[0].landedUnitPrice).toBeCloseTo(42.857142, 5)
    expect(lines[0].landedUnitPrice * 7).toBeCloseTo(300, 6)
  })

  it('leaves the landed price unrounded, because seven into three hundred does not close', () => {
    // Money is rounded at the document; a per-unit cost is not. 42.86 x 7 is
    // 300.02 — an invoice nobody paid. This is the first case where the
    // distinction is routine rather than incidental.
    const { lines } = allocateDocument({ lines: [sevenForSix] })
    expect(lines[0].landedUnitPrice).not.toBe(42.86)
  })

  it('changes nothing at all when there is no bonus', () => {
    // The regression fence. Every document written before this feature has no
    // bonus field, and blank must behave exactly as absent.
    for (const bonus of [undefined, null, '', '   ', 0, '0']) {
      const l = line({ enteredQuantity: '7', enteredUnitPrice: '50', bonusQuantity: bonus })
      expect(lineGross(l)).toBe(350)
      expect(paidQuantity(l)).toBe(7)
    }
  })

  it('allows a wholly free shipment, and the zero it produces is a true one', () => {
    // The owner's decision. unit_cost is 0 because the goods cost nothing, not
    // because a box was left blank — and bonus_quantity is precisely what lets
    // a reader tell those two zeros apart.
    const allFree = line({ enteredQuantity: '5', bonusQuantity: '5', enteredUnitPrice: '80' })
    expect(validateLineMoney(allFree)).toBe('')
    expect(lineGross(allFree)).toBe(0)
    const { lines, net } = allocateDocument({ lines: [allFree] })
    expect(lines[0].landedUnitPrice).toBe(0)
    expect(net).toBe(0)
  })

  it('refuses a bonus larger than the quantity, and says why in the divisor', () => {
    expect(validateLineMoney(line({ enteredQuantity: '5', bonusQuantity: '6' })))
      .toBe('products:money.bonusOverQuantity')
    expect(validateLineMoney(line({ enteredQuantity: '', bonusQuantity: '1' })))
      .toBe('products:money.bonusOverQuantity')
    expect(validateLineMoney(line({ bonusQuantity: '-1' })))
      .toBe('products:money.bonusNegative')
    expect(validateLineMoney(line({ bonusQuantity: 'كتير' })))
      .toBe('products:money.bonusInvalid')
  })

  it('refuses it before the split runs, because one bad weight spoils every line', () => {
    // The reason the guard sits with the discount rather than with the
    // quantities: a negative gross is not this line's problem. Its weight is
    // its share of the sum of the nets, so it drags the other lines' shares
    // with it — a wrong unit_cost stamped for good in rows nobody typed wrong.
    const bad = line({ productId: 'p2', enteredQuantity: '5', bonusQuantity: '9', enteredUnitPrice: '100' })
    expect(validateLineMoney(bad)).not.toBe('')

    // Measured rather than asserted from the rule: unguarded, this is what the
    // honest line's share would become.
    const good = line({ enteredQuantity: '10', enteredUnitPrice: '100' })
    const { lines } = allocateDocument({
      lines: [good, bad], discountKind: 'amount', discountValue: '100',
    })
    expect(lines[0].discountShare).not.toBe(100)
    expect(lines[0].discountShare > 100 || lines[0].discountShare < 0).toBe(true)
  })
})

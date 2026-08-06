// The money on a stock document: what was charged, what was taken off, what was
// added on, and what each line therefore cost.
//
// ⚠️ EVERYTHING HERE IS PERMANENT ONCE POSTED. unit_cost is stamped and never
// recomputed (ADR-051), so an allocation decided here is decided for good and
// the only correction is reversing the document. That is why the rules below
// are written out rather than left to whoever writes the SQL.
//
// ⚠️ AND THE SAME FIELDS MEAN TWO DIFFERENT THINGS on the two screens, measured
// from the function text: `if p_doc_type in ('supply','opening')` takes the
// typed price, and everything else — a return to supplier included — takes the
// fallback chain. So on a supply the discount changes the cost of goods; on a
// return it changes only what is recovered from the supplier and cannot touch
// the cost of the goods leaving. The screen has to say so, or somebody
// discounting a return will believe they changed something in stock.

export const DISCOUNT_KINDS = ['percent', 'amount']
export const TRANSPORT_PAID_TO = ['supplier', 'carrier']

// ⚠️ THREE VALUES, AND "على الحساب" IS NOT ONE OF THEM. The first three answer
// "how did the money move"; deferred payment answers "it did not". One column
// cannot hold two questions, and forcing it to would make a part-cash part-
// deferred payment impossible to describe — which is the ordinary case.
//
// So: paid_amount says how much moved (zero allowed), payment_method says how
// THAT amount moved and is required only when it is above zero, and "on
// account" is derived from paid_amount < net and never stored. The screen still
// offers it as a choice; choosing it stores nothing and zero.
export const PAYMENT_METHODS = ['cash', 'cheque', 'bank_transfer']

const num = (value) => {
  const text = String(value ?? '').trim()
  if (text === '') return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

// Money is rounded to two places, the way a price is written on paper.
const money = (value) => Math.round(value * 100) / 100

// ── one line ────────────────────────────────────────────────────────────────

// What the line was charged before anything came off it.
//
// The typed price is per ENTERED unit — per package, if that is what was
// typed — because that is what the invoice says and what the person recognises.
// unit_cost is per BASE unit, and on a product of 15 per package the two are
// 100 and 6.6667 for the same thing (item 35). Neither is derived from the
// other here; the conversion happens once, in stockLine.
export function lineGross(line) {
  const quantity = num(line && line.enteredQuantity)
  const price = num(line && line.enteredUnitPrice)
  if (quantity === null || price === null) return null
  return money(quantity * price)
}

// The money the line discount takes off — a number, whichever way it was
// written.
export function lineDiscountAmount(line) {
  const gross = lineGross(line)
  if (gross === null) return null
  const value = num(line && line.lineDiscountValue)
  if (value === null || value === 0) return 0
  if (line.lineDiscountKind === 'percent') return money(gross * value / 100)
  return money(value)
}

export function lineNet(line) {
  const gross = lineGross(line)
  const discount = lineDiscountAmount(line)
  if (gross === null || discount === null) return null
  return money(gross - discount)
}

// ⚠️ REFUSED AT THE LINE, and not for tidiness. A line net below zero poisons
// the allocation for EVERY line, not only its own: the weight of a line is its
// share of the sum of the nets, so one negative weight makes shares exceed one
// or flip sign. The guard protects the divisor, which is why it has to run
// before the nets are summed rather than alongside the document check.
export function validateLineMoney(line) {
  const value = num(line && line.lineDiscountValue)
  if (value === null) return line && String(line.lineDiscountValue ?? '').trim() !== ''
    ? 'products:money.discountInvalid'
    : ''

  if (value < 0) return 'products:money.discountNegative'

  if (line.lineDiscountKind === 'percent') {
    if (value > 100) return 'products:money.discountOverHundred'
    return ''
  }

  const gross = lineGross(line)
  if (gross !== null && value > gross) return 'products:money.lineDiscountOverLine'
  return ''
}

// ── the document ────────────────────────────────────────────────────────────

// ⚠️ ONE NAMED QUANTITY FOR BOTH THE CHECK AND THE SPLIT, because they were
// going to be two.
//
// The document discount applies to what is left after the line discounts, so
// that is what it must be validated against. Measured counterexample: two lines
// of 100, each discounted 50, leaves 100 — and a document discount of 150 passes
// a check written against the original 200 while leaving minus fifty.
export function documentDiscountBase(lines) {
  return money((lines || []).reduce((sum, line) => sum + (lineNet(line) || 0), 0))
}

export function documentDiscountAmount(lines, kind, value) {
  const base = documentDiscountBase(lines)
  const amount = num(value)
  if (amount === null || amount === 0) return 0
  if (kind === 'percent') return money(base * amount / 100)
  return money(amount)
}

// ⚠️ Order is binding: every line is refused BEFORE the nets are summed, and the
// document is refused BEFORE anything is split. Both guards protect the same
// divisor.
export function validateDocumentMoney({ lines, discountKind, discountValue, transportAmount, paidAmount, paymentMethod }) {
  for (const line of lines || []) {
    const lineError = validateLineMoney(line)
    if (lineError) return lineError
  }

  const value = num(discountValue)
  if (value !== null) {
    if (value < 0) return 'products:money.discountNegative'
    if (discountKind === 'percent' && value > 100) return 'products:money.discountOverHundred'
    if (discountKind !== 'percent' && value > documentDiscountBase(lines)) {
      return 'products:money.discountOverDocument'
    }
  }

  const transport = num(transportAmount)
  if (transport !== null && transport < 0) return 'products:money.transportNegative'

  const paid = num(paidAmount)
  if (paid !== null && paid < 0) return 'products:money.paidNegative'
  // ⚠️ Required only when money actually moved. Zero paid is a complete and
  // ordinary answer — it is what "on account" is made of.
  if (paid !== null && paid > 0 && !PAYMENT_METHODS.includes(paymentMethod)) {
    return 'products:money.paymentMethodRequired'
  }

  return ''
}

// ── the split ───────────────────────────────────────────────────────────────

// Spread `amount` across `weights` so that the parts add up to `amount` EXACTLY.
//
// ⚠️ THE REMAINDER IS THE WHOLE PROBLEM. Rounding each share independently
// leaves a few agorot unaccounted for — and money that vanishes or money that
// is invented are both lies, on a figure somebody will reconcile against a
// paper invoice.
//
// So every share but one is rounded, and the LAST WORD goes to the heaviest
// line: the crumb lands where it moves a unit cost least in relative terms.
// Deterministic, and it never depends on the order rows happen to be in.
//
// ⚠️ A base of zero is not an error and must not divide. A document discounted
// to nothing has weights that are all zero, and the caller passes quantities
// instead — the split still has to happen, because transport on a fully
// discounted delivery is still real money.
export function spread(weights, amount) {
  const list = (weights || []).map((w) => Number(w) || 0)
  if (list.length === 0) return []
  if (!amount) return list.map(() => 0)

  const total = list.reduce((a, b) => a + b, 0)
  const even = total === 0
  const shares = list.map((w) => money(amount * (even ? 1 / list.length : w / total)))

  const assigned = shares.reduce((a, b) => a + b, 0)
  const remainder = money(amount - assigned)
  if (remainder !== 0) {
    let heaviest = 0
    for (let i = 1; i < list.length; i += 1) if (list[i] > list[heaviest]) heaviest = i
    shares[heaviest] = money(shares[heaviest] + remainder)
  }
  return shares
}

// What each line actually cost us, and what the document says about itself.
//
// ⚠️ THE DOCUMENT IS THE AUTHORITY ON MONEY AND THE MOVEMENT ON COST-PER-UNIT,
// and they are not asked to reconcile to the agora. unit_cost keeps four
// decimals, so quantity × unit_cost summed back will not reproduce the net
// exactly — that is true today, before any of this, and it is the reason the
// document stores its own totals rather than leaving them to be rebuilt.
//
// ⚠️ Divided by the RECEIVED quantity, which today equals the entered quantity.
// Named that way on purpose: stage 4b adds free goods, where six are paid for
// and seven arrive, and it must be a change to this one expression rather than
// a redesign.
export function allocateDocument({ lines, discountKind, discountValue, transportAmount }) {
  const rows = lines || []
  const nets = rows.map((line) => lineNet(line) || 0)

  const discount = documentDiscountAmount(rows, discountKind, discountValue)
  const transport = num(transportAmount) || 0

  // Weights are the nets; quantities stand in when every net is zero.
  const allZero = nets.every((n) => n === 0)
  const weights = allZero ? rows.map((line) => num(line.enteredQuantity) || 0) : nets

  const discountShares = spread(weights, discount)
  const transportShares = spread(weights, transport)

  const allocated = rows.map((line, i) => {
    const landed = money(nets[i] - discountShares[i] + transportShares[i])
    const received = num(line.enteredQuantity) || 0
    return {
      net: nets[i],
      discountShare: discountShares[i],
      transportShare: transportShares[i],
      landed,
      // Per ENTERED unit. stockLine divides by the packaging factor to reach
      // the base unit, exactly as it does with a typed price today.
      landedUnitPrice: received === 0 ? 0 : landed / received,
    }
  })

  const gross = money(rows.reduce((sum, line) => sum + (lineGross(line) || 0), 0))
  const lineDiscounts = money(rows.reduce((sum, line) => sum + (lineDiscountAmount(line) || 0), 0))

  return {
    lines: allocated,
    gross,
    lineDiscounts,
    documentDiscount: discount,
    transport,
    // What the goods cost us, transport included.
    net: money(gross - lineDiscounts - discount + transport),
  }
}

// ── what is still owed ──────────────────────────────────────────────────────

// ⚠️ Transport paid to a carrier is NOT owed to the supplier, and the reason is
// stronger than accuracy: supplier_doc_number exists so our record matches the
// supplier's paper. If their invoice reads 12,100 because it carries the
// freight and we compute 11,900, reconciliation fails on every delivery that
// has any — which is the one job that field has.
//
// ⚠️ And the asymmetry is deliberate rather than an oversight: freight paid to a
// carrier still enters unit_cost, because it is a real cost of getting the
// goods here, and it is owed to nobody we track. The number is complete for
// costing and silent about the carrier on purpose.
export function supplierOwed({ gross, lineDiscounts, documentDiscount, transport, transportPaidTo, paidAmount }) {
  const goods = money(gross - lineDiscounts - documentDiscount)
  const freight = transportPaidTo === 'supplier' ? (Number(transport) || 0) : 0
  return money(goods + freight - (num(paidAmount) || 0))
}

// "On account" is a state, never a stored choice.
export function isOnAccount(owed) {
  return money(owed) > 0
}

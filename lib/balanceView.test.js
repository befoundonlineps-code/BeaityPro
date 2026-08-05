import {
  balanceRows, emptyReason, sortBalanceRows, lowSupplyThreshold,
  BALANCE_STATE, COST_STATE, EMPTY_REASON,
} from './balanceView'

// The decisions this file holds are the ones the stocktake will read too, so
// each is pinned here rather than inside a screen.
const product = (id, extra = {}) => ({
  id, name: id, base_unit: 'pcs', units_per_package: 1, is_active: true, ...extra,
})
const balance = (product_id, balance_base, avg_cost, storage_id = 'stor-1') =>
  ({ storage_id, product_id, balance_base, avg_cost })

const P = {
  shampoo: product('p-shampoo'),
  laser: product('p-laser'),
  cooler: product('p-cooler', { units_per_package: 15 }),
}

describe('balanceRows — which line stands in front of the counter', () => {
  it('shows a stocked product with its computed cost', () => {
    const [row] = balanceRows({
      balances: [balance('p-shampoo', 20, 50)], products: [P.shampoo], storageId: 'stor-1',
    })
    expect(row).toMatchObject({
      balanceBase: 20, avgCost: 50,
      balanceState: BALANCE_STATE.IN_STOCK, costState: COST_STATE.KNOWN,
      needsAttention: false, lowSupply: false, archived: false,
    })
  })

  it('keeps "never moved" apart from a real zero', () => {
    // ⚠️ The view returns NO ROW for a product that never moved, so products is
    // what gets walked. One means "created, not supplied yet", the other means
    // "ran out" — and coalesce(balance, 0) says the second about the first.
    const rows = balanceRows({
      balances: [balance('p-shampoo', 0, null)],
      products: [P.shampoo, P.laser],
      storageId: 'stor-1',
    })
    expect(rows.find((r) => r.product.id === 'p-shampoo')).toMatchObject({
      balanceBase: 0, balanceState: BALANCE_STATE.EMPTY,
    })
    expect(rows.find((r) => r.product.id === 'p-laser')).toMatchObject({
      balanceBase: null, balanceState: BALANCE_STATE.NEVER_MOVED,
    })
  })

  it('keeps NULL apart from zero on the cost', () => {
    // avg_cost is NULL whenever the balance is <= 0 — "does not apply", which
    // is neither "free" nor "unknown". Three meanings, three states.
    const rows = balanceRows({
      balances: [balance('p-shampoo', -75, null), balance('p-laser', 10, 0)],
      products: [P.shampoo, P.laser],
      storageId: 'stor-1',
    })
    expect(rows[0]).toMatchObject({ balanceState: BALANCE_STATE.NEGATIVE, costState: COST_STATE.NONE })
    expect(rows[1]).toMatchObject({ costState: COST_STATE.ZERO })
  })

  it('SHOUTS on stock that exists and is recorded as worth nothing', () => {
    // The combination that finds poisoning without anybody looking for it.
    const [row] = balanceRows({
      balances: [balance('p-laser', 10, 0)], products: [P.laser], storageId: 'stor-1',
    })
    expect(row.needsAttention).toBe(true)
  })

  it('does not shout at a negative balance, which is a different fault', () => {
    const [row] = balanceRows({
      balances: [balance('p-cooler', -75, null)], products: [P.cooler], storageId: 'stor-1',
    })
    expect(row).toMatchObject({ balanceState: BALANCE_STATE.NEGATIVE, needsAttention: false })
  })

  it('ignores another storage’s rows entirely', () => {
    const rows = balanceRows({
      balances: [balance('p-shampoo', 20, 50, 'stor-2')],
      products: [P.shampoo],
      storageId: 'stor-1',
    })
    expect(rows[0].balanceState).toBe(BALANCE_STATE.NEVER_MOVED)
  })
})

describe('the archived rule — a display problem, not an access problem', () => {
  const archived = (p) => ({ ...p, is_active: false })

  it('SHOWS an archived product that still has stock, labelled', () => {
    const [row] = balanceRows({
      balances: [balance('p-shampoo', 20, 50)],
      products: [archived(P.shampoo)],
      storageId: 'stor-1',
    })
    expect(row).toMatchObject({ balanceBase: 20, archived: true })
  })

  it('drops it by itself once the balance reaches zero', () => {
    // ⚠️ Self-healing: no trigger, no cleanup step, no second decision.
    expect(balanceRows({
      balances: [balance('p-shampoo', 0, null)],
      products: [archived(P.shampoo)],
      storageId: 'stor-1',
    })).toEqual([])
  })

  it('hides an archived product that never moved', () => {
    expect(balanceRows({ balances: [], products: [archived(P.laser)], storageId: 'stor-1' })).toEqual([])
  })

  it('SHOWS an archived product whose balance went negative', () => {
    const [row] = balanceRows({
      balances: [balance('p-cooler', -75, null)],
      products: [archived(P.cooler)],
      storageId: 'stor-1',
    })
    expect(row).toMatchObject({ balanceState: BALANCE_STATE.NEGATIVE, archived: true })
  })

  it('means the stocktake can COUNT an archived product on the shelf', () => {
    // ⚠️ The heaviest consequence. Filtering by is_active makes "I counted this
    // storage" false BY CONSTRUCTION, with nothing to reveal it.
    const countable = balanceRows({
      balances: [balance('p-shampoo', 20, 50)],
      products: [archived(P.shampoo)],
      storageId: 'stor-1',
    }).map((r) => r.product.id)
    expect(countable).toContain('p-shampoo')
  })
})

describe('the low-supply alarm, separate from the value alarm', () => {
  const withThreshold = (p, low_supply_units) => ({ ...p, low_supply_units })

  it('fires at or below the threshold', () => {
    const [row] = balanceRows({
      balances: [balance('p-shampoo', 5, 50)],
      products: [withThreshold(P.shampoo, 5)],
      storageId: 'stor-1',
    })
    expect(row.lowSupply).toBe(true)
  })

  it('does not fire above it', () => {
    const [row] = balanceRows({
      balances: [balance('p-shampoo', 20, 50)],
      products: [withThreshold(P.shampoo, 5)],
      storageId: 'stor-1',
    })
    expect(row.lowSupply).toBe(false)
  })

  it('NEVER fires without a threshold, and does not read empty as zero', () => {
    // ⚠️ Reading null as 0 means an alarm that fires when the balance reaches
    // zero — precisely too late to reorder.
    expect(lowSupplyThreshold({ low_supply_units: null })).toBeNull()
    expect(lowSupplyThreshold({ low_supply_units: '' })).toBeNull()
    expect(lowSupplyThreshold({})).toBeNull()
    const [row] = balanceRows({
      balances: [balance('p-shampoo', 0, null)], products: [P.shampoo], storageId: 'stor-1',
    })
    expect(row.lowSupply).toBe(false)
  })

  it('keeps the two alarms independent', () => {
    // needsAttention → its VALUE is unknown. lowSupply → its QUANTITY is small.
    const [plentifulAndPoisoned] = balanceRows({
      balances: [balance('p-laser', 500, 0)],
      products: [withThreshold(P.laser, 10)],
      storageId: 'stor-1',
    })
    expect(plentifulAndPoisoned).toMatchObject({ needsAttention: true, lowSupply: false })

    const [scarceAndPriced] = balanceRows({
      balances: [balance('p-laser', 2, 30)],
      products: [withThreshold(P.laser, 10)],
      storageId: 'stor-1',
    })
    expect(scarceAndPriced).toMatchObject({ needsAttention: false, lowSupply: true })
  })
})

describe('emptyReason — the fourth triple on this screen', () => {
  it('says nothing while still loading', () => {
    expect(emptyReason({ loading: true, error: null, products: [], rows: [] })).toBeNull()
  })

  it('reports a FAILED read rather than emptiness', () => {
    // ⚠️ Item 26. A failed read drawn as "nothing here" does not fail, it
    // reassures — and this hook is new, so it does not inherit the fix
    // useProductCatalog got.
    expect(emptyReason({ loading: false, error: new Error('x'), products: [], rows: [] }))
      .toBe(EMPTY_REASON.FAILED)
  })

  it('distinguishes an empty catalogue from an unstocked one', () => {
    // Two completely different next actions: add a product, or post a supply.
    expect(emptyReason({ loading: false, error: null, products: [], rows: [] }))
      .toBe(EMPTY_REASON.NO_PRODUCTS)
    expect(emptyReason({ loading: false, error: null, products: [{ id: 'p' }], rows: [] }))
      .toBe(EMPTY_REASON.NO_STOCK)
  })

  it('says nothing when there are rows to draw', () => {
    expect(emptyReason({ loading: false, error: null, products: [{ id: 'p' }], rows: [{}] })).toBeNull()
  })

  it('prefers the failure over both empty messages', () => {
    // A read that failed while the catalogue happens to be empty is still a
    // failure, and saying "add a product" would be advice based on nothing.
    expect(emptyReason({ loading: false, error: new Error('x'), products: [{ id: 'p' }], rows: [] }))
      .toBe(EMPTY_REASON.FAILED)
  })
})

describe('sortBalanceRows — what is wrong comes first', () => {
  it('puts the alarms above the quiet rows, and never-moved last', () => {
    const rows = [
      { product: { id: 'quiet' }, balanceState: BALANCE_STATE.IN_STOCK },
      { product: { id: 'never' }, balanceState: BALANCE_STATE.NEVER_MOVED },
      { product: { id: 'low' }, balanceState: BALANCE_STATE.IN_STOCK, lowSupply: true },
      { product: { id: 'negative' }, balanceState: BALANCE_STATE.NEGATIVE },
      { product: { id: 'poisoned' }, balanceState: BALANCE_STATE.IN_STOCK, needsAttention: true },
    ]
    expect(sortBalanceRows(rows).map((r) => r.product.id))
      .toEqual(['poisoned', 'negative', 'low', 'quiet', 'never'])
  })

  it('does not mutate what it was given', () => {
    const rows = [
      { product: { id: 'a' }, balanceState: BALANCE_STATE.NEVER_MOVED },
      { product: { id: 'b' }, needsAttention: true },
    ]
    sortBalanceRows(rows)
    expect(rows.map((r) => r.product.id)).toEqual(['a', 'b'])
  })

  it('survives nothing', () => {
    expect(sortBalanceRows(null)).toEqual([])
  })
})

import {
  balanceRows, emptyReason, sortBalanceRows, lowSupplyThreshold,
  storageValueSummary, problemKind, counterpartBalances, PROBLEM_KIND,
  hasKnownValue, balanceScreenSections, BALANCE_SCREEN_SECTION, stockedStorages, costIsEstimated,
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

  it('asks whether the SALON is low, not this storage', () => {
    // 🔴 THE OWNER'S DECISION, AND IT USED TO BE WRONG HERE. low_supply_units
    // is one column on PRODUCTS — one number per product — and no
    // per-(product, storage) threshold exists in the schema at all (080_1b
    // listed every column of the three tables). So comparing it against ONE
    // storage's balance was the claim the data cannot carry: the same n judged
    // a cabin holding a working stock and the main storage.
    //
    // Two here against a threshold of five, and two hundred next door. The
    // salon is not running low on anything, and the badge used to say it was —
    // on the balances screen, per storage, shipped.
    const balances = [balance('p-shampoo', 2, 50), { ...balance('p-shampoo', 200, 50), storage_id: 'stor-2' }]
    const [row] = balanceRows({
      balances, products: [withThreshold(P.shampoo, 5)], storageId: 'stor-1',
    })
    expect(row.lowSupply).toBe(false)
    // The BALANCE is still this storage's — that is the number the screen is
    // about. Only the threshold question widened.
    expect(row.balanceBase).toBe(2)
  })

  it('gives the same answer whichever storage is being viewed', () => {
    // ⚠️ One computation, so the signal cannot move with the picker. A screen
    // that lit up in one storage and not the next would be answering a question
    // nobody asked — and there is no second place it could be computed.
    const balances = [balance('p-shampoo', 2, 50), { ...balance('p-shampoo', 1, 50), storage_id: 'stor-2' }]
    const products = [withThreshold(P.shampoo, 5)]
    const [here] = balanceRows({ balances, products, storageId: 'stor-1' })
    const [there] = balanceRows({ balances, products, storageId: 'stor-2' })
    expect(here.lowSupply).toBe(true)
    expect(there.lowSupply).toBe(true)
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

describe('storageValueSummary — a total that excludes something says so', () => {
  const rowOf = (over) => ({
    product: { id: over.id || 'p' },
    balanceBase: 0, avgCost: null,
    balanceState: BALANCE_STATE.IN_STOCK, costState: COST_STATE.KNOWN,
    needsAttention: false, lowSupply: false, archived: false,
    ...over,
  })

  it('sums the rows whose cost is actually known', () => {
    const summary = storageValueSummary([
      rowOf({ id: 'a', balanceBase: 20, avgCost: 50 }),
      rowOf({ id: 'b', balanceBase: 4, avgCost: 25 }),
    ])
    expect(summary).toEqual({ total: 1100, unvaluedProducts: 0, unvaluedRows: [] })
  })

  it('HOLDS OUT stock recorded at zero cost, and counts what it held out', () => {
    // ⚠️ The fault this replaces: the line said "its value is unknown" and the
    // total counted it as nothing. Excluding NULL was possible; excluding the
    // zero was not, because a poisoned cost is a number whose value is 0.
    // Arithmetic does not read badges.
    const summary = storageValueSummary([
      rowOf({ id: 'good', balanceBase: 20, avgCost: 50 }),
      rowOf({ id: 'poisoned', balanceBase: 3, avgCost: 0, costState: COST_STATE.ZERO, needsAttention: true }),
    ])
    expect(summary.total).toBe(1000)
    expect(summary.unvaluedProducts).toBe(1)
    expect(summary.unvaluedRows.map((r) => r.product.id)).toEqual(['poisoned'])
  })

  it('reports a COUNT of products, never a summed quantity', () => {
    // ⚠️ My first version added the held-out balances together. Those are each
    // in their own product's base unit, so pieces and millilitres would have
    // gone into one figure — the rule enforced on every other screen, broken
    // inside the function written to make a total honest. A count has no unit.
    const summary = storageValueSummary([
      rowOf({ id: 'pieces', balanceBase: 3, avgCost: 0, costState: COST_STATE.ZERO, needsAttention: true }),
      rowOf({ id: 'millilitres', balanceBase: 250, avgCost: 0, costState: COST_STATE.ZERO, needsAttention: true }),
    ])
    expect(summary.unvaluedProducts).toBe(2)
    expect(summary).not.toHaveProperty('unvaluedBase')
  })

  it('does not silently shrink the total — the exclusion is reportable', () => {
    // Excluding without saying so produces a figure smaller than the truth with
    // nobody able to ask why, which is the fault we keep removing.
    const summary = storageValueSummary([
      rowOf({ id: 'poisoned', balanceBase: 3, avgCost: 0, costState: COST_STATE.ZERO, needsAttention: true }),
    ])
    expect(summary.total).toBe(0)
    expect(summary.unvaluedProducts).toBe(1)
  })

  it('leaves a negative balance out without calling it unvalued stock', () => {
    // It is not stock whose value is unknown; it is stock that is not there.
    const summary = storageValueSummary([
      rowOf({ id: 'neg', balanceBase: -75, avgCost: null, balanceState: BALANCE_STATE.NEGATIVE, costState: COST_STATE.NONE }),
    ])
    expect(summary).toEqual({ total: 0, unvaluedProducts: 0, unvaluedRows: [] })
  })

  it('counts ONE unvalued product when two rows both show a dash', () => {
    // ⚠️ THE DISTINCTION THAT COST A ROUND, AND THAT I LOST ONCE BY DELETING A
    // COMMENT DURING A CORRECT REFACTOR. Both rows are unvaluable and both
    // draw "—", and only one of them is unvalued STOCK:
    //
    //   3 pieces at a recorded cost of 0  → goods exist, worth unknown  ← counted
    //   a balance of -75                  → there are no goods to value  ← not
    //
    // Whoever counts the dashes finds two and reads one. The danger is not to
    // that reader; it is to whoever "corrects" this to 2, after which one
    // number reports two different problems. A comment did not survive; this
    // fails by name.
    const summary = storageValueSummary([
      rowOf({ id: 'goodsWorthUnknown', balanceBase: 3, avgCost: 0, costState: COST_STATE.ZERO, needsAttention: true }),
      rowOf({ id: 'noGoodsAtAll', balanceBase: -75, avgCost: null, balanceState: BALANCE_STATE.NEGATIVE, costState: COST_STATE.NONE }),
    ])
    expect(summary.unvaluedProducts).toBe(1)
    expect(summary.unvaluedRows.map((r) => r.product.id)).toEqual(['goodsWorthUnknown'])
    // and both are absent from the total, for different reasons
    expect(summary.total).toBe(0)
  })

  it('ignores never-moved and emptied rows entirely', () => {
    const summary = storageValueSummary([
      rowOf({ id: 'never', balanceBase: null, balanceState: BALANCE_STATE.NEVER_MOVED, costState: COST_STATE.NONE }),
      rowOf({ id: 'empty', balanceBase: 0, avgCost: null, balanceState: BALANCE_STATE.EMPTY, costState: COST_STATE.NONE }),
    ])
    expect(summary).toEqual({ total: 0, unvaluedProducts: 0, unvaluedRows: [] })
  })

  it('survives nothing', () => {
    expect(storageValueSummary(null)).toEqual({ total: 0, unvaluedProducts: 0, unvaluedRows: [] })
  })
})

describe('problemKind — two kinds, two acts, two people', () => {
  it('calls a poisoned cost and a negative balance DATA problems', () => {
    // Both are fixed by correcting a document.
    expect(problemKind({ needsAttention: true })).toBe(PROBLEM_KIND.DATA)
    expect(problemKind({ balanceState: BALANCE_STATE.NEGATIVE })).toBe(PROBLEM_KIND.DATA)
  })

  it('calls a low shelf an OPERATIONAL signal', () => {
    // The record is fine; the fix is a purchase order, by somebody else.
    expect(problemKind({ lowSupply: true, balanceState: BALANCE_STATE.IN_STOCK }))
      .toBe(PROBLEM_KIND.OPERATIONAL)
  })

  it('does not let a low shelf mask a data problem', () => {
    // A row can be both; the heavier kind wins, because the acts differ.
    expect(problemKind({ needsAttention: true, lowSupply: true })).toBe(PROBLEM_KIND.DATA)
  })

  it('calls everything else nothing', () => {
    expect(problemKind({ balanceState: BALANCE_STATE.IN_STOCK })).toBe(PROBLEM_KIND.NONE)
    expect(problemKind({ balanceState: BALANCE_STATE.NEVER_MOVED })).toBe(PROBLEM_KIND.NONE)
  })
})

describe('counterpartBalances — where the other half of a negative is', () => {
  const balances = [
    { storage_id: 'stor-1', product_id: 'p-cooler', balance_base: -75 },
    { storage_id: 'stor-2', product_id: 'p-cooler', balance_base: 75 },
    { storage_id: 'stor-2', product_id: 'p-other', balance_base: 5 },
    { storage_id: 'stor-3', product_id: 'p-cooler', balance_base: 0 },
  ]

  it('finds the storage holding the other side', () => {
    // The commonest cause of a negative balance is a transfer recorded before
    // the supply, so this is the most useful context the row can carry.
    expect(counterpartBalances({ balances, productId: 'p-cooler', storageId: 'stor-1' }))
      .toEqual([{ storage_id: 'stor-2', balance_base: 75 }])
  })

  it('skips storages holding none of it', () => {
    expect(counterpartBalances({ balances, productId: 'p-cooler', storageId: 'stor-1' })
      .some((c) => c.storage_id === 'stor-3')).toBe(false)
  })

  it('never returns the row’s own storage', () => {
    expect(counterpartBalances({ balances, productId: 'p-cooler', storageId: 'stor-2' })
      .map((c) => c.storage_id)).toEqual(['stor-1'])
  })

  it('survives nothing', () => {
    expect(counterpartBalances({ balances: null, productId: 'p', storageId: 's' })).toEqual([])
  })
})

describe('hasKnownValue — one predicate for the cell and the total', () => {
  const rowOf = (over) => ({
    product: { id: 'p' }, balanceBase: 10, avgCost: 5,
    balanceState: BALANCE_STATE.IN_STOCK, costState: COST_STATE.KNOWN,
    needsAttention: false, lowSupply: false, archived: false, ...over,
  })

  it('is true only when the value can actually be computed', () => {
    expect(hasKnownValue(rowOf({}))).toBe(true)
  })

  it('is FALSE for stock recorded at zero cost — the row the badge exists for', () => {
    // ⚠️ The fault: the total held this row out while the cell beside it
    // printed "0". The screen owned a word for ignorance, used it on two rows,
    // and dropped it on the one row that needed it.
    expect(hasKnownValue(rowOf({ avgCost: 0, costState: COST_STATE.ZERO, needsAttention: true })))
      .toBe(false)
  })

  it('is false for a negative balance, an emptied shelf and a never-moved product', () => {
    expect(hasKnownValue(rowOf({ balanceBase: -75, avgCost: null, balanceState: BALANCE_STATE.NEGATIVE, costState: COST_STATE.NONE }))).toBe(false)
    expect(hasKnownValue(rowOf({ balanceBase: 0, avgCost: null, balanceState: BALANCE_STATE.EMPTY, costState: COST_STATE.NONE }))).toBe(false)
    expect(hasKnownValue(rowOf({ balanceBase: null, avgCost: null, balanceState: BALANCE_STATE.NEVER_MOVED, costState: COST_STATE.NONE }))).toBe(false)
  })

  it('agrees with the total on every row, which is the whole point', () => {
    // Two conditions drifted apart once; one cannot.
    const rows = [
      rowOf({ product: { id: 'good' } }),
      rowOf({ product: { id: 'poisoned' }, avgCost: 0, costState: COST_STATE.ZERO, needsAttention: true }),
      rowOf({ product: { id: 'neg' }, balanceBase: -75, avgCost: null, balanceState: BALANCE_STATE.NEGATIVE, costState: COST_STATE.NONE }),
    ]
    const contributing = rows.filter(hasKnownValue)
    const { total } = storageValueSummary(rows)
    expect(total).toBe(contributing.reduce((s, r) => s + r.balanceBase * r.avgCost, 0))
  })

  it('survives nothing', () => {
    expect(hasKnownValue(null)).toBe(false)
  })
})

describe('balanceScreenSections — a work list is not given a stock appendix', () => {
  const rowOf = (id, over) => ({
    product: { id }, balanceBase: 10, avgCost: 5,
    balanceState: BALANCE_STATE.IN_STOCK, costState: COST_STATE.KNOWN,
    needsAttention: false, lowSupply: false, archived: false, ...over,
  })

  it('separates never-moved from the rest of the stock', () => {
    // ⚠️ "الباقي" named the section by its POSITION. And at two hundred
    // products it turns a work list into a heading above a hundred and seventy
    // rows nobody is asked to act on.
    const sections = balanceScreenSections([
      rowOf('ordinary'),
      rowOf('never', { balanceBase: null, avgCost: null, balanceState: BALANCE_STATE.NEVER_MOVED, costState: COST_STATE.NONE }),
      rowOf('poisoned', { avgCost: 0, costState: COST_STATE.ZERO, needsAttention: true }),
      rowOf('low', { lowSupply: true }),
    ])
    expect(sections.map((s) => s.section))
      .toEqual([BALANCE_SCREEN_SECTION.DATA, BALANCE_SCREEN_SECTION.OPERATIONAL, BALANCE_SCREEN_SECTION.STOCKED, BALANCE_SCREEN_SECTION.NEVER_MOVED])
    expect(sections.map((s) => s.rows.map((r) => r.product.id)))
      .toEqual([['poisoned'], ['low'], ['ordinary'], ['never']])
  })

  it('leaves out a section with nothing in it rather than drawing an empty heading', () => {
    const sections = balanceScreenSections([rowOf('ordinary')])
    expect(sections.map((s) => s.section)).toEqual([BALANCE_SCREEN_SECTION.STOCKED])
  })

  it('puts a negative balance in the DATA section, not with the stock', () => {
    const sections = balanceScreenSections([
      rowOf('neg', { balanceBase: -75, avgCost: null, balanceState: BALANCE_STATE.NEGATIVE, costState: COST_STATE.NONE }),
    ])
    expect(sections[0].section).toBe(BALANCE_SCREEN_SECTION.DATA)
  })

  it('survives nothing', () => {
    expect(balanceScreenSections(null)).toEqual([])
  })
})

describe('stockedStorages — what is still on the shelf after archiving', () => {
  const balances = [
    { storage_id: 'stor-1', product_id: 'p-shampoo', balance_base: 20 },
    { storage_id: 'stor-2', product_id: 'p-shampoo', balance_base: 0 },
    { storage_id: 'stor-1', product_id: 'p-cooler', balance_base: -75 },
    { storage_id: 'stor-2', product_id: 'p-cooler', balance_base: 75 },
    { storage_id: 'stor-1', product_id: 'p-other', balance_base: 5 },
  ]

  it('names every storage still holding it', () => {
    // ⚠️ Nothing blocks archiving a product with stock and nothing should — an
    // archived STORAGE is unreachable so only the database can save it, an
    // archived PRODUCT is merely filtered. What was missing was knowledge.
    expect(stockedStorages({ balances, productId: 'p-shampoo' }))
      .toEqual([{ storage_id: 'stor-1', balance_base: 20 }])
  })

  it('reports a NEGATIVE balance too', () => {
    // Archiving a product that is already short is worth saying out loud.
    expect(stockedStorages({ balances, productId: 'p-cooler' }))
      .toEqual([
        { storage_id: 'stor-1', balance_base: -75 },
        { storage_id: 'stor-2', balance_base: 75 },
      ])
  })

  it('says nothing about a product with no stock anywhere', () => {
    // The notice must not appear for an ordinary archive — a message shown
    // every time is a message nobody reads.
    expect(stockedStorages({ balances, productId: 'p-gone' })).toEqual([])
  })

  it('ignores a storage holding exactly zero of it', () => {
    expect(stockedStorages({ balances, productId: 'p-shampoo' }).some((s) => s.storage_id === 'stor-2'))
      .toBe(false)
  })

  it('survives nothing', () => {
    expect(stockedStorages({ balances: null, productId: 'p' })).toEqual([])
  })
})

describe('costIsEstimated — item 34, dark until the column exists', () => {
  it('is FALSE when the column is not there, and invents nothing', () => {
    // ⚠️ The script is prepared and not run, so cost_has_estimate is undefined
    // on every row today. The badge stays dark and lights up on its own once
    // the view carries it — no value is made up for a column that is absent.
    expect(costIsEstimated({ balance_base: 20, avg_cost: 50 })).toBe(false)
    expect(costIsEstimated({ cost_has_estimate: undefined })).toBe(false)
    expect(costIsEstimated(null)).toBe(false)
  })

  it('is true only for an explicit true, never for a truthy value', () => {
    expect(costIsEstimated({ cost_has_estimate: true })).toBe(true)
    expect(costIsEstimated({ cost_has_estimate: false })).toBe(false)
    // A string 'false' from a wire format must not read as true.
    expect(costIsEstimated({ cost_has_estimate: 'false' })).toBe(false)
  })

  it('reaches the row so the screen can ask for the explanation', () => {
    const [row] = balanceRows({
      balances: [{ storage_id: 'stor-1', product_id: 'p-shampoo', balance_base: 20, avg_cost: 50, cost_has_estimate: true }],
      products: [P.shampoo],
      storageId: 'stor-1',
    })
    expect(row.costEstimated).toBe(true)
  })

  it('is a SEPARATE fact from the value alarm', () => {
    // "estimated" says where the number came from; needsAttention says the
    // number is zero. A plausible estimate is not an alarm, and one badge for
    // both would repeat the mistake this module keeps undoing.
    const [row] = balanceRows({
      balances: [{ storage_id: 'stor-1', product_id: 'p-shampoo', balance_base: 20, avg_cost: 100, cost_has_estimate: true }],
      products: [P.shampoo],
      storageId: 'stor-1',
    })
    expect(row).toMatchObject({ costEstimated: true, needsAttention: false })
  })
})

import { catalogueBalanceRows, ALL_STORAGES } from './catalogueBalance'
import { BALANCE_STATE, balanceRows } from './balanceView'

const product = (id, extra = {}) => ({
  id, name: id, base_unit: 'pcs', units_per_package: 1, is_active: true, ...extra,
})

const bal = (product_id, storage_id, balance_base) => ({
  product_id, storage_id, balance_base, avg_cost: null, cost_has_estimate: false,
})

describe('one storage', () => {
  it('is balanceRows verbatim, keyed by product', () => {
    // ⚠️ The point of the delegation: this must not have its own opinion about
    // never-moved, about zero, or about an archived product with stock.
    const products = [product('p1'), product('p2')]
    const rows = catalogueBalanceRows({
      balances: [bal('p1', 's1', 75)],
      products,
      storageId: 's1',
    })
    expect(rows.get('p1').balanceBase).toBe(75)
    expect(rows.get('p1').balanceState).toBe(BALANCE_STATE.IN_STOCK)
    expect(rows.get('p2').balanceState).toBe(BALANCE_STATE.NEVER_MOVED)
    expect(rows.get('p2').balanceBase).toBeNull()
  })

  it('carries the low-supply signal, computed across every storage', () => {
    // 🔴 THE OWNER'S DECISION, AFTER THE GRAIN WAS MEASURED: the threshold is
    // one number on the product, so it is compared against the product's TOTAL
    // across every storage — «is the salon running low» — not against the
    // balance of whichever storage happens to be selected.
    //
    // Two in this storage against a threshold of five WOULD have lit up under
    // the old per-storage comparison. It does not, because two hundred sit next
    // door and the salon is not running low on anything.
    const rows = catalogueBalanceRows({
      balances: [bal('p1', 's1', 2), bal('p1', 's2', 200)],
      products: [product('p1', { low_supply_units: 5 })],
      storageId: 's1',
    })
    expect(rows.get('p1').lowSupply).toBe(false)
    expect(rows.get('p1').balanceBase).toBe(2)
  })

  it('lights up when the salon as a whole is low, whichever storage is shown', () => {
    // And the other direction, which is the one the signal exists for: the
    // answer does not change with the picker, because the question is not about
    // the picker.
    const balances = [bal('p1', 's1', 2), bal('p1', 's2', 1)]
    const products = [product('p1', { low_supply_units: 5 })]
    expect(catalogueBalanceRows({ balances, products, storageId: 's1' }).get('p1').lowSupply).toBe(true)
    expect(catalogueBalanceRows({ balances, products, storageId: 's2' }).get('p1').lowSupply).toBe(true)
    expect(catalogueBalanceRows({ balances, products, storageId: ALL_STORAGES }).get('p1').lowSupply).toBe(true)
  })

  it('drops nothing of its own any more — the suppression is gone', () => {
    // ⚠️ THIS COLUMN USED TO BLANK lowSupply IN BOTH MODES, on the grounds that
    // the grain of the threshold had never been decided and a badge meaning one
    // thing per storage and another across all of them hides the question
    // rather than posing it. That was right while it was undecided.
    //
    // It is decided. So the suppression comes out — leaving it would be this
    // screen holding an opinion about a number it does not own, which is the
    // second copy arriving as a deletion instead of as a calculation.
    const source = require('fs').readFileSync(require('path').join(__dirname, 'catalogueBalance.js'), 'utf8')
    expect(source).not.toMatch(/lowSupply:\s*false/)
    // And the value that arrives is balanceView's, unaltered.
    const rows = catalogueBalanceRows({
      balances: [bal('p1', 's1', 1)],
      products: [product('p1', { low_supply_units: 5 })],
      storageId: 's1',
    })
    expect(rows.get('p1').lowSupply).toBe(true)
  })

  it('reads the same signal balanceRows gives every other screen', () => {
    // ⚠️ THIS TEST USED TO GUARD THE OPPOSITE. It existed to stop a tidy-up
    // from unifying this column with balanceRows, because the two disagreed on
    // purpose while the grain was undecided — and StorageBalances.js:263 was
    // drawing the badge per storage, which the owner has since ruled wrong.
    //
    // The grain is decided and the disagreement is gone: one computation in
    // balanceView, read by the balances screen, the stocktake sheet and this
    // column alike. What is asserted now is the sameness rather than the
    // difference.
    const balances = [bal('p1', 's1', 2)]
    const products = [product('p1', { low_supply_units: 5 })]
    const shared = balanceRows({ balances, products, storageId: 's1' })
    const here = catalogueBalanceRows({ balances, products, storageId: 's1' })
    expect(here.get('p1').lowSupply).toBe(shared[0].lowSupply)
    expect(shared[0].lowSupply).toBe(true)
  })
})

describe('all storages', () => {
  const products = [product('p1'), product('p2'), product('p3')]
  const balances = [
    bal('p1', 's1', 75),
    bal('p1', 's2', 25),
    bal('p2', 's1', 0),
  ]

  it('adds what a product holds in each of them', () => {
    const rows = catalogueBalanceRows({ balances, products, storageId: ALL_STORAGES })
    expect(rows.get('p1').balanceBase).toBe(100)
    expect(rows.get('p1').balanceState).toBe(BALANCE_STATE.IN_STOCK)
  })

  it('treats a storage it never entered as nothing, not as unknown', () => {
    // p1 has no row in s2's own sense of "never moved" for the other product —
    // the merge has to read null as 0 for the SUM while still knowing whether
    // it ever moved anywhere at all. Those are two different questions and the
    // second is the one balanceRows answers per storage.
    const rows = catalogueBalanceRows({
      balances: [bal('p1', 's1', 40)],
      products: [product('p1')],
      storageId: ALL_STORAGES,
    })
    expect(rows.get('p1').balanceBase).toBe(40)
  })

  it('says never-moved only when it moved in no storage at all', () => {
    // 🔴 The distinction this whole column exists to keep. p3 has no row
    // anywhere: created and never supplied. p2 has a row reading zero: it ran
    // out. A column that draws both as "0" tells the second story about the
    // first, and 081 measured that BOTH cases are live in this database.
    const rows = catalogueBalanceRows({ balances, products, storageId: ALL_STORAGES })
    expect(rows.get('p3').balanceState).toBe(BALANCE_STATE.NEVER_MOVED)
    expect(rows.get('p3').balanceBase).toBeNull()
    expect(rows.get('p2').balanceState).toBe(BALANCE_STATE.EMPTY)
    expect(rows.get('p2').balanceBase).toBe(0)
  })

  it('reports a negative total as negative, not as empty', () => {
    const rows = catalogueBalanceRows({
      balances: [bal('p1', 's1', 10), bal('p1', 's2', -85)],
      products: [product('p1')],
      storageId: ALL_STORAGES,
    })
    expect(rows.get('p1').balanceState).toBe(BALANCE_STATE.NEGATIVE)
    expect(rows.get('p1').balanceBase).toBe(-75)
  })

  it('gives the same low-supply answer as any single storage would', () => {
    // ⚠️ THE PROPERTY WORTH PINNING, and it is what «one computation» means in
    // practice: the signal does not move when the picker does. If merging
    // re-derived it from the merged total it would agree here by arithmetic
    // rather than by construction — and then disagree the day the merge and
    // balanceView drifted.
    const balances = [bal('p1', 's1', 2), bal('p1', 's2', 1)]
    const products = [product('p1', { low_supply_units: 5 })]
    const merged = catalogueBalanceRows({ balances, products, storageId: ALL_STORAGES })
    const perStorage = catalogueBalanceRows({ balances, products, storageId: 's1' })
    expect(merged.get('p1').lowSupply).toBe(perStorage.get('p1').lowSupply)
    expect(merged.get('p1').lowSupply).toBe(true)
    // The BALANCE still differs — that is the number the picker is for.
    expect(merged.get('p1').balanceBase).toBe(3)
    expect(perStorage.get('p1').balanceBase).toBe(2)
  })

  it('still answers for every product when there are no balance rows at all', () => {
    // 🔴 The measured defect: the fold walks the storages found IN the balance
    // rows, so an empty `balances` meant an empty map — two products in, zero
    // rows out — and the column drew BLANK on every row instead of «ما تحرّك
    // بعد». The state this column exists to distinguish, lost in the one case
    // where it is the only state there is: a salon with no movements yet, or a
    // page whose balances have not arrived.
    //
    // ⚠️ And the row-count test does not catch it, because a blank cell is
    // still a drawn row. This assertion is the one that does.
    const rows = catalogueBalanceRows({ balances: [], products, storageId: ALL_STORAGES })
    expect(rows.size).toBe(products.length)
    for (const p of products) {
      expect(rows.get(p.id).balanceState).toBe(BALANCE_STATE.NEVER_MOVED)
      expect(rows.get(p.id).balanceBase).toBeNull()
    }
  })

  it('counts a storage that is in the balances but not in any list', () => {
    // Derived from the data on purpose: a balance row for a storage nobody
    // listed still holds stock, and omitting it makes the total quietly short.
    const rows = catalogueBalanceRows({
      balances: [bal('p1', 'ghost', 12)],
      products: [product('p1')],
      storageId: ALL_STORAGES,
    })
    expect(rows.get('p1').balanceBase).toBe(12)
  })

  it('drops an archived product only when it holds nothing anywhere', () => {
    // balanceRows drops an archived product with no stock per storage. Merged,
    // "no stock" has to mean no stock ANYWHERE — otherwise archiving a product
    // that still sits in one cabin makes it vanish from the catalogue while the
    // stocktake still has to count it.
    const archived = product('gone', { is_active: false })
    const held = catalogueBalanceRows({
      balances: [bal('gone', 's1', 0), bal('gone', 's2', 9)],
      products: [archived],
      storageId: ALL_STORAGES,
    })
    expect(held.get('gone').balanceBase).toBe(9)

    const empty = catalogueBalanceRows({
      balances: [bal('gone', 's1', 0), bal('gone', 's2', 0)],
      products: [archived],
      storageId: ALL_STORAGES,
    })
    expect(empty.has('gone')).toBe(false)
  })
})

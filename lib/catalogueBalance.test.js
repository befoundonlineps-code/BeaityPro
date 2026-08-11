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

  it('drops the low-supply signal, and the grain is why', () => {
    // 🔴 The first version KEPT it here and silenced the merged view, arguing
    // that the two readings answer different questions. The schema points the
    // other way: low_supply_units is a column on PRODUCTS — one grain, one per
    // product — and no per-(product, storage) threshold exists anywhere
    // (080_1b listed every column of all three tables).
    //
    // So comparing it against ONE storage's balance is the claim the data
    // cannot carry: the same n judges a cabin holding a working stock and the
    // main storage. The mode where the number is well defined is the one that
    // was silenced.
    //
    // ⚠️ Silent in BOTH here, because a split that shows it in one mode and
    // hides it in the other hides the question instead of posing it. What is
    // deferred is the GRAIN, not the data.
    const rows = catalogueBalanceRows({
      balances: [bal('p1', 's1', 2)],
      products: [product('p1', { low_supply_units: 5 })],
      storageId: 's1',
    })
    expect(rows.get('p1').lowSupply).toBe(false)
    expect(rows.get('p1').balanceBase).toBe(2)
  })

  it('leaves balanceRows itself untouched for the screens that use it', () => {
    // 🔴 StorageBalances.js:263 already draws this badge per storage, off the
    // same product-grain threshold — the second site of the same mismatch, and
    // it SHIPS. It is not changed from here: the decision is the owner's, and
    // altering a live screen on the way past is not this module's business.
    // This assertion exists so that a later "tidy-up" cannot quietly make the
    // shared function match this column and change that screen with it.
    const rows = balanceRows({
      balances: [bal('p1', 's1', 2)],
      products: [product('p1', { low_supply_units: 5 })],
      storageId: 's1',
    })
    expect(rows[0].lowSupply).toBe(true)
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

  it('stays silent about low supply here too', () => {
    // The mode whose grain actually MATCHES the threshold — one number per
    // product against the salon's total — and it is silent anyway, because
    // showing it in one mode and not the other is what hides the question.
    // The row that decides is the per-storage one above.
    const rows = catalogueBalanceRows({
      balances: [bal('p1', 's1', 2), bal('p1', 's2', 200)],
      products: [product('p1', { low_supply_units: 5 })],
      storageId: ALL_STORAGES,
    })
    expect(rows.get('p1').lowSupply).toBe(false)
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

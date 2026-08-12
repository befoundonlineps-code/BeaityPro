import { foldersForStorage } from './folderStorageScope'
import { catalogueRows } from './catalogueView'
import { catalogueBalanceRows } from './catalogueBalance'
import { balanceRows } from './balanceView'
import { ALL_STORAGES } from './storageScope'

// 🔴 TWO FILTERS LIVE ON THIS SCREEN AND ONLY ONE OF THEM MAY MOVE.
//
//   THE TREE      narrows with the storage — NEW, DELIBERATE, and the whole
//                 point of giving a folder a storage
//   THE BALANCE   does not — the number beside a product is what it always was,
//                 and every test already written about it must go on passing
//                 untouched
//
// ⚠️ AND THIS FILE EXISTS BECAUSE THE OLD GUARD SAID THE OPPOSITE. It read «the
// storage picker changes ONE COLUMN, it does not change which rows exist», and
// that was correct until folders got a storage. Editing it in place would have
// left one sentence covering two claims that have now separated — so the
// reviewer asked for a test that says the DIFFERENCE out loud instead of a
// sentence quietly rewritten.
//
// 🔴 THE FAILURE IT IS AIMED AT IS THE ONE THAT LOOKS LIKE TIDYING UP. Somebody
// implementing «folders belong to a storage» reaches for the obvious next step
// — «so the balance should be per storage too» — and the screen keeps working,
// the numbers keep looking plausible, and a product's balance silently starts
// meaning something narrower than it says. Nothing errors. That is the shape
// this project keeps paying for.

const cat = (id, storage_id) => ({
  id, name: id, parent_id: null, sort_order: 1, is_active: true, storage_id,
})

const COSMO = 'stor-cosmo'
const HAIR = 'stor-hair'

const CATEGORIES = [cat('after-laser', COSMO), cat('bath', HAIR)]

// One product per folder, so «which folder» and «which storage» cannot be
// confused by accident.
const PRODUCTS = [
  { id: 'p-repair', name: 'InstaCalm Repair', category_id: 'after-laser', base_unit: 'pcs', units_per_package: 1, sort_order: 1, is_active: true },
  { id: 'p-bath', name: 'صابون', category_id: 'bath', base_unit: 'pcs', units_per_package: 1, sort_order: 1, is_active: true },
]

// ⚠️ THE PRODUCT WHOSE FOLDER BELONGS TO ONE STORAGE HOLDS STOCK IN THE OTHER.
// That is the case the two filters disagree about, and it is the only one that
// can tell them apart: if the balance ever learned about folders, this number
// would drop to zero and look entirely reasonable.
const BALANCES = [
  { product_id: 'p-repair', storage_id: COSMO, balance_base: 40, avg_cost: 10, cost_has_estimate: false },
  { product_id: 'p-repair', storage_id: HAIR, balance_base: 60, avg_cost: 10, cost_has_estimate: false },
]

describe('the tree narrows with the storage — this is the new behaviour', () => {
  it('shows one folder here and a different one there', () => {
    expect(foldersForStorage(CATEGORIES, COSMO).map((c) => c.id)).toEqual(['after-laser'])
    expect(foldersForStorage(CATEGORIES, HAIR).map((c) => c.id)).toEqual(['bath'])
  })

  it('shows both under «all storages»', () => {
    expect(foldersForStorage(CATEGORIES, ALL_STORAGES)).toHaveLength(2)
  })
})

describe('the balance does NOT narrow with the folder — this must never change', () => {
  it('gives the same number whichever folder the tree is showing', () => {
    // 🔴 THE ASSERTION THE WHOLE FILE IS FOR. `p-repair` sits in a folder that
    // belongs to Cosmotology and holds 60 in Hair. Asking Hair for its balance
    // must still answer 60 — the folder has no say in it.
    const inHair = catalogueBalanceRows({ balances: BALANCES, products: PRODUCTS, storageId: HAIR })
    expect(inHair.get('p-repair').balanceBase).toBe(60)

    const inCosmo = catalogueBalanceRows({ balances: BALANCES, products: PRODUCTS, storageId: COSMO })
    expect(inCosmo.get('p-repair').balanceBase).toBe(40)

    const everywhere = catalogueBalanceRows({ balances: BALANCES, products: PRODUCTS, storageId: null })
    expect(everywhere.get('p-repair').balanceBase).toBe(100)
  })

  it('takes no folder argument at all, in either computation', () => {
    // ⚠️ Structural rather than watched. A balance that CANNOT see a folder is
    // a balance nobody has to remember not to teach about folders — and the
    // shape is what says so, not a comment. Both entry points are checked,
    // because the screen reads one and the balances screen reads the other.
    expect(catalogueBalanceRows.length).toBe(1)   // one options object
    const merged = catalogueBalanceRows({ balances: BALANCES, products: PRODUCTS, storageId: HAIR, categoryId: 'bath' })
    // The stray argument changes nothing, because nothing reads it.
    expect(merged.get('p-repair').balanceBase).toBe(60)

    const perStorage = balanceRows({ balances: BALANCES, products: PRODUCTS, storageId: HAIR })
    expect(perStorage.find((r) => r.product.id === 'p-repair').balanceBase).toBe(60)
  })

  it('keeps the number even when the tree has filtered that folder away', () => {
    // The two filters at once, which is how they will actually meet: standing
    // on Hair, the tree drops «after-laser» — and `p-repair` still holds 60
    // here. A screen that showed a dash, or a zero, would be reporting the
    // TREE's answer under the BALANCE's heading.
    const visibleFolders = foldersForStorage(CATEGORIES, HAIR)
    expect(visibleFolders.map((c) => c.id)).not.toContain('after-laser')

    const row = catalogueBalanceRows({ balances: BALANCES, products: PRODUCTS, storageId: HAIR }).get('p-repair')
    expect(row.balanceBase).toBe(60)
  })
})

describe('the rows follow the folder, and the folder alone', () => {
  it('narrows to the chosen folder rather than to the storage', () => {
    // catalogueRows has never taken a storage and still does not. What reaches
    // it is the FILTERED CATEGORY LIST — so the storage's effect on the rows is
    // entirely indirect, through which folders can be chosen at all.
    const rows = catalogueRows({
      products: PRODUCTS,
      categories: foldersForStorage(CATEGORIES, HAIR),
      categoryId: 'bath',
    })
    expect(rows.map((p) => p.id)).toEqual(['p-bath'])
  })

  it('cannot reach a folder the tree filtered away', () => {
    // ⚠️ Fails CLOSED, and that is the direction that matters: an address or a
    // stale selection naming a folder from another storage narrows to nothing
    // rather than quietly widening to everything.
    const rows = catalogueRows({
      products: PRODUCTS,
      categories: foldersForStorage(CATEGORIES, HAIR),
      categoryId: 'after-laser',
    })
    expect(rows).toEqual([])
  })
})

import fs from 'fs'
import path from 'path'
import {
  OPERATIONS, ALL_OPERATIONS, BAR_OPERATIONS, BOX_OPERATIONS, OPERATION_LABEL_KEY,
  productsOperationFromQuery, operationBlocked, REFERENCE_ENTRIES_WITHOUT_DATA,
} from './productsOperations'
import { VIEWS } from './productsView'
import { ALL_STORAGES } from './storageScope'

describe('the operation set is the view set, minus the screen itself', () => {
  it('covers every view except the catalogue', () => {
    // 🔴 THE CLAIM THE OWNER MADE AND THIS PINS: the presentation changed and
    // the SET did not. Written as a comparison against VIEWS rather than as a
    // list of ten names, because a list would agree with itself forever — the
    // day somebody adds a twelfth view, a hand-written list here says nothing
    // and this says «you added a screen with no way in».
    expect([...ALL_OPERATIONS].sort()).toEqual(VIEWS.filter((v) => v !== 'catalog').sort())
  })

  it('draws the catalogue nowhere, because it is the background', () => {
    expect(ALL_OPERATIONS).not.toContain('catalog')
  })

  it('loses nothing to the split between the bar and the content area', () => {
    // 🔴 THE SPLIT HAS BEEN MADE, UNMADE AND MADE AGAIN, and this is the
    // assertion that survives all three. An operation that fell out of BOTH
    // halves would be unreachable while every other test kept passing — the
    // exact shape of «opening and prices exist and no button renders them»,
    // which this module has already had once.
    expect([...BAR_OPERATIONS, ...BOX_OPERATIONS].sort()).toEqual([...ALL_OPERATIONS].sort())
    expect(BAR_OPERATIONS.filter((op) => BOX_OPERATIONS.includes(op))).toEqual([])
    expect(new Set(OPERATIONS).size).toBe(OPERATIONS.length)
  })

  it('reaches the storages editor from the content area, not the bar', () => {
    // The owner named «طريقة الوصول لإدارة المستودعات» among the things the
    // content area replaces — so the way in is the link under the storage
    // picker, and the bar does not offer a second one.
    expect(BOX_OPERATIONS).toEqual(['storages'])
    expect(BAR_OPERATIONS).not.toContain('storages')
  })
})

describe('the bar draws exactly the bar operations, in its own order', () => {
  const bar = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'ProductsSecondaryBar.js'), 'utf8'
  )
  const drawn = [...bar.matchAll(/\{\s*view:\s*'([a-z_]+)'/g)].map((m) => m[1])

  it('draws every one of them exactly once, and nothing else', () => {
    // ⚠️ Read OUT of the component rather than restated here, because the two
    // files answer different questions — this one owns the set and the address,
    // that one owns the order and the icons — and a hand-written copy of either
    // inside the other is the second list that eventually disagrees.
    expect(drawn.slice().sort()).toEqual([...BAR_OPERATIONS].sort())
    expect(new Set(drawn).size).toBe(drawn.length)
  })

  it('offers no second way into the storages editor', () => {
    // ⚠️ The direction that fails silently. A button left here alongside the
    // link in the box breaks nothing and looks helpful — and it is two controls
    // for one concept, which is the fault this module paid for once already
    // with a duplicate storage picker.
    expect(drawn).not.toContain('storages')
  })

  it('keeps the order the bar argues for, not the reference band’s', () => {
    // The order had been rewritten to order → supply → transfer → write-off →
    // return, matching the reference. The bar is not part of the conversion, so
    // it is back to the one whose reasons are written beside it: the
    // directories first, then the order a supply is filled from, then the
    // documents.
    expect(drawn.slice(0, 3)).toEqual(['suppliers', 'orders', 'supply'])
  })
})

describe('the storage box carries the link, and only it does', () => {
  const box = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'ref', 'RefStorageBox.js'), 'utf8'
  )

  it('draws the way into the storages editor', () => {
    expect(box).toContain('data-edit-storages')
    expect(box).toContain('products:refShell.editStorages')
  })

  it('holds the storage picker beside it', () => {
    // The two are one subject and share a frame — which is what makes the link
    // read as «maintenance of this field» rather than as a tenth operation.
    expect(box).toContain('data-lens-picker')
  })
})

describe('the address', () => {
  it('accepts every operation', () => {
    for (const op of ALL_OPERATIONS) expect(productsOperationFromQuery(op)).toBe(op)
  })

  it('refuses anything else, so a typed address opens the catalogue', () => {
    // Fails closed. `?op=deleteEverything` is a bare catalogue, not a crash and
    // not a blank modal.
    expect(productsOperationFromQuery('catalog')).toBeNull()
    expect(productsOperationFromQuery('nonsense')).toBeNull()
    expect(productsOperationFromQuery('')).toBeNull()
    expect(productsOperationFromQuery(undefined)).toBeNull()
    // Next gives an array when a parameter repeats; it is not a string, so it
    // is not an operation.
    expect(productsOperationFromQuery(['supply', 'write_off'])).toBeNull()
  })
})

describe('an operation is refused by the same rule the bar used', () => {
  it('blocks the seven that need one real storage while the lens is wide', () => {
    for (const op of ['supply', 'write_off', 'return_to_supplier', 'transfer', 'stocktake', 'coverage', 'balances']) {
      expect(operationBlocked(op, ALL_STORAGES)).toBe(true)
      expect(operationBlocked(op, '')).toBe(true)
      expect(operationBlocked(op, 's1')).toBe(false)
    }
  })

  it('lets the rest through from anywhere', () => {
    for (const op of ['orders', 'documents', 'suppliers', 'storages']) {
      expect(operationBlocked(op, ALL_STORAGES)).toBe(false)
      expect(operationBlocked(op, 's1')).toBe(false)
    }
  })
})

describe('every operation has a name on screen', () => {
  const products = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'public', 'locales', 'ar', 'products.json'), 'utf8')
  )

  it('names all of them and invents none', () => {
    expect(Object.keys(OPERATION_LABEL_KEY).sort()).toEqual([...ALL_OPERATIONS].sort())
  })

  it('resolves every one against the file the screen reads', () => {
    // 🔴 The failure this stops is a RAW KEY on the owner's screen, and it has
    // reached it before. A missing entry here would draw
    // «products:secondaryItems.returnToSupplier» in the modal's orange title
    // bar — and the button that opened it would be fine, so it would look like
    // the modal was broken rather than the dictionary.
    for (const [op, key] of Object.entries(OPERATION_LABEL_KEY)) {
      expect(typeof products.secondaryItems?.[key]).toBe('string')
      expect(products.secondaryItems[key].length).toBeGreaterThan(0)
      expect(op).toBeTruthy()
    }
  })
})

describe('what the reference offers and we do not', () => {
  it('names the deleted entries rather than drawing them empty', () => {
    // ⚠️ The list exists so the deletion is a decision on the record instead of
    // an omission somebody notices in a screenshot. Two buttons and one caret:
    // a product price sheet we do not have, fixed assets we have no table for,
    // and two of the three ways to enter a count.
    expect(REFERENCE_ENTRIES_WITHOUT_DATA).toEqual([
      'setPricesForProducts', 'fixedAssets', 'stocktakeInputMethods',
    ])
  })
})

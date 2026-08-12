import fs from 'fs'
import path from 'path'
import {
  TOOLBAR_OPERATIONS, BOX_OPERATIONS, ALL_OPERATIONS, OPERATION_LABEL_KEY,
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

  it('splits the toolbar from the storage box without losing anything', () => {
    // ⚠️ Both directions. An operation that fell out of both lists would be
    // unreachable while every other test kept passing — the exact shape of
    // «opening/prices exist and no button renders them», which this module has
    // already had once.
    expect([...TOOLBAR_OPERATIONS, ...BOX_OPERATIONS].sort()).toEqual([...ALL_OPERATIONS].sort())
    expect(TOOLBAR_OPERATIONS.filter((op) => BOX_OPERATIONS.includes(op))).toEqual([])
  })

  it('puts the storages editor beside the picker it edits, as the reference does', () => {
    expect(BOX_OPERATIONS).toEqual(['storages'])
    expect(TOOLBAR_OPERATIONS).not.toContain('storages')
  })

  it('runs the reference toolbar order rather than the one we had', () => {
    // The old bar opened with the directories and put the transfer seventh.
    // Nothing in our data prefers either order, so the reference wins — and
    // asserting it here is what stops a tidy-up from «restoring» the old one on
    // the grounds that its comments explain it.
    expect(TOOLBAR_OPERATIONS.slice(0, 5)).toEqual([
      'orders', 'supply', 'transfer', 'write_off', 'return_to_supplier',
    ])
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

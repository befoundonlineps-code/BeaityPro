import {
  ALL_STORAGES, lensMayWiden, storageInForce, needsRealStorage, navigationBlocked,
} from './storageScope'
import { isStorageScoped, OPERATION_TABLE } from './storageScopedOperations'

describe('the sentinel is not «nothing chosen»', () => {
  it('is its own value', () => {
    // ⚠️ Collapsing them would open the catalogue on one storage and call it
    // the catalogue: nothing-chosen falls back to a real storage everywhere,
    // and ALL survives on the two views that can mean it.
    expect(ALL_STORAGES).not.toBe('')
    expect(ALL_STORAGES).not.toBeNull()
  })

  it('but both mean «do not narrow» once a screen is drawing rows', () => {
    expect(storageInForce(ALL_STORAGES)).toBe('')
    expect(storageInForce('')).toBe('')
    expect(storageInForce(null)).toBe('')
    expect(storageInForce('s1')).toBe('s1')
  })
})

describe('which screens refuse to be entered without a storage', () => {
  it('blocks the ones that write or read exactly one', () => {
    for (const view of ['supply', 'write_off', 'return_to_supplier', 'transfer',
      'stocktake', 'coverage', 'balances']) {
      expect(navigationBlocked(view, ALL_STORAGES)).toBe(true)
      expect(navigationBlocked(view, '')).toBe(true)
      expect(navigationBlocked(view, 's1')).toBe(false)
    }
  })

  it('lets the rest through at any lens', () => {
    // The catalogue and the document list can mean «all»; the storages manager,
    // the suppliers list and the orders screen are not about a place at all.
    for (const view of ['catalog', 'documents', 'storages', 'suppliers', 'orders']) {
      expect(navigationBlocked(view, ALL_STORAGES)).toBe(false)
      expect(navigationBlocked(view, '')).toBe(false)
    }
  })

  it('is the same question the toolbar map asks, wherever both have an opinion', () => {
    // 🔴 THE «JOIN IT, DO NOT PARALLEL IT» REQUIREMENT, MADE CHECKABLE. Two
    // lists that must agree and are never compared drift — this module has paid
    // for that with a walk written twice and a needle written three times.
    //
    // ⚠️ And the two questions are NOT the same width, which is why this
    // compares only where they overlap: isStorageScoped asks about the row an
    // operation WRITES, so it answers false for `balances` and `coverage`,
    // which write nothing and read one storage. Right for its question, wrong
    // for this one. Saying that here is what stops somebody "fixing" the
    // disagreement by widening the wrong one.
    for (const [operation] of Object.entries(OPERATION_TABLE)) {
      if (!needsRealStorage(operation)) continue
      expect(isStorageScoped(operation)).toBe(true)
    }
  })

  it('and the two views that read one storage are outside that map on purpose', () => {
    expect(OPERATION_TABLE.balances).toBeUndefined()
    expect(OPERATION_TABLE.coverage).toBeUndefined()
    expect(needsRealStorage('balances')).toBe(true)
    expect(needsRealStorage('coverage')).toBe(true)
  })
})

describe('widening fails closed', () => {
  it('refuses a view it has never heard of', () => {
    // ⚠️ A screen added next year defaults to one real storage. The cost of
    // being wrong in this direction is a narrower view than somebody asked for;
    // in the other direction it is a stocktake posted against no place.
    expect(lensMayWiden('a-view-from-next-year')).toBe(false)
    expect(lensMayWiden(undefined)).toBe(false)
  })

  it('and an unknown view is not blocked from navigation either', () => {
    // ⚠️ The two defaults point opposite ways ON PURPOSE, and it is worth
    // saying rather than discovering. An unknown view may not WIDEN — because
    // widening is the dangerous permission — but it is not BLOCKED, because
    // blocking every unknown screen would make adding one require editing this
    // file to be reachable at all. Fail closed on the permission, open on the
    // door.
    expect(navigationBlocked('a-view-from-next-year', ALL_STORAGES)).toBe(false)
  })
})

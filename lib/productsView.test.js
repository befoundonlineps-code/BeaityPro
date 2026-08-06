import { productsView, productsQuery, isDocumentView, VIEWS, DOCUMENT_VIEWS } from './productsView'

describe('productsView', () => {
  it('reads every tab the bar offers', () => {
    for (const view of VIEWS) expect(productsView(view)).toBe(view)
  })

  it('falls back to the catalogue rather than rendering nothing', () => {
    // A hand-typed URL, a renamed tab, an old bookmark. None of them should be
    // able to produce a blank screen.
    // ⚠️ 'stocktake' used to be in this list as an example of a tab that did
    // not exist yet. It exists now, so it moved to the assertion below —
    // leaving it here would have made this test demand that a real tab be
    // unreachable, and it would have failed at exactly the right moment.
    for (const bad of [undefined, null, '', 'nonsense', 'reversal', 42, ['supply']]) {
      expect(productsView(bad)).toBe('catalog')
    }
  })

  it('resolves the stocktake, which is a tab of its own', () => {
    // Not a document view: it sends counts rather than movements and its own
    // function derives the difference under a lock.
    expect(productsView('stocktake')).toBe('stocktake')
    expect(isDocumentView('stocktake')).toBe(false)
  })
})

describe('productsQuery', () => {
  it('gives the catalogue the bare address', () => {
    // So that the main menu's plain router.push('/products') lands on it — the
    // navigation that used to do nothing at all.
    expect(productsQuery('catalog')).toEqual({})
    expect(productsQuery('nonsense')).toEqual({})
  })

  it('puts every other tab in the query, so the URL is the state', () => {
    expect(productsQuery('supply')).toEqual({ tab: 'supply' })
    expect(productsQuery('storages')).toEqual({ tab: 'storages' })
  })

  it('round-trips every view', () => {
    // Whatever the bar can select, the URL can carry back.
    for (const view of VIEWS) {
      expect(productsView(productsQuery(view).tab)).toBe(view)
    }
  })
})

describe('isDocumentView', () => {
  it('names the four that write movements and nothing else', () => {
    expect(DOCUMENT_VIEWS).toEqual(['supply', 'write_off', 'return_to_supplier', 'transfer'])
    for (const view of ['catalog', 'storages', 'suppliers']) {
      expect(isDocumentView(view)).toBe(false)
    }
    for (const view of DOCUMENT_VIEWS) expect(isDocumentView(view)).toBe(true)
  })
})

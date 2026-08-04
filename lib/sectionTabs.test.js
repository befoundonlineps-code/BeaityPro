import { sectionTab, sectionQuery } from './sectionTabs'

const TABS = ['catalog', 'storages', 'suppliers']

describe('sectionTab', () => {
  it('reads back every tab a section offers', () => {
    for (const tab of TABS) expect(sectionTab(TABS, tab)).toBe(tab)
  })

  it('falls back to the first rather than rendering nothing', () => {
    // A hand-typed URL, a renamed tab, an old bookmark, a numeric id arriving
    // where a name was expected. None of them should be able to produce a
    // blank screen.
    for (const bad of [undefined, null, '', 'nonsense', 42, ['storages'], {}]) {
      expect(sectionTab(TABS, bad)).toBe('catalog')
    }
  })

  it('lets a section name a default that is not its first tab', () => {
    expect(sectionTab(TABS, 'nonsense', 'suppliers')).toBe('suppliers')
  })
})

describe('sectionQuery', () => {
  it('gives the default tab the bare address', () => {
    // So that the main menu's plain router.push('/section') lands on it — the
    // navigation that used to do nothing at all, because both addresses were
    // the same string.
    expect(sectionQuery(TABS, 'catalog')).toEqual({})
    expect(sectionQuery(TABS, 'nonsense')).toEqual({})
  })

  it('names every other tab in the query', () => {
    expect(sectionQuery(TABS, 'storages')).toEqual({ tab: 'storages' })
  })

  it('keeps whatever else the address was carrying', () => {
    // A detail page's id, a filter somebody arrived with. Dropping them would
    // make switching tabs quietly throw away part of the URL.
    expect(sectionQuery(TABS, 'suppliers', { extra: { id: '7' } }))
      .toEqual({ id: '7', tab: 'suppliers' })
    expect(sectionQuery(TABS, 'catalog', { extra: { id: '7' } }))
      .toEqual({ id: '7' })
  })

  it('round-trips every tab through the URL and back', () => {
    for (const tab of TABS) {
      expect(sectionTab(TABS, sectionQuery(TABS, tab).tab)).toBe(tab)
    }
  })

  it('round-trips with a non-default fallback too', () => {
    const opts = { fallback: 'suppliers' }
    for (const tab of TABS) {
      expect(sectionTab(TABS, sectionQuery(TABS, tab, opts).tab, 'suppliers')).toBe(tab)
    }
  })
})

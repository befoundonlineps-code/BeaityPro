import { defaultLens, lensChoices, currentLens, lensChangeCosts } from './storageLens'
import { storageChoices } from './stockDocumentForm'

const LIVE = { id: 's1', name: 'المستودع العام', is_active: true }
const SECOND = { id: 's2', name: 'مستودع الأخصائية', is_active: true }
const RETIRED = { id: 's0', name: 'مستودع قديم', is_active: false }

describe('what a fresh session opens on', () => {
  it('opens on the first live storage', () => {
    expect(defaultLens([LIVE, SECOND])).toBe('s1')
  })

  it('skips a retired storage even when it comes first', () => {
    // ⚠️ Not "the first storage". A salon that retired its old storage and made
    // a new one would open inside the retired one, and every document, count
    // and balance read after that would be about a place nobody uses.
    expect(defaultLens([RETIRED, LIVE])).toBe('s1')
  })

  it('opens on nothing when there is nothing live to open on', () => {
    // Rather than the first archived one. "Choose a storage" is a state a
    // person can act on; working silently inside a retired storage is not.
    expect(defaultLens([RETIRED])).toBe('')
    expect(defaultLens([])).toBe('')
    expect(defaultLens(null)).toBe('')
  })
})

describe('what the lens offers', () => {
  it('is the same rule the document screens already used', () => {
    // ⚠️ Imported, not restated. Two lists of "which storages may be picked"
    // would be two answers the day one of them learns something — and this
    // module has paid for a second answer to a settled question more than once.
    for (const selected of ['', 's0', 's1']) {
      expect(lensChoices([RETIRED, LIVE, SECOND], selected))
        .toEqual(storageChoices([RETIRED, LIVE, SECOND], selected))
    }
  })

  it('keeps a retired storage listed while it is the one being read', () => {
    expect(lensChoices([RETIRED, LIVE], 's0').map((s) => s.id)).toEqual(['s0', 's1'])
    expect(lensChoices([RETIRED, LIVE], 's1').map((s) => s.id)).toEqual(['s1'])
  })
})

describe('the value in force right now', () => {
  it('follows the data until somebody chooses', () => {
    // ⚠️ Derived, so the first render is right rather than right one render
    // later. Storages arrive from a read; a lens stored on load would be empty
    // for exactly as long as that read takes, and every screen below it would
    // draw an empty storage first.
    expect(currentLens([LIVE, SECOND], '')).toBe('s1')
    expect(currentLens([], '')).toBe('')
  })

  it('honours a choice once it is made', () => {
    expect(currentLens([LIVE, SECOND], 's2')).toBe('s2')
  })

  it('falls back when the chosen storage is gone', () => {
    // Deleted, or belonging to a salon that is no longer loaded. Holding a
    // dangling id would filter every screen to nothing and look like an empty
    // salon — item 26's failure mode, reached by a different road.
    expect(currentLens([LIVE], 's-gone')).toBe('s1')
    expect(currentLens([], 's-gone')).toBe('')
  })
})

describe('what a change would cost', () => {
  // ⚠️ THE FEATURE CAN RECREATE THE FAULT IT WAS BUILT AFTER. One lens means
  // changing storage on the balances tab wipes an in-progress count on the
  // stocktake tab: silent, plausible, permanent — the class closed one round
  // ago, arriving through a convenience instead of a filter.
  it('says a change costs something exactly when counts are unsaved', () => {
    expect(lensChangeCosts(0)).toBe(false)
    expect(lensChangeCosts(3)).toBe(true)
  })

  it('treats nothing reported as nothing at risk', () => {
    // A screen that never reports must not make every storage change ask, or
    // the question becomes noise and gets clicked through — which is worse than
    // not asking, because then it is asked and ignored.
    expect(lensChangeCosts(undefined)).toBe(false)
    expect(lensChangeCosts(null)).toBe(false)
    expect(lensChangeCosts('')).toBe(false)
  })
})

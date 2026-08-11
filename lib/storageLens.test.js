import { defaultLens, lensChoices, currentLens, lensChangeCosts, lensMayWiden, ALL_STORAGES } from './storageLens'
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

// ── «All storages», and only where it answers the screen ──────────────────
//
// 🔴 The lens carried no ALL at all, for a reason that was right for the screens
// it had: a balance is per storage, post_stocktake takes one, a supply enters
// one. Then the catalogue grew a balance column and became the first screen
// that a storage changes without being ABOUT a storage — and it was briefly
// given a picker of its own, which is two controls for one concept.
//
// ⇒ The lens widens instead, and only where widening means something.
describe('the lens widens for the two views that can mean it', () => {
  it('offers ALL to the catalogue and the document list', () => {
    expect(lensMayWiden('catalog')).toBe(true)
    expect(lensMayWiden('documents')).toBe(true)
  })

  it('refuses it to every screen that writes one storage', () => {
    // 🔴 The whole point. A stocktake posted against «all» is not a wider view,
    // it is no view — post_stocktake takes ONE storage, and a supply enters one.
    for (const view of ['stocktake', 'supply', 'write_off', 'transfer', 'return_to_supplier', 'balances']) {
      expect(lensMayWiden(view)).toBe(false)
    }
  })

  it('fails closed on a view it has never heard of', () => {
    // ⚠️ The direction that matters: a caller who forgets to say where they are
    // gets a real storage. Being handed a narrower view than asked for is a
    // nuisance; being handed «all» on a screen that posts movements is not.
    expect(lensMayWiden(undefined)).toBe(false)
    expect(lensMayWiden('')).toBe(false)
    expect(lensMayWiden('a-view-from-next-year')).toBe(false)
  })
})

describe('the widening is resolved where it is read, not where it is stored', () => {
  const storages = [LIVE, SECOND]

  it('keeps ALL on a view that may hold it', () => {
    expect(currentLens(storages, ALL_STORAGES, 'catalog')).toBe(ALL_STORAGES)
    expect(currentLens(storages, ALL_STORAGES, 'documents')).toBe(ALL_STORAGES)
  })

  it('turns it back into a real storage on a view that may not', () => {
    // 🔴 THE TRANSITION THE OWNER ASKED ABOUT: standing on the catalogue at
    // «all», then moving to the stocktake. One stored value, read differently
    // by each screen — so a supply screen can never inherit the catalogue's
    // widening, whatever is in the URL or in state.
    expect(currentLens(storages, ALL_STORAGES, 'stocktake')).toBe(LIVE.id)
    expect(currentLens(storages, ALL_STORAGES, 'supply')).toBe(LIVE.id)
    expect(currentLens(storages, ALL_STORAGES, undefined)).toBe(LIVE.id)
  })

  it('still tells ALL apart from «nothing chosen yet»', () => {
    // ⚠️ ALL is a sentinel and not '' for exactly this: nothing-chosen falls
    // back to a real storage everywhere, and ALL survives on the two views.
    // Collapsing them would make the catalogue open on one storage and call it
    // the catalogue.
    expect(currentLens(storages, '', 'catalog')).toBe(LIVE.id)
    expect(currentLens(storages, ALL_STORAGES, 'catalog')).not.toBe(LIVE.id)
  })

  it('does not invent a storage when there are none', () => {
    expect(currentLens([], ALL_STORAGES, 'stocktake')).toBe('')
  })
})

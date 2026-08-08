import {
  postedSessions, sessionCoverage, coverageByStocktake, coverageByProduct, coverageTotals,
} from './stocktakeCoverage'

const PRODUCTS = [
  { id: 'p1', name: 'شامبو', is_active: true },
  { id: 'p2', name: 'مشط', is_active: true },
  { id: 'p3', name: 'صبغة', is_active: true },
  { id: 'gone', name: 'قديم', is_active: false },
]

const SESSIONS = [
  { id: 's-old', storage_id: 'st1', document_id: 'd-old', started_at: '2020-01-01' },
  { id: 's-new', storage_id: 'st1', document_id: 'd-new', started_at: '2020-03-01' },
  // ⚠️ Open: somebody is counting right now, or walked away. It describes
  // nothing that happened and must not reach any report.
  { id: 's-open', storage_id: 'st2', document_id: null, started_at: '2020-04-01' },
]

const DOCUMENTS = [
  { id: 'd-old', doc_date: '2020-01-02' },
  { id: 'd-new', doc_date: '2020-03-02' },
]

const COUNTS = [
  // The old stocktake: two counted, one of them right.
  { session_id: 's-old', product_id: 'p1', counted_base: 10, balance_at_post: 10 },
  { session_id: 's-old', product_id: 'p2', counted_base: 4, balance_at_post: 7 },
  // The new one: p1 again, and p3 for the first time.
  { session_id: 's-new', product_id: 'p1', counted_base: 12, balance_at_post: 12 },
  { session_id: 's-new', product_id: 'p3', counted_base: 0, balance_at_post: 5 },
  // Still being typed. p2 would look counted-again if this leaked through.
  { session_id: 's-open', product_id: 'p2', counted_base: 9, balance_at_post: null },
]

describe('only a posted count describes anything that happened', () => {
  it('leaves the open session out', () => {
    expect(postedSessions(SESSIONS).map((s) => s.id)).toEqual(['s-old', 's-new'])
  })

  it('is the only road, so nothing has to remember to exclude it', () => {
    // ⚠️ The claim the design rests on: an abandoned count cannot pollute the
    // report because there is no path to it, not because a filter excludes it.
    const byProduct = coverageByProduct({ products: PRODUCTS, sessions: SESSIONS, counts: COUNTS, documents: DOCUMENTS })
    const p2 = byProduct.find((row) => row.product.id === 'p2')
    // p2 sits in the open session AND in the old posted one. Only the posted
    // one counts, so it is 1 rather than 2.
    expect(p2.times).toBe(1)
    expect(p2.lastCounted).toBe('2020-01-02')
  })
})

describe('what one stocktake covered', () => {
  it('counts matched separately, which is the number that did not exist before', () => {
    expect(sessionCoverage({ id: 's-old' }, COUNTS))
      .toEqual({ counted: 2, matched: 1, differed: 1, unmeasured: 0 })
  })

  it('reads a counted zero as a real count, not as nothing', () => {
    // p3 was counted 0 against a balance of 5 — the shelf is empty and the
    // record says five. The most important line a stocktake produces.
    expect(sessionCoverage({ id: 's-new' }, COUNTS))
      .toEqual({ counted: 2, matched: 1, differed: 1, unmeasured: 0 })
  })

  it('never treats a missing balance as agreement', () => {
    // ⚠️ balance_at_post is null until the posting stamps it. Counting that as
    // "matched" would invent agreement out of an absence — the loudest possible
    // way to be wrong in a report about whether things agreed.
    expect(sessionCoverage({ id: 's-open' }, COUNTS))
      .toEqual({ counted: 1, matched: 0, differed: 0, unmeasured: 1 })
  })

  it('compares numbers, not the strings PostgREST returns', () => {
    // ⚠️ numeric columns come back as strings. '10.000' === '10' is false and
    // '10.000' !== 10 is true, so a string comparison would report every single
    // line as a difference — a report that says nothing ever matched, which
    // reads as a broken warehouse rather than a broken comparison.
    const asStrings = [
      { session_id: 'x', product_id: 'p1', counted_base: '10.000', balance_at_post: '10' },
    ]
    expect(sessionCoverage({ id: 'x' }, asStrings)).toMatchObject({ matched: 1, differed: 0 })
  })
})

describe('the list of stocktakes', () => {
  const rows = coverageByStocktake({ sessions: SESSIONS, counts: COUNTS, documents: DOCUMENTS })

  it('shows the posted ones only, newest first', () => {
    expect(rows.map((r) => r.session.id)).toEqual(['s-new', 's-old'])
  })

  it('dates each one by its DOCUMENT, not by when counting started', () => {
    // A count begun on Monday and posted on Wednesday belongs to Wednesday's
    // ledger, which is the date it carries on every other screen.
    expect(rows[0].docDate).toBe('2020-03-02')
    expect(rows[1].docDate).toBe('2020-01-02')
  })

  it('falls back to the start date when the document is missing', () => {
    // Not reachable through the app — a session with a document_id whose
    // document cannot be read means half a read, and the screen fails whole.
    // Falling back to '' would sort it to the end silently.
    const orphan = [{ id: 's-x', document_id: 'gone', started_at: '2021-01-01' }]
    expect(coverageByStocktake({ sessions: orphan, counts: [], documents: [] })[0].docDate)
      .toBe('2021-01-01')
  })

  it('breaks a same-day tie so the order is total', () => {
    // Two stocktakes posted the same day would otherwise draw in whatever order
    // the read returned, and the list would reshuffle itself on a refresh —
    // the fault the documents list already had.
    const sameDay = [
      { id: 'a', document_id: 'd1' }, { id: 'b', document_id: 'd2' },
    ]
    const docs = [{ id: 'd1', doc_date: '2020-05-05' }, { id: 'd2', doc_date: '2020-05-05' }]
    const once = coverageByStocktake({ sessions: sameDay, counts: [], documents: docs })
    const again = coverageByStocktake({ sessions: [...sameDay].reverse(), counts: [], documents: docs })
    expect(once.map((r) => r.session.id)).toEqual(again.map((r) => r.session.id))
  })
})

describe('the products nobody has counted', () => {
  const rows = coverageByProduct({
    products: PRODUCTS, sessions: SESSIONS, counts: COUNTS, documents: DOCUMENTS,
  })

  it('walks the catalogue, so a product with no count still has a row', () => {
    // ⚠️ THE FINDING IS THE ABSENCE. A report built from the counts is
    // reassuring by construction: everything in it is evidence of work. What is
    // missing from it is what somebody needs to know, and it is invisible
    // unless something walks the products instead.
    expect(rows).toHaveLength(PRODUCTS.length)
    expect(rows.find((r) => r.product.id === 'gone')).toMatchObject({ times: 0, lastCounted: null })
  })

  it('keeps the latest date when a product was counted more than once', () => {
    expect(rows.find((r) => r.product.id === 'p1')).toMatchObject({ times: 2, lastCounted: '2020-03-02' })
  })

  it('reports a product counted once, in the stocktake that counted it', () => {
    expect(rows.find((r) => r.product.id === 'p3')).toMatchObject({ times: 1, lastCounted: '2020-03-02' })
  })
})

describe('the headline number', () => {
  const rows = coverageByProduct({
    products: PRODUCTS, sessions: SESSIONS, counts: COUNTS, documents: DOCUMENTS,
  })

  it('leaves archived products out of the denominator', () => {
    // ⚠️ A report that can never reach 100% is a report nobody reads twice, and
    // nobody is going to count something they took out of circulation. Three
    // live products, all three counted at some point.
    expect(coverageTotals(rows)).toEqual({ products: 3, counted: 3, never: 0 })
  })

  it('names the never-counted rather than leaving them to subtraction', () => {
    const partial = coverageByProduct({
      products: PRODUCTS, sessions: SESSIONS, counts: [COUNTS[0]], documents: DOCUMENTS,
    })
    expect(coverageTotals(partial)).toEqual({ products: 3, counted: 1, never: 2 })
  })
})

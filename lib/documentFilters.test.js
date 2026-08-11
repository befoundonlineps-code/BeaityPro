import { ALL_STORAGES } from './storageScope'
import {
  SUPPLIER_TYPES, hasSupplier, supplierFilterApplies, EMPTY_FILTERS,
  filterDocuments, hasActiveFilters, filterEmptyReason, FILTER_EMPTY,
  duplicateDocNumber, storageInForce,
} from './documentFilters'
import { reversalState } from './stockDocumentList'

// Shaped as the real rows are: doc_date is a timestamptz string, not a day.
const doc = (over) => ({
  id: 'd1', doc_type: 'supply', doc_date: '2026-08-04T00:00:00+00:00',
  storage_id: 'st-general', to_storage_id: null, supplier_id: 'sup-1',
  supplier_doc_number: null, reverses_document_id: null, ...over,
})

const DOCS = [
  doc({ id: 'sup-a', doc_type: 'supply', doc_date: '2026-08-01T00:00:00+00:00', supplier_doc_number: '01' }),
  doc({ id: 'sup-b', doc_type: 'supply', doc_date: '2026-08-04T00:00:00+00:00', supplier_doc_number: '02', supplier_id: 'sup-2' }),
  doc({ id: 'ret-a', doc_type: 'return_to_supplier', doc_date: '2026-08-05T00:00:00+00:00', supplier_doc_number: '01-A/2026' }),
  doc({ id: 'trf-a', doc_type: 'transfer', doc_date: '2026-08-06T00:00:00+00:00', supplier_id: null, storage_id: 'st-general', to_storage_id: 'st-test' }),
  doc({ id: 'stk-a', doc_type: 'stocktake', doc_date: '2026-08-06T00:00:00+00:00', supplier_id: null, storage_id: 'st-test' }),
]

const ids = (rows) => rows.map((r) => r.id)

describe('which documents can carry a supplier at all', () => {
  it('is exactly the two with a counterparty outside the salon', () => {
    // ⚠️ The supplier filter and the number field share this list because they
    // are the same fact twice. A transfer moves between our own storages, a
    // stocktake and a write-off involve nobody, a reversal is our correction —
    // none of them can have somebody else's invoice number.
    expect(SUPPLIER_TYPES).toEqual(['supply', 'return_to_supplier'])
    expect(hasSupplier('supply')).toBe(true)
    expect(hasSupplier('transfer')).toBe(false)
    expect(hasSupplier('stocktake')).toBe(false)
    expect(hasSupplier('write_off')).toBe(false)
  })

  it('leaves the supplier filter usable while no type is chosen', () => {
    expect(supplierFilterApplies('')).toBe(true)
    expect(supplierFilterApplies('supply')).toBe(true)
    expect(supplierFilterApplies('transfer')).toBe(false)
  })
})

describe('the period runs on doc_date', () => {
  it('includes both ends of the range', () => {
    // Somebody typing the same day in both boxes means that day.
    expect(ids(filterDocuments(DOCS, { from: '2026-08-04', to: '2026-08-05' })))
      .toEqual(['sup-b', 'ret-a'])
    expect(ids(filterDocuments(DOCS, { from: '2026-08-01', to: '2026-08-01' })))
      .toEqual(['sup-a'])
  })

  it('reads the day out of a timestamptz without converting anything', () => {
    // doc_date arrives as '2026-08-04T00:00:00+00:00'. Comparing the first ten
    // characters is exact for YYYY-MM-DD and involves no timezone arithmetic.
    expect(ids(filterDocuments(DOCS, { from: '2026-08-06' }))).toEqual(['trf-a', 'stk-a'])
  })

  it('excludes a backdated document from the month it was entered in', () => {
    // ⚠️ Correct, and surprising. A supply entered today for last month is not
    // in this month's list, because doc_date is what the person meant by "when".
    const backdated = doc({ id: 'old', doc_date: '2026-07-02T00:00:00+00:00' })
    expect(ids(filterDocuments([backdated], { from: '2026-08-01', to: '2026-08-31' })))
      .toEqual([])
  })
})

describe('the storage filter sees both ends of a transfer', () => {
  it('finds a transfer from the destination storage too', () => {
    // ⚠️ Matching storage_id alone would drop every transfer from the receiving
    // storage's list — the goods arrived and the document that brought them
    // would be invisible.
    expect(ids(filterDocuments(DOCS, { storageId: 'st-test' }))).toEqual(['trf-a', 'stk-a'])
    expect(ids(filterDocuments(DOCS, { storageId: 'st-general' })))
      .toEqual(['sup-a', 'sup-b', 'ret-a', 'trf-a'])
  })
})

describe('the number is text off a piece of paper', () => {
  it('matches on a substring, not on equality', () => {
    // Typing 01 should find 01-A/2026 — it is a reference somebody copied, not
    // a key.
    expect(ids(filterDocuments(DOCS, { docNumber: '01' }))).toEqual(['sup-a', 'ret-a'])
  })

  it('ignores case and surrounding space', () => {
    expect(ids(filterDocuments(DOCS, { docNumber: ' 01-a ' }))).toEqual(['ret-a'])
  })

  it('never matches a document that has no number', () => {
    expect(ids(filterDocuments(DOCS, { docNumber: '9' }))).toEqual([])
  })
})

describe('the supplier filter narrows, and is dropped rather than obeyed blindly', () => {
  it('narrows to one supplier', () => {
    expect(ids(filterDocuments(DOCS, { supplierId: 'sup-2' }))).toEqual(['sup-b'])
  })

  it('is ignored for a type that cannot have one, instead of emptying the list', () => {
    // ⚠️ The control is disabled on screen for exactly this case, so this is
    // the belt to that braces: a stale supplier left behind by switching type
    // must not narrow anything invisibly.
    expect(ids(filterDocuments(DOCS, { docType: 'transfer', supplierId: 'sup-1' })))
      .toEqual(['trf-a'])
  })

  it('combines with everything else as AND', () => {
    expect(ids(filterDocuments(DOCS, {
      docType: 'supply', supplierId: 'sup-1', from: '2026-08-01', to: '2026-08-03',
    }))).toEqual(['sup-a'])
  })
})

describe('an empty result says which kind of empty it is', () => {
  it('separates "none yet" from "nothing matched"', () => {
    // Two different facts sending a person to two different actions: post a
    // document, or widen the filter.
    expect(filterEmptyReason({ documents: [], filtered: [], filters: EMPTY_FILTERS }))
      .toBe(FILTER_EMPTY.NOT_FILTERED)
    expect(filterEmptyReason({ documents: DOCS, filtered: [], filters: { docNumber: 'zzz' } }))
      .toBe(FILTER_EMPTY.NO_MATCH)
  })

  it('says so when nothing recorded can carry a supplier at all', () => {
    // A salon that has recorded stocktakes and transfers but never a supply.
    // Every supplier query is empty there, and "widen the filter" is useless
    // advice — no widening of the supplier helps, only dropping it.
    const noSupplierDocs = DOCS.filter((d) => !hasSupplier(d.doc_type))
    expect(filterEmptyReason({
      documents: noSupplierDocs, filtered: [], filters: { supplierId: 'sup-1' },
    })).toBe(FILTER_EMPTY.NO_SUPPLIER_DOCS)
  })

  it('but stays generic when it is only THIS supplier that has none', () => {
    // ⚠️ THE BOUNDARY THE OWNER PROBED, pinned so it cannot drift. Supplies
    // exist, just not from the chosen supplier — an ordinary no-match, where
    // "widen or clear the filters" is exactly right. Naming stocktakes here
    // would be noise about a type the person never asked about.
    //
    // The state that was called CONTRADICTORY is neither this nor impossible:
    // one supply tomorrow and the same query matches.
    expect(filterEmptyReason({
      documents: DOCS, filtered: [], filters: { supplierId: 'sup-never-used' },
    })).toBe(FILTER_EMPTY.NO_MATCH)
  })

  it('says nothing when there are rows to draw', () => {
    expect(filterEmptyReason({ documents: DOCS, filtered: DOCS, filters: EMPTY_FILTERS }))
      .toBe(FILTER_EMPTY.NONE)
  })

  it('knows whether anything was asked at all', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, docNumber: '  ' })).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, docNumber: '1' })).toBe(true)
  })
})

describe('the duplicate warning', () => {
  it('finds another document of the same supplier with the same number', () => {
    const existing = [doc({ id: 'old', supplier_id: 'sup-1', supplier_doc_number: '01' })]
    expect(duplicateDocNumber({
      documents: existing, supplierId: 'sup-1', docNumber: '01',
    })).toMatchObject({ id: 'old' })
  })

  it('says nothing about a different supplier using the same number', () => {
    // ⚠️ Two suppliers both using 01 is ordinary, and warning about it would be
    // noise — which is how a warning stops being read.
    const existing = [doc({ id: 'old', supplier_id: 'sup-2', supplier_doc_number: '01' })]
    expect(duplicateDocNumber({
      documents: existing, supplierId: 'sup-1', docNumber: '01',
    })).toBeNull()
  })

  it('does not warn about the document being edited against itself', () => {
    const existing = [doc({ id: 'me', supplier_id: 'sup-1', supplier_doc_number: '01' })]
    expect(duplicateDocNumber({
      documents: existing, supplierId: 'sup-1', docNumber: '01', excludeId: 'me',
    })).toBeNull()
  })

  it('stays quiet on a blank number or a missing supplier', () => {
    const existing = [doc({ id: 'old', supplier_id: 'sup-1', supplier_doc_number: '01' })]
    expect(duplicateDocNumber({ documents: existing, supplierId: 'sup-1', docNumber: '  ' })).toBeNull()
    expect(duplicateDocNumber({ documents: existing, supplierId: '', docNumber: '01' })).toBeNull()
  })
})

// ── the reason this filters in memory ──────────────────────────────────────
describe('filtering must not decide what the reversal question can see', () => {
  it('would break the reversal check if it ran in the query', () => {
    // ⚠️ THE SAFETY PROPERTY, made concrete. reversalState answers "was this
    // reversed?" from the set handed in. Below, the reversal is filtered OUT of
    // the drawn rows while the loaded set still holds it.
    //
    // Filtering in memory means the drawn list narrows and the reversal
    // question keeps the whole set — so the button stays correctly disabled.
    // Filtering in the query would hand reversalState the narrowed set instead,
    // and it would say the document is still reversible.
    const original = doc({ id: 'orig', doc_type: 'supply', doc_date: '2026-08-01T00:00:00+00:00' })
    const undo = doc({
      id: 'undo', doc_type: 'reversal', doc_date: '2026-08-09T00:00:00+00:00',
      reverses_document_id: 'orig',
    })
    const loaded = [original, undo]

    const drawn = filterDocuments(loaded, { from: '2026-08-01', to: '2026-08-05' })
    expect(ids(drawn)).toEqual(['orig'])          // the reversal is not drawn

    // Asked of the LOADED set — correct, and what the screen does.
    expect(reversalState(original, loaded)).toMatchObject({ canReverse: false })
    // Asked of the DRAWN set — wrong, and what a query filter would produce.
    expect(reversalState(original, drawn)).toMatchObject({ canReverse: true })
  })
})

// ⚠️ MIGRATED, NOT DELETED. These covered a second argument — the list's own
// `allStorages` checkbox — which is gone: the lens itself widens now, for the
// two views that can mean it, so the checkbox was a second control answering
// the question the header above it already answered.
//
// Every behaviour they asserted still has a test; what changed is the ROUTE.
// "Looks past it when asked to" is now asked through the shared lens rather
// than through a toggle only this screen had.
describe('which storage the document list is showing', () => {
  it('follows the lens', () => {
    expect(storageInForce('s1')).toBe('s1')
    expect(storageInForce('s2')).toBe('s2')
  })

  it('looks past it when the lens itself is widened', () => {
    // '' is what filterDocuments reads as "every storage" — the same empty
    // string EMPTY_FILTERS uses, so the widening needs no second convention.
    //
    // ⚠️ And the widening arrives as the lens's own sentinel now. The screen has
    // nothing of its own to remember, so there is no second value that could
    // disagree with the header.
    expect(storageInForce(ALL_STORAGES)).toBe('')
  })

  it('shows everything when there is no lens to follow', () => {
    // A salon with no storage yet. Narrowing to a storage that does not exist
    // would draw an empty list that looks like an empty salon — item 26's
    // failure, reached from another direction.
    expect(storageInForce('')).toBe('')
    expect(storageInForce(null)).toBe('')
    expect(storageInForce(undefined)).toBe('')
  })

  it('keeps ALL and «nothing chosen» apart at the boundary', () => {
    // Both answer '' HERE, and that is right — the list draws every storage
    // either way. But they are different upstream: nothing-chosen falls back to
    // a real storage on every other screen, and ALL survives on two. Collapsing
    // them in the lens would open the catalogue on one storage and call it the
    // catalogue.
    expect(storageInForce(ALL_STORAGES)).toBe(storageInForce(''))
    expect(ALL_STORAGES).not.toBe('')
  })

  it('is a function of the lens, and of nothing remembered', () => {
    // ⚠️ The property the first attempt broke. Two calls with the same lens
    // give the same answer whatever happened in between, which is what
    // "derived, not copied" means when written as a test rather than a comment.
    expect(storageInForce('s1')).toBe(storageInForce('s1'))
    expect(storageInForce('s9')).toBe('s9')
  })
})

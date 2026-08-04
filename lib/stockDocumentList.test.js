import {
  movementFrames, reversalState, sortDocuments, movementsOf, REVERSIBLE_TYPES,
} from './stockDocumentList'

const pcs = { id: 'p1', base_unit: 'pcs' }
const ml = { id: 'p2', base_unit: 'ml' }

describe('movementFrames', () => {
  it('keeps both frames, because neither alone is honest', () => {
    // The owner entered 5 packages of 15 and the row says 75. He did not
    // recognise 75 as his own movement; 5 alone cannot be added to a line
    // entered in pieces. Both, or the reader and the arithmetic disagree.
    expect(movementFrames(
      { quantity_base: 75, entered_quantity: 5, entered_uom: 'package' }, pcs
    )).toEqual({ direction: 'in', entered: 5, uom: 'package', base: 75, baseUnit: 'pcs', sameFrame: false })
  })

  it('says which way the goods went, as a word and not a sign', () => {
    // ⚠️ This was missing, and its absence was reported as a good thing. On a
    // transfer the direction is recoverable from the header; on a write-off it
    // is not, and on a REVERSAL — whose lines are the exact opposite of the
    // document it undoes, shown right beside it — the correction would read as
    // a copy of the mistake.
    expect(movementFrames({ quantity_base: -75, entered_quantity: -5, entered_uom: 'package' }, pcs))
      .toMatchObject({ direction: 'out', entered: 5, base: 75 })
    expect(movementFrames({ quantity_base: 75, entered_quantity: 5, entered_uom: 'package' }, pcs))
      .toMatchObject({ direction: 'in', entered: 5, base: 75 })
  })

  it('invents no direction for a movement of nothing', () => {
    // Zero is neither in nor out, and such a movement should not exist. Saying
    // "in" about it would be making something up.
    expect(movementFrames({ quantity_base: 0 }, pcs).direction).toBeNull()
  })

  it('still shows the magnitude without its sign beside the direction', () => {
    // The number itself stays unsigned: a minus inside an Arabic line is a
    // neutral character between two directions, which is the bidi problem
    // lib/timeRangeDirection.test.js exists for. The word carries the meaning.
    const f = movementFrames({ quantity_base: -75, entered_quantity: -5, entered_uom: 'package' }, pcs)
    expect(f.base).toBe(75)
    expect(f.entered).toBe(5)
  })

  it('says when the two frames are the same number', () => {
    // Entering 3 pieces of a pcs product stores 3. Showing "3 pieces (3
    // pieces)" is noise, so the screen is told it may show one.
    expect(movementFrames({ quantity_base: 3, entered_quantity: 3, entered_uom: 'unit' }, pcs).sameFrame)
      .toBe(true)
    expect(movementFrames({ quantity_base: 250, entered_quantity: 1, entered_uom: 'package' }, ml).sameFrame)
      .toBe(false)
  })

  it('survives a movement nobody entered', () => {
    // A stocktake adjustment is produced by the function from a count, so it
    // has no entered frame at all. Null, not zero — zero would be a claim.
    expect(movementFrames({ quantity_base: 4 }, pcs))
      .toEqual({ direction: 'in', entered: null, uom: null, base: 4, baseUnit: 'pcs', sameFrame: false })
  })

  it('survives an unknown product', () => {
    expect(movementFrames({ quantity_base: 4, entered_quantity: 4, entered_uom: 'unit' }, null).baseUnit)
      .toBeNull()
  })
})

describe('reversalState', () => {
  const doc = { id: 'd1', doc_type: 'supply', reverses_document_id: null }

  it('allows a plain document nobody has undone', () => {
    expect(reversalState(doc, [doc])).toEqual({ canReverse: true, reason: null })
  })

  it('refuses one that has already been reversed', () => {
    // ⚠️ Pressing it twice would post a second counter-document and swing the
    // balance the other way — worse than the mistake being corrected. And
    // being reversed is not a flag on the row: stock_documents only records
    // which document a reversal undoes, so the question is asked of the set.
    const undo = { id: 'd2', doc_type: 'reversal', reverses_document_id: 'd1' }
    expect(reversalState(doc, [doc, undo]))
      .toEqual({ canReverse: false, reason: 'alreadyReversed', by: 'd2' })
  })

  it('refuses to reverse a reversal', () => {
    // That is just the original again, and it leaves three documents where one
    // mistake happened.
    const undo = { id: 'd2', doc_type: 'reversal', reverses_document_id: 'd1' }
    expect(reversalState(undo, [doc, undo])).toMatchObject({ canReverse: false, reason: 'isReversal' })
  })

  it('refuses a type that has no reversal', () => {
    expect(reversalState({ id: 'd3', doc_type: 'sale' }, []))
      .toMatchObject({ canReverse: false, reason: 'typeNotReversible' })
  })

  it('survives no document and no list', () => {
    expect(reversalState(null, null)).toMatchObject({ canReverse: false })
    expect(reversalState(doc, null)).toMatchObject({ canReverse: true })
  })

  it('names the types a reversal exists for', () => {
    expect(REVERSIBLE_TYPES).toEqual(
      ['supply', 'write_off', 'return_to_supplier', 'transfer', 'stocktake', 'opening']
    )
  })
})

describe('sortDocuments', () => {
  it('puts the newest first, because that is the one being looked for', () => {
    const rows = [
      { id: 'a', doc_date: '2026-08-01', created_at: '2026-08-01T10:00:00Z' },
      { id: 'c', doc_date: '2026-08-04', created_at: '2026-08-04T09:00:00Z' },
      { id: 'b', doc_date: '2026-08-02', created_at: '2026-08-02T10:00:00Z' },
    ]
    expect(sortDocuments(rows).map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('breaks a shared date by when it was actually written', () => {
    // doc_date is a date somebody chose, and several documents share one.
    const rows = [
      { id: 'early', doc_date: '2026-08-04', created_at: '2026-08-04T08:00:00Z' },
      { id: 'late', doc_date: '2026-08-04', created_at: '2026-08-04T18:20:00Z' },
    ]
    expect(sortDocuments(rows).map((r) => r.id)).toEqual(['late', 'early'])
  })

  it('does not mutate what it was given', () => {
    const rows = [{ id: 'a', doc_date: '2026-08-01' }, { id: 'b', doc_date: '2026-08-02' }]
    sortDocuments(rows)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('survives nothing', () => {
    expect(sortDocuments(null)).toEqual([])
  })
})

describe('movementsOf', () => {
  it('takes only this document’s lines', () => {
    const rows = [{ document_id: 'd1' }, { document_id: 'd2' }, { document_id: 'd1' }]
    expect(movementsOf(rows, 'd1')).toHaveLength(2)
  })

  it('survives nothing', () => {
    expect(movementsOf(null, 'd1')).toEqual([])
  })
})

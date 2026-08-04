import {
  movementFrames, reversalState, sortDocuments, movementsOf, REVERSIBLE_TYPES,
  documentProductNames, documentDate,
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

  it('collapses only when the two frames say the same thing', () => {
    // Entering in the base unit is the one case where they do: "3 pieces (3
    // pieces)" is noise.
    expect(movementFrames({ quantity_base: 3, entered_quantity: 3, entered_uom: 'unit' }, pcs).sameFrame)
      .toBe(true)
    expect(movementFrames({ quantity_base: 250, entered_quantity: 1, entered_uom: 'package' }, ml).sameFrame)
      .toBe(false)
  })

  it('keeps the frame when the numbers match by coincidence', () => {
    // ⚠️ units_per_package = 1 stores 10 for "10 packages". Collapsing on equal
    // numbers dropped the frame exactly there — and a factor of 1 is most
    // simple products, so the rule was off for the common case and on for the
    // rare one. The owner found it in his own reversal line.
    expect(movementFrames(
      { quantity_base: 10, entered_quantity: 10, entered_uom: 'package' }, pcs
    ).sameFrame).toBe(false)
  })

  it('names the base unit from the product, never a fixed word', () => {
    // "in pieces" is right for a pcs product and wrong for a millilitre one.
    expect(movementFrames({ quantity_base: 250, entered_quantity: 1, entered_uom: 'package' }, ml).baseUnit)
      .toBe('ml')
    expect(movementFrames({ quantity_base: 3, entered_quantity: 3, entered_uom: 'unit' }, pcs).baseUnit)
      .toBe('pcs')
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

describe('documentProductNames', () => {
  const productsById = { p1: { name: 'شامبو' }, p2: { name: 'بلسم' }, p3: { name: 'مقص' }, p4: { name: 'مشط' } }
  const move = (doc, product) => ({ document_id: doc, product_id: product })

  it('names what is in the document, because nothing else tells two apart', () => {
    // ⚠️ The owner has two supply documents on the same date, into the same
    // storage, from the same supplier, with the same line count. Type and date
    // describe both. stock_documents has no doc_number, so the contents are
    // the only human handle there is.
    expect(documentProductNames([move('d1', 'p1'), move('d1', 'p2')], 'd1', productsById))
      .toEqual({ names: ['شامبو', 'بلسم'], more: 0 })
  })

  it('names a transferred product once, not once per storage', () => {
    // A transfer writes two movements for one product — out of one storage and
    // into the other. Listing it twice would read as two different things.
    expect(documentProductNames([move('d1', 'p1'), move('d1', 'p1')], 'd1', productsById))
      .toEqual({ names: ['شامبو'], more: 0 })
  })

  it('stops at three and counts the rest, rather than filling the box', () => {
    const rows = ['p1', 'p2', 'p3', 'p4'].map((p) => move('d1', p))
    expect(documentProductNames(rows, 'd1', productsById))
      .toEqual({ names: ['شامبو', 'بلسم', 'مقص'], more: 1 })
  })

  it('skips a product it cannot name rather than printing an id', () => {
    expect(documentProductNames([move('d1', 'ghost'), move('d1', 'p1')], 'd1', productsById))
      .toEqual({ names: ['شامبو'], more: 0 })
  })

  it('survives nothing', () => {
    expect(documentProductNames(null, 'd1', null)).toEqual({ names: [], more: 0 })
  })
})

describe('documentDate', () => {
  it('takes the date out of a timestamptz', () => {
    // Both columns arrive with a time and an offset, and both were being
    // printed raw — machine text inside an Arabic sentence.
    expect(documentDate('2026-08-04T00:00:00+00:00')).toBe('2026-08-04')
    expect(documentDate('2026-08-04T20:25:54.798153+00:00')).toBe('2026-08-04')
  })

  it('leaves a plain date alone', () => {
    expect(documentDate('2026-08-04')).toBe('2026-08-04')
  })

  it('survives nothing', () => {
    expect(documentDate(null)).toBe('')
    expect(documentDate(undefined)).toBe('')
  })
})

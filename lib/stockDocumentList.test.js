import {
  movementFrames, reversalState, sortDocuments, movementsOf, REVERSIBLE_TYPES,
  documentProductNames, documentDate, costFrames, documentValue,
  documentValueLabel, DOCUMENT_VALUE_LABEL, DOCUMENT_VALUE_FALLBACK,
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

  it('reads a real reversal row, whichever sign the entered column carries', () => {
    // ⚠️ Copied from the owner's actual reversal, not invented:
    //   quantity_base = -10.000   entered 10 package
    // Every fixture above signs BOTH columns the same way, and this row shows
    // quantity_base negative beside an entered quantity written as 10. I cannot
    // read the raw sign of entered_quantity myself — RLS returns nothing to me —
    // so the function has to be right either way rather than right about my
    // guess. That is the probe-fixture rule turned on my own tests: the shape
    // has to come from a real row, and where it can't, cover both shapes.
    const both = { quantity_base: -10, entered_quantity: -10, entered_uom: 'package' }
    const split = { quantity_base: -10, entered_quantity: 10, entered_uom: 'package' }
    expect(movementFrames(both, pcs)).toEqual(movementFrames(split, pcs))
    expect(movementFrames(split, pcs))
      .toMatchObject({ direction: 'out', entered: 10, base: 10, sameFrame: false })
  })

  it('returns numbers even when the columns arrive as strings', () => {
    // numeric(12,3) is what the column is, and '-10.000' is a shape it can
    // arrive in over the wire.
    //
    // ⚠️ Stated precisely, because I first wrote that this guards the Number()
    // call in movementFrames and a mutation disproved it: removing Number()
    // changes NOTHING here, since Math.abs and < both coerce a numeric string
    // on their own. What this actually pins is that the OUTPUT is numeric — so
    // a future line doing arithmetic on f.base cannot silently get '−10.000'.
    expect(movementFrames(
      { quantity_base: '-10.000', entered_quantity: '10.000', entered_uom: 'package' }, pcs
    )).toMatchObject({ direction: 'out', entered: 10, base: 10 })
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

describe('costFrames', () => {
  const simple = { id: 'p1', base_unit: 'pcs', units_per_package: 1 }
  const boxOf15 = { id: 'p2', base_unit: 'pcs', units_per_package: 15 }
  const bottle = { id: 'p3', base_unit: 'ml', units_per_package: 250 }

  it('names the unit the price belongs to, because "the unit" names none', () => {
    // ⚠️ The line said "تكلفة الوحدة: 100 ₪" beside a quantity that said BOTH
    // بالعبوة and بالقطعة. The rule was written as "every quantity" and applied
    // to half a line; a price is read two ways for the same reason.
    expect(costFrames({ unit_cost: '100.0000', entered_uom: 'package' }, simple))
      .toEqual({ base: 100, baseUnit: 'pcs' })
  })

  it('names the product’s own base unit, never a fixed word', () => {
    expect(costFrames({ unit_cost: 0.05 }, bottle).baseUnit).toBe('ml')
    expect(costFrames({ unit_cost: 100 }, boxOf15).baseUnit).toBe('pcs')
  })

  it('does NOT reconstruct the price that was typed', () => {
    // ⚠️ This was built, and the first real render printed 100.0005 ₪ for a
    // price typed as 100: unit_cost keeps four decimals, so 100/15 stores as
    // 6.6667 and multiplying back misses. A quantity may show two frames
    // because entered_quantity AND quantity_base are both stored columns; a
    // price has only one recorded frame, and deriving the other puts an
    // invented number on a money line in the module whose entire history is a
    // wrong unit_cost.
    const stored = Number((100 / 15).toFixed(4))          // what the column keeps
    const c = costFrames({ unit_cost: stored, entered_uom: 'package' }, boxOf15)
    expect(c).toEqual({ base: 6.6667, baseUnit: 'pcs' })
    expect(c.entered).toBeUndefined()
    expect(stored * 15).not.toBe(100)                     // the reason, measured
  })

  it('keeps a stamped zero, which is a real number and not a blank', () => {
    // Exactly what the two poisoned documents carried, and what the reversal
    // stamped back. Hiding it would hide the fault it records.
    expect(costFrames({ unit_cost: 0, entered_uom: 'package' }, simple))
      .toMatchObject({ base: 0 })
  })

  it('says nothing at all when there is no price', () => {
    // A transfer line carries none, and "0" would be a claim about one.
    expect(costFrames({ unit_cost: null, entered_uom: 'package' }, simple)).toBeNull()
    expect(costFrames({ entered_uom: 'package' }, simple)).toBeNull()
    expect(costFrames({ unit_cost: '' }, simple)).toBeNull()
  })

  it('survives an unknown product', () => {
    // The price is still a fact; only the unit's name is unavailable, and the
    // screen falls back rather than printing an id.
    expect(costFrames({ unit_cost: 5, entered_uom: 'package' }, null))
      .toEqual({ base: 5, baseUnit: null })
  })
})

describe('documentValue', () => {
  const simple = { id: 'p1', base_unit: 'pcs', units_per_package: 1 }
  const productsById = { p1: simple, p2: { id: 'p2', base_unit: 'pcs', units_per_package: 1 } }

  it('adds up what the document was worth', () => {
    // ⚠️ The list showed storage, supplier, contents and line count, and not
    // what it cost — while the entry screen shows a running total that vanishes
    // the moment it is posted. Nobody opens a document list looking for a line
    // count; they are looking for the expensive one.
    const rows = [
      { document_id: 'd1', product_id: 'p1', quantity_base: 20, unit_cost: 50, entered_uom: 'package' },
      { document_id: 'd1', product_id: 'p2', quantity_base: 5, unit_cost: 100, entered_uom: 'package' },
    ]
    expect(documentValue(rows, 'd1', productsById)).toBe(1500)   // 20×50 + 5×100
  })

  it('matches the owner’s measured supply exactly', () => {
    // 20 × 50 = 1000, from the real rows after the poisoned pair was reversed.
    expect(documentValue(
      [{ document_id: 'd1', product_id: 'p1', quantity_base: '20.000', unit_cost: '50.0000', entered_uom: 'package' }],
      'd1', productsById
    )).toBe(1000)
  })

  it('reports a magnitude, never a minus sign', () => {
    // A write-off's sum is negative, and a minus inside an Arabic line is a
    // neutral character between two directions. The type badge already carries
    // the direction as a word — same rule as the per-line direction badge.
    expect(documentValue(
      [{ document_id: 'd1', product_id: 'p1', quantity_base: -5, unit_cost: 100, entered_uom: 'package' }],
      'd1', productsById
    )).toBe(500)
  })

  it('reports what MOVED on a transfer, not the net of zero', () => {
    // ⚠️ The net was the first answer and it drew "الإجمالي: 0 ₪" — true, and
    // colliding with a POISONED supply whose total is also 0 but means "this
    // cost nothing". Two documents, one badge, opposite meanings. The heavier
    // side answers every type with one rule: 500 worth of goods moved.
    const rows = [
      { document_id: 'd1', product_id: 'p1', quantity_base: -40, unit_cost: 12.5, entered_uom: 'package' },
      { document_id: 'd1', product_id: 'p1', quantity_base: 40, unit_cost: 12.5, entered_uom: 'package' },
    ]
    expect(documentValue(rows, 'd1', productsById)).toBe(500)
  })

  it('takes the heavier side, so no type needs special-casing', () => {
    // supply: only positives · write-off: only negatives · transfer: both.
    expect(documentValue(
      [{ document_id: 'd', product_id: 'p1', quantity_base: 20, unit_cost: 50 }], 'd', productsById
    )).toBe(1000)
    expect(documentValue(
      [{ document_id: 'd', product_id: 'p1', quantity_base: -20, unit_cost: 50 }], 'd', productsById
    )).toBe(1000)
  })

  it('separates "not priced" from "priced at zero"', () => {
    // Only the first should show nothing. The second is the poisoned pair, and
    // hiding it would hide the fault.
    expect(documentValue(
      [{ document_id: 'd1', product_id: 'p1', quantity_base: 10, unit_cost: null }], 'd1', productsById
    )).toBeNull()
    expect(documentValue(
      [{ document_id: 'd1', product_id: 'p1', quantity_base: 10, unit_cost: 0 }], 'd1', productsById
    )).toBe(0)
  })

  it('ignores a line whose quantity cannot be read, rather than poisoning the sum', () => {
    const rows = [
      { document_id: 'd1', product_id: 'p1', quantity_base: 'abc', unit_cost: 50 },
      { document_id: 'd1', product_id: 'p1', quantity_base: 4, unit_cost: 50 },
    ]
    expect(documentValue(rows, 'd1', productsById)).toBe(200)
  })

  it('takes only this document’s lines', () => {
    const rows = [
      { document_id: 'd1', product_id: 'p1', quantity_base: 2, unit_cost: 10 },
      { document_id: 'd2', product_id: 'p1', quantity_base: 99, unit_cost: 99 },
    ]
    expect(documentValue(rows, 'd1', productsById)).toBe(20)
  })

  it('survives nothing', () => {
    expect(documentValue(null, 'd1', null)).toBeNull()
  })
})

describe('documentValueLabel', () => {
  it('says worth of WHAT, because the number is identical in all of them', () => {
    // ⚠️ "الإجمالي" is "الوحدة" one level up — a word that says "a sum" and
    // never says a sum of what. Only the word tells a transfer's 500 apart
    // from a supply's 500.
    expect(documentValueLabel('supply')).toBe('products:documents.valueSupply')
    expect(documentValueLabel('write_off')).toBe('products:documents.valueWriteOff')
    expect(documentValueLabel('return_to_supplier')).toBe('products:documents.valueReturn')
    expect(documentValueLabel('transfer')).toBe('products:documents.valueTransfer')
    expect(documentValueLabel('reversal')).toBe('products:documents.valueReversal')
  })

  it('gives every type its own word, never one shared with another', () => {
    // Two types sharing a label would rebuild the collision this fixed.
    const labels = Object.values(DOCUMENT_VALUE_LABEL)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).not.toContain(DOCUMENT_VALUE_FALLBACK)
  })

  it('says the neutral thing for a type nobody has written a word for', () => {
    // sale and service_consumption reach this today. A wrong word would be
    // worse than a general one.
    expect(documentValueLabel('sale')).toBe('products:documents.valueGeneric')
    expect(documentValueLabel(undefined)).toBe('products:documents.valueGeneric')
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

  it('says yes to a reversed document whose reversal was not loaded', () => {
    // ⚠️ NOT a bug today, and named here so it cannot become one quietly.
    //
    // The answer is derived from the set, so it is only as complete as the set
    // handed in. Today the screen loads every document at once and there is no
    // paging, so the set is always complete and this state is unreachable in
    // the app. The day paging lands, a document whose reversal sits on another
    // page reads as never reversed, the button lights up, and the database
    // answers already_reversed — a refusal the screen did not plan for.
    //
    // The direction of the column is right and is not the problem:
    // reverses_document_id points from the reversal to its original, so "was I
    // undone" is genuinely a question about other rows rather than a flag on
    // this one. What is fragile is deriving it from whatever happens to be in
    // memory. Whoever adds paging should make the answer come from the
    // database, and this test failing is not the signal — this test PASSING
    // while paging exists is.
    const undo = { id: 'd2', doc_type: 'reversal', reverses_document_id: 'd1' }
    expect(reversalState(doc, [doc])).toEqual({ canReverse: true, reason: null })
    expect(reversalState(doc, [doc, undo])).toMatchObject({ canReverse: false })
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

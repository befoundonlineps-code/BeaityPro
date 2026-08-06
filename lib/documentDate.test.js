import { today, maxDocumentDate, documentDateError } from './documentDate'
import { validateStockDocument, stocktakePayload, DOC_TYPES } from './stockDocumentForm'

// Item 39. Four of the owner's five real documents carried future dates, and
// nothing anywhere refused one.

// A fixed instant, and deliberately one where UTC and local disagree: 00:30 on
// the 6th in a +03:00 zone is still the 5th in UTC. Every test that cares about
// "which day is it" uses this.
const AFTER_MIDNIGHT = new Date('2026-08-05T21:30:00Z')   // 00:30 on the 6th at +03:00

describe('which day is today', () => {
  it('reads the local calendar, not UTC', () => {
    // ⚠️ THE BUG THIS REPLACED. The screen defaulted the date with
    // toISOString().slice(0, 10), which is UTC — so between midnight and 03:00
    // in Palestine every document was dated the day before. Not a future date,
    // so item 39 would never have caught it; wrong all the same, and invisible
    // because a yesterday date looks perfectly ordinary in the list.
    const utcAnswer = AFTER_MIDNIGHT.toISOString().slice(0, 10)
    const localAnswer = today(AFTER_MIDNIGHT)

    // The environment has to actually be ahead of UTC for this to mean
    // anything, so the test says so rather than assuming the CI box.
    if (AFTER_MIDNIGHT.getDate() !== AFTER_MIDNIGHT.getUTCDate()) {
      expect(localAnswer).not.toBe(utcAnswer)
    }
    expect(localAnswer).toBe(
      `${AFTER_MIDNIGHT.getFullYear()}-${String(AFTER_MIDNIGHT.getMonth() + 1).padStart(2, '0')}`
      + `-${String(AFTER_MIDNIGHT.getDate()).padStart(2, '0')}`
    )
  })

  it('is what the field offers as its ceiling', () => {
    // One value, so the picker's limit and the refusal cannot disagree.
    expect(maxDocumentDate(AFTER_MIDNIGHT)).toBe(today(AFTER_MIDNIGHT))
  })
})

describe('documentDateError', () => {
  const now = new Date('2026-08-06T10:00:00')

  it('accepts today at any hour of it', () => {
    // ⚠️ The end-of-day bound, and why it needs no arithmetic: the comparison
    // is day against day. Comparing against an instant would refuse a document
    // dated today, because today read as a timestamp is midnight and midnight
    // has passed.
    expect(documentDateError('2026-08-06', new Date('2026-08-06T00:00:01'))).toBe('')
    expect(documentDateError('2026-08-06', new Date('2026-08-06T23:59:59'))).toBe('')
  })

  it('accepts a date as far back as somebody wants', () => {
    // No `min`, deliberately: recording last month's purchase is ordinary, and
    // it is exactly what the first week of using this looks like.
    expect(documentDateError('2019-01-01', now)).toBe('')
  })

  it('refuses tomorrow', () => {
    expect(documentDateError('2026-08-07', now)).toBe('products:docs.dateFutureError')
  })

  it('refuses a blank date with the reason it is blank', () => {
    // Two different facts, two different sentences. "You left it empty" and
    // "that day has not happened" are not the same help.
    expect(documentDateError('', now)).toBe('products:docs.dateRequiredError')
    expect(documentDateError(null, now)).toBe('products:docs.dateRequiredError')
  })

  it('refuses a date it cannot judge instead of assuming it is fine', () => {
    // ⚠️ THE CASE A STRING COMPARISON GETS WRONG, and it is not the one I
    // reached for first. Every value below is tomorrow written another way,
    // and a bare `value > today` splits them in two by nothing but spelling —
    // measured against a today of '2026-08-06':
    //
    //   '07/08/2026'  sorts LOW  → accepted as if it were in the past
    //   ' 2026-08-07' sorts LOW  → accepted
    //   '2026-8-7'    sorts HIGH → refused, but for the wrong reason
    //   '26-08-07'    sorts HIGH → refused, but for the wrong reason
    //
    // A pasted day-first date is the realistic one, and it is in the half that
    // walks through. Checking the shape first makes the spelling irrelevant.
    expect('07/08/2026' > '2026-08-06').toBe(false)   // would have been accepted
    expect(' 2026-08-07' > '2026-08-06').toBe(false)  // would have been accepted
    expect('26-08-07' > '2026-08-06').toBe(true)      // refused, but as "future"

    for (const spelling of ['07/08/2026', ' 2026-08-07', '2026-8-7', '26-08-07',
      '2026/08/07', '2026-08-07T00:00:00Z', 'next tuesday']) {
      expect(documentDateError(spelling, now)).toBe('products:docs.dateInvalidError')
    }
  })
})

// ── every writer, not every writer I remembered ─────────────────────────────
//
// ⚠️ The owner's condition was one shared place covering ALL FIVE writers
// including the stocktake. A list of screens I check by hand is the "inventory
// not rule" fault: the next document type is a silent gap. So the doc types
// come from DOC_FORMS itself, and the stocktake — which is deliberately not in
// there — gets its own line right beside them.
describe('no writer accepts tomorrow', () => {
  const now = new Date('2026-08-06T10:00:00')
  const tomorrow = '2026-08-07'
  const products = { p1: { id: 'p1', base_unit: 'pcs', units_per_package: 1 } }

  it.each(DOC_TYPES)('%s refuses it', (docType) => {
    const values = {
      storageId: 's1',
      toStorageId: docType === 'transfer' ? 's2' : undefined,
      supplierId: 'sup1',
      docDate: tomorrow,
      rows: [{ productId: 'p1', enteredQuantity: '1', enteredUom: 'unit', unitCost: '5' }],
    }
    // Frozen so the test does not start failing on 2026-08-07.
    jest.useFakeTimers().setSystemTime(now)
    try {
      expect(validateStockDocument(docType, values)).toBe('products:docs.dateFutureError')
    } finally {
      jest.useRealTimers()
    }
  })

  it('the stocktake refuses it too, through its own door', () => {
    jest.useFakeTimers().setSystemTime(now)
    try {
      expect(stocktakePayload({
        storageId: 's1',
        docDate: tomorrow,
        rows: [{ productId: 'p1', countedQuantity: '3', enteredUom: 'unit' }],
      }, products)).toEqual({ error: 'products:docs.dateFutureError' })
    } finally {
      jest.useRealTimers()
    }
  })

  it('and all of them accept today', () => {
    jest.useFakeTimers().setSystemTime(now)
    try {
      for (const docType of DOC_TYPES) {
        expect(validateStockDocument(docType, {
          storageId: 's1',
          toStorageId: docType === 'transfer' ? 's2' : undefined,
          supplierId: 'sup1',
          docDate: today(now),
          rows: [],
        })).toBe('')
      }
      expect(stocktakePayload({ storageId: 's1', docDate: today(now), rows: [] }, products))
        .toEqual({ payload: { storageId: 's1', docDate: today(now), note: null, lines: [] } })
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('the stocktake door itself', () => {
  const products = { p1: { id: 'p1', base_unit: 'pcs', units_per_package: 1 } }
  const now = new Date('2026-08-06T10:00:00')

  it('accepts a stocktake where nothing differed, and dates it', () => {
    // Item 44: the most valuable stocktake is often the one that finds nothing
    // wrong, and it must still be a document with a date on it.
    jest.useFakeTimers().setSystemTime(now)
    try {
      expect(stocktakePayload({ storageId: 's1', docDate: '2026-08-06', rows: [] }, products))
        .toEqual({ payload: { storageId: 's1', docDate: '2026-08-06', note: null, lines: [] } })
    } finally {
      jest.useRealTimers()
    }
  })

  it('asks for a storage before it asks about the date', () => {
    expect(stocktakePayload({ docDate: '2026-08-06' }, products))
      .toEqual({ error: 'products:docs.storageRequiredError' })
  })

  it('passes a bad count through untouched, rather than re-deciding it', () => {
    // The line rules live in stockDocument.js and this door does not repeat
    // them — a second copy is a second thing to keep in step.
    expect(stocktakePayload({
      storageId: 's1', docDate: '2026-08-06',
      rows: [{ productId: 'p1', countedQuantity: '', enteredUom: 'unit' }],
    }, products)).toEqual({ error: 'products:stock.countInvalid' })
  })
})

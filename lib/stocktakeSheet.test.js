import {
  COUNT_STATE, countState, recordedBase, sheetRows, sortForCounting,
  lineReading, adjustmentValue, stocktakeSummary, countedRowsToSend,
} from './stocktakeSheet'
import { BALANCE_STATE, sortBalanceRows } from './balanceView'

// Products, categories and balances shaped as the real ones are. Two folders,
// because the whole size answer is a category filter.
const CATEGORIES = [
  { id: 'c-hair', parent_id: null, name: 'شعر' },
  { id: 'c-shampoo', parent_id: 'c-hair', name: 'شامبو' },
  { id: 'c-nails', parent_id: null, name: 'أظافر' },
]

const PRODUCTS = [
  { id: 'p-stocked', name: 'شامبو', category_id: 'c-shampoo', is_active: true, units_per_package: 1, base_unit: 'pcs', sort_order: 1 },
  { id: 'p-empty', name: 'بلسم', category_id: 'c-shampoo', is_active: true, units_per_package: 1, base_unit: 'pcs', sort_order: 2 },
  { id: 'p-never', name: 'زيت', category_id: 'c-hair', is_active: true, units_per_package: 1, base_unit: 'pcs', sort_order: 3 },
  { id: 'p-nails', name: 'مبرد', category_id: 'c-nails', is_active: true, units_per_package: 1, base_unit: 'pcs', sort_order: 4 },
]

const BALANCES = [
  { storage_id: 's1', product_id: 'p-stocked', balance_base: 10, avg_cost: 5, cost_has_estimate: false },
  { storage_id: 's1', product_id: 'p-empty', balance_base: 0, avg_cost: null, cost_has_estimate: false },
  { storage_id: 's1', product_id: 'p-nails', balance_base: 4, avg_cost: 0, cost_has_estimate: false },
]

const rowsFor = (opts) => sheetRows({ balances: BALANCES, products: PRODUCTS, storageId: 's1', categories: CATEGORIES, ...opts })
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.product.id, r]))

describe('the three states of a count', () => {
  it('separates an untouched box from a written zero', () => {
    // ⚠️ The same Number('') === 0 trap that poisoned the supply screen,
    // pointed at quantity instead of money — and worse here, because reading an
    // untouched row as a count says "I counted zero" and writes off the shelf.
    expect(countState('')).toBe(COUNT_STATE.UNTOUCHED)
    expect(countState('   ')).toBe(COUNT_STATE.UNTOUCHED)
    expect(countState(null)).toBe(COUNT_STATE.UNTOUCHED)
    expect(countState(undefined)).toBe(COUNT_STATE.UNTOUCHED)
    expect(countState('0')).toBe(COUNT_STATE.ZERO)
    expect(countState(0)).toBe(COUNT_STATE.ZERO)
  })

  it('treats a real count as a count', () => {
    expect(countState('7')).toBe(COUNT_STATE.NUMBER)
    expect(countState(7)).toBe(COUNT_STATE.NUMBER)
  })

  it('refuses a negative or unreadable count rather than guessing', () => {
    // Not a smaller count — nonsense. Treated as untouched so it can never
    // become a line; the field says why separately.
    expect(countState('-3')).toBe(COUNT_STATE.UNTOUCHED)
    expect(countState('كتير')).toBe(COUNT_STATE.UNTOUCHED)
  })
})

describe('what the ledger already says', () => {
  it('flattens never-moved to zero for the arithmetic only', () => {
    // post_stocktake computes counted - coalesce(sum, 0), so never-moved IS
    // zero to the database. The display must still say "not recorded", because
    // "emptied" and "never stocked" send a person to different conclusions.
    const rows = byId(rowsFor({}))
    expect(rows['p-never'].balanceState).toBe(BALANCE_STATE.NEVER_MOVED)
    expect(rows['p-never'].balanceBase).toBeNull()
    expect(recordedBase(rows['p-never'])).toBe(0)
  })

  it('keeps a real balance as it is', () => {
    const rows = byId(rowsFor({}))
    expect(recordedBase(rows['p-stocked'])).toBe(10)
    expect(recordedBase(rows['p-empty'])).toBe(0)
  })
})

describe('the sheet folds nothing', () => {
  it('shows a product that never moved, which is the point of counting', () => {
    // ⚠️ THE OPPOSITE OF THE BALANCE SCREEN. There, never-moved folds away as a
    // reference. Here it is the richest line on the page: a wrong positive
    // balance is caught by counting, but goods the system never knew about are
    // found ONLY by somebody at the shelf seeing them. Folding it makes them
    // impossible to find, not merely harder.
    expect(rowsFor({}).map((r) => r.product.id)).toContain('p-never')
  })

  it('shows an emptied shelf too, because zero is a claim worth checking', () => {
    expect(rowsFor({}).map((r) => r.product.id)).toContain('p-empty')
  })

  it('lists every product in the storage when no folder is chosen', () => {
    expect(rowsFor({}).map((r) => r.product.id).sort())
      .toEqual(['p-empty', 'p-nails', 'p-never', 'p-stocked'])
  })
})

describe('size is solved by the folder, not by hiding rows', () => {
  it('narrows to a folder and its subfolders', () => {
    // The same walk the archive dialog uses, so "the hair folder" means the
    // same thing on both screens.
    expect(rowsFor({ categoryId: 'c-hair' }).map((r) => r.product.id).sort())
      .toEqual(['p-empty', 'p-never', 'p-stocked'])
  })

  it('narrows to a leaf folder alone', () => {
    expect(rowsFor({ categoryId: 'c-shampoo' }).map((r) => r.product.id).sort())
      .toEqual(['p-empty', 'p-stocked'])
  })

  it('narrows to nothing for a folder that no longer exists', () => {
    // ⚠️ Fails closed. Silently widening a counting sheet is worse than an
    // empty one, because an empty sheet is noticed and a wider one is not.
    expect(rowsFor({ categoryId: 'c-ghost' })).toEqual([])
  })
})

describe('order groups by folder, and does not rank by problem', () => {
  it('keeps one folder together and uses the catalogue order inside it', () => {
    // Written out rather than recomputed. A test that re-derives the sort
    // passes whatever the sort does, including whatever it does wrongly.
    expect(sortForCounting(rowsFor({})).map((r) => r.product.id))
      .toEqual(['p-never', 'p-nails', 'p-stocked', 'p-empty'])
  })

  it('does NOT put the troubled row first, unlike the balance screen', () => {
    // ⚠️ The contrast is the point, and it is measured against the real
    // function rather than asserted. p-nails holds stock recorded as worth
    // zero, so the balance screen ranks it first — that screen is a work list.
    // A counting sheet that reorders itself by problem makes somebody hunt for
    // each product instead of reading down the page.
    const rows = rowsFor({})
    expect(sortBalanceRows(rows)[0].product.id).toBe('p-nails')
    expect(sortForCounting(rows)[0].product.id).not.toBe('p-nails')
  })
})

describe('a line reading', () => {
  const rows = () => byId(rowsFor({}))

  it('has no difference at all until something is counted', () => {
    // ⚠️ Not a difference of zero. "Nothing counted yet" and "counted, and it
    // matched" are different findings and only one of them is a result.
    expect(lineReading(rows()['p-stocked'], '', null))
      .toEqual({ state: COUNT_STATE.UNTOUCHED, countedBase: null, recorded: 10, difference: null })
  })

  it('reports a shortage against a recorded balance', () => {
    expect(lineReading(rows()['p-stocked'], '7', 7))
      .toEqual({ state: COUNT_STATE.NUMBER, countedBase: 7, recorded: 10, difference: -3 })
  })

  it('reports an empty shelf as a written zero, not as nothing', () => {
    expect(lineReading(rows()['p-stocked'], '0', 0))
      .toEqual({ state: COUNT_STATE.ZERO, countedBase: 0, recorded: 10, difference: -10 })
  })

  it('reports goods the system never knew about as a surplus', () => {
    // The line that only exists because the sheet folds nothing.
    expect(lineReading(rows()['p-never'], '4', 4))
      .toEqual({ state: COUNT_STATE.NUMBER, countedBase: 4, recorded: 0, difference: 4 })
  })
})

describe('what the confirmation may claim about money', () => {
  const rows = () => byId(rowsFor({}))

  it('values a difference against the recorded average', () => {
    expect(adjustmentValue(rows()['p-stocked'], -3)).toBe(-15)
  })

  it('refuses to value a surplus of something never stocked', () => {
    // ⚠️ There is no average because there has never been a movement to
    // average, and post_stocktake decides the price by its fallback chain —
    // which this screen does not know and must not pretend to.
    expect(adjustmentValue(rows()['p-never'], 4)).toBeNull()
  })

  it('refuses to value stock whose recorded cost is zero', () => {
    // A recorded cost of 0 means the worth is unknown, not free (item 34).
    // Multiplying by it would produce a confident nothing.
    expect(adjustmentValue(rows()['p-nails'], -1)).toBeNull()
  })

  it('says nothing about a line that did not move', () => {
    expect(adjustmentValue(rows()['p-stocked'], 0)).toBeNull()
    expect(adjustmentValue(rows()['p-stocked'], null)).toBeNull()
  })
})

describe('the confirmation summary', () => {
  const rows = () => sortForCounting(rowsFor({}))
  const reading = (rowsById, id, raw, base) => lineReading(rowsById[id], raw, base)

  it('separates "nothing counted" from "counted and nothing changed"', () => {
    // ⚠️ Item 44: a stocktake where everything matched writes no movements at
    // all. "Nothing will change" and "you have not counted anything" look
    // identical in a movement count and are opposite findings.
    const list = rows()
    const map = byId(list)
    const nothingCounted = stocktakeSummary(list, {})
    expect(nothingCounted).toMatchObject({ countedLines: 0, changing: [] })

    const allMatched = stocktakeSummary(list, {
      'p-stocked': reading(map, 'p-stocked', '10', 10),
      'p-empty': reading(map, 'p-empty', '0', 0),
    })
    expect(allMatched).toMatchObject({ countedLines: 2, changing: [] })
    expect(allMatched.untouchedLines).toBe(2)
  })

  it('lists only the lines that will move, and totals what it can value', () => {
    const list = rows()
    const map = byId(list)
    const summary = stocktakeSummary(list, {
      'p-stocked': reading(map, 'p-stocked', '7', 7),      // -3 × 5  = -15
      'p-empty': reading(map, 'p-empty', '0', 0),          // no change
      'p-never': reading(map, 'p-never', '4', 4),          // +4, unvaluable
    })

    expect(summary.countedLines).toBe(3)
    expect(summary.changing.map((c) => c.row.product.id).sort()).toEqual(['p-never', 'p-stocked'])
    expect(summary.valued).toBe(-15)
    // ⚠️ A total that excludes something says what it excluded.
    expect(summary.unvaluedLines).toBe(1)
  })
})

describe('what gets sent', () => {
  it('never sends an untouched row', () => {
    // ⚠️ The single most destructive thing this screen could do: the database
    // would read a missing count as zero and empty the shelf. Prevented by
    // never building the line, not by validating it afterwards.
    const list = rowsFor({})
    const sent = countedRowsToSend(list, { 'p-stocked': '7' })
    expect(sent).toEqual([{ productId: 'p-stocked', countedQuantity: '7', enteredUom: 'unit' }])
  })

  it('does send a written zero, because an empty shelf is a finding', () => {
    const list = rowsFor({})
    const sent = countedRowsToSend(list, { 'p-stocked': '0' })
    expect(sent).toEqual([{ productId: 'p-stocked', countedQuantity: '0', enteredUom: 'unit' }])
  })

  it('sends nothing at all when nothing was counted', () => {
    expect(countedRowsToSend(rowsFor({}), {})).toEqual([])
  })
})

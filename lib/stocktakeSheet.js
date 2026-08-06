import { balanceRows, BALANCE_STATE, COST_STATE, hasKnownValue } from './balanceView'
import { descendantIds } from './categoryVisibility'

// The counting sheet: which lines stand in front of somebody at the shelf, what
// each one already says, and what a count would change.
//
// ⚠️ WHAT IS RECORDED COMES FROM balanceView.js, NOT FROM A SECOND READER.
// Three decisions live there and a copy that missed any of them would make this
// screen count a shelf it believes is shorter than it is: "never moved" is not
// zero, NULL is not zero, and an archived product that still has stock is
// shown. The adjustment written from a wrong "recorded" is the one that does
// not scream — it looks exactly like an ordinary correction.
//
// ⚠️ AND THE GROUPING IS THE OPPOSITE OF THE BALANCE SCREEN'S, deliberately.
// That screen asks "what do I have and what is wrong with my record", so it
// folds "never moved" away as a reference. Here it is the richest column on the
// page: a wrong positive balance is caught by counting, but goods the system
// never knew about are found ONLY by somebody standing at the shelf seeing
// them. Folding that section would not make them harder to find — it would make
// them impossible, because what is not in front of the counter is not counted.
//
// So: nothing folded, nothing sorted by problem, and size solved by a CATEGORY
// filter — people count a shelf, not a warehouse. "Show the shampoo folder"
// cuts the sheet along the real world; "hide what has no balance" cuts it
// against the real world.

// ⚠️ THREE STATES, and the middle one is why this cannot be a truthiness check.
//
// An untouched box and a written zero are the same `''`-to-`0` trap that
// poisoned the supply screen, pointed at quantity instead of money — except the
// damage runs the other way. Number('') is 0, so an untouched row read as a
// count says "I counted zero" and writes off the whole shelf. A row nobody
// filled in must not be able to empty one.
//
// And zero is not a value to be avoided: it is one of the most important
// findings a stocktake produces. "I looked and there is nothing there" is
// exactly the sentence the ledger cannot generate by itself.
export const COUNT_STATE = {
  UNTOUCHED: 'untouched',
  ZERO: 'zero',
  NUMBER: 'number',
}

export function countState(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return COUNT_STATE.UNTOUCHED
  const counted = Number(raw)
  if (!Number.isFinite(counted) || counted < 0) return COUNT_STATE.UNTOUCHED
  return counted === 0 ? COUNT_STATE.ZERO : COUNT_STATE.NUMBER
}

// What the ledger already believes, as a number a difference can be taken
// against — and NOT as something to show.
//
// ⚠️ The screen shows three different things for these three states and this
// function flattens them to one, on purpose and in one direction only.
// post_stocktake computes `counted - coalesce(sum(quantity_base), 0)`, so a
// product that never moved is arithmetically zero to the database. The display
// must still say "غير مسجَّل" rather than "0", because the two send a person to
// different conclusions: one shelf was emptied, the other was never stocked.
export function recordedBase(row) {
  if (!row || row.balanceState === BALANCE_STATE.NEVER_MOVED) return 0
  return row.balanceBase
}

// Every product the counter should walk past, for one storage.
//
// `categoryId` narrows it to a folder AND ITS SUBFOLDERS — the same walk the
// archive dialog uses, so "the shampoo folder" means the same thing on both
// screens. null means the whole storage.
export function sheetRows({ balances, products, storageId, categoryId, categories }) {
  const rows = balanceRows({ balances, products, storageId })

  const inFolder = categoryId
    ? (() => {
      const category = (categories || []).find((c) => c.id === categoryId)
      // A folder that no longer exists narrows to nothing rather than to
      // everything. Silently widening a counting sheet is worse than an empty
      // one: the empty sheet is noticed.
      const ids = category ? descendantIds(category, categories) : new Set()
      return (row) => ids.has(row.product.category_id)
    })()
    : () => true

  return sortForCounting(rows.filter(inFolder))
}

// ⚠️ Sorted the way a shelf is walked, NOT the way a work list is ranked.
//
// sortBalanceRows puts the problems first, which is right when the question is
// "what needs attention". Here the question is "what is in front of me", and a
// sheet that reorders itself by problem makes the counter hunt for each product
// instead of reading down the page.
//
// ⚠️ The category key GROUPS, it does not rank: comparing ids puts one folder
// before another for no reason anybody would defend. That is deliberate and
// only safe because the screen draws a heading per folder — what matters is
// that a folder's products are adjacent, and inside it the catalogue's own
// sort_order decides, which is the order the person arranged them in.
export function sortForCounting(rows) {
  return [...(rows || [])].sort((a, b) => {
    const byCategory = String(a.product.category_id || '').localeCompare(String(b.product.category_id || ''))
    if (byCategory !== 0) return byCategory
    const byOrder = (a.product.sort_order || 0) - (b.product.sort_order || 0)
    if (byOrder !== 0) return byOrder
    return String(a.product.name || '').localeCompare(String(b.product.name || ''), 'ar')
  })
}

// One line's reading: what was counted, what is recorded, and the difference —
// or null for the difference when nothing was counted.
//
// ⚠️ `counted` is in BASE units here. The conversion from packages happens in
// stocktakeLine, which owns the factor and the whole-pieces refusal; repeating
// it would be a second copy of the rule that decides whether half a hairpin
// exists.
export function lineReading(row, rawCount, countedBase) {
  const state = countState(rawCount)
  if (state === COUNT_STATE.UNTOUCHED) {
    return { state, countedBase: null, recorded: recordedBase(row), difference: null }
  }
  const recorded = recordedBase(row)
  return { state, countedBase, recorded, difference: countedBase - recorded }
}

// ⚠️ WHAT THE CONFIRMATION IS ALLOWED TO CLAIM ABOUT MONEY.
//
// The value of an adjustment is `difference × cost`, and the cost is decided
// INSIDE post_stocktake by the fallback chain — this screen does not know it
// and must not pretend to. What it does know is the recorded average, and only
// for rows that have one.
//
// So the total carries the lines it can value and REPORTS the ones it cannot,
// the same rule storageValueSummary keeps: a total that excludes something says
// what it excluded. A surplus found on a product that never moved is the
// commonest unvaluable line there is — there is no average, because there has
// never been a movement to average.
//
// ⚠️ hasKnownValue is reused rather than re-derived, because the cell and the
// total disagreeing is a fault this module has already paid for once.
export function adjustmentValue(row, difference) {
  if (difference === null || difference === 0) return null
  // A never-moved or negative row has no average at all; a zero-cost row has
  // one whose worth is unknown. Neither can be multiplied honestly.
  if (!hasKnownValue(row) && row.costState !== COST_STATE.KNOWN) return null
  if (row.avgCost === null || row.avgCost === undefined) return null
  return difference * row.avgCost
}

// Everything the confirmation has to say before anybody presses save.
//
// ⚠️ It names the lines that will MOVE, not the lines that were counted, and
// the difference matters: counting fifty products and finding forty-seven right
// produces three movements. Somebody agreeing to "save the stocktake" is
// agreeing to those three, and they are what gets listed.
//
// ⚠️ But `countedLines` is reported too, because a stocktake where everything
// matched writes no movements at all (item 44) — and "nothing will change" is a
// completely different sentence from "you have not counted anything yet".
export function stocktakeSummary(rows, readings) {
  const changing = []
  let valued = 0
  let unvaluedLines = 0
  let countedLines = 0

  for (const row of rows || []) {
    const reading = readings[row.product.id]
    if (!reading || reading.state === COUNT_STATE.UNTOUCHED) continue
    countedLines += 1
    if (reading.difference === 0) continue

    const value = adjustmentValue(row, reading.difference)
    if (value === null) unvaluedLines += 1
    else valued += value

    changing.push({ row, reading, value })
  }

  return {
    countedLines,
    untouchedLines: (rows || []).length - countedLines,
    changing,
    valued,
    unvaluedLines,
  }
}

// The rows to send, in the shape stocktakeLine expects.
//
// ⚠️ ONLY the counted ones. An untouched row must never become a line: the
// database would read it as a count of zero and write the shelf off. This is
// the single most destructive thing this screen could do, and it is prevented
// by never building the line rather than by validating it later.
export function countedRowsToSend(rows, rawCounts) {
  return (rows || [])
    .filter((row) => countState(rawCounts[row.product.id]) !== COUNT_STATE.UNTOUCHED)
    .map((row) => ({
      productId: row.product.id,
      countedQuantity: rawCounts[row.product.id],
      enteredUom: 'unit',
    }))
}

// Which rows appear in front of a person, and what each one means.
//
// ⚠️ THIS FILE IS SHARED WITH THE STOCKTAKE ON PURPOSE, AND BEFORE THE FORK
// EXISTS. The stocktake shows "recorded" beside "counted", and "recorded" is
// letter for letter what this produces: same view, same storage, same
// products, same treatment of an archived product that still has stock.
//
// If these decisions lived inside the balance screen, the stocktake would grow
// its own copy a week later and the two would drift — which is exactly what
// dbErrorSentence cost before it was unified, and what productAdminIO's header
// cost. The difference is that those forks were born and then closed; this one
// is known before it is born.
//
// ⚠️ And what has to be shared is the DECISIONS, not the query. Three of them
// decide which line stands in front of the counter:
//
//   an archived product WITH stock is shown
//   "never moved" is not "zero"
//   NULL is not "zero"
//
// A second copy that misses any one of them makes the stocktake count a shelf
// it believes is shorter than it is, and write an adjustment for the
// difference — and that adjustment is the one that does not scream.

export const BALANCE_STATE = {
  NEVER_MOVED: 'neverMoved',
  EMPTY: 'empty',
  NEGATIVE: 'negative',
  IN_STOCK: 'inStock',
}

export const COST_STATE = {
  NONE: 'noAverage',
  ZERO: 'zeroCost',
  KNOWN: 'known',
}

// Whether any movement behind this balance had its cost ESTIMATED rather than
// paid — item 34's `cost_is_estimated`, raised to the balance by the view.
//
// ⚠️ AND "ESTIMATED" MEANS ONE EXACT THING: the fallback chain descended below
// its first rung. It is NOT "derived rather than dictated", which is how this
// was first written and is wrong — grade 1 IS derived, from a weighted average,
// and it is not flagged.
//
//   false  a person dictated the price (supply/opening — no chain runs at all)
//   false  grade 1: the weighted average of stock actually present HERE
//   false  copied, when a reversal inherits the row it undoes
//   true   grades 2-5: last receipt here, any storage, nominal price, or zero
//
// The unifying statement is the one to keep: the number is either a price
// actually paid, or an average of prices actually paid for stock that is
// actually here. Everything else is a substitute for a price this storage could
// not supply, and that is what gets flagged.
//
// Measured on the owner's first real stocktake: a shortage line on a product
// with history came back false, on a stocktake document — which the doc-type
// wording could not explain.
//
// ⚠️ Sticky on the ROW forever — a stamped cost is never recomputed (ADR-051).
// But the BADGE is not sticky, and the difference took a round to get right:
// the view asks whether the flagged rows still move the average, so reversing
// the document that carried the guess clears it. That is what makes "how does
// it go away?" a true sentence rather than a decorative one.
//
// ⚠️ The column exists now — the migration ran on 2026-08-06 — so this reads a
// real value rather than defaulting dark. It still uses === true so that a row
// from any other source, or a read that predates the column, is treated as
// unknown rather than as flagged.
export function costIsEstimated(row) {
  return row?.cost_has_estimate === true
}

// The reorder threshold, or null when there is none.
//
// The unit needs no decision here, unlike nominal_purchase_price (item 31):
// the product dialog's label interpolates the base unit explicitly, so the
// threshold and the balance are both in base units and the comparison is
// direct.
//
// ⚠️ An empty threshold is null and NOT zero — productForm's numberOrNull
// already stores it that way. Reading it as 0 would mean an alarm that fires
// when the balance reaches zero, which is exactly too late to reorder.
export function lowSupplyThreshold(product) {
  const raw = product && product.low_supply_units
  if (raw === null || raw === undefined || String(raw).trim() === '') return null
  const threshold = Number(raw)
  return Number.isFinite(threshold) ? threshold : null
}

// One row per product for one storage, given the view's rows for that storage.
//
// `balances` are rows of product_balances — the view returns nothing at all for
// a product that never moved, which is why `products` is the list being walked
// and not `balances`.
export function balanceRows({ balances, products, storageId }) {
  const forStorage = Object.fromEntries(
    (balances || [])
      .filter((b) => b.storage_id === storageId)
      .map((b) => [b.product_id, b])
  )

  return (products || []).flatMap((product) => {
    const row = forStorage[product.id]
    const archived = product.is_active === false

    // ⚠️ Archived and nothing on the shelf: gone — and it got there by itself
    // the moment the balance reached zero, which is why no trigger and no
    // cleanup step are needed. An archived product that STILL HAS STOCK stays,
    // because "archived" means "stop buying this", not "the shelf is empty" —
    // and because the stocktake must be able to count it, or "I counted this
    // storage" is false by construction.
    if (archived && (!row || Number(row.balance_base) === 0)) return []

    const threshold = lowSupplyThreshold(product)

    if (!row) {
      // The state the view cannot express: never moved is not zero. One means
      // "created, not supplied yet", the other means "ran out".
      return [{
        product,
        balanceBase: null,
        avgCost: null,
        balanceState: BALANCE_STATE.NEVER_MOVED,
        costState: COST_STATE.NONE,
        archived,
        // Restocking is a signal about something you stock; never-moved is
        // already its own state.
        lowSupply: false,
        needsAttention: false,
      }]
    }

    const balanceBase = Number(row.balance_base)
    const avgCost = row.avg_cost === null || row.avg_cost === undefined ? null : Number(row.avg_cost)

    const balanceState = balanceBase > 0 ? BALANCE_STATE.IN_STOCK
      : balanceBase < 0 ? BALANCE_STATE.NEGATIVE
        : BALANCE_STATE.EMPTY

    const costState = avgCost === null ? COST_STATE.NONE
      : avgCost === 0 ? COST_STATE.ZERO
        : COST_STATE.KNOWN

    return [{
      product,
      balanceBase,
      avgCost,
      balanceState,
      costState,
      // Item 34. Reads false until the column exists — the badge lights up on
      // its own once the script is run, and invents nothing before that.
      costEstimated: costIsEstimated(row),
      archived,
      // ⚠️ TWO independent alarms, never one glyph:
      //   needsAttention → its VALUE is unknown (stock recorded as worth 0)
      //   lowSupply      → its QUANTITY is small
      needsAttention: balanceState === BALANCE_STATE.IN_STOCK && costState === COST_STATE.ZERO,
      lowSupply: threshold !== null && balanceBase <= threshold,
    }]
  })
}

// ⚠️ The empty screen is three states as well — the fourth triple on this one
// screen, after the balance, the cost and the alarms.
//
// The first two send a person to two completely different actions, and one
// message sends half of them to the wrong screen. The third is item 26: a
// failed read that renders as emptiness reassures instead of failing, and a
// hook written from scratch does not inherit the fix that useProductCatalog
// got — it has to be made again, here.
export const EMPTY_REASON = {
  FAILED: 'failed',
  NO_PRODUCTS: 'noProducts',
  NO_STOCK: 'noStock',
}

export function emptyReason({ loading, error, products, rows }) {
  if (loading) return null
  if (error) return EMPTY_REASON.FAILED
  if (!products || products.length === 0) return EMPTY_REASON.NO_PRODUCTS
  if (!rows || rows.length === 0) return EMPTY_REASON.NO_STOCK
  return null
}

// ⚠️ "What is wrong" is TWO kinds, not one, and they call for different acts
// by different people.
//
//   DATA        the record is incomplete or impossible — stock at zero cost, a
//               negative balance. Fixed by correcting a document.
//   OPERATIONAL the record is fine and the shelf is low. Fixed by ordering.
//
// One rank for both makes somebody read three rows with one eye. So the kind
// travels with the row and the screen separates them.
export const PROBLEM_KIND = {
  DATA: 'data',
  OPERATIONAL: 'operational',
  NONE: 'none',
}

export function problemKind(row) {
  if (row.needsAttention || row.balanceState === BALANCE_STATE.NEGATIVE) return PROBLEM_KIND.DATA
  if (row.lowSupply) return PROBLEM_KIND.OPERATIONAL
  return PROBLEM_KIND.NONE
}

// Data problems first, then what to reorder, then the quiet rows, and
// never-moved last — it is not a problem, it is an absence.
export function sortBalanceRows(rows) {
  const rank = (row) => {
    const kind = problemKind(row)
    if (kind === PROBLEM_KIND.DATA) return row.needsAttention ? 0 : 1
    if (kind === PROBLEM_KIND.OPERATIONAL) return 2
    if (row.balanceState === BALANCE_STATE.NEVER_MOVED) return 4
    return 3
  }
  return [...(rows || [])].sort((a, b) => rank(a) - rank(b))
}

// ⚠️ A TOTAL THAT EXCLUDES SOMETHING SAYS WHAT IT EXCLUDED.
//
// The first version summed "what is known" — and it excluded NULL because it
// could, and kept the zeros because it could not: a poisoned row's cost is a
// number whose value is 0, not NULL. So the line said "its value is unknown"
// while the total counted it as nothing, and the header announced a final
// figure for a storage we know is partly unvalued.
//
// This is item 34 biting for the first time rather than in theory: "the ledger
// has no word for ignorance" was a statement about a column until a total was
// put above it. And the zero we deliberately keep VISIBLE on the line entered
// the arithmetic, because arithmetic does not read badges.
//
// Excluding it alone would produce a figure smaller than the truth with nobody
// saying why — the exact fault we keep removing. So the exclusion is reported
// with the sum, and the total is honest twice: about what it carries and about
// what it does not.
//
// The rule generalises to every total that follows — a report, the salon's
// whole stock value.
// ⚠️ What is excluded is reported as a COUNT OF PRODUCTS, never as a summed
// quantity. The first version added the held-out balances together — and those
// balances are in each product's own base unit, so pieces and millilitres
// would have been added into one figure. That is the rule this module enforces
// on every other screen ("no number without its unit"), broken inside the
// function written to make a total honest.
//
// A count of products has no unit and is always true. The rows come back too,
// so a caller that wants to name them can.
// ⚠️ ONE predicate for the cell and the total, because they disagreed.
//
// The total excluded a poisoned row (it knew the value was unknown) while the
// cell beside it printed "0" — so the screen owned a word for ignorance, used
// it on two rows, and dropped it on the one row the badge exists for. The
// reader was left to join "0" in the column to "1 unvalued" in the header.
//
// They disagreed because they were two conditions. Now they are one, and
// cannot drift apart again.
//
// ⚠️ And the cost column is NOT covered by this, deliberately. "تكلفة القطعة:
// 0 ₪" stays, because that column TRANSPORTS what the ledger holds and the
// zero is the evidence. The value column PRODUCES a new claim by multiplying.
// Transporting a zero is honest; computing with it is not.
export function hasKnownValue(row) {
  if (!row) return false
  if (row.balanceState === BALANCE_STATE.NEVER_MOVED) return false
  if (row.balanceState === BALANCE_STATE.EMPTY) return false
  // Stock recorded as worth nothing: the value is unknown, not zero.
  if (row.needsAttention) return false
  // No average at all — a negative balance.
  if (row.costState === COST_STATE.NONE) return false
  return true
}

// ⚠️ "UNVALUED" MEANS STOCK PRESENT WHOSE WORTH IS UNKNOWN — a negative
// balance is NOT that, and the difference is why the screen can show two rows
// reading "—" while the counter says one.
//
//   مقشر ليزر   3 pieces at a recorded cost of 0   → goods exist, worth unknown
//   مبرد ومهدئ   -75                                → there are no goods to value
//
// Both cells say "—" because neither value can be computed; only the first is
// stock that needs valuing. Somebody counting the dashes finds two and reads
// one, and the danger is not to that reader — it is to whoever "corrects" this
// to 2, after which the counter reports two different problems as one number.
//
// This sentence existed once and I deleted it myself while refactoring the
// function to share hasKnownValue. It is back where the count is made.
export function storageValueSummary(rows) {
  let total = 0
  const unvaluedRows = []

  for (const row of rows || []) {
    // Stock present, recorded as worth nothing. Held out AND counted — a total
    // that excludes something says so.
    if (row.needsAttention) {
      unvaluedRows.push(row)
      continue
    }
    // Everything else that cannot be valued — a negative balance, an emptied
    // shelf, a product that never moved — contributes nothing AND is not
    // unvalued stock. It is reported by its own badge on its own row.
    if (!hasKnownValue(row)) continue
    total += row.balanceBase * row.avgCost
  }

  return { total, unvaluedProducts: unvaluedRows.length, unvaluedRows }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ THE BOUNDARY. Everything ABOVE this line is shared with the stocktake.
//    Everything BELOW belongs to the balance screen alone, and the names say
//    so, so that nothing is imported merely because it sits in this file.
//
// The two screens need the same INTERPRETATION and emphatically not the same
// grouping. I wrote "the stocktake needs the same sections" in a report, which
// was wrong and would have become the stocktake's design:
//
//   the balance screen asks  what do I have, and what is wrong with my record?
//   the stocktake asks       what is actually on the shelf?
//
// And they treat one section in OPPOSITE ways. "Never moved" is a reference on
// the balance screen — nothing to act on, so it folds. On a counting sheet it
// is the richest column there is: a wrong positive balance is caught by a
// difference when counted, but goods the system never knew about are found
// only by somebody standing at the shelf and seeing them. Folding that section
// on a stocktake does not make them harder to find, it makes them impossible —
// what is not in front of the counter is not counted.
//
// So the counting sheet is EVERY active product with no exceptions, plus an
// archived one that still has stock (item 47), and nothing folded. Its size is
// solved where size actually lives — a CATEGORY filter, using the folder tree
// from step 3 — because people count a shelf, not a warehouse. "Show the
// shampoo folder" cuts the sheet along the real world; "hide what has no
// balance" cuts it against the real world.
//
// What must never be copied is above: "never moved" is not zero, NULL is not
// zero, an archived product with stock is shown, and hasKnownValue.
// ═══════════════════════════════════════════════════════════════════════════

// The sections of the BALANCE SCREEN. The first two are a work list, the last
// two a reference — which is why "never moved" is its own section rather than
// the tail of "the rest": at six products it passes, at two hundred it turns a
// work list into a header above a hundred and seventy rows nobody is being
// asked to act on. And "الباقي" named a section by its position, not its
// content.
export const BALANCE_SCREEN_SECTION = {
  DATA: 'data',
  OPERATIONAL: 'operational',
  STOCKED: 'stocked',
  NEVER_MOVED: 'neverMoved',
}

export function balanceScreenSectionOf(row) {
  const kind = problemKind(row)
  if (kind === PROBLEM_KIND.DATA) return BALANCE_SCREEN_SECTION.DATA
  if (kind === PROBLEM_KIND.OPERATIONAL) return BALANCE_SCREEN_SECTION.OPERATIONAL
  if (row.balanceState === BALANCE_STATE.NEVER_MOVED) return BALANCE_SCREEN_SECTION.NEVER_MOVED
  return BALANCE_SCREEN_SECTION.STOCKED
}

// The sections in reading order, each with its rows. Empty sections are left
// out rather than drawn as a heading over nothing.
export function balanceScreenSections(rows) {
  const order = [
    BALANCE_SCREEN_SECTION.DATA,
    BALANCE_SCREEN_SECTION.OPERATIONAL,
    BALANCE_SCREEN_SECTION.STOCKED,
    BALANCE_SCREEN_SECTION.NEVER_MOVED,
  ]
  const sorted = sortBalanceRows(rows)
  return order
    .map((section) => ({ section, rows: sorted.filter((row) => balanceScreenSectionOf(row) === section) }))
    .filter((group) => group.rows.length > 0)
}

// Every storage where this product still has stock.
//
// ⚠️ Used when a product is ARCHIVED. There is no trigger stopping that
// (measured), and there should not be: an archived storage is unreachable so
// only the database can save it, while an archived product is merely filtered
// and the screen can. Forcing somebody to write off three remaining bottles of
// a discontinued line is friction that buys nothing.
//
// What was actually missing was not a block but KNOWLEDGE — that the goods
// stay on the shelf, stay countable, and stay on the balance screen until they
// run out. So this answers "what is still there", and the screen says it.
//
// Non-zero in either direction: a negative balance on a product somebody just
// archived is worth saying out loud too.
export function stockedStorages({ balances, productId }) {
  return (balances || [])
    .filter((b) => b.product_id === productId && Number(b.balance_base) !== 0)
    .map((b) => ({ storage_id: b.storage_id, balance_base: Number(b.balance_base) }))
}

// Where the other half of a negative balance is sitting.
//
// The commonest cause of a negative balance is a transfer recorded before the
// supply, so the counterpart is the most useful context this row can carry —
// and the screen already has every storage's rows.
export function counterpartBalances({ balances, productId, storageId }) {
  return (balances || [])
    .filter((b) => b.product_id === productId
      && b.storage_id !== storageId
      && Number(b.balance_base) !== 0)
    .map((b) => ({ storage_id: b.storage_id, balance_base: Number(b.balance_base) }))
}

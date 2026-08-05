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

export function storageValueSummary(rows) {
  let total = 0
  const unvaluedRows = []

  for (const row of rows || []) {
    if (row.needsAttention) {
      // Held out AND counted — a total that excludes something says so.
      unvaluedRows.push(row)
      continue
    }
    if (!hasKnownValue(row)) continue
    total += row.balanceBase * row.avgCost
  }

  return { total, unvaluedProducts: unvaluedRows.length, unvaluedRows }
}

// ⚠️ The sections a person reads, which are not the same as the problem kinds.
//
// The first two are a WORK LIST and the last two are a REFERENCE. That is why
// "never moved" is its own section rather than the tail of "the rest": at six
// products it passes, at two hundred it turns a work list into a header above
// a hundred and seventy rows nobody is being asked to do anything about.
//
// And "الباقي" named the section by its POSITION, not its content.
export const SECTION = {
  DATA: 'data',
  OPERATIONAL: 'operational',
  STOCKED: 'stocked',
  NEVER_MOVED: 'neverMoved',
}

export function sectionOf(row) {
  const kind = problemKind(row)
  if (kind === PROBLEM_KIND.DATA) return SECTION.DATA
  if (kind === PROBLEM_KIND.OPERATIONAL) return SECTION.OPERATIONAL
  if (row.balanceState === BALANCE_STATE.NEVER_MOVED) return SECTION.NEVER_MOVED
  return SECTION.STOCKED
}

// The sections in reading order, each with its rows. Empty sections are left
// out rather than drawn as a heading over nothing.
export function balanceSections(rows) {
  const order = [SECTION.DATA, SECTION.OPERATIONAL, SECTION.STOCKED, SECTION.NEVER_MOVED]
  const sorted = sortBalanceRows(rows)
  return order
    .map((section) => ({ section, rows: sorted.filter((row) => sectionOf(row) === section) }))
    .filter((group) => group.rows.length > 0)
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

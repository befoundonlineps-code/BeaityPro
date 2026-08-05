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
export function storageValueSummary(rows) {
  let total = 0
  const unvaluedRows = []

  for (const row of rows || []) {
    // Nothing on the shelf: contributes nothing and is missing nothing.
    if (row.balanceState === BALANCE_STATE.NEVER_MOVED) continue
    if (row.balanceState === BALANCE_STATE.EMPTY) continue

    // Stock present, recorded as worth nothing. Held out AND counted.
    if (row.needsAttention) {
      unvaluedRows.push(row)
      continue
    }

    // A negative balance has no average at all; it is not unvalued stock, it
    // is stock that is not there. Reported by its own badge, not here.
    if (row.costState === COST_STATE.NONE) continue

    total += row.balanceBase * row.avgCost
  }

  return { total, unvaluedProducts: unvaluedRows.length, unvaluedRows }
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

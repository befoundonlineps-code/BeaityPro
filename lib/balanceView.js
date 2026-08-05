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

// Newest problems first: a person opening this screen is looking for what is
// wrong, not for an alphabet. Within each group the order is the catalogue's.
export function sortBalanceRows(rows) {
  const rank = (row) => {
    if (row.needsAttention) return 0
    if (row.balanceState === BALANCE_STATE.NEGATIVE) return 1
    if (row.lowSupply) return 2
    if (row.balanceState === BALANCE_STATE.NEVER_MOVED) return 4
    return 3
  }
  return [...(rows || [])].sort((a, b) => rank(a) - rank(b))
}

import { balanceRows, BALANCE_STATE } from './balanceView'

// The catalogue's "remaining here" column, for one storage or for all of them.
//
// ⚠️ IT DELEGATES RATHER THAN RE-DERIVES. balanceView.js decides three things
// that must not be decided twice — an archived product WITH stock is shown,
// "never moved" is not "zero", and NULL is not "zero" — and its header says
// the fork is being prevented BEFORE it is born. A balance computed here from
// `balances` directly would be that fork, arriving through a screen instead of
// through a copy-paste.
//
// So the single-storage case is balanceRows verbatim, and the all-storages case
// is a MERGE of what balanceRows already said about each one.
export const ALL_STORAGES = null

// Every storage that appears in the balance rows.
//
// ⚠️ Derived from the data rather than taken from the storages list, on
// purpose: a balance row for a storage that is not in the list still has to be
// counted, or the total silently omits stock that exists. The opposite mistake
// — a storage with no rows — costs nothing, because it contributes nothing.
function storageIdsIn(balances) {
  return [...new Set((balances || []).map((b) => b.storage_id))]
}

// One row per product, keyed by product id.
//
// ⚠️ A Map and not an array: the table already walks the tree's own grouping,
// and handing it a second ordered list would make two orders that can disagree.
// The caller asks per product and the order stays the tree's.
export function catalogueBalanceRows({ balances, products, storageId = ALL_STORAGES }) {
  if (storageId) {
    return new Map(
      // ✅ lowSupply passes through now. It was suppressed while the GRAIN of
      // the threshold was undecided; the owner decided it — the product's total
      // across every storage — and balanceView computes exactly that, once, for
      // every screen. There is nothing left here to disagree with.
      balanceRows({ balances, products, storageId }).map((row) => [row.product.id, row])
    )
  }

  // 🔴 SEEDED WITH EVERY PRODUCT AS NEVER-MOVED BEFORE ANY STORAGE IS FOLDED
  // IN, and the seed is not tidiness — without it the map was EMPTY whenever
  // `balances` was, because the fold walks the storages found IN the balance
  // rows and there were none.
  //
  // ⚠️ Measured: two products in, zero rows out. And the failure is the quiet
  // kind — every cell drew BLANK rather than «ما تحرّك بعد», so a salon with no
  // movements yet, or a page whose balances had not arrived, saw a column that
  // looked broken instead of one saying the true thing. It is the state this
  // column exists to distinguish, lost in the case where it is the only state
  // there is.
  //
  // ⚠️ And it was found by writing the render test, not by the test failing —
  // the row-count assertion passes either way, because a blank cell is still a
  // drawn row.
  const merged = new Map()
  for (const row of balanceRows({ balances: [], products, storageId: null })) {
    merged.set(row.product.id, { ...row })
  }

  for (const id of storageIdsIn(balances)) {
    for (const row of balanceRows({ balances, products, storageId: id })) {
      const soFar = merged.get(row.product.id)
      if (!soFar) { merged.set(row.product.id, { ...row }); continue }

      // ⚠️ null + n is n, not null. A product that never moved in THIS storage
      // and holds stock in that one has a balance; treating the null as zero
      // is right here and wrong in balanceRows, which is why the two are
      // separate places.
      const total = (soFar.balanceBase ?? 0) + (row.balanceBase ?? 0)
      const everMoved = soFar.balanceBase !== null || row.balanceBase !== null

      merged.set(row.product.id, {
        ...soFar,
        balanceBase: everMoved ? total : null,
        balanceState: stateOf(everMoved, total),
        // ⚠️ NOT RE-COMPUTED. Every per-storage row already carries the SALON's
        // answer — balanceView compares the threshold against the product's
        // total across storages — so all of them agree and taking either is
        // taking the same number. Re-deriving it here would be the second copy.
        lowSupply: soFar.lowSupply || row.lowSupply,
        needsAttention: soFar.needsAttention || row.needsAttention,
      })
    }
  }
  return merged
}

function stateOf(everMoved, total) {
  if (!everMoved) return BALANCE_STATE.NEVER_MOVED
  if (total < 0) return BALANCE_STATE.NEGATIVE
  if (total === 0) return BALANCE_STATE.EMPTY
  return BALANCE_STATE.IN_STOCK
}

// ⚠️ THE LOW-SUPPLY SIGNAL IS SILENT IN THIS COLUMN IN BOTH MODES, AND THE
// FIRST VERSION SILENCED THE WRONG ONE.
//
// It silenced the merged view and kept the per-storage one, arguing that the
// two readings answer different questions and a badge must not change meaning
// with a dropdown. The shape of that argument is fine. It misses a fact about
// the schema that points one way:
//
//     low_supply_units is a column on PRODUCTS. One grain: one per product.
//     No per-(product, storage) threshold exists — 080_1b listed every column
//     of all three tables.
//
// ⇒ So comparing a number whose grain is the PRODUCT against ONE STORAGE's
// balance is the claim the data cannot carry: the same n judges a cabin
// holding a small working stock and the main storage. The comparison whose
// grain MATCHES is the sum across storages — "the salon is running low",
// which is what a reorder point is for.
//
// ⚠️ WHICH MEANS THE ONE MODE WHERE THE NUMBER IS WELL DEFINED IS THE MODE THE
// FIRST VERSION SILENCED, and the modes where it over-claims are the ones it
// showed.
//
// The other reading is open too: if the badge is meant for the SHELF ("restock
// this cabin"), then the schema is missing a per-storage threshold and the
// correct silence is the opposite one. Either way, a split that shows it in
// one mode and hides it in the other HIDES THE QUESTION instead of posing it.
//
// ⇒ So this column says nothing in either mode, and what is deferred is named
// exactly: THE GRAIN OF THE THRESHOLD HAS NEVER BEEN DECIDED. Not "the data is
// test data" — that was the first version's reason and it was the weaker one.
//
// 🔴 AND THE SAME MISMATCH IS ALREADY SHIPPING: StorageBalances.js:263 draws
// this badge per storage, off balanceView.js:159 comparing a product-grain
// threshold to one storage's balance. That is the second site of one fault,
// and it is NOT changed here — it ships, the decision is the owner's, and
// altering a live screen on the way past is not this file's business. What
// this file can do is decline to become the third site.
export const LOW_SUPPLY_GRAIN = 'undecided — product-grain threshold, per-storage balances'

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
      balanceRows({ balances, products, storageId }).map((row) => [row.product.id, row])
    )
  }

  const merged = new Map()
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
        // ⚠️ NOT MERGED, AND THE REASON IS A DECISION RATHER THAN AN OVERSIGHT
        // — see lowSupplyAcrossStorages below.
        lowSupply: false,
        needsAttention: false,
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

// ⚠️ WHY THE LOW-SUPPLY SIGNAL IS NOT SHOWN WHEN ALL STORAGES ARE SELECTED, and
// this is an OPEN DECISION recorded rather than a rule settled.
//
// low_supply_units is one number on the product, and stock sits in several
// storages. Two readings, and they disagree about real rows:
//
//   per storage  "this shelf is running low"   → fires in the cabin that is
//                                                 nearly empty while the main
//                                                 storage is full
//   across all   "the salon is running low"     → stays quiet in that case
//
// Neither is wrong; they answer different questions. And a badge that means
// one thing in one dropdown position and another thing in the next is the
// fault this project keeps naming — a screen that reads differently depending
// on state nobody is looking at.
//
// So in the merged view it is silent, which claims nothing, rather than
// picking a meaning nobody chose. The per-storage view keeps the signal
// balanceRows already computes.
//
// ⚠️ And nothing can be measured to settle it: 083 established that these rows
// are test rows, and low_supply_units is null on all eight anyway — so there
// is not even one real threshold to reason from. It waits for a working salon.
export const lowSupplyAcrossStorages = 'open decision — see the comment above'

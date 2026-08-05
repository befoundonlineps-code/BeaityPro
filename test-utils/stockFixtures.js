// Stock fixtures, built from the invariant instead of typed out.
//
// ⚠️ WHY THIS IS A FILE AND NOT A FEW LINES IN A PROBE PAGE.
//
// The invariant `entered × factor === base` was enforced last round — inside
// the probe page, which is deleted before every commit. So the guard was born
// and died in the same round, and the next probe would have re-invented its
// fixtures with nothing carrying the rule across. Every other correction this
// session was about a guard's SCOPE; this one is about its LIFETIME.
//
// It lives here rather than in lib/ because nothing in the product imports it:
// only tests and the throwaway probe pages do, so it never enters a shipped
// bundle.
//
// ⚠️ AND WHAT IS MEASURED VERSUS WHAT IS INVENTED IS MARKED, because that
// distinction is the entire reason the file exists.

// The owner's real catalogue. Measured by him, 2026-08-05: all three products
// are `pcs`, with packaging factors 15, 1 and 1.
export const OWNER_PRODUCTS = [
  { id: 'p-cooler', name: 'مبرد ومهدئ ليزر', base_unit: 'pcs', units_per_package: 15 },
  { id: 'p-laser', name: 'مقشر ليزر', base_unit: 'pcs', units_per_package: 1 },
  { id: 'p-shampoo', name: 'شامبو 250 مل', base_unit: 'pcs', units_per_package: 1 },
]

// ⚠️ NOT the owner's. There is no ml or g product in his database at all —
// that is item 36, the branch real data has never woken. Anything drawn with
// this is a hypothesis about a case that has never existed, and saying so is
// the point: the previous probe put "تكلفة المل" on screen and it read exactly
// like measured behaviour.
export const HYPOTHETICAL_PRODUCTS = [
  { id: 'h-bottle', name: 'شامبو باللتر (افتراضي)', base_unit: 'ml', units_per_package: 1000 },
]

export const OWNER_STORAGES = [
  { id: 'stor-general', name: 'مستودع عام' },
  { id: 'stor-test', name: 'مستودع تجريبي' },
]
export const OWNER_SUPPLIERS = [{ id: 'sup-1', name: 'مورّد التجميل' }]

const byId = (products) => Object.fromEntries(products.map((p) => [p.id, p]))

// One movement, with base COMPUTED rather than accepted.
//
// A caller cannot produce "بالعبوة: 5 · بالقطعة: 3" here, which is what the
// hand-written fixture drew: 0.6 pieces per package, a state the entry screen
// refuses to create ("القطع ما بتتجزّأ"). The writer computes base from what
// was typed; so does this.
//
// `direction` is 1 for a receipt and -1 for an issue, matching stockLine: the
// sign is the document's, never the typist's.
export function movement({
  id, documentId, product, enteredPackages, unitCostPerBase,
  direction = 1, storageId = 'stor-general', products = OWNER_PRODUCTS,
  counterfactualNullCost = false,
}) {
  const found = typeof product === 'string' ? byId([...products, ...HYPOTHETICAL_PRODUCTS])[product] : product
  if (!found) throw new Error(`stockFixtures: unknown product ${product}`)

  const factor = Number(found.units_per_package)
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`stockFixtures: ${found.id} has no usable packaging factor`)
  }
  if (direction !== 1 && direction !== -1) {
    throw new Error('stockFixtures: direction must be 1 (receipt) or -1 (issue)')
  }
  // ⚠️ stock_movements.unit_cost is NOT NULL — measured in the schema. So a
  // fixture with no cost depicts a row the database cannot hold, which is the
  // exact fault this builder exists to prevent, just pointed at a constraint
  // instead of an arithmetic relation.
  //
  // The one legitimate use is the counterfactual that shows WHY the constraint
  // must stay: with a nullable column, sum() would skip the numerator term and
  // keep the denominator, dropping the average silently. That case must be
  // asked for by name.
  if ((unitCostPerBase === null || unitCostPerBase === undefined) && !counterfactualNullCost) {
    throw new Error(
      'stockFixtures: unit_cost is NOT NULL in the schema — pass counterfactualNullCost: true '
      + 'only to demonstrate why it must stay so'
    )
  }

  const base = enteredPackages * factor
  if (found.base_unit === 'pcs' && base !== Math.round(base)) {
    // The same refusal lib/stockDocument.js makes, kept here so a fixture
    // cannot depict a document the product would not accept.
    throw new Error(`stockFixtures: ${enteredPackages} × ${factor} = ${base}, and pieces do not divide`)
  }

  return {
    id,
    document_id: documentId,
    product_id: found.id,
    storage_id: storageId,
    entered_quantity: String(enteredPackages),
    entered_uom: 'package',
    quantity_base: String(direction * base),
    // numeric(_,4) is what the owner's rows display (50.0000 / 100.0000 /
    // 0.0000). Rounding here rather than at read time is what produced
    // 100.0005 on screen — item 35.
    unit_cost: unitCostPerBase === null ? null : Number(unitCostPerBase).toFixed(4),
  }
}

// Asserts the thing the whole file exists for, over any set of movements.
// Exported so a probe page can print it and a test can assert it.
export function fixtureIsConsistent(movements, products = OWNER_PRODUCTS) {
  const index = byId([...products, ...HYPOTHETICAL_PRODUCTS])
  const broken = []
  for (const m of movements) {
    const product = index[m.product_id]
    if (!product) { broken.push(`${m.id}: unknown product`); continue }
    const expected = Number(m.entered_quantity) * Number(product.units_per_package)
    if (Math.abs(Number(m.quantity_base)) !== expected) {
      broken.push(`${m.id}: |${m.quantity_base}| ≠ ${m.entered_quantity} × ${product.units_per_package}`)
    }
  }
  return broken
}

// ⚠️ The states the owner's database actually reached, which nobody would
// think to type: a negative balance, a reversed pair that cancels in both
// numerator and denominator, and an average that came out right AFTER being
// poisoned. The balance screen's fixtures are these, not rows somebody
// imagines.
//
// Measured from his rows on 2026-08-05.
export const OWNER_HISTORY = {
  // شامبو: poisoned at 0, reversed, re-posted at the real price.
  shampoo: {
    productId: 'p-shampoo',
    movements: [
      { enteredPackages: 10, unitCostPerBase: 0, direction: 1 },
      { enteredPackages: 10, unitCostPerBase: 0, direction: -1 },
      { enteredPackages: 20, unitCostPerBase: 50, direction: 1 },
    ],
    expected: { balance: 20, value: 1000, average: 50 },
  },
  // مقشر ليزر: the consignment product, same cycle.
  laser: {
    productId: 'p-laser',
    movements: [
      { enteredPackages: 10, unitCostPerBase: 0, direction: 1 },
      { enteredPackages: 10, unitCostPerBase: 0, direction: -1 },
      { enteredPackages: 5, unitCostPerBase: 100, direction: 1 },
    ],
    expected: { balance: 5, value: 500, average: 100 },
  },
  // مبرد ومهدئ ليزر: transferred out of the general storage and never
  // received into it, so its balance there is NEGATIVE. This is the row the
  // stocktake screen will show as "recorded" on its first run.
  cooler: {
    productId: 'p-cooler',
    movements: [
      { enteredPackages: 5, unitCostPerBase: 6.6667, direction: -1 },
    ],
    expected: { balance: -75, value: -500.0025, average: 6.6667 },
  },
}

// A stocktake adjustment, which is the ONE movement type where the two columns
// are not two views of one number.
//
// ⚠️ Everywhere else `entered × factor === base`. post_stocktake writes
// `v_diff := v_counted - v_balance` into quantity_base, and puts whatever the
// caller passed into entered_quantity — and it accepts either answer in
// silence. So the screen decides, and the decision is made here, before the
// screen exists:
//
//   pass the DIFF   → the invariant holds and the drawing is right, but the
//                     COUNTED NUMBER is stored nowhere. That is the one figure
//                     a human can check: "we counted and found 10" is a fact;
//                     "the adjustment was -5" is derived from it and from
//                     another number.
//   pass the COUNT  → the count survives, and every stocktake line draws
//                     "بالعبوة: 10 · بالقطعة: -5" — exactly the shape caught as
//                     a fixture defect two rounds ago, except produced by the
//                     function on every single stocktake.
//   pass NEITHER    → nothing is claimed that is not true. ← this one.
//
// The third is not a compromise, it is what the display already assumes:
// movementFrames returns entered: null for a movement nobody typed, and
// lib/stockDocumentList.test.js has pinned that since before the question was
// asked. The count is still not stored — that is a missing COLUMN, sibling to
// item 35's entered_unit_cost, and refusing to lie about it is not the same as
// solving it.
//
// ⚠️ One thing I cannot verify: whether stock_movements.entered_uom is
// nullable. If it is NOT, this shape is rejected by the database and the
// decision needs a schema change rather than a caller change.
export function stocktakeAdjustment({
  id, documentId, product, countedPackages, recordedBase, unitCostPerBase,
  storageId = 'stor-general', products = OWNER_PRODUCTS,
}) {
  const found = typeof product === 'string' ? byId([...products, ...HYPOTHETICAL_PRODUCTS])[product] : product
  if (!found) throw new Error(`stockFixtures: unknown product ${product}`)
  const factor = Number(found.units_per_package)
  const countedBase = countedPackages * factor
  if (found.base_unit === 'pcs' && countedBase !== Math.round(countedBase)) {
    throw new Error(`stockFixtures: ${countedPackages} × ${factor} = ${countedBase}, and pieces do not divide`)
  }
  return {
    id,
    document_id: documentId,
    product_id: found.id,
    storage_id: storageId,
    // v_diff := v_counted - v_balance
    quantity_base: String(countedBase - recordedBase),
    // Nobody typed a movement here; a count was typed and a difference derived.
    entered_quantity: null,
    entered_uom: null,
    unit_cost: unitCostPerBase === null ? null : Number(unitCostPerBase).toFixed(4),
  }
}

// product_balances, reproduced from the view's own text rather than from a
// description of it.
//
//   SELECT salon_id, storage_id, product_id,
//     sum(quantity_base) AS balance_base,
//     CASE WHEN sum(quantity_base) > 0
//          THEN sum(quantity_base * unit_cost) / sum(quantity_base)
//          ELSE NULL END AS avg_cost
//   FROM stock_movements GROUP BY salon_id, storage_id, product_id;
//
// ⚠️ Three things in that text that a paraphrase loses, and the balance screen
// depends on all three:
//
// 1. avg_cost is NULL whenever the balance is zero or negative. That is a
//    THIRD state beside a number and a zero — "does not apply", which is not
//    "free" (item 34) and not "unknown". Drawing it as 0 would collapse three
//    meanings onto one glyph.
// 2. FROM stock_movements GROUP BY means a product with NO movements has NO
//    ROW — item 27. "Never moved" is not "zero", and the view cannot tell you
//    the difference because it never saw the product.
// 3. SQL sum() SKIPS NULLs, and quantity_base * NULL is NULL. So a movement
//    with no unit_cost counts in the DENOMINATOR and not the numerator, which
//    silently drags the average down.
//
//    ⚠️ AND THE CASE THAT NEARLY GOT PAST ME: when EVERY movement has a NULL
//    cost, sum() over nothing is NULL — not 0 — so `NULL / 20` is NULL and the
//    view says "no average". My first version accumulated into 0 and returned
//    0, which is "free". That is the unknown-versus-free collapse (item 34),
//    written into the very function whose job is to preserve it.
//
//    A mutation did not find it: skipping a term and adding zero are the same
//    for a sum, so the mutation was unobservable. It surfaced only from asking
//    what the SQL does when there is nothing to sum — the case no test covered.
export function productBalances(movements) {
  const groups = new Map()
  for (const m of movements) {
    const key = `${m.storage_id}|${m.product_id}`
    if (!groups.has(key)) {
      groups.set(key, {
        storage_id: m.storage_id, product_id: m.product_id, qty: 0, valued: 0, anyCost: false,
      })
    }
    const group = groups.get(key)
    const quantity = Number(m.quantity_base)
    group.qty += quantity
    if (m.unit_cost !== null && m.unit_cost !== undefined) {
      group.anyCost = true
      group.valued += quantity * Number(m.unit_cost)
    }
  }
  return [...groups.values()].map(({ storage_id, product_id, qty, valued, anyCost }) => ({
    storage_id,
    product_id,
    balance_base: qty,
    // sum(...) is NULL when every term was NULL, and NULL / anything is NULL.
    avg_cost: qty > 0 && anyCost ? valued / qty : null,
  }))
}

// What the BALANCE SCREEN must draw — which is not what the view returns.
//
// ⚠️ TWO INDEPENDENT TRIPLES meet here, and naming only one of them was the
// gap. The cost triple we had: a number · 0 (free, or unknown — item 34) ·
// NULL (no average). The balance triple we had registered as item 27 and never
// connected to a display:
//
//   20        a computed balance
//   0         goods came in and went out — a REAL balance of zero
//   no row    never moved at all — the view never saw this product
//
// The view cannot express the third: `FROM stock_movements GROUP BY` means a
// product with no movements produces no row. So a product created today and
// not yet supplied is ABSENT from the screen — it looks like it does not
// exist. And filling it in with coalesce(balance, 0) is worse than absence: it
// says "you have zero of these", a sentence about a balance, when the truth is
// there is no balance because nothing ever entered. One means "it ran out,
// reorder"; the other means "it never arrived".
//
// ⚠️ AND THE CROSS-PRODUCT IS WHERE THE VALUE IS. A POSITIVE balance with a
// ZERO cost is stock that exists whose recorded worth is nothing — which is
// exactly what the owner's database held before the cleanup. So the balance
// screen is not a passive display: it is the first place poisoning is found
// without anybody looking for it, IF the states are distinguished, and the
// place that hides it if they are not.
export const BALANCE_STATE = {
  NEVER_MOVED: 'neverMoved',   // no row in the view at all
  EMPTY: 'empty',              // balance exactly 0 — moved in and out
  NEGATIVE: 'negative',        // issued before the receipt was recorded
  IN_STOCK: 'inStock',
}

export const COST_STATE = {
  NONE: 'noAverage',           // avg_cost NULL — balance <= 0, or never priced
  ZERO: 'zeroCost',            // a real 0 — free, or unknown (item 34)
  KNOWN: 'known',
}

export function balanceRowsForStorage({ storageId, products, movements }) {
  const balances = Object.fromEntries(
    productBalances(movements)
      .filter((b) => b.storage_id === storageId)
      .map((b) => [b.product_id, b])
  )

  return products.map((product) => {
    const row = balances[product.id]
    if (!row) {
      // The state the view cannot return, and the screen must still draw.
      return { product_id: product.id, balanceState: BALANCE_STATE.NEVER_MOVED, costState: COST_STATE.NONE }
    }
    const balanceState = row.balance_base > 0 ? BALANCE_STATE.IN_STOCK
      : row.balance_base < 0 ? BALANCE_STATE.NEGATIVE
        : BALANCE_STATE.EMPTY
    const costState = row.avg_cost === null ? COST_STATE.NONE
      : row.avg_cost === 0 ? COST_STATE.ZERO
        : COST_STATE.KNOWN
    return {
      product_id: product.id,
      balance_base: row.balance_base,
      avg_cost: row.avg_cost,
      balanceState,
      costState,
      // The one combination that should shout: goods on the shelf recorded as
      // worth nothing.
      needsAttention: balanceState === BALANCE_STATE.IN_STOCK && costState === COST_STATE.ZERO,
    }
  })
}

// Runs one OWNER_HISTORY entry into movements, so a screen can be drawn from
// the real sequence rather than from its summary.
export function historyMovements(key, documentId = 'doc-history') {
  const entry = OWNER_HISTORY[key]
  if (!entry) throw new Error(`stockFixtures: no history called ${key}`)
  return entry.movements.map((step, index) => movement({
    id: `${key}-${index + 1}`,
    documentId: `${documentId}-${index + 1}`,
    product: entry.productId,
    ...step,
  }))
}

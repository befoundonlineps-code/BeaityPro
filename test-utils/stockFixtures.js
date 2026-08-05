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

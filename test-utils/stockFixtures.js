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
  counterfactualNullCost = false, costIsEstimated = false,
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
    // NOT NULL DEFAULT false in the schema, so every row carries it. false
    // means "a person dictated this price, or a real average produced it" —
    // which is a claim, not an absence, and item 43's script is where the
    // truth of that claim for existing rows is being settled.
    cost_is_estimated: costIsEstimated,
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
  // مبرد ومهدئ ليزر: transferred out of the general storage into the test one.
  // BOTH sides, because the pair is the point — the general storage is at -75
  // and the test storage at +75, and summing them says zero.
  //
  // ⚠️ THE COST HERE WAS 6.6667 AND THAT WAS INVENTED, inside the constant
  // whose entire purpose is "measured, not supposed". 6.6667 is 100/15 — the
  // per-piece derivation of a package price of 100, which is a DISPLAY example
  // from item 35 (see lib/stockDocumentList.js). It leaked in here as if it
  // were a stored figure. Nothing caught it because no test asserted a cost on
  // this constant, only its quantities.
  //
  // It is 0, and 0 is the only value it could have been: this product has
  // never been received anywhere, so at transfer time transfer_stock found no
  // positive balance in the source, no earlier receipt, and no nominal price —
  // the chain ran out and coalesce(v_cost, 0) ended it. 6.6667 would have
  // meant the chain found something, which contradicts the very argument
  // item 34 was written from.
  //
  // cost_is_estimated is TRUE on both, which is what transfer_stock will stamp
  // once item 43's script runs: v_estimated = (source balance <= 0), and the
  // source balance was zero. The eight rows that predate the column carry
  // `false` by DEFAULT, and these two are among the four that default lies
  // about — item 43's Part 4 is the correction.
  //
  // ⚠️⚠️ THIS IS THE 2026-08-05 STATE AND IT IS NO LONGER HIS DATABASE. The
  // transfer was reversed on 2026-08-06, so the -75 is gone and both storages
  // sit at zero. It is kept because a negative balance is a state the code must
  // still handle correctly — reachable again any day — but it is a state we
  // CHOSE to keep, not a photograph of today.
  //
  // I predicted a number about his live database from this entry and got it
  // wrong: I said two balance rows would be flagged, and the measured answer
  // was zero. Nothing here computes incorrectly — this depicts two movements
  // and his database now holds four. The fault was reading a dated snapshot as
  // if it were current, which is the rule CLAUDE.md states about the docs
  // ("they point, the database decides") arriving through a fixture instead.
  //
  // coolerReversed below is the current state, and asserting both is what
  // makes the difference impossible to miss again.
  cooler: {
    productId: 'p-cooler',
    movements: [
      { enteredPackages: 5, unitCostPerBase: 0, direction: -1, storageId: 'stor-general', costIsEstimated: true },
      { enteredPackages: 5, unitCostPerBase: 0, direction: 1, storageId: 'stor-test', costIsEstimated: true },
    ],
    expected: { perStorage: { 'stor-general': -75, 'stor-test': 75 }, summed: 0 },
  },
  // مبرد ومهدئ ليزر AFTER the reversal — what his database holds today.
  //
  // ⚠️ The reversal writes its counterpart at the SAME storage_id as each
  // original movement (`-m.quantity_base` at `m.storage_id`), so the pair
  // cancels INSIDE each storage rather than across the two. That is why the
  // badge clears in both: Q_est and S_est are each zero per group. I had this
  // backwards and said the two flagged rows sat in different storages, which
  // is true of `cooler` above and false of the database.
  //
  // ⚠️ And a consequence that outlives this entry: the -75 the stocktake work
  // kept deferring no longer exists. The first real stocktake meets two
  // storages at zero, not a negative one.
  coolerReversed: {
    productId: 'p-cooler',
    movements: [
      { enteredPackages: 5, unitCostPerBase: 0, direction: -1, storageId: 'stor-general', costIsEstimated: true },
      { enteredPackages: 5, unitCostPerBase: 0, direction: 1, storageId: 'stor-test', costIsEstimated: true },
      { enteredPackages: 5, unitCostPerBase: 0, direction: 1, storageId: 'stor-general', costIsEstimated: true },
      { enteredPackages: 5, unitCostPerBase: 0, direction: -1, storageId: 'stor-test', costIsEstimated: true },
    ],
    expected: { perStorage: { 'stor-general': 0, 'stor-test': 0 }, summed: 0 },
  },
}

// A product's total across every storage — which is never returned as a bare
// number.
//
// ⚠️ THE OWNER'S ROWS ARE THE COUNTEREXAMPLE. مبرد ومهدئ ليزر is -75 in the
// general storage and +75 in the test one, reached by an ordinary transfer
// nobody got wrong. Two storages, both wrong, and the sum is a clean zero:
//
//   general  -75    a negative balance
//   test     +75    goods whose cost is unknown
//   ───────────
//   summed     0    "nothing to see"
//
// And the average vanishes with it: sum(qty × cost) / sum(qty) over a zero
// denominator is no average at all, so the screen would say "no data" about a
// product with two opposite faults.
//
// A zero in a SUM is worse than a zero on a line, because a line's zero says
// "free" or "unknown" while a sum's zero says "no problem" — the one meaning
// that must never be said here.
//
// So the total always travels with its composition, and the caller cannot
// accidentally show one without the other.
export function productTotalAcrossStorages({ productId, movements }) {
  const perStorage = productBalances(movements)
    .filter((b) => b.product_id === productId)
    .map(({ storage_id, balance_base, avg_cost }) => ({ storage_id, balance_base, avg_cost }))

  const total = perStorage.reduce((sum, row) => sum + row.balance_base, 0)
  const signs = new Set(perStorage.map((r) => Math.sign(r.balance_base)))
  return {
    total,
    perStorage,
    // True when the storages disagree in direction — the shape where a total
    // is actively misleading rather than merely incomplete.
    hidesOpposingBalances: signs.has(1) && signs.has(-1),
  }
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
// 4. cost_has_estimate asks whether the average SHOWN still depends on a
//    guessed price — and that is a question about the fraction, not about
//    whether a flagged row exists.
//
//    ⚠️ bool_or(cost_is_estimated) was the obvious expression and it is wrong,
//    caught in review before it ran. reverse_stock_document copies the flag
//    along with the number, so the cure the screen tells the owner to perform
//    — reverse it, post it again at the real price — leaves TWO flagged rows
//    in the group and bool_or stays true forever. The number becomes correct
//    and the badge says "do not trust it". A badge that never clears is a
//    badge on everything, which is the thing the supply branch of
//    post_stock_document was written to avoid.
//
//    avg = (S_real + S_est) / (Q_real + Q_est). The estimated rows change
//    nothing exactly when S_est = 0 AND Q_est = 0 — so the badge is
//    Q_est <> 0 OR S_est <> 0.
//
//    ⚠️ The quantity test alone is not enough, and this is the correction on
//    top of the reviewed proposal. A reversal pair cancels on both sums
//    (±q at the same cost), so quantity alone gets that case right. But an
//    estimated ISSUE at a non-positive balance and an estimated RECEIPT of the
//    same size (item 54's transfer out of an empty storage) also cancel on
//    quantity while their differing costs leave a residue in the numerator —
//    measured in the test named "quantities that cancel while the value does
//    not". Asking both sums has no such hole and needs no assumption about
//    which paths can produce a flagged row.
export function productBalances(movements) {
  const groups = new Map()
  for (const m of movements) {
    const key = `${m.storage_id}|${m.product_id}`
    if (!groups.has(key)) {
      groups.set(key, {
        storage_id: m.storage_id,
        product_id: m.product_id,
        qty: 0,
        valued: 0,
        anyCost: false,
        estQty: 0,
        estValued: 0,
      })
    }
    const group = groups.get(key)
    const quantity = Number(m.quantity_base)
    const estimated = m.cost_is_estimated === true
    group.qty += quantity
    // sum(quantity_base) FILTER (WHERE cost_is_estimated) does not skip a row
    // whose cost is NULL — only the product term does.
    if (estimated) group.estQty += quantity
    if (m.unit_cost !== null && m.unit_cost !== undefined) {
      group.anyCost = true
      group.valued += quantity * Number(m.unit_cost)
      if (estimated) group.estValued += quantity * Number(m.unit_cost)
    }
  }
  return [...groups.values()].map(({ storage_id, product_id, qty, valued, anyCost, estQty, estValued }) => ({
    storage_id,
    product_id,
    balance_base: qty,
    // sum(...) is NULL when every term was NULL, and NULL / anything is NULL.
    avg_cost: qty > 0 && anyCost ? valued / qty : null,
    cost_has_estimate: estQty !== 0 || estValued !== 0,
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

// ⚠️ AND THE FILTER IS BY BALANCE, NOT BY is_active.
//
// Measured: there is no trigger stopping a product with stock from being
// archived (products carries only trg_freeze_consignment_after_use). But the
// remedy is NOT the mirror of the storage guard, because the two cases are not
// mirrors:
//
//   an archived STORAGE  → its balance is UNREACHABLE. Every screen in the
//                          module is a storage first, so nothing can show it.
//                          Only the database can save that, hence the trigger.
//   an archived PRODUCT  → its balance is merely FILTERED. The storage is
//                          alive, the row is there, and a screen that chooses
//                          to show it, shows it.
//
// So a storage is an ACCESS problem and a product is a DISPLAY problem, and
// forcing somebody to write off three remaining bottles of a discontinued line
// is friction with nothing bought by it. "Archived" means "stop buying this",
// not "the shelf is empty".
//
//   A product whose balance is not zero is shown even when archived, marked.
//
// Three things follow with no extra work: it HEALS ITSELF (the balance runs
// out and the row disappears on its own — no cleanup, no trigger, no second
// decision); it SAVES THE STOCKTAKE, because an archived product sitting on
// the shelf must be countable, and a stocktake that hides it makes "I counted
// this storage" false BY CONSTRUCTION with nothing to reveal it (item 44 from
// its other side — there the ledger cannot record verification, here the
// verification cannot happen at all); and it keeps "archived" meaning what it
// says.
// The reorder threshold, or null when there is none.
//
// ⚠️ The unit is settled and needs no decision — unlike item 31. The product
// dialog's label interpolates the base unit explicitly
// (`lowSupplyLabel` with `units.${baseUnit}`), so the threshold is in base
// units and so is the balance, and the comparison is direct with no factor and
// no ambiguity. Said here because the resemblance to item 31 invites the
// assumption that it is the same problem, and it is not.
function lowSupplyThreshold(product) {
  const raw = product.low_supply_units
  if (raw === null || raw === undefined || String(raw).trim() === '') return null
  const threshold = Number(raw)
  return Number.isFinite(threshold) ? threshold : null
}

export function balanceRowsForStorage({ storageId, products, movements }) {
  const balances = Object.fromEntries(
    productBalances(movements)
      .filter((b) => b.storage_id === storageId)
      .map((b) => [b.product_id, b])
  )

  return products.flatMap((product) => {
    const row = balances[product.id]
    const archived = product.is_active === false
    // Archived AND nothing on the shelf: gone from the screen, and it got there
    // by itself the moment the balance reached zero.
    if (archived && (!row || row.balance_base === 0)) return []
    if (!row) {
      // The state the view cannot return, and the screen must still draw.
      return [{
        product_id: product.id,
        balanceState: BALANCE_STATE.NEVER_MOVED,
        costState: COST_STATE.NONE,
        archived,
        lowSupply: false,
        needsAttention: false,
      }]
    }
    const balanceState = row.balance_base > 0 ? BALANCE_STATE.IN_STOCK
      : row.balance_base < 0 ? BALANCE_STATE.NEGATIVE
        : BALANCE_STATE.EMPTY
    const costState = row.avg_cost === null ? COST_STATE.NONE
      : row.avg_cost === 0 ? COST_STATE.ZERO
        : COST_STATE.KNOWN
    return [{
      product_id: product.id,
      balance_base: row.balance_base,
      avg_cost: row.avg_cost,
      balanceState,
      costState,
      // ⚠️ A SECOND, INDEPENDENT alarm — never merged with needsAttention.
      //
      // low_supply_units is written by the product dialog and read by NOTHING
      // (measured: every occurrence in the repo is the form writing it, its
      // validation, the schema doc, or a test of the form). Its only possible
      // home is this screen, because nowhere else knows a balance to compare a
      // threshold against — and "what do I have?" is asked once while "what is
      // about to run out?" is asked daily.
      //
      // The two alarms say different things and must not share a glyph:
      //   needsAttention → its VALUE is unknown (stock at zero cost)
      //   lowSupply      → its QUANTITY is small
      // Collapsing them would rebuild exactly what this module spent itself
      // taking apart.
      //
      // ⚠️ An empty threshold is NOT zero. numberOrNull already stores it as
      // null (measured), so the data is right and only a screen could break it:
      // a product with no threshold is never alerted about, and is not treated
      // as though its threshold were 0.
      //
      // A NEVER_MOVED product is not flagged either, whatever its threshold —
      // "about to run out" is a restocking signal about something you stock,
      // and never-moved is already its own state.
      lowSupply: lowSupplyThreshold(product) !== null
        && row.balance_base <= lowSupplyThreshold(product),
      // Shown BECAUSE it still has stock, and labelled so nobody reads its
      // presence as "still on sale".
      archived,
      // The one combination that should shout: goods on the shelf recorded as
      // worth nothing.
      needsAttention: balanceState === BALANCE_STATE.IN_STOCK && costState === COST_STATE.ZERO,
    }]
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

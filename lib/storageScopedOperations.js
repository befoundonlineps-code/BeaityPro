// Which toolbar operations need a storage chosen, and which do not.
//
// The products toolbar has to grey out the operations that cannot run against
// "all storages". The question was answered from memory three times in one
// review and answered wrongly twice — the RULE was right every time, and the
// LIST derived from it was not. So the list is no longer written: an operation
// declares the table it writes into, and being storage-scoped is read off that
// table's schema.
//
// ⚠️ AND A MAP IS STILL A CLAIM. Moving six scattered names into one named
// constant makes the claim easier to find, not truer — and a concentrated claim
// is easier to believe, which makes it more dangerous rather than less. Adding
// `storage_id NOT NULL` to product_orders tomorrow would leave this file
// confidently wrong: the button would light, the insert would fail at the
// database, and nothing here would have complained.
//
// That is what storageScopedOperations.test.js is for. It reads the creation
// scripts in docs/sql and refuses a mismatch, so this map cannot drift from the
// schema without something failing. The map does not know the schema; the test
// stops it from contradicting it.

// The table each operation ultimately writes a row into. `null` means it writes
// no stock row at all — a reading or an administration screen.
export const OPERATION_TABLE = {
  order: 'product_orders',
  supply: 'stock_documents',
  write_off: 'stock_documents',
  return_to_supplier: 'stock_documents',
  transfer: 'stock_documents',
  stocktake: 'stocktake_sessions',
  opening: 'stock_documents',
  documents: null,
  prices: null,
  suppliers: null,
}

// Whether a row in that table is meaningless without a storage — and WHERE THAT
// IS KNOWN FROM.
//
// ⚠️ THE `evidence` FIELD EXISTS BECAUSE THE ENTRIES ARE NOT EQUALLY KNOWN AND
// USED TO LOOK IT. Two of them are read out of a creation script by the test.
// The third is not: stock_documents predates docs/sql, so its NOT NULL is
// asserted in DATABASE_DIAGRAM and passed through the guard rather than checked
// by it — and it is the entry that greys FIVE of the six operations.
//
// A guard sitting beside a map makes every line in it look verified, which is
// the same fault as a partially guarded design token reading as fully guarded.
// So the line says which it is, and whoever edits it knows whether the test is
// protecting them or their own attention is.
//
//   'script'   — read from a create table block in docs/sql, asserted by the test
//   'document' — asserted in DATABASE_DIAGRAM, and asked of the live database by
//                the named survey. The test checks only that no script exists,
//                so this cannot stay 'document' after one appears.
export const TABLE_STORAGE_SCOPE = {
  stock_documents: {
    needsStorage: true,
    evidence: 'document',
    // ⚠️ Not run at the time of writing — the file is the question, and
    // docs/sql/README.md is where its answer goes.
    survey: '067_2_doc_types_and_storage_columns.sql',
  },
  stocktake_sessions: { needsStorage: true, evidence: 'script' },   // 054a
  product_orders: { needsStorage: false, evidence: 'script' },      // 053a
}

// Kept as a plain boolean map for callers that only need the answer, derived so
// the two can never disagree.
export const TABLE_NEEDS_STORAGE = Object.fromEntries(
  Object.entries(TABLE_STORAGE_SCOPE).map(([table, v]) => [table, v.needsStorage])
)

// ⚠️ `opening` is in the scoped set and was left out of it twice by hand. It is
// a stock document like the other four, so storage_id is NOT NULL on its row
// too — the rule covers it whether or not anyone remembers to list it. It sits
// apart in the toolbar because it is a once-per-storage action, not because it
// behaves differently here.
export function isStorageScoped(operationId) {
  const table = OPERATION_TABLE[operationId]
  return table ? TABLE_NEEDS_STORAGE[table] === true : false
}

// ⚠️ THIS IS NOT THE TOOLBAR ANY MORE, AND THE HEADING SAID IT WAS.
//
// It reads «the toolbar's own order» and that stopped being true when the
// products screen was converted to the reference: the band is built from
// lib/productsOperations.js now, whose names are the URL's (`orders`,
// `write_off`) rather than this file's (`order`, `opening`, `prices`).
//
// ⇒ What this actually is, and always was underneath: THE GROUPING OF
// OPERATIONS BY WHAT THEY WRITE. The heading was describing where it happened
// to be drawn.
//
// 🔴 AND THE CLAUSE THAT USED TO FINISH THAT SENTENCE IS NOW FALSE — «even
// though it is the only one that stays lit at all storages». It is not lit any
// more: lib/storageScope.js puts `orders` in NEEDS_REAL_STORAGE, because the
// order screen was rebuilt to the reference and its first window asks which of
// THIS storage's folders to order from.
//
// ⚠️ Struck out rather than quietly deleted, because the sentence below it
// predicted the wrong trigger: «the button would move the day product_orders
// gained a storage column». product_orders gained NO column — the row is
// unchanged and isStorageScoped('order') is still false — and the button moved
// anyway. What changed was what the SCREEN needs to draw, which no schema
// question was ever going to catch.
//
// A comment that names a screen goes stale when the screen moves; one that
// names a rule does not.
//
// The grouping, which means WHAT THE OPERATION WRITES and never what its
// state happens to be today.
//
// `order` sits with the operations because it is one — the first link in
// order -> supply. Grouping it with the navigation buttons instead would make
// the layout follow an implementation detail rather than what the thing is.
export const TOOLBAR_GROUPS = [
  ['order', 'supply', 'write_off', 'return_to_supplier', 'transfer', 'stocktake'],
  ['opening'],
  ['documents', 'prices', 'suppliers'],
]

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

// Whether a row in that table is meaningless without a storage.
//
// ⚠️ Every key here is checked against docs/sql by the test, except the ones
// named in NO_CREATION_SCRIPT there — and that exception list fails closed.
export const TABLE_NEEDS_STORAGE = {
  stock_documents: true,
  stocktake_sessions: true,
  product_orders: false,
}

// ⚠️ `opening` is in the scoped set and was left out of it twice by hand. It is
// a stock document like the other four, so storage_id is NOT NULL on its row
// too — the rule covers it whether or not anyone remembers to list it. It sits
// apart in the toolbar because it is a once-per-storage action, not because it
// behaves differently here.
export function isStorageScoped(operationId) {
  const table = OPERATION_TABLE[operationId]
  return table ? TABLE_NEEDS_STORAGE[table] === true : false
}

// The toolbar's own order, which means WHAT THE BUTTON DOES and never what its
// state happens to be today.
//
// `order` sits with the operations because it is one — the first link in
// order -> supply — even though it is the only one of the seven that stays lit
// at "all storages". A group of six greyed and one lit is not a layout problem;
// it is the true sentence: these are your actions, and six of them need a
// storage. Grouping it with the navigation buttons instead would make the
// layout follow an implementation detail, and the button would move the day
// product_orders gained a storage column.
export const TOOLBAR_GROUPS = [
  ['order', 'supply', 'write_off', 'return_to_supplier', 'transfer', 'stocktake'],
  ['opening'],
  ['documents', 'prices', 'suppliers'],
]

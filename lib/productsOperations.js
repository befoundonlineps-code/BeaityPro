import { navigationBlocked } from './storageScope'
import { VIEWS } from './productsView'

// Which operations the products screen offers, and where each one is launched
// from.
//
// 🔴 THE SET IS NOT NEW AND IS NOT BEING RE-DECIDED. It is exactly the views
// that lib/productsView.js already lists, minus the catalogue — because the
// catalogue stopped being one of them. It is the SCREEN now: the tree and the
// grid are the permanent background, and every other entry opens over it.
//
// ⇒ So this file answers one question the old bar did not have to: an operation
// is a MODAL, not a tab, and «which tab am I on» is no longer a question the
// products screen has.
//
// ⚠️ AND THE ORDER IS THE REFERENCE'S, WHICH IS NOT THE ONE WE HAD. The old bar
// put the directories first and the transfer seventh; the reference runs
// order → supply → transfer → write-off → return, then the counting, then the
// records. Nothing about our data prefers either, so the reference wins — that
// is the standing rule, and this is a case of it rather than an exception.
//
// ⚠️ ONE THING MOVED RATHER THAN VANISHED: `storages`. The reference has no
// toolbar button for it; it sits inside the storage box at the top left, as
// «Editing storages», beside the picker it edits. Same operation, same modal,
// launched from where the reference launches it. It is in ALL_OPERATIONS and
// out of TOOLBAR_OPERATIONS, and that split IS the statement.
export const TOOLBAR_OPERATIONS = [
  'orders',
  'supply',
  'transfer',
  'write_off',
  'return_to_supplier',
  'stocktake',
  // ⚠️ Beside the stocktake, because it is the stocktake read the other way
  // round: the sheet asks what is on the shelf, this asks what has been asked.
  // The reference has no equivalent, so it keeps the place our own bar argued
  // for.
  'coverage',
  'documents',
  'suppliers',
  // No reference equivalent either — the reference answers «what is left» with
  // columns in the catalogue grid instead of a screen. We have both: the
  // columns are there AND the screen says more (cost, estimate flags), so the
  // screen stays.
  'balances',
]

// Launched from the storage box rather than the toolbar, following the
// reference.
export const BOX_OPERATIONS = ['storages']

export const ALL_OPERATIONS = [...TOOLBAR_OPERATIONS, ...BOX_OPERATIONS]

// ⚠️ Two entries of the reference toolbar are DELETED rather than drawn empty,
// which is the owner's third standing rule: a button that does nothing makes
// the screen lie.
//
//   Set prices for products   we have SetPricesDialog, but it is the SERVICES
//                             price sheet — there is no product pricing screen
//                             and no product price document behind it
//   Fixed assets              nothing at all: no table, no column, no concept
//
// ⚠️ And the stocktake's caret goes with them. The reference opens a menu of
// three ways to count — by hand, by barcode reader, from an Excel file — and we
// have the first alone. A caret revealing one entry is a menu that lies about
// having a choice.
export const REFERENCE_ENTRIES_WITHOUT_DATA = [
  'setPricesForProducts',
  'fixedAssets',
  'stocktakeInputMethods',
]

// The label key for an operation — reused from the bar rather than retyped, so
// the modal's title and the button that opens it cannot say different things.
//
// ⚠️ A map and not a transformation, because the two vocabularies genuinely
// differ: the views are snake_case because they are URL values, and the
// translation keys are camelCase because they are JSON. A `toCamel()` would
// work today and break silently on the first view whose name has no underscore
// to convert — the failure would be a raw key on screen, which is exactly what
// lib/translationKeys.test.js exists to keep out.
export const OPERATION_LABEL_KEY = {
  orders: 'orders',
  supply: 'supply',
  transfer: 'transfer',
  write_off: 'writeOff',
  return_to_supplier: 'returnToSupplier',
  stocktake: 'stocktake',
  coverage: 'coverage',
  documents: 'documents',
  suppliers: 'suppliers',
  balances: 'balances',
  storages: 'storages',
}

// The address for an operation, and the one it has to be readable FROM.
//
// 🔴 THE MODAL CARRIES ITS STATE IN THE URL, AND THAT IS THE OWNER'S DECISION
// RATHER THAN A CONVENIENCE. Turning tabs into modals reintroduces the four
// faults the URL tab was built to fix — pressing «Products» in the main menu
// doing nothing, the back button skipping the whole section, no address to
// bookmark or send, and a reload dropping you on the catalogue. A modal held in
// component state has every one of them.
//
// ⚠️ The reference cannot answer this question. It is a Windows application: it
// has no address bar and no back button, so «what happens when you reload» is
// not a question its design ever had to have an opinion about. This is the
// first place where the reference is silent rather than different.
export function productsOperationFromQuery(raw) {
  return ALL_OPERATIONS.includes(raw) ? raw : null
}

// Whether an operation can be entered right now, and it is the SAME question
// the old bar asked — lib/storageScope.js, unchanged. An operation that writes
// or reads one storage cannot be opened while the lens says «all», because it
// would not fail: it would quietly resolve to the first live storage and let
// somebody count a shelf they never chose.
export function operationBlocked(op, lensStorageId) {
  return navigationBlocked(op, lensStorageId)
}

// ⚠️ Derived from VIEWS rather than restated, so the two cannot drift. Every
// operation must still be a view the page knows how to render — the modal
// changed where a screen is drawn, not which screens exist.
export const OPERATIONS_ARE_VIEWS = ALL_OPERATIONS.every((op) => VIEWS.includes(op))

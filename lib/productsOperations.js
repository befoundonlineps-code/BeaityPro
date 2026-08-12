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
// 🔴 AND THE LIST IS OURS AGAIN — IT WAS BRIEFLY SPLIT IN TWO AND REORDERED TO
// MATCH THE REFERENCE, AND BOTH OF THOSE OVERSTEPPED.
//
// The reference reaches these operations from a band of its own, so the band
// was rebuilt in its image: the order became order → supply → transfer →
// write-off → return, and `storages` moved out of the list entirely into a box
// beside the storage picker, «Editing storages», because that is where the
// reference puts it.
//
// ⇒ Both undone. What was asked for is the CONTENT AREA — the tree, the dense
// grid, the modal per operation. The bar above it keeps the product's existing
// design and is identical on every screen, so the reference has no authority
// over where its buttons sit or in what order. The order below is ours and
// carries its own reasons, in components/ProductsSecondaryBar.js.
//
// ⚠️ This file is now the SET and the ADDRESS; the bar is the order and the
// icons. Two files, two questions — and the test below compares this set
// against VIEWS so neither can quietly grow a member the other has never heard
// of.
// 🔴 `storages` IS LAUNCHED FROM THE CONTENT AREA, NOT FROM THE BAR — AND THIS
// SPLIT HAS BEEN MADE, UNMADE AND MADE AGAIN, WHICH IS WHY IT IS WRITTEN DOWN.
//
//   1. split, because the reference launches it from beside the storage picker
//   2. merged, because the bar is not being copied and the reference has no
//      authority over it
//   3. split again, because the owner named «طريقة الوصول لإدارة المستودعات»
//      among the things the CONTENT AREA replaces — and the content area is a
//      complete replacement, not a selective one
//
// ⚠️ The shape is identical in (1) and (3) and the authority is not. (1) was me
// reading a screenshot; (3) is a decision about where the boundary sits. Worth
// the four lines, because the next person to see a split with no reason beside
// it will merge it back for the same good reason I did.
export const BOX_OPERATIONS = ['storages']

export const OPERATIONS = [
  ...BOX_OPERATIONS,
  'suppliers',
  'orders',
  'supply',
  'write_off',
  'return_to_supplier',
  'transfer',
  'stocktake',
  'coverage',
  'documents',
  'balances',
]

// ⚠️ Kept as a name because three call sites read it and «all of them» is what
// they mean. It is not a second list.
export const ALL_OPERATIONS = OPERATIONS

// What the operations bar draws — everything the content area does not launch.
// Derived rather than listed, so an operation cannot fall out of both and
// become unreachable while every test keeps passing.
export const BAR_OPERATIONS = OPERATIONS.filter((op) => !BOX_OPERATIONS.includes(op))

// ⚠️ Two entries of the reference's own band have no data behind them, and are
// recorded here rather than drawn empty — the owner's third standing rule: a
// button that does nothing makes the screen lie.
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
//
// ⚠️ These stay written down even though the band is no longer being copied,
// because the QUESTION they answer outlives the band: somebody comparing our
// screen to the reference will notice two missing entries, and the useful
// answer is «no data» rather than «nobody looked».
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

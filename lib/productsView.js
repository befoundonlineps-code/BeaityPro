// Which tab of the products screen the URL is asking for.
//
// The tab is a query parameter rather than component state, and the reason is
// a bug rather than a preference: with every tab at the same address, the main
// menu's router.push('/products') was a push to the page you were already on,
// Next saw no navigation, and nothing happened. Somebody inside a sub-tab had
// no way out but the menu that would not answer. The browser's back button,
// bookmarking a tab, and surviving a reload all failed from the same cause.
//
// Out here rather than inline so the fallback can be tested. An unknown tab —
// hand-typed, renamed, or arriving from an old bookmark — resolves to the
// catalogue rather than rendering nothing, because a URL somebody mistyped
// should not be able to produce a blank screen.
export const DOCUMENT_VIEWS = ['supply', 'write_off', 'return_to_supplier', 'transfer']

export const VIEWS = ['catalog', 'storages', 'suppliers', ...DOCUMENT_VIEWS]

export function productsView(tab) {
  return VIEWS.includes(tab) ? tab : 'catalog'
}

// The query the address bar should carry for a tab.
//
// The catalogue is the bare address, so that the main menu's plain
// router.push('/products') lands on it and reads as "back to the start".
export function productsQuery(view) {
  return view === 'catalog' || !VIEWS.includes(view) ? {} : { tab: view }
}

export function isDocumentView(view) {
  return DOCUMENT_VIEWS.includes(view)
}

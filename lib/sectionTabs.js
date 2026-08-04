// Which sub-screen of a section the URL is asking for.
//
// ⚠️ The rule this exists to enforce, before the mechanism:
//
//   A sub-screen somebody can navigate TO lives in the URL.
//   Transient interaction state lives in the component.
//
// The test is one question: would a link to this be worth sending to somebody
// else? "The suppliers tab of the products screen" — yes. "The cancel step of
// the appointment dialog" — no, it has no meaning without the dialog that
// opened it. A form's inner step is the same: it belongs to an edit somebody
// is in the middle of, not to a place.
//
// ⚠️ Why it matters, measured rather than argued. The products screen kept its
// tab in component state, so every tab was the address /products. Pressing
// "Products" in the main menu does router.push('/products') — a push to the
// page you are already on. Next sees no navigation and does nothing, and
// somebody inside a sub-tab has no way out but the menu that will not answer.
// The owner then checked the services section and found the same: every screen
// under it reads localhost:3000/services, unchanged.
//
// Three more failures come free with the same cause, and go away with the same
// line: the back button skips the whole section instead of stepping between its
// tabs, no tab can be bookmarked or sent, and a reload drops you on the default
// one.
//
// Half-measures are worse than neither, and settings had one: a useEffect that
// read router.query.tab so other screens could deep-link in, while pressing a
// tab wrote nothing back. The address was right on arrival and a lie ever
// after.
export function sectionTab(tabs, raw, fallback = tabs[0]) {
  return tabs.includes(raw) ? raw : fallback
}

// The query a section's address should carry for a tab.
//
// The default tab is the bare address, so the main menu's plain
// router.push('/section') lands on it and reads as "back to the start". Any
// other tab names itself.
//
// `extra` keeps query parameters that are not the tab — a detail page's id, a
// filter somebody arrived with — because dropping them would make switching
// tabs quietly throw away what the URL was carrying.
export function sectionQuery(tabs, value, { fallback = tabs[0], extra = {} } = {}) {
  const tab = sectionTab(tabs, value, fallback)
  return tab === fallback ? { ...extra } : { ...extra, tab }
}

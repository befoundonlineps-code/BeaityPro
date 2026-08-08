import { sectionTab, sectionQuery } from './sectionTabs'

// The products section's tabs. The rule they follow — what belongs in the URL
// and what belongs in component state — is in lib/sectionTabs.js, which every
// section now shares.
export const DOCUMENT_VIEWS = ['supply', 'write_off', 'return_to_supplier', 'transfer']

// ⚠️ `stocktake` is NOT in DOCUMENT_VIEWS, and that is the same boundary
// stockDocumentForm keeps: it sends counts rather than movements, and its own
// function works the difference out under a lock. Folding it into the shared
// document screen would make `rows` mean two different things.
// ⚠️ `orders` is NOT in DOCUMENT_VIEWS either, and for a sharper reason than
// the stocktake's: an order writes no movement at all. It is a template that a
// supply is filled FROM, so folding it into the document screen would put a
// storage, a cost and a posting button on a thing that moves nothing.
export const VIEWS = ['catalog', 'storages', 'suppliers', 'orders', ...DOCUMENT_VIEWS, 'stocktake', 'coverage', 'documents', 'balances']

export function productsView(tab) {
  return sectionTab(VIEWS, tab)
}

export function productsQuery(view) {
  return sectionQuery(VIEWS, view)
}

// The four views that are one screen with a doc type rather than four screens.
export function isDocumentView(view) {
  return DOCUMENT_VIEWS.includes(view)
}

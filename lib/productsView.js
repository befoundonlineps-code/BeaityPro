import { sectionTab, sectionQuery } from './sectionTabs'

// The products section's tabs. The rule they follow — what belongs in the URL
// and what belongs in component state — is in lib/sectionTabs.js, which every
// section now shares.
export const DOCUMENT_VIEWS = ['supply', 'write_off', 'return_to_supplier', 'transfer']

export const VIEWS = ['catalog', 'storages', 'suppliers', ...DOCUMENT_VIEWS, 'documents', 'balances']

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

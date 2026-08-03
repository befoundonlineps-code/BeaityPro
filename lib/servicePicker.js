import { buildServiceTree, BUSINESS_TYPES } from './serviceTree'
import { visibleCategories } from './categoryVisibility'

// The folder list a booking picks a service out of.
//
// The same tree the services page draws, built from whatever list of services
// it is handed rather than from the whole catalogue. That matters: the
// booking dialog has already narrowed services to the ones the chosen
// professional's role covers, and rebuilding the tree from the catalogue
// would put back the folders that narrowing just removed.
//
// Every business type is passed through for the same reason. Type is how the
// services page decides which folders a salon offers at all; here the list
// arriving has been filtered already, so filtering a second time on a
// different axis could only ever take away something the caller meant to
// keep.
// Archived folders are filtered here rather than at the call site, so a
// booking can never offer a service out of one by forgetting to ask.
export function servicePickerTree(categories, services) {
  return pruneEmpty(buildServiceTree(visibleCategories(categories), services, BUSINESS_TYPES))
}

// A folder with nothing in it is noise in a picker, even though it is real on
// the services page — there it is somewhere to add a service to, here it is a
// row that cannot be picked.
export function pruneEmpty(tree) {
  return (tree || [])
    .map((root) => ({
      ...root,
      children: (root.children || []).filter((sub) => (sub.services || []).length > 0),
    }))
    .filter((root) => (root.services || []).length > 0 || root.children.length > 0)
}

// Search narrows to services by name and keeps whichever folders still hold
// one. Folder names are deliberately not matched: typing "hair" to be shown
// every service in a folder called "hair" reads as a search that ignored what
// was typed, and the folder is one press away regardless.
export function filterServiceTree(tree, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return tree || []
  const match = (s) => (s.name || '').toLowerCase().includes(q)

  return pruneEmpty(
    (tree || []).map((root) => ({
      ...root,
      services: (root.services || []).filter(match),
      children: (root.children || []).map((sub) => ({
        ...sub,
        services: (sub.services || []).filter(match),
      })),
    }))
  )
}

// Whether a service has a price worth printing.
//
// Zero counts as unpriced here, and that is a display rule rather than a
// claim about the data: every service in this database has a price, because
// the service form defaults it to 0 and always sends a number. There is no
// stored difference between "free" and "nobody has set this yet", so the
// screen answers the question the salon actually asks — is there a price to
// charge — and says so in words when there is not.
export function servicePriceState(service) {
  const price = Number(service?.price)
  if (!Number.isFinite(price) || price <= 0) return { known: false, price: null }
  return { known: true, price }
}

// What a booking is worth so far: the chosen service, and nothing else.
//
// Products and certificates are on the panel beside it but are shapes without
// tables behind them, so they contribute nothing and the total stays honest
// rather than pretending to be a basket.
export function bookingTotal(service) {
  const { known, price } = servicePriceState(service)
  return known ? price : 0
}

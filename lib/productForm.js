import { ACCOUNTING_DIRECTIONS } from './serviceForm'

// What the product window sends, and what it refuses to send.
//
// The same split serviceForm.js uses, and for the same reason: the payload has
// to be something a test can ask about. That one grew from five columns to
// thirteen with the write inline, and the point at which nobody could say what
// had been sent is the point it moved out.
//
// The accounting direction list is imported rather than restated. Two copies
// would be two things to keep in step, and the whole reason products carry
// this column is so reports can add their revenue to the services' — which
// they cannot do if the two lists drift.
export { ACCOUNTING_DIRECTIONS }

export const PRODUCT_UNITS = ['pcs', 'ml', 'g']
export const PRODUCT_KINDS = ['product', 'set']

const trimmedOrNull = (value) => {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

const numberOrNull = (value) => {
  const text = String(value ?? '').trim()
  return text === '' ? null : Number(text)
}

const nonNegativeOrNull = (value, key) => {
  const n = numberOrNull(value)
  if (n === null) return null
  return Number.isFinite(n) && n >= 0 ? null : key
}

// What pressing save should do — three answers, not two.
//
// A set turned back into a regular product loses its components: a product
// cannot have any, and the mirror foreign key on (set_product_id, set_kind)
// makes that structural rather than a house rule. So the save has a delete in
// it, and a delete somebody triggered by changing a dropdown gets asked about
// before it happens.
//
// It is out here rather than inline because the version that was inline was
// wrong in a way nothing could catch: it refused the save and said "remove the
// components first" while the person was looking at a component list they had
// just emptied, inside a section the kind switch had already hidden. It was
// reading the table and talking about the screen.
//
// Note what is NOT among the inputs: what the component list currently shows.
// Emptying it changes nothing here, because those rows are still in the table
// until a save removes them — and the count in the question is the count that
// will actually be deleted.
export function productSaveAction({ kind, isEdit, savedKind, componentCount, confirmed }) {
  const dropping = kind !== 'set' && !!isEdit && savedKind === 'set' && componentCount > 0
  if (!dropping) return 'save'
  return confirmed ? 'dropThenSave' : 'confirmDrop'
}

// Returns a translation key, or '' when the form is fit to send.
export function validateProductForm(values) {
  const v = values || {}
  const isSet = v.kind === 'set'

  if (!String(v.name ?? '').trim()) return 'products:productDialog.nameRequiredError'
  if (!v.categoryId) return 'products:productDialog.categoryRequiredError'

  if (!isSet) {
    const perPackage = Number(v.unitsPerPackage)
    if (!Number.isFinite(perPackage) || perPackage <= 0) {
      return 'products:productDialog.unitsPerPackageError'
    }

    if (v.sellByPortions) {
      const perPortion = numberOrNull(v.unitsPerPortion)
      if (perPortion === null || !Number.isFinite(perPortion) || perPortion <= 0) {
        return 'products:productDialog.portionSizeError'
      }
    }

    // The database says the same thing, and saying it here first is what turns
    // a refusal in Postgres English into a sentence beside the field it is
    // about.
    if (v.isConsignment && !v.supplierId) {
      return 'products:productDialog.consignmentSupplierError'
    }
  } else {
    const output = numberOrNull(v.portionOutput)
    if (output !== null && (!Number.isFinite(output) || output <= 0)) {
      return 'products:productDialog.portionOutputError'
    }
  }

  for (const [value, key] of [
    [v.packagePrice, 'products:productDialog.packagePriceError'],
    [v.portionPrice, 'products:productDialog.portionPriceError'],
    [v.purchasePrice, 'products:productDialog.purchasePriceError'],
    [v.lowSupplyUnits, 'products:productDialog.lowSupplyError'],
  ]) {
    if (nonNegativeOrNull(value, key)) return key
  }

  return ''
}

// Every column the form owns, always all of them.
//
// No key is ever omitted: a key missing from an update leaves the old value in
// the row, so clearing a barcode would report success and change nothing. That
// lesson was learned on services and the owner's fourth manual check exists to
// catch it — it is the only one of the six that fails silently.
//
// image_path is absent for the same reason it is absent from the service
// payload: the storage path contains the product id, which a new product does
// not have until it has been inserted.
export function productFormPayload(values) {
  const v = values || {}
  const isSet = v.kind === 'set'

  const base = {
    name: String(v.name ?? '').trim(),
    kind: isSet ? 'set' : 'product',
    accounting_direction: trimmedOrNull(v.accountingDirection),
    bar_code: trimmedOrNull(v.barCode),
    description: trimmedOrNull(v.description),
    sell_by_packages: v.sellByPackages !== false,
    package_price: numberOrNull(v.packagePrice),
  }

  // A set is a different shape, not a product with blanks. The reference drops
  // In Container, the purchase price, the low-supply threshold, the
  // abbreviation and consignment the moment the type changes — because a set
  // is never bought, only assembled from things that were. Sending stale
  // values for those would leave a product's old numbers attached to
  // something that cannot use them.
  if (isSet) {
    return {
      ...base,
      portion_output: numberOrNull(v.portionOutput),
      base_unit: 'pcs',
      units_per_package: 1,
      units_per_portion: null,
      sell_by_portions: false,
      portion_price: null,
      nominal_purchase_price: null,
      low_supply_units: null,
      abbreviation: null,
      part_of_actual_cost: false,
      is_consignment: false,
      supplier_id: null,
    }
  }

  return {
    ...base,
    portion_output: null,
    base_unit: PRODUCT_UNITS.includes(v.baseUnit) ? v.baseUnit : 'pcs',
    units_per_package: Number(v.unitsPerPackage),
    units_per_portion: v.sellByPortions ? numberOrNull(v.unitsPerPortion) : null,
    sell_by_portions: !!v.sellByPortions,
    portion_price: v.sellByPortions ? numberOrNull(v.portionPrice) : null,
    nominal_purchase_price: numberOrNull(v.purchasePrice),
    low_supply_units: numberOrNull(v.lowSupplyUnits),
    abbreviation: trimmedOrNull(v.abbreviation),
    part_of_actual_cost: v.partOfActualCost !== false,
    is_consignment: !!v.isConsignment,
    supplier_id: v.isConsignment ? (v.supplierId || null) : null,
  }
}

// A folder's payload. Smaller than a product's and the same rules apply.
export function productCategoryPayload(values) {
  const v = values || {}
  return {
    name: String(v.name ?? '').trim(),
    parent_id: v.parentId || null,
  }
}

export function validateProductCategory(values) {
  if (!String((values || {}).name ?? '').trim()) {
    return 'products:categoryDialog.nameRequiredError'
  }
  return ''
}

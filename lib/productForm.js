import { ACCOUNTING_DIRECTIONS } from './serviceForm'
import { dropAction } from './dropConfirm'

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
// Ticked for sale by the package, with the price box left empty.
//
// ⚠️ BLANK, NEVER ZERO — and the distinction is the one this module has paid
// for twice. Zero is a decision ("this one goes out free"); blank is an
// absence. Collapsing them is the same fault as `0 ₪` standing for an unknown
// cost, which cost_is_estimated exists to undo.
//
// ⚠️ And the default matters: sell_by_packages is `!== false`, so a NEW product
// is for sale by the package unless somebody says otherwise. A product bought
// only for internal use therefore has to have that box unticked — and that is
// the honest way to silence this question, because the box is the claim that it
// is ready to be sold that way.
export function missingPackagePrice({ sellByPackages, packagePrice } = {}) {
  const sells = sellByPackages !== false
  return sells && String(packagePrice ?? '').trim() === ''
}

// What pressing save should do — and now it can ask two different questions.
//
// ⚠️ THE ORDER IS FORCED, NOT CHOSEN: the drop question comes first because it
// is the only one where something is LOST. Answering it is answering about a
// deletion; the price question is about an omission, and nothing about the
// product changes either way. Asking about the smaller thing first would put a
// warning in front of a deletion.
//
// ⚠️ And the two answers are stored separately. One `confirmed` flag for both
// would let a yes given about deleting components count as a yes about saving
// with no price — a press about one state answering for another, which is the
// fault the header of dropConfirm.js already names.
//
// 🔴 THE PRICE QUESTION EXISTS BECAUSE THE DATABASE CANNOT ASK IT. Measured in
// 080_1: products_portion_check refuses sell_by_portions without a portion
// size, and there is NO equivalent for sell_by_packages without a price — in
// the schema OR in this file, which refused the first and said nothing about
// the second.
//
// ⚠️ AND A CHECK CONSTRAINT WOULD NOT FIX IT, which is why this is here and not
// in SQL: `CHECK (… OR package_price IS NOT NULL)` is satisfied by 0, and this
// project has already measured that exact escape — unit_cost is NOT NULL, an
// untouched box arrived as 0, 0 passed `v_cost >= 0`, and it poisoned an
// average. A constraint guards the RANGE; only the screen can see the box was
// empty. And `0 ₪` in front of an employee is worse than a blank: a blank makes
// her stop and ask, a zero reads as somebody's decision.
export function productSaveAction({
  kind, isEdit, savedKind, componentCount, confirmed,
  sellByPackages, packagePrice, priceConfirmed,
}) {
  const drop = dropAction({
    dropping: kind !== 'set' && !!isEdit && savedKind === 'set' && componentCount > 0,
    confirmed,
  })
  if (drop === 'confirmDrop') return 'confirmDrop'
  if (missingPackagePrice({ sellByPackages, packagePrice }) && !priceConfirmed) return 'confirmNoPrice'
  return drop
}

// What the set's component dropdown offers.
//
// Only real products. The database refuses a set inside a set structurally, so
// offering one would be offering a choice that was always going to be rejected.
//
// ⚠️ An archived product that is ALREADY a component stays on the list. Drop it
// and the <select> has a value matching no <option>, and a select like that
// shows its first option instead — which here reads "choose a product". So a
// set holding an archived shampoo opens claiming its first row has nothing
// selected, beside a quantity of 250. The state still carries the right id, so
// saving without touching it writes the right rows; but what the person is
// looking at is false, and the first touch of that dropdown turns the false
// picture into a real loss.
//
// The rescue has to live here rather than in the per-row filter that hides
// already-chosen products, because that filter runs on a list this one has
// already dropped the row from. Same fault and same fix as supplierChoices in
// lib/supplierForm.js.
export function componentChoices(products, { setId = null, selectedIds = [] } = {}) {
  const chosen = new Set(selectedIds)
  return (products || []).filter(
    (p) => p.kind !== 'set'
      && p.id !== setId
      && (p.is_active !== false || chosen.has(p.id))
  )
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

  // A price whose switch is off is dropped, both of them, the same way.
  //
  // ⚠️ This used to be true of the portion price and not the package price, and
  // the two answers were both defensible and could not both be right. The rule
  // is one rule: the field leaves the screen when its switch goes off, so a
  // value left in the row is a number nothing reads and nothing can show. A
  // later screen offering a package nobody can buy is the same fault as one
  // offering a portion nobody can buy.
  //
  // The cost is real and accepted: turning the switch back on starts the price
  // blank rather than restoring the old one. That is the honest half of the
  // trade — the row says what is true now, and nothing carries an opinion the
  // person cannot see.
  const sellByPackages = v.sellByPackages !== false
  const base = {
    name: String(v.name ?? '').trim(),
    kind: isSet ? 'set' : 'product',
    accounting_direction: trimmedOrNull(v.accountingDirection),
    bar_code: trimmedOrNull(v.barCode),
    description: trimmedOrNull(v.description),
    sell_by_packages: sellByPackages,
    package_price: sellByPackages ? numberOrNull(v.packagePrice) : null,
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

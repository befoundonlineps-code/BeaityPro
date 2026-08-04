import {
  validateProductForm, productFormPayload,
  validateProductCategory, productCategoryPayload,
  ACCOUNTING_DIRECTIONS, PRODUCT_UNITS, PRODUCT_KINDS,
} from './productForm'
import { ACCOUNTING_DIRECTIONS as SERVICE_DIRECTIONS } from './serviceForm'

const product = {
  name: '  شامبو مرطّب  ',
  categoryId: 'c1',
  kind: 'product',
  accountingDirection: 'hairdressing',
  baseUnit: 'ml',
  unitsPerPackage: '250',
  sellByPackages: true,
  packagePrice: '35',
  sellByPortions: true,
  unitsPerPortion: '50',
  portionPrice: '9',
  purchasePrice: '18.5',
  lowSupplyUnits: '100',
  abbreviation: ' شامبو ',
  barCode: ' 5901234 ',
  description: ' وصف ',
  partOfActualCost: true,
  isConsignment: false,
  supplierId: null,
}

describe('validateProductForm', () => {
  it('passes a filled product', () => {
    expect(validateProductForm(product)).toBe('')
  })

  it('refuses a blank name and a missing folder', () => {
    expect(validateProductForm({ ...product, name: '  ' }))
      .toBe('products:productDialog.nameRequiredError')
    expect(validateProductForm({ ...product, categoryId: null }))
      .toBe('products:productDialog.categoryRequiredError')
  })

  it('refuses a package that holds nothing', () => {
    for (const v of ['0', '-1', '', 'abc']) {
      expect(validateProductForm({ ...product, unitsPerPackage: v }))
        .toBe('products:productDialog.unitsPerPackageError')
    }
  })

  it('demands a portion size only when selling by portions', () => {
    expect(validateProductForm({ ...product, sellByPortions: true, unitsPerPortion: '' }))
      .toBe('products:productDialog.portionSizeError')
    expect(validateProductForm({ ...product, sellByPortions: false, unitsPerPortion: '' }))
      .toBe('')
  })

  it('demands a supplier for a consignment product', () => {
    // The database says the same thing. Saying it here first is what turns a
    // refusal in Postgres English into a sentence beside the field.
    expect(validateProductForm({ ...product, isConsignment: true, supplierId: null }))
      .toBe('products:productDialog.consignmentSupplierError')
    expect(validateProductForm({ ...product, isConsignment: true, supplierId: 's1' }))
      .toBe('')
  })

  it('refuses a negative price anywhere and allows a blank one', () => {
    for (const [field, key] of [
      ['packagePrice', 'products:productDialog.packagePriceError'],
      ['portionPrice', 'products:productDialog.portionPriceError'],
      ['purchasePrice', 'products:productDialog.purchasePriceError'],
      ['lowSupplyUnits', 'products:productDialog.lowSupplyError'],
    ]) {
      expect(validateProductForm({ ...product, [field]: '-1' })).toBe(key)
      expect(validateProductForm({ ...product, [field]: '' })).toBe('')
    }
  })

  it('checks a set against the set rules, not the product ones', () => {
    // A set has no package to hold anything, so unitsPerPackage must not be
    // demanded of it.
    const set = { name: 'طقم', categoryId: 'c1', kind: 'set', portionOutput: '1' }
    expect(validateProductForm(set)).toBe('')
    expect(validateProductForm({ ...set, portionOutput: '0' }))
      .toBe('products:productDialog.portionOutputError')
    expect(validateProductForm({ ...set, portionOutput: '' })).toBe('')
  })
})

describe('productFormPayload — a product', () => {
  const payload = productFormPayload(product)

  it('trims text and converts numbers', () => {
    expect(payload).toMatchObject({
      name: 'شامبو مرطّب',
      kind: 'product',
      base_unit: 'ml',
      units_per_package: 250,
      units_per_portion: 50,
      package_price: 35,
      portion_price: 9,
      nominal_purchase_price: 18.5,
      low_supply_units: 100,
      abbreviation: 'شامبو',
      bar_code: '5901234',
      accounting_direction: 'hairdressing',
    })
  })

  it('turns every blank optional into null, never an empty string', () => {
    const blank = productFormPayload({
      name: 'x', categoryId: 'c', kind: 'product', unitsPerPackage: '1',
      abbreviation: '', barCode: '  ', description: '', accountingDirection: '',
      packagePrice: '', purchasePrice: '', lowSupplyUnits: '',
    })
    for (const key of ['abbreviation', 'bar_code', 'description', 'accounting_direction',
      'package_price', 'nominal_purchase_price', 'low_supply_units']) {
      expect(blank[key]).toBeNull()
    }
  })

  it('drops the portion fields when portions are off', () => {
    // Leaving a stale portion size on a product that no longer sells by
    // portions would let a later screen offer a portion nobody can buy.
    const off = productFormPayload({ ...product, sellByPortions: false })
    expect(off.units_per_portion).toBeNull()
    expect(off.portion_price).toBeNull()
    expect(off.sell_by_portions).toBe(false)
  })

  it('drops the supplier when consignment is off', () => {
    const off = productFormPayload({ ...product, isConsignment: false, supplierId: 's1' })
    expect(off.supplier_id).toBeNull()
    expect(off.is_consignment).toBe(false)
  })

  it('always sends every column, so clearing a field clears it', () => {
    // A key left out of an update leaves the old value in the row. This is the
    // one the owner's fourth manual check exists to catch, because it is the
    // only failure of the six that is silent.
    const blank = productFormPayload({ name: 'x', kind: 'product', unitsPerPackage: '1' })
    for (const column of [
      'name', 'kind', 'accounting_direction', 'base_unit', 'units_per_package',
      'units_per_portion', 'sell_by_packages', 'package_price', 'sell_by_portions',
      'portion_price', 'nominal_purchase_price', 'low_supply_units', 'abbreviation',
      'bar_code', 'description', 'part_of_actual_cost', 'is_consignment', 'supplier_id',
      'portion_output',
    ]) {
      expect(Object.prototype.hasOwnProperty.call(blank, column)).toBe(true)
    }
  })

  it('never sends image_path, id, salon or category', () => {
    // The storage path needs the product id, which a new product does not have
    // until it exists. The rest belong to the caller.
    for (const key of ['image_path', 'id', 'salon_id', 'category_id']) {
      expect(Object.prototype.hasOwnProperty.call(payload, key)).toBe(false)
    }
  })

  it('falls back to pieces for an unknown base unit', () => {
    expect(productFormPayload({ ...product, baseUnit: 'crate' }).base_unit).toBe('pcs')
  })
})

describe('productFormPayload — a set is a different shape, not a product with blanks', () => {
  const set = productFormPayload({
    name: 'طقم العناية', categoryId: 'c1', kind: 'set',
    portionOutput: '2', packagePrice: '120', barCode: '999',
    // Everything below belongs to a product and must not survive the switch.
    unitsPerPackage: '250', unitsPerPortion: '50', sellByPortions: true,
    purchasePrice: '80', lowSupplyUnits: '5', abbreviation: 'طقم',
    isConsignment: true, supplierId: 's1', partOfActualCost: true,
  })

  it('keeps what a set has', () => {
    expect(set).toMatchObject({ kind: 'set', portion_output: 2, package_price: 120, bar_code: '999' })
  })

  it('clears everything a set cannot have, even when it was filled in', () => {
    // A set is never bought, only assembled from things that were. Carrying a
    // purchase price or a consignment supplier across the switch would leave a
    // product's numbers attached to something that cannot use them.
    expect(set.nominal_purchase_price).toBeNull()
    expect(set.low_supply_units).toBeNull()
    expect(set.abbreviation).toBeNull()
    expect(set.units_per_portion).toBeNull()
    expect(set.portion_price).toBeNull()
    expect(set.sell_by_portions).toBe(false)
    expect(set.is_consignment).toBe(false)
    expect(set.supplier_id).toBeNull()
    expect(set.part_of_actual_cost).toBe(false)
  })

  it('sends a units_per_package the CHECK will accept', () => {
    // The column is NOT NULL with CHECK > 0 whatever the kind, so a set still
    // has to carry a legal value rather than null.
    expect(set.units_per_package).toBe(1)
    expect(set.base_unit).toBe('pcs')
  })
})

describe('the product category payload', () => {
  it('trims the name and nulls a blank parent', () => {
    expect(productCategoryPayload({ name: '  مجلّد  ', parentId: '' }))
      .toEqual({ name: 'مجلّد', parent_id: null })
  })

  it('always sends parent_id, so moving a folder to the root actually moves it', () => {
    const payload = productCategoryPayload({ name: 'x' })
    expect(Object.prototype.hasOwnProperty.call(payload, 'parent_id')).toBe(true)
  })

  it('refuses a blank name', () => {
    expect(validateProductCategory({ name: '   ' })).toBe('products:categoryDialog.nameRequiredError')
    expect(validateProductCategory({ name: 'x' })).toBe('')
  })
})

describe('the shared lists', () => {
  it('uses the services’ accounting directions, not a copy', () => {
    // Two lists would drift, and reports could no longer add product revenue
    // to service revenue on the same departments — which is the only reason
    // products carry this column.
    expect(ACCOUNTING_DIRECTIONS).toBe(SERVICE_DIRECTIONS)
  })

  it('matches the database enums', () => {
    expect(PRODUCT_UNITS).toEqual(['pcs', 'ml', 'g'])
    expect(PRODUCT_KINDS).toEqual(['product', 'set'])
  })
})

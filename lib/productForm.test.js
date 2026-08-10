import fs from 'fs'
import path from 'path'
import {
  validateProductForm, productFormPayload, productSaveAction, componentChoices,
  validateProductCategory, productCategoryPayload, missingSalePrice,
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

describe('productSaveAction', () => {
  // A set being edited, with two components in the table.
  //
  // ⚠️ packagePrice is part of the fixture now, and it has to be: sell_by_packages
  // defaults to TRUE, so a fixture that omits the price is a product ticked for
  // sale with an empty price box — and every one of these cases would answer
  // 'confirmNoPrice' about a question that is not what they are testing.
  const converting = {
    kind: 'product', isEdit: true, savedKind: 'set', componentCount: 2, confirmed: false,
    packagePrice: '80',
  }

  it('just saves when nothing is being deleted', () => {
    expect(productSaveAction({ ...converting, kind: 'set' })).toBe('save')
    expect(productSaveAction({ ...converting, savedKind: 'product' })).toBe('save')
    expect(productSaveAction({ ...converting, componentCount: 0 })).toBe('save')
    expect(productSaveAction({ ...converting, isEdit: false })).toBe('save')
  })

  it('asks before deleting, and deletes once asked', () => {
    expect(productSaveAction(converting)).toBe('confirmDrop')
    expect(productSaveAction({ ...converting, confirmed: true })).toBe('dropThenSave')
  })

  // ── For sale by the package, with no price ──────────────────────────────
  //
  // The owner's decision, in their words: ask before saving, save on yes, and
  // on «تراجع» stay on the product screen. Not a refusal — "I will put the
  // price in later" is a real way of working; what it must not do is pass in
  // silence and turn up a week later in front of a customer.
  const plain = { kind: 'product', isEdit: false, savedKind: null, componentCount: 0, confirmed: false }

  it('asks when it is for sale by the package with an empty price', () => {
    expect(productSaveAction({ ...plain, packagePrice: '' })).toBe('confirmNoPrice')
    expect(productSaveAction({ ...plain, packagePrice: '   ' })).toBe('confirmNoPrice')
    expect(productSaveAction({ ...plain, packagePrice: undefined })).toBe('confirmNoPrice')
  })

  it('does not ask about a price of zero', () => {
    // 🔴 The distinction the whole module is built on. Zero is a decision —
    // this one goes out free — and blank is an absence. A confirmation that
    // treats them alike teaches people to click through it, and then it is
    // guarding nothing.
    expect(productSaveAction({ ...plain, packagePrice: '0' })).toBe('save')
    expect(productSaveAction({ ...plain, packagePrice: 0 })).toBe('save')
  })

  it('does not ask when it is not for sale by the package', () => {
    // Unticking the box is the honest way to silence the question: the box is
    // the claim that this is ready to be sold that way.
    expect(productSaveAction({ ...plain, sellByPackages: false, packagePrice: '' })).toBe('save')
  })

  it('asks about the portions path too, and names which one it is', () => {
    // 🔴 The first version asked about packages only, justified by "the
    // portions path has a completeness constraint and the packages path has
    // none". That compared a DIVISOR with a PRICE: units_per_package is NOT
    // NULL default 1 so it cannot go missing, units_per_portion can — hence
    // products_portion_check. On PRICES the schema is silent on both paths.
    //
    // So the question was never packages-versus-portions. It is whether "for
    // sale" may mean "for sale with no price named", and that does not care
    // which box was ticked.
    const noPackage = { sellByPackages: true, packagePrice: '', sellByPortions: false, portionPrice: '' }
    const noPortion = { sellByPackages: false, packagePrice: '', sellByPortions: true, portionPrice: '' }
    const neither = { sellByPackages: true, packagePrice: '', sellByPortions: true, portionPrice: '' }

    expect(missingSalePrice(noPackage)).toBe('package')
    expect(missingSalePrice(noPortion)).toBe('portion')
    expect(missingSalePrice(neither)).toBe('both')

    expect(productSaveAction({ ...plain, ...noPortion })).toBe('confirmNoPrice')
    expect(productSaveAction({ ...plain, ...neither })).toBe('confirmNoPrice')
  })

  it('says nothing about a portion price nobody is selling portions of', () => {
    // sell_by_portions defaults to false, so a blank portion price is the
    // ordinary state of almost every product. Asking about it would make the
    // question fire on nearly every save, and a question that always fires is
    // clicked through.
    expect(missingSalePrice({ sellByPackages: true, packagePrice: '45', portionPrice: '' })).toBe('')
  })

  it('has a message for each of the three, and they differ', () => {
    // Three fixed strings rather than one with a list interpolated into it —
    // an Arabic noun after {{…}} needs a case ending the template cannot know
    // (CLAUDE.md), and this is the same reason the fine fields ended up with
    // two messages instead of one.
    const dictionary = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'public', 'locales', 'ar', 'products.json'), 'utf8'),
    ).productDialog
    const keys = ['noPackagePriceConfirm', 'noPortionPriceConfirm', 'noSalePriceConfirm']
    for (const key of keys) expect(typeof dictionary[key]).toBe('string')
    expect(new Set(keys.map((k) => dictionary[k])).size).toBe(3)
  })

  it('saves once the question is answered', () => {
    expect(productSaveAction({ ...plain, packagePrice: '', priceConfirmed: true })).toBe('save')
  })

  it('withdraws the question when a price is typed, with no second press', () => {
    // Derived rather than stored, like the drop question. Typing a price after
    // the notice appears must not leave a warning standing about a state that
    // has gone.
    expect(productSaveAction({ ...plain, packagePrice: '', priceConfirmed: false })).toBe('confirmNoPrice')
    expect(productSaveAction({ ...plain, packagePrice: '45', priceConfirmed: false })).toBe('save')
  })

  it('asks about the deletion FIRST, because that is the one that loses data', () => {
    // ⚠️ Both questions can be pending at once — a set turned back into a
    // product, with components, and no price. The deletion is asked about
    // first: it is the only one where something goes away. Putting a warning
    // about an omission in front of a deletion would be the wrong order, and
    // whoever clicks through the first would be answering about the second.
    const both = { ...converting, packagePrice: '' }
    expect(productSaveAction(both)).toBe('confirmDrop')
    expect(productSaveAction({ ...both, confirmed: true })).toBe('confirmNoPrice')
    expect(productSaveAction({ ...both, confirmed: true, priceConfirmed: true })).toBe('dropThenSave')
  })

  it('keeps the two answers separate', () => {
    // One shared flag would let a yes about deleting components count as a yes
    // about saving with no price. Measured both ways round.
    const both = { ...converting, packagePrice: '' }
    expect(productSaveAction({ ...both, confirmed: true, priceConfirmed: false })).toBe('confirmNoPrice')
    expect(productSaveAction({ ...both, confirmed: false, priceConfirmed: true })).toBe('confirmDrop')
  })

  it('withdraws the question when the kind goes back to set', () => {
    // The confirmation has to stop applying the moment it stops describing
    // what will happen. Left standing, a yes given about deleting components
    // would still be sitting there after the conversion was called off — and
    // the strip on screen would be asking about a delete that is not going to
    // occur.
    expect(productSaveAction({ ...converting, confirmed: true, kind: 'set' })).toBe('save')
  })

  it('does not ask a second time once the components are gone', () => {
    // The delete lands and the product update fails: the rows are gone, the
    // count is zero, and pressing save again must go straight through rather
    // than asking about a deletion that already happened.
    expect(productSaveAction({ ...converting, confirmed: true, componentCount: 0 })).toBe('save')
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

  it('drops the package price when packages are off, for the same reason', () => {
    // The two switches were answered differently once — the portion price was
    // dropped and the package price survived — and both answers cannot be
    // right about the same thing. One rule: the field leaves the screen, so
    // the value leaves the row.
    const off = productFormPayload({ ...product, sellByPackages: false })
    expect(off.package_price).toBeNull()
    expect(off.sell_by_packages).toBe(false)
  })

  it('keeps each price while its own switch is on', () => {
    // The complement, so that "drop it" cannot be satisfied by dropping it
    // always — a payload that nulls both prices unconditionally passes the two
    // tests above and loses every price in the catalogue.
    const on = productFormPayload({ ...product, sellByPackages: true, sellByPortions: true })
    expect(on.package_price).toBe(35)
    expect(on.portion_price).toBe(9)
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

  it('always carries is_consignment and supplier_id in the SAME payload', () => {
    // ⚠️ products_consignment_supplier_check, measured in 080_1:
    //   CHECK ((NOT is_consignment) OR (supplier_id IS NOT NULL))
    //
    // So the two fields have to reach the database in ONE statement. A save
    // that wrote is_consignment = true first and the supplier second would be
    // refused by the CHECK, between two writes, with half the change applied.
    //
    // ⚠️ AND IT IS LIVE ON EXACTLY ONE PRODUCT TODAY: the freeze trigger
    // refuses flipping the flag on anything with a live movement, so seven of
    // eight are locked and «بلسم 250 مل» — zero movements — is the only one
    // that can become consignment. Which is precisely the row somebody will
    // try it on.
    //
    // productAdminIO.js:44 issues a single .update(payload) today, so this
    // holds. The risk is a later refactor splitting the save — and a sentence
    // in a header is not read by a refactor, which is why this is a test.
    for (const values of [
      { ...product, isConsignment: true, supplierId: 's1' },
      { ...product, isConsignment: false, supplierId: 's1' },
      { ...product, isConsignment: false, supplierId: '' },
      { ...product, kind: 'set' },
    ]) {
      const payload = productFormPayload(values)
      expect(Object.keys(payload)).toEqual(expect.arrayContaining(['is_consignment', 'supplier_id']))
    }
  })

  it('and the CHECK-refused shape is stopped by validation, not by the payload', () => {
    // ⚠️ THE CASE DELIBERATELY LEFT OUT ABOVE, because including it under the
    // claim "the payload can never be the shape the CHECK refuses" would have
    // been a false ✓ — the payload CAN be that shape:
    //
    //   supplier_id: v.isConsignment ? (v.supplierId || null) : null
    //
    // ticked with a blank supplier gives is_consignment = true and
    // supplier_id = null, which is exactly what
    // products_consignment_supplier_check refuses.
    //
    // ✅ It never reaches the database because validation refuses it first —
    // so the guard is real, and it is HERE and not in the payload builder.
    // Saying which layer holds it is the difference between a defence and a
    // coincidence, and this project has paid for that distinction once already
    // (a CHECK guards the RANGE and the screen guards the MEANING — a blank box
    // arriving as 0 passed `v_cost >= 0` and poisoned an average).
    const blank = { ...product, isConsignment: true, supplierId: '' }
    expect(validateProductForm(blank)).toBe('products:productDialog.consignmentSupplierError')

    const payload = productFormPayload(blank)
    expect(payload.is_consignment).toBe(true)
    expect(payload.supplier_id).toBeNull()
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

  it('clears portion_output on the way back, too', () => {
    // The reverse switch matters as much as the forward one: a set turned
    // back into a product would otherwise keep a portion output that nothing
    // reads, sitting in the row looking meaningful.
    const backToProduct = productFormPayload({
      name: 'x', categoryId: 'c1', kind: 'product', unitsPerPackage: '250',
      portionOutput: '2',
    })
    expect(backToProduct.portion_output).toBeNull()
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

describe('componentChoices', () => {
  const list = [
    { id: 'p1', name: 'شامبو', kind: 'product', is_active: true },
    { id: 'p2', name: 'بلسم مؤرشف', kind: 'product', is_active: false },
    { id: 's1', name: 'طقم', kind: 'set', is_active: true },
    { id: 'me', name: 'الطقم نفسه', kind: 'set', is_active: true },
  ]

  it('offers only live products, never a set and never itself', () => {
    expect(componentChoices(list, { setId: 'me' }).map((p) => p.id)).toEqual(['p1'])
  })

  it('keeps an archived product that is already a component', () => {
    // Dropping it leaves the <select> with a value no <option> matches, and a
    // select like that shows its first option — "choose a product". The row
    // would read as empty beside a quantity somebody typed.
    expect(componentChoices(list, { setId: 'me', selectedIds: ['p2'] }).map((p) => p.id))
      .toEqual(['p1', 'p2'])
  })

  it('does not resurrect an archived product nobody chose', () => {
    expect(componentChoices(list, { setId: 'me', selectedIds: ['p1'] }).map((p) => p.id))
      .toEqual(['p1'])
  })

  it('still refuses a set even when one is somehow already chosen', () => {
    // The mirror foreign key would reject it, so offering it would be offering
    // a choice that was always going to fail.
    expect(componentChoices(list, { setId: 'me', selectedIds: ['s1'] }).map((p) => p.id))
      .toEqual(['p1'])
  })

  it('survives no list and no options', () => {
    expect(componentChoices(null)).toEqual([])
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

import {
  validateStorage, storagePayload, responsiblesVisible, responsibleCounts, storageSaveAction,
  responsibleKey, responsibleRowFor,
  STORAGE_KINDS, FINE_BASES,
} from './storageForm'

const common = {
  name: '  المستودع الرئيسي  ',
  kind: 'common',
  ownerEmployeeId: null,
  packagesOnly: false,
  saleEnabled: true,
  saleByVolume: true,
  saleByPortion: true,
  saleByUnits: true,
  finePercent: '100',
  fineBasis: 'purchase_price',
}

describe('validateStorage', () => {
  it('passes a filled common storage', () => {
    expect(validateStorage(common)).toBe('')
  })

  it('refuses a blank name', () => {
    expect(validateStorage({ ...common, name: '   ' }))
      .toBe('products:storageDialog.nameRequiredError')
  })

  it('demands an owner for a professional storage, and only for one', () => {
    // storages_owner_matches_kind_check is an equivalence, so both halves are
    // refusals in the database: professional without an owner, and — through
    // the payload rather than here — common with one.
    expect(validateStorage({ ...common, kind: 'professional', ownerEmployeeId: null }))
      .toBe('products:storageDialog.ownerRequiredError')
    expect(validateStorage({ ...common, kind: 'professional', ownerEmployeeId: 'e1' }))
      .toBe('')
    expect(validateStorage({ ...common, kind: 'common', ownerEmployeeId: null })).toBe('')
  })

  it('refuses a fine outside 0–100, and a blank one', () => {
    for (const value of ['-1', '101', '', '  ', 'abc']) {
      expect(validateStorage({ ...common, finePercent: value }))
        .toBe('products:storageDialog.finePercentError')
    }
    for (const value of ['0', '100', '12.5']) {
      expect(validateStorage({ ...common, finePercent: value })).toBe('')
    }
  })

  it('refuses a kind or a fine basis that is not one of the enum values', () => {
    expect(validateStorage({ ...common, kind: 'warehouse' }))
      .toBe('products:storageDialog.kindRequiredError')
    expect(validateStorage({ ...common, fineBasis: 'retail' }))
      .toBe('products:storageDialog.fineBasisError')
  })
})

describe('storagePayload', () => {
  it('trims the name and converts the fine to a number', () => {
    expect(storagePayload(common)).toMatchObject({
      name: 'المستودع الرئيسي', kind: 'common', fine_percent: 100,
      fine_basis: 'purchase_price',
    })
  })

  it('drops the owner when the kind is common', () => {
    // The CHECK is an equivalence, so a stale owner left on a storage switched
    // back to common is refused outright rather than merely being untidy.
    const back = storagePayload({ ...common, kind: 'common', ownerEmployeeId: 'e1' })
    expect(back.owner_employee_id).toBeNull()
  })

  it('keeps the owner when the kind is professional', () => {
    expect(storagePayload({ ...common, kind: 'professional', ownerEmployeeId: 'e1' })
      .owner_employee_id).toBe('e1')
  })

  it('turns off all three unit switches when sale from storage is off', () => {
    // They are children on screen and have to be children in the row: leaving
    // them true under a parent that is off would let a later screen offer a
    // way to sell from a storage that does not sell.
    const off = storagePayload({ ...common, saleEnabled: false })
    expect(off.sale_enabled).toBe(false)
    expect(off.sale_by_volume).toBe(false)
    expect(off.sale_by_portion).toBe(false)
    expect(off.sale_by_units).toBe(false)
  })

  it('keeps the three independent while the parent is on', () => {
    const some = storagePayload({ ...common, saleByVolume: false, saleByPortion: true, saleByUnits: false })
    expect(some).toMatchObject({ sale_by_volume: false, sale_by_portion: true, sale_by_units: false })
  })

  it('always sends every column, so clearing a switch clears it', () => {
    const payload = storagePayload({ name: 'x', kind: 'common', finePercent: '0', fineBasis: 'sales_price' })
    for (const column of ['name', 'kind', 'owner_employee_id', 'packages_only', 'sale_enabled',
      'sale_by_volume', 'sale_by_portion', 'sale_by_units', 'fine_percent', 'fine_basis']) {
      expect(Object.prototype.hasOwnProperty.call(payload, column)).toBe(true)
    }
  })

  it('never sends image_path, id, salon or is_active', () => {
    for (const key of ['image_path', 'id', 'salon_id', 'is_active', 'sort_order']) {
      expect(Object.prototype.hasOwnProperty.call(storagePayload(common), key)).toBe(false)
    }
  })
})

describe('the responsible key', () => {
  it('reads an employee row and a role row apart', () => {
    expect(responsibleKey({ employee_id: 'e1', role: null })).toBe('employee:e1')
    expect(responsibleKey({ employee_id: null, role: 'hairdresser' })).toBe('role:hairdresser')
  })

  it('turns a key back into the exclusive-or the CHECK demands', () => {
    // (employee_id IS NOT NULL) <> (role IS NOT NULL): sending both, or
    // neither, is refused. The row built here has to null the other side
    // explicitly rather than leave it out, because an update leaving a key out
    // keeps the old value.
    expect(responsibleRowFor('employee:e1')).toEqual({ employee_id: 'e1', role: null })
    expect(responsibleRowFor('role:owner')).toEqual({ employee_id: null, role: 'owner' })
  })

  it('survives a round trip both ways', () => {
    for (const row of [{ employee_id: 'e1', role: null }, { employee_id: null, role: 'masseur' }]) {
      expect(responsibleRowFor(responsibleKey(row))).toEqual(row)
    }
  })

  it('gives a row naming neither a key of its own, so a save clears it', () => {
    // Whether the table forbids this is unverified — the exclusive-or CHECK is
    // a design claim nobody has read back, the composite key would let it
    // through because a NULL in a foreign key passes for free, and
    // unique(storage_id, employee_id) does not see two rows both NULL there.
    //
    // Keyed on its own id it can never match anything ticked, so the diff puts
    // it in the removals. Keyed the old way it became the literal string
    // "role:null", which round-trips into a role called "null" — a made-up
    // value written back into an enum column.
    expect(responsibleKey({ id: 'r9', employee_id: null, role: null })).toBe('orphan:r9')
    expect(responsibleKey({ id: 'r9', employee_id: null, role: undefined })).toBe('orphan:r9')
  })

  it('does not count a row that names nobody', () => {
    // It appears in neither list on screen, so a question saying "2 will be
    // removed" beside one name would be counting something nothing shows.
    expect(responsibleCounts([
      { id: 'r1', employee_id: 'e1', role: null },
      { id: 'r2', employee_id: null, role: null },
    ])).toEqual({ people: 1, roles: 0 })
  })
})

describe('responsiblesVisible', () => {
  it('hides the picker for a professional storage only', () => {
    // Not screen space: a storage that belongs to one person cannot have
    // somebody else answerable for what goes missing from it.
    expect(responsiblesVisible('professional')).toBe(false)
    expect(responsiblesVisible('common')).toBe(true)
  })
})

describe('responsibleCounts', () => {
  it('counts people and roles apart, never as one total', () => {
    // Two people named is two people. Two roles ticked is everybody in them
    // today and everybody hired into them next year, and a single number is
    // exactly what hides that.
    expect(responsibleCounts([
      { employee_id: 'e1', role: null },
      { employee_id: null, role: 'hairdresser' },
      { employee_id: null, role: 'owner' },
    ])).toEqual({ people: 1, roles: 2 })
  })

  it('survives no rows', () => {
    expect(responsibleCounts(null)).toEqual({ people: 0, roles: 0 })
  })
})

describe('storageSaveAction', () => {
  const switching = { kind: 'professional', isEdit: true, responsibleCount: 2, confirmed: false }

  it('just saves when nobody is losing their responsibility', () => {
    expect(storageSaveAction({ ...switching, kind: 'common' })).toBe('save')
    expect(storageSaveAction({ ...switching, responsibleCount: 0 })).toBe('save')
    expect(storageSaveAction({ ...switching, isEdit: false })).toBe('save')
  })

  it('asks before removing them, and removes once asked', () => {
    expect(storageSaveAction(switching)).toBe('confirmDrop')
    expect(storageSaveAction({ ...switching, confirmed: true })).toBe('dropThenSave')
  })

  it('withdraws the question when the kind goes back to common', () => {
    expect(storageSaveAction({ ...switching, confirmed: true, kind: 'common' })).toBe('save')
  })

  it('does not ask again once the rows are gone', () => {
    expect(storageSaveAction({ ...switching, confirmed: true, responsibleCount: 0 })).toBe('save')
  })
})

describe('the enums', () => {
  it('matches the database', () => {
    expect(STORAGE_KINDS).toEqual(['common', 'professional'])
    expect(FINE_BASES).toEqual(['purchase_price', 'sales_price'])
  })
})

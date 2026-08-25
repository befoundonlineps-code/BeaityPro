import { readFileSync } from 'fs'
import { join } from 'path'
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

  it('refuses a fine outside 0–100, but no longer refuses a blank one', () => {
    for (const value of ['-1', '101', 'abc']) {
      expect(validateStorage({ ...common, finePercent: value }))
        .toBe('products:storageDialog.finePercentError')
    }
    for (const value of ['0', '100', '12.5']) {
      expect(validateStorage({ ...common, finePercent: value })).toBe('')
    }
  })

  it('accepts both fine fields blank, and that is not the same as zero', () => {
    // ⚠️ The distinction this whole change exists for. 0 is a decision — record
    // the fine, charge nothing. Blank is the absence of one, and
    // post_stocktake_session refuses to fine on a shortage until it is made.
    // The screen used to pre-fill 100, so both live storages carry a wage
    // deduction of 100% that the owner said was written to fill the box.
    expect(validateStorage({ ...common, finePercent: '', fineBasis: '' })).toBe('')
    expect(validateStorage({ ...common, finePercent: '  ', fineBasis: '' })).toBe('')

    expect(storagePayload({ ...common, finePercent: '', fineBasis: '' }))
      .toMatchObject({ fine_percent: null, fine_basis: null })
    expect(storagePayload({ ...common, finePercent: '0', fineBasis: 'purchase_price' }))
      .toMatchObject({ fine_percent: 0, fine_basis: 'purchase_price' })
  })

  it('refuses one fine field without the other, and names the empty one', () => {
    // ⚠️ Both directions, because a half-set policy reads as a decision on
    // screen and behaves as its absence in the database — post_stocktake_session
    // refuses on `percent is null OR basis is null`, so either half alone buys
    // nothing and hides which state the row is in.
    //
    // ⚠️ AND A DIFFERENT KEY PER DIRECTION, which one shared message got wrong
    // in front of the owner: it explained "a percentage with no basis" while he
    // had chosen a basis and left the percentage empty. The refusal was right
    // and the reason shown was not its reason. Two keys make that impossible
    // rather than careful.
    expect(validateStorage({ ...common, finePercent: '50', fineBasis: '' }))
      .toBe('products:storageDialog.finePercentWithoutBasisError')
    expect(validateStorage({ ...common, finePercent: '', fineBasis: 'purchase_price' }))
      .toBe('products:storageDialog.fineBasisWithoutPercentError')
  })

  it('refuses a kind or a fine basis that is not one of the enum values', () => {
    expect(validateStorage({ ...common, kind: 'warehouse' }))
      .toBe('products:storageDialog.kindRequiredError')
    expect(validateStorage({ ...common, fineBasis: 'retail' }))
      .toBe('products:storageDialog.fineBasisError')
  })

  it('validates nothing about the fine when the checkbox is off', () => {
    // The box holds whatever the user last typed so unticking is undoable, and
    // none of it is a policy any more. Refusing a half-filled pair here would
    // block saving "this storage has no policy" over a row that had one.
    expect(validateStorage({ ...common, fineEnabled: false, finePercent: '50', fineBasis: '' }))
      .toBe('')
    expect(validateStorage({
      ...common, fineEnabled: false, finePercent: '', fineBasis: 'purchase_price',
    }))
      .toBe('')
    expect(validateStorage({
      ...common, fineEnabled: false, finePercent: '900', fineBasis: 'retail',
    }))
      .toBe('')
  })

  it('keeps checking the rest of the form when the checkbox is off', () => {
    expect(validateStorage({ ...common, fineEnabled: false, kind: 'warehouse' }))
      .toBe('products:storageDialog.kindRequiredError')
    expect(validateStorage({ ...common, fineEnabled: false, name: '   ' }))
      .not.toBe('')
  })

  it('the fine skip is a guarded block, not an early return', () => {
    // 🔴 THE TEST ABOVE DOES NOT PROVE THIS, AND IT WAS WRITTEN AS IF IT DID.
    // `kind` and `name` are checked at the TOP of the function, before the fine
    // block — so an early `return ''` at the skip leaves them untouched and the
    // assertions pass. Measured: the early return was put back in deliberately
    // and all 33 tests stayed green.
    //
    // There is no check after the fine block today, so no input can distinguish
    // the two shapes. What distinguishes them is the source, so the source is
    // what this asserts: `validateStorage` returns '' exactly once, at its end.
    // The day a check IS appended below, it keeps running for an unticked
    // storage — which is the property the comment in storageForm.js claims.
    const src = readFileSync(join(__dirname, 'storageForm.js'), 'utf8')
    const body = src.slice(src.indexOf('export function validateStorage'),
      src.indexOf('export function storagePayload'))
    // ⚠️ COMMENT LINES ARE DROPPED FIRST, and that was measured the hard way:
    // the sentence above this test's subject quotes `return ''` to explain
    // itself, so a match over the raw source counted the explanation as an
    // occurrence and the assertion could never pass — a guard counting the
    // prose that describes it.
    const code = body.split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(code.match(/return\s*''/g) || []).toHaveLength(1)
    expect(code.trimEnd().endsWith("return ''\n}")).toBe(true)
  })

  it('an absent fineEnabled behaves exactly as an on one', () => {
    // Every caller written before the box existed passes values without the
    // key. `undefined` must not read as `false`, or those callers stop being
    // validated the day this line ships.
    expect(validateStorage({ ...common, finePercent: '50', fineBasis: '' }))
      .toBe('products:storageDialog.finePercentWithoutBasisError')
    expect(validateStorage({ ...common, fineEnabled: true, finePercent: '50', fineBasis: '' }))
      .toBe('products:storageDialog.finePercentWithoutBasisError')
  })
})

describe('storagePayload', () => {
  it('trims the name and converts the fine to a number', () => {
    expect(storagePayload(common)).toMatchObject({
      name: 'المستودع الرئيسي', kind: 'common', fine_percent: 100,
      fine_basis: 'purchase_price',
    })
  })

  it('the checkbox decides the two columns — three states, three rows', () => {
    // 🔴 The three the owner named, and the pair that must never meet in a
    // column: zero is "decided not to deduct" and null is "no policy yet".
    // post_stocktake_session reads the second and refuses to fine at all.
    expect(storagePayload({
      ...common, fineEnabled: true, finePercent: '10', fineBasis: 'purchase_price',
    }))
      .toMatchObject({ fine_percent: 10, fine_basis: 'purchase_price' })
    expect(storagePayload({
      ...common, fineEnabled: true, finePercent: '0', fineBasis: 'purchase_price',
    }))
      .toMatchObject({ fine_percent: 0, fine_basis: 'purchase_price' })
    expect(storagePayload({
      ...common, fineEnabled: false, finePercent: '10', fineBasis: 'purchase_price',
    }))
      .toMatchObject({ fine_percent: null, fine_basis: null })
  })

  it('the numbers kept on screen for an undo are not kept in the row', () => {
    // Unticking leaves the boxes filled so re-ticking restores them. The row
    // must not inherit that convenience — a policy that deducts from a salary
    // is not a draft the user has not finished changing their mind about.
    const off = storagePayload({
      ...common, fineEnabled: false, finePercent: '75', fineBasis: 'sales_price',
    })
    expect(off.fine_percent).toBeNull()
    expect(off.fine_basis).toBeNull()
  })

  it('an absent fineEnabled writes the fine exactly as an on one', () => {
    expect(storagePayload({ ...common, finePercent: '10', fineBasis: 'sales_price' }))
      .toMatchObject({ fine_percent: 10, fine_basis: 'sales_price' })
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
    const some = storagePayload({
      ...common, saleByVolume: false, saleByPortion: true, saleByUnits: false,
    })
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

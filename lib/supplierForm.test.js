import {
  validateSupplier, supplierPayload,
  contactIsEmpty, validateSupplierContacts, supplierContactPayload,
  supplierChoices,
} from './supplierForm'

describe('validateSupplier', () => {
  it('needs a name and nothing else', () => {
    expect(validateSupplier({ name: 'مورد' })).toBe('')
    expect(validateSupplier({ name: '   ' })).toBe('products:supplierDialog.nameRequiredError')
  })
})

describe('supplierPayload', () => {
  it('trims and nulls the blanks', () => {
    expect(supplierPayload({
      name: '  شركة التجميل  ', phone: ' 0599 ', email: '', website: '  ', notes: ' ملاحظة ',
    })).toEqual({
      name: 'شركة التجميل', phone: '0599', email: null, website: null, notes: 'ملاحظة',
    })
  })

  it('always sends every column, so clearing a field clears it', () => {
    const payload = supplierPayload({ name: 'x' })
    for (const column of ['name', 'phone', 'email', 'website', 'notes']) {
      expect(Object.prototype.hasOwnProperty.call(payload, column)).toBe(true)
    }
  })

  it('never sends is_active, id or salon', () => {
    for (const key of ['is_active', 'id', 'salon_id', 'sort_order']) {
      expect(Object.prototype.hasOwnProperty.call(supplierPayload({ name: 'x' }), key)).toBe(false)
    }
  })
})

describe('a supplier contact', () => {
  it('counts as empty only when every field is', () => {
    expect(contactIsEmpty({})).toBe(true)
    expect(contactIsEmpty({ lastName: '  ', firstName: '', position: '', phone: '', email: '', notes: '' }))
      .toBe(true)
    expect(contactIsEmpty({ notes: 'x' })).toBe(false)
    expect(contactIsEmpty({ position: 'مدير' })).toBe(false)
  })

  it('refuses a row that describes a job but not a person', () => {
    // "Sales manager" with no name and no number will be read as a working
    // contact by whoever opens the window next.
    expect(validateSupplierContacts([{ position: 'مدير المبيعات' }]))
      .toBe('products:supplierDialog.contactIdentityError')
    expect(validateSupplierContacts([{ position: 'مدير المبيعات', phone: '0599' }])).toBe('')
    expect(validateSupplierContacts([{ lastName: 'خالد' }])).toBe('')
    expect(validateSupplierContacts([{ email: 'a@b.c' }])).toBe('')
  })

  it('lets an untouched row through, because it is not a row yet', () => {
    // Somebody who presses "add contact" and changes their mind should not
    // have to find the row again to delete it.
    expect(validateSupplierContacts([{}, { firstName: 'سارة' }])).toBe('')
  })

  it('carries its place in the list', () => {
    expect(supplierContactPayload({ firstName: ' سارة ' }, 2))
      .toEqual({ last_name: null, first_name: 'سارة', position: null, phone: null,
        email: null, notes: null, sort_order: 2 })
  })
})

describe('supplierChoices', () => {
  const list = [
    { id: 's1', name: 'حيّ', is_active: true },
    { id: 's2', name: 'مؤرشف', is_active: false },
  ]

  it('drops archived suppliers from a fresh choice', () => {
    expect(supplierChoices(list, null).map((s) => s.id)).toEqual(['s1'])
  })

  it('keeps the one already chosen even after it was archived', () => {
    // Otherwise opening a product whose supplier was archived would show an
    // empty dropdown, and pressing save would reassign it to nobody without
    // anything having said so.
    expect(supplierChoices(list, 's2').map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('survives no list at all', () => {
    expect(supplierChoices(null, null)).toEqual([])
  })
})

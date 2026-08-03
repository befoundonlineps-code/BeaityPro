import {
  validateServiceForm,
  serviceFormPayload,
  ACCOUNTING_DIRECTIONS,
  SEX_OPTIONS,
} from './serviceForm'

const filled = {
  name: '  قص شعر  ',
  duration: '45',
  price: '80',
  color: '#7C3AED',
  sex: 'women',
  abbreviation: ' قص ',
  barCode: ' 12345 ',
  description: ' وصف الخدمة ',
  plannedCost: '20',
  accountingDirection: 'hairdressing',
  priceProportionalToDuration: true,
  anyoneCanSell: false,
}

describe('validateServiceForm', () => {
  it('passes a filled form', () => {
    expect(validateServiceForm(filled)).toBe('')
  })

  it('passes with every optional field blank', () => {
    expect(validateServiceForm({ name: 'x', duration: '30', price: '0' })).toBe('')
  })

  it('refuses a blank name, and whitespace is blank', () => {
    expect(validateServiceForm({ ...filled, name: '   ' }))
      .toBe('services:serviceDialog.nameRequiredError')
  })

  it('refuses a duration of zero or less, or nonsense', () => {
    for (const duration of ['0', '-5', '', 'abc']) {
      expect(validateServiceForm({ ...filled, duration }))
        .toBe('services:serviceDialog.durationInvalidError')
    }
  })

  it('refuses a negative price but allows zero', () => {
    expect(validateServiceForm({ ...filled, price: '-1' }))
      .toBe('services:serviceDialog.priceInvalidError')
    expect(validateServiceForm({ ...filled, price: '0' })).toBe('')
  })

  it('allows a blank planned cost but refuses a negative one', () => {
    expect(validateServiceForm({ ...filled, plannedCost: '' })).toBe('')
    expect(validateServiceForm({ ...filled, plannedCost: '   ' })).toBe('')
    expect(validateServiceForm({ ...filled, plannedCost: '-3' }))
      .toBe('services:serviceDialog.plannedCostInvalidError')
    expect(validateServiceForm({ ...filled, plannedCost: 'abc' }))
      .toBe('services:serviceDialog.plannedCostInvalidError')
  })

  it('returns keys, not sentences', () => {
    // A lib that returned Arabic would put text outside the i18n files.
    expect(validateServiceForm({ name: '' })).toMatch(/^services:/)
  })
})

describe('serviceFormPayload', () => {
  const payload = serviceFormPayload(filled)

  it('trims text and converts numbers', () => {
    expect(payload).toMatchObject({
      name: 'قص شعر',
      duration_minutes: 45,
      price: 80,
      abbreviation: 'قص',
      bar_code: '12345',
      description: 'وصف الخدمة',
      planned_cost: 20,
      accounting_direction: 'hairdressing',
    })
  })

  it('keeps the two booleans as booleans', () => {
    expect(payload.price_proportional_to_duration).toBe(true)
    expect(payload.anyone_can_sell).toBe(false)
  })

  it('turns every blank optional into null, never an empty string', () => {
    const blank = serviceFormPayload({
      name: 'x', duration: '30', price: '0', color: '#000000', sex: 'all',
      abbreviation: '', barCode: '   ', description: '', plannedCost: '', accountingDirection: '',
    })
    expect(blank.abbreviation).toBeNull()
    expect(blank.bar_code).toBeNull()
    expect(blank.description).toBeNull()
    expect(blank.planned_cost).toBeNull()
    expect(blank.accounting_direction).toBeNull()
  })

  it('always sends every column, so clearing a field actually clears it', () => {
    // A key left out of an update leaves the old value in the row. Removing a
    // barcode would then report success and change nothing.
    const blank = serviceFormPayload({ name: 'x', duration: '30', price: '0' })
    for (const column of [
      'name', 'duration_minutes', 'price', 'color', 'sex', 'abbreviation', 'bar_code',
      'description', 'planned_cost', 'accounting_direction',
      'price_proportional_to_duration', 'anyone_can_sell',
    ]) {
      expect(Object.prototype.hasOwnProperty.call(blank, column)).toBe(true)
    }
  })

  it('never sends image_path', () => {
    // The storage path needs the service id, which a new service does not have
    // until it has been inserted, so the picture is a separate write.
    expect(Object.prototype.hasOwnProperty.call(payload, 'image_path')).toBe(false)
  })

  it('sends no id, salon or category — the caller decides those', () => {
    expect(payload.id).toBeUndefined()
    expect(payload.salon_id).toBeUndefined()
    expect(payload.category_id).toBeUndefined()
  })
})

describe('the option lists', () => {
  it('offers exactly what the CHECK constraint allows', () => {
    // services_accounting_direction_check, read back off the live database.
    expect(ACCOUNTING_DIRECTIONS).toEqual([
      'common', 'hairdressing', 'barbershop', 'cosmetology',
      'nails', 'makeup', 'massage', 'tanning',
    ])
  })

  it('keeps common out of the business types it borrows from', () => {
    // It is not a business type. Adding it to that enum would put "common
    // department" in the salon's own activity picker in settings.
    const { BUSINESS_TYPES } = require('./serviceTree')
    expect(BUSINESS_TYPES).not.toContain('common')
  })

  it('matches the service_sex enum', () => {
    expect(SEX_OPTIONS).toEqual(['all', 'men', 'women'])
  })
})

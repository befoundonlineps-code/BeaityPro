import { businessTypesForRole, servicesForRole } from './roleServiceFilter'

const roleBusinessTypes = [
  { role: 'hairdresser', business_type: 'hairdressing' },
  { role: 'hairdresser', business_type: 'barbershop' },
  { role: 'stylist', business_type: 'hairdressing' },
  { role: 'masseur', business_type: 'massage' },
]

const categories = [
  { id: 'cat-hair', business_type: 'hairdressing' },
  { id: 'cat-barber', business_type: 'barbershop' },
  { id: 'cat-massage', business_type: 'massage' },
]

const services = [
  { id: 's1', category_id: 'cat-hair', name: 'قص شعر' },
  { id: 's2', category_id: 'cat-barber', name: 'حلاقة ذقن' },
  { id: 's3', category_id: 'cat-massage', name: 'مساج ظهر' },
]

describe('businessTypesForRole', () => {
  it('collects every business_type linked to a role', () => {
    expect(businessTypesForRole('hairdresser', roleBusinessTypes)).toEqual(new Set(['hairdressing', 'barbershop']))
  })

  it('returns an empty set for a role with no rows (administrator, executive, ...)', () => {
    expect(businessTypesForRole('administrator', roleBusinessTypes)).toEqual(new Set())
  })
})

describe('servicesForRole', () => {
  it('returns every service unfiltered when no role is given yet', () => {
    expect(servicesForRole(null, services, categories, roleBusinessTypes)).toEqual(services)
    expect(servicesForRole('', services, categories, roleBusinessTypes)).toEqual(services)
  })

  it('keeps only services whose category matches one of the role\'s business types', () => {
    const result = servicesForRole('hairdresser', services, categories, roleBusinessTypes)
    expect(result.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('returns nothing for a role with zero linked categories', () => {
    expect(servicesForRole('administrator', services, categories, roleBusinessTypes)).toEqual([])
  })

  it('excludes a service whose category the role does not cover', () => {
    const result = servicesForRole('stylist', services, categories, roleBusinessTypes)
    expect(result.map((s) => s.id)).toEqual(['s1'])
  })

  it('drops a service whose category is missing from the categories list', () => {
    const orphanServices = [{ id: 's4', category_id: 'does-not-exist' }]
    expect(servicesForRole('hairdresser', orphanServices, categories, roleBusinessTypes)).toEqual([])
  })
})

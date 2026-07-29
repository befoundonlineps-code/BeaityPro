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

  describe('with categories typed at mixed levels', () => {
    const mixedCategories = [
      { id: 'bridal', parent_id: null, business_type: null },
      { id: 'bridal-hair', parent_id: 'bridal', business_type: 'hairdressing' },
      { id: 'bridal-makeup', parent_id: 'bridal', business_type: 'makeup' },
      { id: 'hair', parent_id: null, business_type: 'hairdressing' },
      { id: 'hair-cut', parent_id: 'hair', business_type: null },
    ]

    const mixedServices = [
      { id: 'b1', category_id: 'bridal-hair', name: 'تسريحة عروس' },
      { id: 'b2', category_id: 'bridal-makeup', name: 'مكياج عروس' },
      { id: 'b3', category_id: 'bridal', name: 'استشارة الباقة' }, // directly under the untyped root
      { id: 'h1', category_id: 'hair-cut', name: 'قص شعر' },
    ]

    const mixedRoles = [
      { role: 'hairdresser', business_type: 'hairdressing' },
      { role: 'makeup_artist', business_type: 'makeup' },
    ]

    it('gives each sibling under an untyped root to the right role', () => {
      const hair = servicesForRole('hairdresser', mixedServices, mixedCategories, mixedRoles)
      expect(hair.map((s) => s.id)).toEqual(['b1', 'b3', 'h1'])

      const makeup = servicesForRole('makeup_artist', mixedServices, mixedCategories, mixedRoles)
      expect(makeup.map((s) => s.id)).toEqual(['b2', 'b3'])
    })

    it('treats a service under an untyped category as general, available to any role', () => {
      const admin = servicesForRole('administrator', mixedServices, mixedCategories, mixedRoles)
      expect(admin.map((s) => s.id)).toEqual(['b3'])
    })

    it('resolves a service under an untyped child through its typed root', () => {
      const hair = servicesForRole('hairdresser', mixedServices, mixedCategories, mixedRoles)
      expect(hair.map((s) => s.id)).toContain('h1')
    })
  })
})

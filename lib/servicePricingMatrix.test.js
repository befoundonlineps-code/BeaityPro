import {
  PRICING_COLUMNS,
  resolvePricingRole,
  buildPricingMatrix,
  filterPricingMatrix,
  changedPrices,
} from './servicePricingMatrix'
import { indexCategoriesById } from './categoryTypes'

const root = (id, name, business_type, pricing_role, sort_order = 1) => ({
  id, name, business_type, pricing_role, parent_id: null, sort_order,
})
const sub = (id, name, parent_id, pricing_role = null, sort_order = 1) => ({
  id, name, parent_id, pricing_role, business_type: null, sort_order,
})
const svc = (id, category_id, name, price = 100, sort_order = 1) => ({
  id, category_id, name, price, duration_minutes: 30, is_active: true, sort_order,
})

// The catalogue as it is actually seeded: seven roots, and nails carrying its
// split on two sub-categories rather than on the services.
const CATEGORIES = [
  root('hair', 'خدمات الشعر', 'hairdressing', 'stylist', 1),
  sub('cut', 'قص الشعر', 'hair'),
  root('men', 'الحلاقة الرجالية', 'barbershop', 'hairdresser', 2),
  root('skin', 'العناية بالبشرة والتجميل', 'cosmetology', 'cosmetologist', 3),
  sub('peel', 'تقشير البشرة', 'skin'),
  root('nails', 'العناية بالأظافر', 'nails', null, 4),
  sub('hands', 'العناية باليدين', 'nails', 'manicure_professional', 1),
  sub('feet', 'العناية بالقدمين', 'nails', 'pedicure_professional', 2),
  root('tan', 'تسمير البشرة', 'tanning', null, 7),
  sub('tanroom', 'التسمير الصناعي', 'tan'),
]

describe('PRICING_COLUMNS', () => {
  it('is the seven roles the reference screen lays out, in its order', () => {
    expect(PRICING_COLUMNS).toEqual([
      'stylist', 'hairdresser', 'cosmetologist',
      'manicure_professional', 'pedicure_professional',
      'makeup_artist', 'masseur',
    ])
  })
})

describe('resolvePricingRole', () => {
  const byId = indexCategoriesById(CATEGORIES)
  const find = (id) => resolvePricingRole(byId[id], byId)

  it('reads a root category’s own column', () => {
    expect(find('hair')).toBe('stylist')
    expect(find('men')).toBe('hairdresser')
  })

  it('inherits down to a sub-category that declares nothing', () => {
    // "قص الشعر" never says it is a stylist's work; its parent does.
    expect(find('cut')).toBe('stylist')
    expect(find('peel')).toBe('cosmetologist')
  })

  it('lets a sub-category override its parent', () => {
    // The whole of the nails case: same root, two different columns.
    expect(find('hands')).toBe('manicure_professional')
    expect(find('feet')).toBe('pedicure_professional')
  })

  it('gives nothing when no ancestor declares a column', () => {
    expect(find('tan')).toBe(null)
    expect(find('tanroom')).toBe(null)
    // Nails root itself has none — only its children do.
    expect(find('nails')).toBe(null)
  })

  it('survives a parent chain that points at itself', () => {
    const loop = { id: 'a', parent_id: 'a', pricing_role: null }
    expect(resolvePricingRole(loop, { a: loop })).toBe(null)
  })

  it('says nothing for nothing', () => {
    expect(resolvePricingRole(null, {})).toBe(null)
  })
})

describe('buildPricingMatrix', () => {
  const services = [
    svc('s1', 'cut', 'قص شعر'),
    svc('s2', 'hair', 'تسريحة'),
    svc('s3', 'hands', 'مانيكير كلاسيكي'),
    svc('s4', 'feet', 'باديكير كلاسيكي'),
    svc('s5', 'tanroom', 'جلسة تسمير'),
  ]

  it('groups every service under the root it hangs from, however deep', () => {
    const matrix = buildPricingMatrix({ categories: CATEGORIES, services })
    const names = matrix.map((g) => g.root.name)
    expect(names).toEqual(['خدمات الشعر', 'العناية بالأظافر'])
  })

  it('carries each row’s own column, not its root’s', () => {
    const matrix = buildPricingMatrix({ categories: CATEGORIES, services })
    const nails = matrix.find((g) => g.root.id === 'nails')
    expect(nails.rows.map((r) => [r.service.name, r.role])).toEqual([
      ['مانيكير كلاسيكي', 'manicure_professional'],
      ['باديكير كلاسيكي', 'pedicure_professional'],
    ])
  })

  it('leaves out a service with no column at all', () => {
    // Tanning has no matching role, so it stays on the catalogue screen.
    const matrix = buildPricingMatrix({ categories: CATEGORIES, services })
    expect(matrix.some((g) => g.rows.some((r) => r.service.id === 's5'))).toBe(false)
  })

  it('leaves out an inactive service', () => {
    const withDead = [...services, { ...svc('s6', 'cut', 'خدمة موقوفة'), is_active: false }]
    const matrix = buildPricingMatrix({ categories: CATEGORIES, services: withDead })
    expect(matrix.some((g) => g.rows.some((r) => r.service.id === 's6'))).toBe(false)
  })

  it('leaves out a service whose category is missing', () => {
    const orphan = [svc('s7', 'gone', 'خدمة يتيمة')]
    expect(buildPricingMatrix({ categories: CATEGORIES, services: orphan })).toEqual([])
  })

  it('orders groups by the root’s own order', () => {
    const all = [svc('s1', 'cut', 'قص'), svc('s8', 'skin', 'تنظيف')]
    const matrix = buildPricingMatrix({ categories: CATEGORIES, services: all })
    expect(matrix.map((g) => g.root.id)).toEqual(['hair', 'skin'])
  })

  it('copes with nothing at all', () => {
    expect(buildPricingMatrix({ categories: [], services: [] })).toEqual([])
    expect(buildPricingMatrix({})).toEqual([])
  })
})

describe('filterPricingMatrix', () => {
  const matrix = buildPricingMatrix({
    categories: CATEGORIES,
    services: [svc('s1', 'cut', 'قص شعر'), svc('s3', 'hands', 'مانيكير كلاسيكي')],
  })

  it('hands the matrix back untouched for an empty search', () => {
    expect(filterPricingMatrix(matrix, '')).toBe(matrix)
    expect(filterPricingMatrix(matrix, '   ')).toBe(matrix)
  })

  it('keeps the matching services and drops headings left holding none', () => {
    const found = filterPricingMatrix(matrix, 'مانيكير')
    expect(found).toHaveLength(1)
    expect(found[0].root.id).toBe('nails')
  })

  it('does not match on category names', () => {
    expect(filterPricingMatrix(matrix, 'العناية بالأظافر')).toEqual([])
  })

  it('ignores case', () => {
    const latin = buildPricingMatrix({
      categories: CATEGORIES, services: [svc('s9', 'cut', 'Blow Dry')],
    })
    expect(filterPricingMatrix(latin, 'blow')[0].rows).toHaveLength(1)
  })
})

describe('changedPrices', () => {
  const matrix = buildPricingMatrix({
    categories: CATEGORIES,
    services: [svc('s1', 'cut', 'قص شعر', 100), svc('s3', 'hands', 'مانيكير', 0)],
  })

  it('reports only what actually differs', () => {
    expect(changedPrices(matrix, { s1: '150' })).toEqual([{ id: 's1', price: 150 }])
  })

  it('ignores a value retyped as it already was', () => {
    // A dialog that wrote every row it drew would touch two hundred to change
    // one, and every one of those is a chance to fail on a row nobody edited.
    expect(changedPrices(matrix, { s1: '100', s3: 0 })).toEqual([])
  })

  it('ignores rows nobody touched', () => {
    expect(changedPrices(matrix, {})).toEqual([])
  })

  it('refuses a value that is not a price', () => {
    expect(changedPrices(matrix, { s1: 'abc' })).toEqual([])
    expect(changedPrices(matrix, { s1: '-5' })).toEqual([])
    expect(changedPrices(matrix, { s1: '' })).toEqual([])
  })

  it('accepts zero as a real change', () => {
    // Clearing a price back to nothing is an edit like any other.
    expect(changedPrices(matrix, { s1: '0' })).toEqual([{ id: 's1', price: 0 }])
  })
})

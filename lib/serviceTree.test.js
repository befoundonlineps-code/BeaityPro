import { buildServiceTree, countServices } from './serviceTree'

const categories = [
  { id: 'r1', parent_id: null, business_type: 'nails', name: 'الأظافر', sort_order: 2 },
  { id: 'r2', parent_id: null, business_type: 'makeup', name: 'المكياج', sort_order: 1 },
  { id: 'r3', parent_id: null, business_type: 'massage', name: 'المساج', sort_order: 3 },
  { id: 's1', parent_id: 'r1', business_type: null, name: 'بديكير', sort_order: 2 },
  { id: 's2', parent_id: 'r1', business_type: null, name: 'مانيكير', sort_order: 1 },
]

const services = [
  { id: 'v1', category_id: 's2', name: 'مانيكير عادي', sort_order: 2 },
  { id: 'v2', category_id: 's2', name: 'مانيكير سبا', sort_order: 1 },
  { id: 'v3', category_id: 's1', name: 'بديكير عادي', sort_order: 1 },
  { id: 'v4', category_id: 'r1', name: 'خدمة مباشرة تحت الجذر', sort_order: 1 },
]

describe('buildServiceTree', () => {
  it('keeps only roots whose business type is selected', () => {
    const tree = buildServiceTree(categories, services, ['nails'])
    expect(tree.map((r) => r.id)).toEqual(['r1'])
  })

  it('returns nothing when no types are selected', () => {
    expect(buildServiceTree(categories, services, [])).toEqual([])
    expect(buildServiceTree(categories, services, null)).toEqual([])
  })

  it('sorts roots, sub-categories and services by sort_order', () => {
    const tree = buildServiceTree(categories, services, ['nails', 'makeup', 'massage'])
    expect(tree.map((r) => r.id)).toEqual(['r2', 'r1', 'r3'])

    const nails = tree.find((r) => r.id === 'r1')
    expect(nails.children.map((s) => s.id)).toEqual(['s2', 's1'])
    expect(nails.children[0].services.map((s) => s.id)).toEqual(['v2', 'v1'])
  })

  it('keeps services attached directly to a root', () => {
    const [nails] = buildServiceTree(categories, services, ['nails'])
    expect(nails.services.map((s) => s.id)).toEqual(['v4'])
  })

  it('tolerates empty inputs', () => {
    expect(buildServiceTree(null, null, ['nails'])).toEqual([])
  })

  describe('with categories typed at mixed levels', () => {
    // An untyped "bridal packages" root whose children each declare a type,
    // alongside the classic typed-root / untyped-child shape.
    const mixedCategories = [
      { id: 'bridal', parent_id: null, business_type: null, name: 'باقات العرايس', sort_order: 1 },
      { id: 'bridal-hair', parent_id: 'bridal', business_type: 'hairdressing', name: 'تسريحات', sort_order: 1 },
      { id: 'bridal-makeup', parent_id: 'bridal', business_type: 'makeup', name: 'مكياج', sort_order: 2 },
      { id: 'bridal-nails', parent_id: 'bridal', business_type: 'nails', name: 'أظافر', sort_order: 3 },
      { id: 'hair', parent_id: null, business_type: 'hairdressing', name: 'الشعر', sort_order: 2 },
      { id: 'hair-cut', parent_id: 'hair', business_type: null, name: 'قص', sort_order: 1 },
    ]

    it('shows an untyped root but only the children whose type is selected', () => {
      const tree = buildServiceTree(mixedCategories, [], ['makeup'])
      expect(tree.map((r) => r.id)).toEqual(['bridal'])
      expect(tree[0].children.map((c) => c.id)).toEqual(['bridal-makeup'])
    })

    it('shows every child of an untyped root when all their types are selected', () => {
      const tree = buildServiceTree(mixedCategories, [], ['hairdressing', 'makeup', 'nails'])
      const bridal = tree.find((r) => r.id === 'bridal')
      expect(bridal.children.map((c) => c.id)).toEqual(['bridal-hair', 'bridal-makeup', 'bridal-nails'])
    })

    it('keeps an untyped root visible even when no types are selected', () => {
      const tree = buildServiceTree(mixedCategories, [], [])
      expect(tree.map((r) => r.id)).toEqual(['bridal'])
      expect(tree[0].children).toEqual([])
    })

    it('still resolves an untyped child through its typed root', () => {
      const tree = buildServiceTree(mixedCategories, [], ['hairdressing'])
      const hair = tree.find((r) => r.id === 'hair')
      expect(hair.children.map((c) => c.id)).toEqual(['hair-cut'])
    })

    it('hides a typed root whose type is not selected', () => {
      const tree = buildServiceTree(mixedCategories, [], ['makeup'])
      expect(tree.find((r) => r.id === 'hair')).toBeUndefined()
    })
  })
})

describe('countServices', () => {
  it('counts services in sub-categories and directly under the root', () => {
    const [nails] = buildServiceTree(categories, services, ['nails'])
    expect(countServices(nails)).toBe(4)
  })

  it('returns 0 for a root with nothing under it', () => {
    const [massage] = buildServiceTree(categories, services, ['massage'])
    expect(countServices(massage)).toBe(0)
  })
})

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

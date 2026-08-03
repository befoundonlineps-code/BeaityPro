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


const dcat = (id, name, parent_id, business_type = null, sort_order = 1) =>
  ({ id, name, parent_id, business_type, sort_order })
const dsvc = (id, category_id, sort_order = 1) =>
  ({ id, category_id, name: id, sort_order })

// The exact shape that went wrong: a folder created inside a folder. It saved
// correctly and then vanished, because this builder went two levels deep and
// the screen had started allowing three.
describe('buildServiceTree at more than two levels', () => {
  const cats = [
    dcat('r', 'التجميل والعناية بالبشرة', null, 'cosmetology'),
    dcat('s2', 'التجميل اللاجراحي', 'r'),
    dcat('s3', 'جراحة عامة', 's2'),
    dcat('s4', 'تفصيل أعمق', 's3'),
  ]
  const tree = buildServiceTree(cats, [dsvc('a', 's3'), dsvc('b', 's4'), dsvc('c', 'r')], ['cosmetology'])

  it('keeps a third level under its own parent', () => {
    const sub = tree[0].children[0]
    expect(sub.name).toBe('التجميل اللاجراحي')
    expect(sub.children.map((c) => c.name)).toEqual(['جراحة عامة'])
  })

  it('does not promote a deep folder to a root', () => {
    // The symptom reported: it appeared as a new root rather than nowhere.
    expect(tree.map((r) => r.name)).toEqual(['التجميل والعناية بالبشرة'])
  })

  it('goes deeper still', () => {
    expect(tree[0].children[0].children[0].children.map((c) => c.name)).toEqual(['تفصيل أعمق'])
  })

  it('gives every node a children array, so nothing has to guess', () => {
    const deepest = tree[0].children[0].children[0].children[0]
    expect(deepest.children).toEqual([])
  })

  it('carries the services of every level', () => {
    expect(tree[0].services.map((s) => s.id)).toEqual(['c'])
    expect(tree[0].children[0].children[0].services.map((s) => s.id)).toEqual(['a'])
  })
})

describe('buildServiceTree guards', () => {
  it('does not recurse forever on a parent chain that loops', () => {
    // parent_id is a real column and nothing stops a cycle being written.
    const cats = [dcat('r', 'root', null, 'nails'), dcat('a', 'A', 'b'), dcat('b', 'B', 'a')]
    expect(() => buildServiceTree(cats, [], ['nails'])).not.toThrow()
    expect(buildServiceTree(cats, [], ['nails']).map((r) => r.name)).toEqual(['root'])
  })

  it('still hides a type the salon has not chosen', () => {
    const cats = [dcat('r', 'root', null, 'nails'), dcat('x', 'other', null, 'makeup')]
    expect(buildServiceTree(cats, [], ['nails']).map((r) => r.name)).toEqual(['root'])
  })
})

describe('countServices', () => {
  it('counts every level, not just the first two', () => {
    const cats = [dcat('r', 'root', null, 'nails'), dcat('a', 'A', 'r'), dcat('b', 'B', 'a')]
    const tree = buildServiceTree(cats, [dsvc('1', 'r'), dsvc('2', 'a'), dsvc('3', 'b'), dsvc('4', 'b')], ['nails'])
    expect(countServices(tree[0])).toBe(4)
  })

  it('is zero for an empty folder', () => {
    const tree = buildServiceTree([dcat('r', 'root', null, 'nails')], [], ['nails'])
    expect(countServices(tree[0])).toBe(0)
  })
})

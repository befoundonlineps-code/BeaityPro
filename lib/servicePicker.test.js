import {
  servicePickerTree,
  pruneEmpty,
  filterServiceTree,
  servicePriceState,
  bookingTotal,
} from './servicePicker'

const cat = (id, name, parent_id = null, extra = {}) => ({
  id, name, parent_id, sort_order: 0, business_type: parent_id ? null : 'hairdressing', ...extra,
})
const svc = (id, category_id, name, price = 50) => ({
  id, category_id, name, price, duration_minutes: 30, is_active: true, sort_order: 0,
})

describe('servicePickerTree', () => {
  const categories = [
    cat('c1', 'الشعر'),
    cat('c2', 'الصبغة', 'c1'),
    cat('c3', 'الأظافر', null, { business_type: 'nails' }),
  ]

  it('builds folders out of the services it is given, not the whole catalogue', () => {
    // The dialog has already cut this list down to the professional's role.
    const tree = servicePickerTree(categories, [svc('s1', 'c2', 'صبغة كاملة')])

    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('الشعر')
    expect(tree[0].children.map((c) => c.name)).toEqual(['الصبغة'])
    expect(tree[0].children[0].services.map((s) => s.name)).toEqual(['صبغة كاملة'])
  })

  it('keeps a folder whose services hang directly off it', () => {
    const tree = servicePickerTree(categories, [svc('s1', 'c1', 'قص')])
    expect(tree[0].services.map((s) => s.name)).toEqual(['قص'])
  })

  it('drops every business type as a filter', () => {
    // Nails is a different type from hairdressing; narrowing again here could
    // only ever remove something the caller meant to keep.
    const tree = servicePickerTree(categories, [svc('s1', 'c3', 'مانيكير')])
    expect(tree.map((r) => r.name)).toEqual(['الأظافر'])
  })

  it('returns nothing at all when no service survived the role filter', () => {
    expect(servicePickerTree(categories, [])).toEqual([])
  })
})

describe('pruneEmpty', () => {
  it('drops a folder that holds nothing pickable', () => {
    const tree = [
      { id: 'a', name: 'A', services: [], children: [{ id: 'a1', name: 'A1', services: [] }] },
      { id: 'b', name: 'B', services: [], children: [{ id: 'b1', name: 'B1', services: [svc('s', 'b1', 'X')] }] },
    ]
    expect(pruneEmpty(tree).map((r) => r.name)).toEqual(['B'])
  })

  it('copes with a tree that never had children', () => {
    expect(pruneEmpty([{ id: 'a', name: 'A', services: [svc('s', 'a', 'X')] }])).toHaveLength(1)
    expect(pruneEmpty(null)).toEqual([])
  })
})

describe('filterServiceTree', () => {
  const tree = [{
    id: 'c1',
    name: 'الشعر',
    services: [svc('s1', 'c1', 'قص شعر')],
    children: [{ id: 'c2', name: 'الصبغة', services: [svc('s2', 'c2', 'صبغة كاملة'), svc('s3', 'c2', 'خصل')] }],
  }]

  it('hands the tree back untouched for an empty search', () => {
    expect(filterServiceTree(tree, '')).toBe(tree)
    expect(filterServiceTree(tree, '   ')).toBe(tree)
  })

  it('keeps only the matching services, and the folders still holding one', () => {
    const found = filterServiceTree(tree, 'صبغة')
    expect(found).toHaveLength(1)
    expect(found[0].services).toEqual([])
    expect(found[0].children[0].services.map((s) => s.name)).toEqual(['صبغة كاملة'])
  })

  it('matches a service hanging off the root as readily as a nested one', () => {
    const found = filterServiceTree(tree, 'قص')
    expect(found[0].services.map((s) => s.name)).toEqual(['قص شعر'])
    expect(found[0].children).toEqual([])
  })

  it('does not match on folder names', () => {
    // "الشعر" is a folder here and appears in no service's name — "قص شعر"
    // has no definite article. Typing a folder's name and being handed
    // everything inside it reads as a search that ignored what was typed, so
    // this returns nothing rather than the folder's contents.
    expect(filterServiceTree(tree, 'الشعر')).toEqual([])
    expect(filterServiceTree(tree, 'الصبغة')).toEqual([])
  })

  it('ignores case', () => {
    const latin = [{ id: 'c', name: 'Hair', services: [svc('s', 'c', 'Blow Dry')], children: [] }]
    expect(filterServiceTree(latin, 'blow')[0].services).toHaveLength(1)
  })

  it('returns nothing when nothing matches', () => {
    expect(filterServiceTree(tree, 'مساج')).toEqual([])
  })
})

describe('servicePriceState', () => {
  it('reports a real price', () => {
    expect(servicePriceState({ price: 120 })).toEqual({ known: true, price: 120 })
    expect(servicePriceState({ price: '85.5' })).toEqual({ known: true, price: 85.5 })
  })

  it('treats zero as nothing set yet', () => {
    // Display rule, not a claim about the data: the service form defaults the
    // price to 0 and always sends a number, so there is no stored difference
    // between free and unset.
    expect(servicePriceState({ price: 0 })).toEqual({ known: false, price: null })
    expect(servicePriceState({ price: '0' })).toEqual({ known: false, price: null })
  })

  it('says nothing is set for a missing or unreadable price', () => {
    expect(servicePriceState({ price: null }).known).toBe(false)
    expect(servicePriceState({}).known).toBe(false)
    expect(servicePriceState(null).known).toBe(false)
    expect(servicePriceState({ price: 'abc' }).known).toBe(false)
  })
})

describe('bookingTotal', () => {
  it('is the chosen service and nothing else', () => {
    expect(bookingTotal({ price: 120 })).toBe(120)
  })

  it('is zero before a service is chosen, or when it has no price', () => {
    expect(bookingTotal(null)).toBe(0)
    expect(bookingTotal({ price: 0 })).toBe(0)
  })
})

describe('servicePickerTree and archived folders', () => {
  const cats = [
    { id: 'c1', name: 'الشعر', parent_id: null, business_type: 'hairdressing', sort_order: 1, is_active: true },
    { id: 'c2', name: 'الصبغة', parent_id: 'c1', business_type: null, sort_order: 1, is_active: true },
    { id: 'c3', name: 'المكياج', parent_id: null, business_type: 'makeup', sort_order: 2, is_active: false },
  ]
  const svcs = [
    { id: 's1', category_id: 'c2', name: 'صبغة كاملة', price: 50, duration_minutes: 30, is_active: true, sort_order: 1 },
    { id: 's2', category_id: 'c3', name: 'مكياج سهرة', price: 200, duration_minutes: 60, is_active: true, sort_order: 1 },
  ]

  it('never offers a service out of an archived folder', () => {
    // The service itself is still active — it is the folder that is gone.
    const tree = servicePickerTree(cats, svcs)
    expect(tree.map((r) => r.name)).toEqual(['الشعر'])
  })

  it('takes the whole subtree with it', () => {
    const archivedRoot = cats.map((c) => (c.id === 'c1' ? { ...c, is_active: false } : c))
    expect(servicePickerTree(archivedRoot, svcs)).toEqual([])
  })
})

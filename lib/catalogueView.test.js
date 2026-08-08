import { catalogueScope, catalogueRows, catalogueGroups, categoryOrder } from './catalogueView'
import { descendantIds } from './categoryVisibility'

const CATEGORIES = [
  { id: 'c-hair', parent_id: null, name: 'شعر', sort_order: 1 },
  { id: 'c-shampoo', parent_id: 'c-hair', name: 'شامبو', sort_order: 1 },
  { id: 'c-nails', parent_id: null, name: 'أظافر', sort_order: 2 },
]

const PRODUCTS = [
  { id: 'p1', name: 'شامبو زيتي', category_id: 'c-shampoo', sort_order: 2, is_active: true },
  { id: 'p2', name: 'شامبو جاف', category_id: 'c-shampoo', sort_order: 1, is_active: true },
  { id: 'p3', name: 'مقصّ', category_id: 'c-hair', sort_order: 1, is_active: true },
  { id: 'p4', name: 'مبرد', category_id: 'c-nails', sort_order: 1, is_active: true },
  { id: 'p5', name: 'زيت قديم', category_id: 'c-hair', sort_order: 2, is_active: false },
]

const rows = (over) => catalogueRows({
  products: PRODUCTS, categories: CATEGORIES, categoryId: null, search: '', hideArchived: false, ...over,
})

describe('what the folder means', () => {
  it('includes subfolders, like every other screen', () => {
    // ⚠️ THE FAULT THIS FILE EXISTS FOR. The catalogue filtered on
    // `category_id === selected` while the counting sheet and the archive
    // dialog walked descendantIds — so «شعر» meant two different sets on two
    // screens and nobody could tell which one they were reading.
    expect(rows({ categoryId: 'c-hair' }).map((p) => p.id).sort())
      .toEqual(['p1', 'p2', 'p3', 'p5'])
  })

  it('uses the same walk as the other screens rather than a second copy', () => {
    // Imported, not restated. Two implementations of "this folder and its
    // children" are two answers the day one of them learns something.
    const category = CATEGORIES.find((c) => c.id === 'c-hair')
    expect([...catalogueScope('c-hair', CATEGORIES)].sort())
      .toEqual([...descendantIds(category, CATEGORIES)].sort())
  })

  it('narrows to a leaf folder alone', () => {
    expect(rows({ categoryId: 'c-shampoo' }).map((p) => p.id).sort()).toEqual(['p1', 'p2'])
  })

  it('shows everything when no folder is chosen', () => {
    // ⚠️ The catalogue used to return an empty array here and draw a hint. That
    // is what made the search box lie: with no rows to search, a real product
    // answered «ما في نتائج».
    expect(rows({}).length).toBe(PRODUCTS.length)
  })

  it('narrows to nothing for a folder that no longer exists', () => {
    // Fails closed. Silently widening a filtered list is worse than an empty
    // one, because the empty one is noticed.
    expect(rows({ categoryId: 'c-ghost' })).toEqual([])
    expect(catalogueScope('c-ghost', CATEGORIES).size).toBe(0)
  })

  it('does not narrow at all when asked for everything', () => {
    // ⚠️ null, not a set of every known id. A product whose category was
    // deleted has an id no set built from the category list can contain, so
    // "narrow to everything I could find" would hide exactly the rows most
    // worth seeing.
    expect(catalogueScope(null, CATEGORIES)).toBeNull()
    const orphan = { id: 'p9', name: 'يتيم', category_id: 'c-gone', sort_order: 1, is_active: true }
    expect(catalogueRows({
      products: [...PRODUCTS, orphan], categories: CATEGORIES, categoryId: null,
    }).map((p) => p.id)).toContain('p9')
  })
})

describe('search reads the scope it is shown beside', () => {
  it('finds a product without knowing its folder', () => {
    // The whole reason anybody types in that box.
    expect(rows({ search: 'مبرد' }).map((p) => p.id)).toEqual(['p4'])
  })

  it('still narrows inside a chosen folder', () => {
    // Widening the scope must not make the folder decorative.
    expect(rows({ categoryId: 'c-nails', search: 'شامبو' })).toEqual([])
    expect(rows({ categoryId: 'c-shampoo', search: 'جاف' }).map((p) => p.id)).toEqual(['p2'])
  })

  it('hides archived rows only when asked', () => {
    expect(rows({ hideArchived: true }).map((p) => p.id)).not.toContain('p5')
    expect(rows({ hideArchived: false }).map((p) => p.id)).toContain('p5')
  })
})

describe('the table groups by folder and does not rank by it', () => {
  it('keeps a folder together', () => {
    const groups = catalogueGroups(rows({}), CATEGORIES)
    const ids = groups.map((g) => g.categoryId)
    // Each folder appears once: adjacency is the property, not the order.
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('orders inside a folder by the catalogue order a person arranged', () => {
    const shampoo = catalogueGroups(rows({ categoryId: 'c-shampoo' }), CATEGORIES)[0]
    expect(shampoo.products.map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('carries the folder so the table can head each run', () => {
    const groups = catalogueGroups(rows({ categoryId: 'c-nails' }), CATEGORIES)
    expect(groups).toHaveLength(1)
    expect(groups[0].category.name).toBe('أظافر')
  })

  it('keeps a product whose folder is unknown, rather than dropping its row', () => {
    // ⚠️ The form requires a category, so this "cannot happen" — which is
    // exactly the condition under which dropping a row goes unnoticed. A
    // catalogue that silently omits a product is one somebody re-creates the
    // product in.
    const orphan = { id: 'p9', name: 'يتيم', category_id: null, sort_order: 1, is_active: true }
    const groups = catalogueGroups([orphan], CATEGORIES)
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBeNull()
    expect(groups[0].products.map((p) => p.id)).toEqual(['p9'])
  })

  it('does not reorder the table when the renamed folder has its own sort_order', () => {
    // ⚠️ Narrower than it first read. Renaming moves nothing only while
    // sort_order decides — and here c-hair is 1 and c-nails is 2, so the name
    // is never consulted. Stated precisely, because the general claim is false
    // and a test asserting it would have been asserting the fixture.
    const renamed = CATEGORIES.map((c) => (c.id === 'c-hair' ? { ...c, name: 'ياء آخر الأبجدية' } : c))
    const before = catalogueRows({ products: PRODUCTS, categories: CATEGORIES, categoryId: null })
    const after = catalogueRows({ products: PRODUCTS, categories: renamed, categoryId: null })
    expect(after.map((p) => p.id)).toEqual(before.map((p) => p.id))
  })
})

describe('the table follows the tree, not an id comparison', () => {
  // ⚠️ FOUND BY RENDERING THE COMPONENT, not by reading the sort. Comparing
  // category ids gave «شعر | أظافر | شامبو» — the subfolder detached from the
  // parent it lives inside, on a screen showing that hierarchy two panes away.
  it('puts a subfolder directly after its parent', () => {
    const groups = catalogueGroups(rows({}), CATEGORIES)
    expect(groups.map((g) => g.category && g.category.name))
      .toEqual(['شعر', 'شامبو', 'أظافر'])
  })

  it('reads the order from the same walk the tree pane uses', () => {
    // Not re-derived. Two implementations of "the order of the folders" are two
    // answers the day one of them learns about a third level.
    const order = categoryOrder(CATEGORIES)
    expect([...order.keys()]).toEqual(['c-hair', 'c-shampoo', 'c-nails'])
  })

  it('moves WITH the tree when a rename reorders, never against it', () => {
    // ⚠️ A first version of this asserted that renaming moves nothing, and that
    // is false: byOrder sorts on sort_order and falls back to the NAME when two
    // folders share one, which they do by default. The guarantee on offer is
    // not immobility — it is that the table and the tree move together, because
    // they are one walk.
    //
    // Two roots given the same sort_order so the name decides, then renamed to
    // flip them.
    const tied = [
      { id: 'c-hair', parent_id: null, name: 'شعر', sort_order: 1 },
      { id: 'c-nails', parent_id: null, name: 'أظافر', sort_order: 1 },
    ]
    const flipped = tied.map((c) => (c.id === 'c-nails' ? { ...c, name: 'ياء' } : c))

    expect([...categoryOrder(tied).keys()]).toEqual(['c-nails', 'c-hair'])
    expect([...categoryOrder(flipped).keys()]).toEqual(['c-hair', 'c-nails'])

    // And the table's order is that order, not a second opinion about it.
    //
    // Only the two roots are compared: `flipped` does not contain c-shampoo, so
    // its products rank as unknown and land at the end — correct, and beside
    // the point here. A first version of this assertion included them and
    // failed, which was the assertion being wrong rather than the sort.
    const of = (cats) => catalogueGroups(
      catalogueRows({ products: PRODUCTS, categories: cats, categoryId: null }), cats
    ).map((g) => g.categoryId)
    expect(of(flipped).slice(0, 2)).toEqual(['c-hair', 'c-nails'])
    expect(of(tied).slice(0, 2)).toEqual(['c-nails', 'c-hair'])
  })

  it('keeps every folder in exactly one run, including unknown ones', () => {
    // ⚠️ The invariant catalogueGroups depends on. Two products in two DIFFERENT
    // deleted folders both rank Infinity, and without the id tie-break they
    // interleave — producing two runs with the same heading and one the reader
    // cannot explain.
    const orphans = [
      { id: 'x1', name: 'أ', category_id: 'gone-b', sort_order: 1, is_active: true },
      { id: 'x2', name: 'ب', category_id: 'gone-a', sort_order: 1, is_active: true },
      { id: 'x3', name: 'ج', category_id: 'gone-b', sort_order: 2, is_active: true },
    ]
    const groups = catalogueGroups(
      catalogueRows({ products: [...PRODUCTS, ...orphans], categories: CATEGORIES, categoryId: null }),
      CATEGORIES
    )
    const ids = groups.map((g) => g.categoryId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('puts folders the tree does not know at the end', () => {
    // A deleted folder's products must not push the real catalogue down the page.
    const orphan = { id: 'x1', name: 'يتيم', category_id: 'gone', sort_order: 1, is_active: true }
    const groups = catalogueGroups(
      catalogueRows({ products: [...PRODUCTS, orphan], categories: CATEGORIES, categoryId: null }),
      CATEGORIES
    )
    expect(groups[groups.length - 1].category).toBeNull()
  })
})

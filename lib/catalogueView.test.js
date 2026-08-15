import { catalogueScope, catalogueRows, catalogueGroups, categoryOrder, tableOrder } from './catalogueView'
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

// 🔴 THE DEFAULT CHANGED FROM «no folder» TO «the root folder», AND THAT IS THE
// RULE CHANGE, NOT A FIXTURE TIDY-UP.
//
// «No folder chosen» used to mean every product; it now means NO products —
// the owner's rule, matching the reference, whose second screenshot shows
// folders present, none highlighted, and a blank grid.
//
// ⚠️ So a helper that keeps passing `categoryId: null` would be asserting the
// rows of an empty screen in a dozen tests that are about grouping, ordering
// and searching. They ask about the SHAPE of a row set; they are given a folder
// so there is one. The two tests that were genuinely about «no folder» are
// rewritten below rather than repaired.
const rows = (over) => catalogueRows({
  products: PRODUCTS, categories: CATEGORIES, categoryId: 'c-hair', search: '', hideArchived: false, ...over,
})

// Every product in the fixture, which is what «c-hair plus c-nails» comes to.
// Written as two folders rather than as «no folder», because «no folder» is not
// a way to ask for everything any more.
const allRows = (over) => [
  ...catalogueRows({ products: PRODUCTS, categories: CATEGORIES, categoryId: 'c-hair', ...over }),
  ...catalogueRows({ products: PRODUCTS, categories: CATEGORIES, categoryId: 'c-nails', ...over }),
]

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

  it('shows NOTHING when no folder is chosen', () => {
    // 🔴 THIS TEST USED TO ASSERT THE OPPOSITE, AND BOTH VERSIONS ARE RIGHT
    // ABOUT THEIR OWN MOMENT.
    //
    // It read: «the catalogue used to return an empty array here and draw a
    // hint — that is what made the search box lie: with no rows to search, a
    // real product answered ما في نتائج». True, and the fix was correct.
    //
    // The owner has since set the rule the reference uses: the grid stays empty
    // until a folder is picked. So the empty array is back — and the fault it
    // caused is closed by the OTHER half of the same decision rather than by
    // this behaviour, which is the test directly below.
    expect(catalogueRows({ products: PRODUCTS, categories: CATEGORIES, categoryId: null })).toEqual([])
  })

  it('searches the whole storage when no folder is chosen but a search is typed', () => {
    // 🔴 THE HALF THAT KEEPS THE OLD FAULT CLOSED. Somebody who does not know
    // the folder is exactly who uses the search box — and «no folder» must not
    // turn that into «ما في نتائج» about a product that exists.
    const scope = new Set(CATEGORIES.map((c) => c.id))
    const found = catalogueRows({
      products: PRODUCTS, categories: CATEGORIES, categoryId: null, search: 'شامبو', searchScope: scope,
    })
    expect(found.map((p) => p.id).sort()).toEqual(['p1', 'p2'])
  })

  it('narrows the search to the scope it was handed, not to everything', () => {
    // ⚠️ The storage's answer, and this file does not know what a storage is —
    // the screen hands the ids down. Searching «شامبو» while only the nails
    // folder is in scope finds nothing, because those products are not in this
    // storage's tree at all.
    const nailsOnly = new Set(['c-nails'])
    expect(catalogueRows({
      products: PRODUCTS, categories: CATEGORIES, categoryId: null, search: 'شامبو', searchScope: nailsOnly,
    })).toEqual([])
  })

  it('narrows to nothing for a folder that no longer exists', () => {
    // Fails closed. Silently widening a filtered list is worse than an empty
    // one, because the empty one is noticed.
    expect(rows({ categoryId: 'c-ghost' })).toEqual([])
    expect(catalogueScope('c-ghost', CATEGORIES).size).toBe(0)
  })

  it('still says «do not narrow» rather than «narrow to every id I found»', () => {
    // ⚠️ catalogueScope is UNCHANGED and still returns null for «no folder» —
    // the new rule lives in catalogueRows, which is what reads it. The
    // distinction is the one this function's header is about: a product whose
    // category was deleted has an id no set built from the category list can
    // contain, so «narrow to everything I could find» would hide exactly the
    // rows most worth seeing.
    expect(catalogueScope(null, CATEGORIES)).toBeNull()
  })

  it('lets a caller ask for «do not narrow» explicitly, orphans and all', () => {
    // 🔴 AND THIS IS WHAT «ALL STORAGES» PASSES. A null searchScope is «do not
    // narrow», which is a different statement from a set of every known id —
    // the orphan below proves it, and it is the row the old test was written
    // for. On a single storage the screen passes a real set instead, and the
    // orphan falls out with it, which is correct: its folder belongs to no
    // storage.
    const orphan = { id: 'p9', name: 'يتيم شامبو', category_id: 'c-gone', sort_order: 1, is_active: true }
    expect(catalogueRows({
      products: [...PRODUCTS, orphan], categories: CATEGORIES,
      categoryId: null, search: 'شامبو', searchScope: null,
    }).map((p) => p.id)).toContain('p9')

    const known = new Set(CATEGORIES.map((c) => c.id))
    expect(catalogueRows({
      products: [...PRODUCTS, orphan], categories: CATEGORIES,
      categoryId: null, search: 'شامبو', searchScope: known,
    }).map((p) => p.id)).not.toContain('p9')
  })
})

describe('search reads the scope it is shown beside', () => {
  it('finds a product without knowing its folder', () => {
    // 🔴 The whole reason anybody types in that box — and the case moved. It
    // used to mean «no folder chosen, so the search sees everything»; «no
    // folder» is empty now, so the same sentence is «no folder chosen AND a
    // scope handed down», which is what the screen does.
    const scope = new Set(CATEGORIES.map((c) => c.id))
    expect(catalogueRows({
      products: PRODUCTS, categories: CATEGORIES, categoryId: null, search: 'مبرد', searchScope: scope,
    }).map((p) => p.id)).toEqual(['p4'])
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
    const before = tableOrder(PRODUCTS, CATEGORIES)
    const after = tableOrder(PRODUCTS, renamed)
    expect(after.map((p) => p.id)).toEqual(before.map((p) => p.id))
  })
})

describe('the table follows the tree, not an id comparison', () => {
  // ⚠️ FOUND BY RENDERING THE COMPONENT, not by reading the sort. Comparing
  // category ids gave «شعر | أظافر | شامبو» — the subfolder detached from the
  // parent it lives inside, on a screen showing that hierarchy two panes away.
  it('puts a subfolder directly after its parent', () => {
    // Every folder at once, which no single selection produces any more —
    // so the sort is called by name rather than obtained from a view that has
    // been removed.
    const groups = catalogueGroups(tableOrder(PRODUCTS, CATEGORIES), CATEGORIES)
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
    const of = (cats) => catalogueGroups(tableOrder(PRODUCTS, cats), cats).map((g) => g.categoryId)
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
    const groups = catalogueGroups(tableOrder([...PRODUCTS, ...orphans], CATEGORIES), CATEGORIES)
    const ids = groups.map((g) => g.categoryId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('puts folders the tree does not know at the end', () => {
    // A deleted folder's products must not push the real catalogue down the page.
    const orphan = { id: 'x1', name: 'يتيم', category_id: 'gone', sort_order: 1, is_active: true }
    const groups = catalogueGroups(tableOrder([...PRODUCTS, orphan], CATEGORIES), CATEGORIES)
    expect(groups[groups.length - 1].category).toBeNull()
  })
})

describe('search inside a folder reaches its subfolders too', () => {
  // ⚠️ THE ONE COMBINATION THE OTHER TESTS MISS, named by review. Of the four
  // possible pairs — all/folder × search/no-search — three were covered:
  // everything unsearched, everything searched, and a LEAF folder searched.
  // A PARENT folder searched was not, and it is the only one where the two
  // fixes have to hold at once: the scope must include descendants AND the
  // search must run inside that widened scope rather than the folder alone.
  //
  // It should follow from `rows` being one list. "Should follow" is the reason
  // to assert it, not the reason to skip it.
  it('finds a product that lives in the subfolder, not the folder itself', () => {
    // شامبو زيتي is in c-shampoo, which is inside c-hair. Searching from c-hair
    // must reach it.
    expect(rows({ categoryId: 'c-hair', search: 'زيتي' }).map((p) => p.id)).toEqual(['p1'])
  })

  it('still refuses a product outside the chosen branch', () => {
    // Or the widening would have made the folder decorative — the search would
    // pass, and for the wrong reason.
    expect(rows({ categoryId: 'c-hair', search: 'مبرد' })).toEqual([])
  })

  it('matches what the same search finds with no folder chosen, narrowed', () => {
    // The property behind it: one list, filtered twice. The folder result is
    // the unfiltered result minus whatever falls outside the branch — never
    // something the wider search did not contain.
    const wide = rows({ search: 'زيتي' }).map((p) => p.id)
    const narrow = rows({ categoryId: 'c-hair', search: 'زيتي' }).map((p) => p.id)
    expect(narrow.every((id) => wide.includes(id))).toBe(true)
    expect(narrow).toEqual(wide)
  })
})

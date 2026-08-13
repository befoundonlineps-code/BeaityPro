import { renderToStaticMarkup } from 'react-dom/server'
import ProductsBrowser from './ProductsBrowser'
import { catalogueRows } from '../lib/catalogueView'
import { ALL_STORAGES } from '../lib/storageScope'

// ⚠️ THE ONE RESIDUAL THE OWNER'S EYE COULD NOT CLOSE.
//
// Three of stage 2's four cases tell on themselves: an empty table is obviously
// empty, a failed search obviously finds nothing, a subfolder's products are
// obviously there or not. «All products» is the exception — nobody looking at a
// long list can tell ALL from MOST, and the owner confirmed he did not check the
// numbers.
//
// The library test already asserts catalogueRows returns every product. That is
// a different claim from "the table DRAWS every row it was given": a slice, a
// nested map that loses a run, a grouping that drops its last group would all
// pass upstream and fail here.
//
// So it is counted at the render, which needs no owner and re-runs every suite.
jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

const CATEGORIES = [
  { id: 'c-hair', parent_id: null, name: 'شعر', sort_order: 1, is_active: true },
  { id: 'c-shampoo', parent_id: 'c-hair', name: 'شامبو', sort_order: 1, is_active: true },
  { id: 'c-nails', parent_id: null, name: 'أظافر', sort_order: 2, is_active: true },
]

const product = (id, categoryId, over) => ({
  id, name: `منتج ${id}`, category_id: categoryId, sort_order: 1,
  is_active: true, units_per_package: 1, base_unit: 'pcs', ...over,
})

// Spread across every folder, plus one whose folder is gone — the row most
// likely to be dropped by a grouping that assumes every product has a heading.
const PRODUCTS = [
  product('a', 'c-hair'), product('b', 'c-hair', { sort_order: 2 }),
  product('c', 'c-shampoo'), product('d', 'c-shampoo', { sort_order: 2 }),
  product('e', 'c-nails'),
  product('f', 'c-gone'),
]

// 🔴 THE RENDER OPENS ON A FOLDER NOW, AND THAT IS THE RULE CHANGE.
//
// «No folder chosen» used to mean every product, so a plain render showed the
// whole catalogue and this file could count it. It now means an EMPTY grid —
// the owner's rule, matching the reference — so a plain render has nothing to
// count and the guard would have had no reachable case left.
//
// ⚠️ AND THE GUARD IS THE ONE THE OWNER ASKED FOR BY NAME: «nobody looking at a
// long list can tell ALL from MOST». Losing it to a rule change would be the
// quiet kind of loss — the suite stays green and the commit reads as a feature.
//
// ⇒ ProductsBrowser takes its opening state as props, so every case is
// reachable again.
//
// ⚠️ AND THE DEFAULT RENDER IS «ALL STORAGES, SEARCHING», NOT «A FOLDER». A
// folder cannot contain «منتج f», whose folder was deleted — and that is the
// row a grouping is likeliest to drop, which is half of what this file guards.
// The one state that reaches every product is a search from «all storages»,
// where the scope is «do not narrow» rather than a set of known ids. Every
// fixture name starts with «منتج», so the search matches all six.
const STORAGE = 'stor-1'

// 🔴 الانتماءُ صفوفٌ في `storage_categories` لا عمودٌ على المجلّد — المجلّدُ
// يقدر يكون بأكتر من مستودع، وهو شرطُ النقل بين اثنين.
const LINKS = CATEGORIES.map((c) => ({
  id: `l-${c.id}`, storage_id: STORAGE, category_id: c.id,
}))
const render = (over) => renderToStaticMarkup(
  <ProductsBrowser
    salonId="s" suppliers={[]} storages={[]} balances={[]} storageCategories={LINKS}
    storageId={ALL_STORAGES}
    initialSearch="منتج"
    catalogue={{
      products: PRODUCTS, categories: CATEGORIES, loading: false, error: null, reload: () => {},
    }}
    {...over}
  />
)

// One folder, on one storage — the other reachable state, and the one the tree
// filter is live in.
const renderFolder = (over) => renderToStaticMarkup(
  <ProductsBrowser
    salonId="s" suppliers={[]} storages={[]} balances={[]} storageCategories={LINKS}
    storageId={STORAGE}
    initialCategoryId="c-hair"
    catalogue={{
      products: PRODUCTS, categories: CATEGORIES, loading: false, error: null, reload: () => {},
    }}
    {...over}
  />
)

// ⚠️ THE ROW'S OWN ATTRIBUTE, NOT ITS CLASSES.
//
// The first version counted `cursor-pointer` and got 7 for 6 products — the
// extra was the "hide archived" LABEL, which is also clickable. So it was
// narrowed to the row's exact class list, which fixed the count and pinned the
// test to the STYLING: converting the grid to the reference's dense look
// changed those classes and every count here dropped to zero, on a screen that
// draws all six rows perfectly well.
//
// ⇒ It counts identity now. `data-product-row` is on the row because it IS the
// row, and no restyle can move it — which is the project's own rule about
// browser-driven checks («the elements a check clicks carry their identity in
// the DOM») arriving at a rendered-markup check from the other side.
const drawnRows = (html) => (html.match(/data-product-row="/g) || []).length

describe('the table draws every row it was given', () => {
  it('draws ALL products, not most of them, when a search spans every storage', () => {
    // ⚠️ The residual, closed by counting. Six products in, six rows out — and
    // asserted against PRODUCTS.length rather than a literal, so adding a
    // fixture product cannot quietly make this test describe fewer.
    expect(drawnRows(render())).toBe(PRODUCTS.length)
  })

  it('names each one exactly once', () => {
    // A count alone would pass if one product were drawn twice and another not
    // at all — which is precisely what a mis-nested map produces.
    const html = render()
    for (const p of PRODUCTS) {
      expect(html.split(p.name).length - 1).toBe(1)
    }
  })

  it('keeps the row whose folder no longer exists', () => {
    // The row a grouping is most likely to lose, and the one nobody would miss.
    expect(render()).toContain('منتج f')
  })

  it('draws every row even when only some products have a balance', () => {
    // 🔴 THE STORAGE PICKER CHANGES ONE COLUMN. It does not change which rows
    // exist — and that sentence is what the whole design stands on.
    //
    // ⚠️ The leak that needs no mention of "storage" to happen: narrowing the
    // catalogue to products the balance data knows about. It reads as a
    // tidy-up, and «بلسم 250 مل» — zero movements in every storage (079b_3) —
    // is the first row it takes. Here that row is «منتج f», and every product
    // except two has no balance row at all.
    //
    // ⚠️ AND THIS IS THE SAME RESIDUAL THIS FILE WAS OPENED FOR: nobody looking
    // at a long list can tell ALL from MOST. A picker that quietly drops two
    // rows is exactly that, arriving through a new door.
    const balances = [
      { product_id: 'a', storage_id: 's1', balance_base: 75, avg_cost: 10, cost_has_estimate: false },
      { product_id: 'c', storage_id: 's2', balance_base: 0, avg_cost: null, cost_has_estimate: false },
    ]
    const storages = [{ id: 's1', name: 'عام' }, { id: 's2', name: 'تجريبي' }]
    expect(drawnRows(render({ balances, storages }))).toBe(PRODUCTS.length)
  })

  it('says «never moved» and «zero» in the same column and not the same way', () => {
    // 🔴 Both cases are live in the owner's data: «بلسم 250 مل» has no movement
    // at all and «سيروم علاجي 100 مل» has two live movements and a balance of
    // exactly zero. Drawing both as 0 tells the second story about the first.
    //
    // Product 'c' has a balance row reading zero; every other product has none.
    const balances = [
      { product_id: 'c', storage_id: 's2', balance_base: 0, avg_cost: null, cost_has_estimate: false },
    ]
    const html = render({ balances, storages: [{ id: 's2', name: 'تجريبي' }] })
    expect(html).toContain('products:balances.neverMoved')
    expect(html).toContain('products:balances.inBase')
  })

  it('does not claim «never moved» while the balances are still in flight', () => {
    // 🔴 The fourth state, and the reason it needed one: the seed that draws
    // «ما تحرّك بعد» for every product when no balance rows are present is TRUE
    // for a salon that has moved nothing and FALSE for a page whose fetch is
    // still out. Both looked identical.
    //
    // ⚠️ False in the REASSURING direction, which is the worse one — the reader
    // takes "never moved" for "nothing in stock" and walks off. And reachable
    // on every first paint: the page hands over `balances.balances` alone,
    // while useProductBalances starts at [] with loading true.
    const html = render({ balances: [], balancesLoading: true })
    expect(html).not.toContain('products:balances.neverMoved')
    expect(html).toContain('products:columns.balanceLoading')
    // And the catalogue does not wait on it — the rows are readable meanwhile.
    expect(drawnRows(html)).toBe(PRODUCTS.length)
  })

  it('says the balance is unavailable rather than saying zero', () => {
    // A failed fetch is the same lie as the one above, except permanent. It has
    // to name itself: not zero, not never-moved, not blank.
    const html = render({ balances: [], balancesError: new Error('boom') })
    expect(html).not.toContain('products:balances.neverMoved')
    expect(html).toContain('products:columns.balanceUnavailable')
    expect(drawnRows(html)).toBe(PRODUCTS.length)
  })

  it('draws exactly what the scope says, folder by folder', () => {
    // ⚠️ Compared against catalogueRows rather than against a number typed here.
    // A literal would have to be updated whenever the fixture moves, and the
    // person updating it would be writing down whatever the code now does.
    //
    // 🔴 AND EVERY FOLDER IS RENDERED NOW, NOT ONE. This used to say «the screen
    // holds the selection itself, so only the unfiltered case can be rendered
    // directly — the rest assert the rule the screen reads», which is a test
    // checking the library twice and the render once. The opening folder is a
    // prop, so each case is a real render.
    for (const categoryId of ['c-hair', 'c-shampoo', 'c-nails']) {
      const expected = catalogueRows({
        products: PRODUCTS, categories: CATEGORIES, categoryId,
      }).length
      expect(expected).toBeGreaterThan(0)
      expect(drawnRows(renderFolder({ initialCategoryId: categoryId }))).toBe(expected)
    }
  })

  it('draws nothing at all, and says why, when no folder is chosen', () => {
    // 🔴 THE OWNER'S POINT, ARRIVING FROM THE REFERENCE ANALYSIS: a blank grid
    // ALONE cannot tell «no folder chosen» from «this folder is empty». In the
    // reference's second screenshot the blank was only readable because the
    // toolbar showed nothing selected — so here the grid says it in words.
    const html = renderFolder({ initialCategoryId: null })
    expect(drawnRows(html)).toBe(0)
    expect(html).toContain('data-empty-state="pick-folder"')
    expect(html).not.toContain('data-empty-state="folder-empty"')
  })

  it('says «this folder is empty» with different words from «pick a folder»', () => {
    // The other half of the same point. Two states, two sentences — and the
    // test asserts they are DIFFERENT, because one message for both is the
    // blank grid again with extra steps.
    const empty = { ...CATEGORIES[2], id: 'c-empty', name: 'فاضي' }
    const html = renderToStaticMarkup(
      <ProductsBrowser
        salonId="s" suppliers={[]} storages={[]} balances={[]}
        storageCategories={[...LINKS, { id: 'l-empty', storage_id: STORAGE, category_id: 'c-empty' }]}
        storageId={STORAGE}
        initialCategoryId="c-empty"
        catalogue={{
          products: PRODUCTS, categories: [...CATEGORIES, empty],
          loading: false, error: null, reload: () => {},
        }}
      />
    )
    expect(drawnRows(html)).toBe(0)
    expect(html).toContain('data-empty-state="folder-empty"')
    expect(html).not.toContain('data-empty-state="pick-folder"')
  })

  it('shows a storage only its own folders, and says so when it has none', () => {
    // 🔴 The tree narrows and the balance does not — lib/treeVsBalanceScope
    // asserts the pair. This is the RENDER half: a storage with nothing
    // assigned to it draws an empty tree that names the reason instead of a
    // blank pane that reads as a failed load.
    const html = renderFolder({ storageId: 'stor-with-nothing', initialCategoryId: null })
    expect(html).toContain('products:refShell.noFoldersHere')
    expect(html).not.toContain('products:noCategoriesTitle')
  })
})

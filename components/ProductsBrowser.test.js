import { renderToStaticMarkup } from 'react-dom/server'
import ProductsBrowser from './ProductsBrowser'
import { catalogueRows } from '../lib/catalogueView'

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

const render = (over) => renderToStaticMarkup(
  <ProductsBrowser
    salonId="s" suppliers={[]} storages={[]} balances={[]}
    catalogue={{
      products: PRODUCTS, categories: CATEGORIES, loading: false, error: null, reload: () => {},
    }}
    {...over}
  />
)

// ⚠️ THE ROW'S OWN CLASSES, not just `cursor-pointer` — which the first version
// counted and got 7 for 6 products. The extra was the "hide archived" LABEL,
// which is also clickable. A counter that catches anything clickable is a
// counter that reports a duplicate row where there is none, and the next person
// reads it as the code being wrong.
//
// Corroborated by the test below it: every name appears exactly once, which
// already ruled out a real duplicate before this was traced.
const drawnRows = (html) => (html.match(/cursor-pointer border-b border-border\/60/g) || []).length

describe('the table draws every row it was given', () => {
  it('draws ALL products, not most of them, when no folder is chosen', () => {
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
    for (const categoryId of [null, 'c-hair', 'c-shampoo', 'c-nails']) {
      const expected = catalogueRows({
        products: PRODUCTS, categories: CATEGORIES, categoryId,
      }).length
      // The screen holds the selection itself, so only the unfiltered case can
      // be rendered directly — the rest assert the rule the screen reads.
      if (categoryId === null) expect(drawnRows(render())).toBe(expected)
      else expect(expected).toBeGreaterThan(0)
    }
  })
})

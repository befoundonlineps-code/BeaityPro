import { renderToStaticMarkup } from 'react-dom/server'
import ProductOrderScreen from './ProductOrderScreen'

// The wiring layer, tested the way this module tests wiring since the return
// screen drew none of stage 4: static markup, no jsdom, no new dependency. What
// it answers is which elements the component CHOOSES to emit. What it cannot —
// whether the table is legible — is the owner's eye, and this does not pretend
// otherwise.
jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key) }),
}))

const SUPPLIERS = [{ id: 'sup1', name: 'المورّد' }, { id: 'sup2', name: 'التاني' }]
const PRODUCTS = [
  { id: 'p1', name: 'شامبو', base_unit: 'ml', units_per_package: 250 },
  { id: 'p2', name: 'مشط', base_unit: 'pcs', units_per_package: 12 },
]

const ORDERS = [
  { id: 'o1', supplier_id: 'sup1', order_date: '2020-03-01', note: 'عاجل' },
  { id: 'o2', supplier_id: 'sup2', order_date: '2020-02-01', note: null },
  { id: 'o3', supplier_id: 'sup1', order_date: '2020-01-01', note: null },
]

const LINES = [
  { id: 'l1', order_id: 'o1', product_id: 'p1', entered_quantity: 2, entered_uom: 'package', entered_unit_price: 100, sort_order: 0 },
  { id: 'l2', order_id: 'o1', product_id: 'p2', entered_quantity: 5, entered_uom: 'unit', entered_unit_price: null, sort_order: 1 },
  // o2 is entirely unpriced — the case the total has a different sentence for.
  { id: 'l3', order_id: 'o2', product_id: 'p1', entered_quantity: 1, entered_uom: 'unit', entered_unit_price: null, sort_order: 0 },
  // o3 has no lines at all, which is a state only a half-failed create makes —
  // and the list must still draw it, because it is the row somebody deletes.
]

const render = (over = {}) => renderToStaticMarkup(
  <ProductOrderScreen
    salonId="sal1" orders={ORDERS} lines={LINES}
    suppliers={SUPPLIERS} products={PRODUCTS}
    loading={false} error={null} reload={() => {}}
    {...over}
  />
)

// ⚠️ The row's OWN classes, not anything clickable. Counting `cursor-pointer`
// once returned 7 for 6 products in ProductsBrowser, because a checkbox label
// carried it too — and a counter that reports a duplicate row where there is
// none gets read as the code being wrong.
const drawnRows = (html) => (html.match(/border-b border-border\/60/g) || []).length

describe('the list draws every order it was given', () => {
  it('draws ALL of them, not most', () => {
    // Asserted against ORDERS.length rather than a literal, so adding a fixture
    // order cannot quietly make this test describe fewer.
    expect(drawnRows(render())).toBe(ORDERS.length)
  })

  it('keeps the order that has no lines', () => {
    // ⚠️ orderPayload refuses to CREATE an empty order, so this row can only
    // come from a create whose second write failed. It is exactly the row a
    // grouping drops, and exactly the row somebody needs to find in order to
    // delete it.
    const html = render()
    expect(html).toContain('2020-01-01')
  })

  it('names each supplier on its own order', () => {
    const html = render()
    expect(html.split('المورّد').length - 1).toBe(2)
    expect(html.split('التاني').length - 1).toBe(1)
  })
})

describe('what an order is worth, on screen', () => {
  it('says "no prices" rather than zero when nothing is priced', () => {
    // ⚠️ The distinction the whole module keeps: "nobody has agreed prices" is
    // not the statement "this costs nothing". A 0 here would be a claim.
    expect(render({ orders: [ORDERS[1]] })).toContain('products:orders.totalUnpriced')
  })

  it('reports the priced part and how much of the order that was', () => {
    // o1 is 2 × 100 priced and one line unpriced.
    const html = render({ orders: [ORDERS[0]] })
    expect(html).toContain('products:orders.totalPartial')
    expect(html).toContain('&quot;priced&quot;:1')
    expect(html).toContain('&quot;count&quot;:2')
  })

  it('treats an order with no lines as unpriced rather than as zero', () => {
    expect(render({ orders: [ORDERS[2]] })).toContain('products:orders.totalUnpriced')
  })
})

describe('the empty and failed states say which they are', () => {
  it('offers the hint rather than an empty table when there are no orders', () => {
    const html = render({ orders: [], lines: [] })
    expect(html).toContain('products:orders.emptyTitle')
    expect(drawnRows(html)).toBe(0)
  })

  it('draws the failure instead of an empty list when the read failed', () => {
    // ⚠️ An order list is legitimately empty on a fresh salon, so a swallowed
    // failure would not fail — it would reassure. Item 26, earned again.
    const html = render({ error: new Error('boom'), orders: [], lines: [] })
    expect(html).toContain('products:orders.loadFailedTitle')
    expect(html).not.toContain('products:orders.emptyTitle')
  })
})

describe('nothing destructive is open before it is asked for', () => {
  it('draws neither the editor nor the delete question on arrival', () => {
    const html = render()
    expect(html).not.toContain('products:orders.linesTitle')
    expect(html).not.toContain('products:orders.deleteTitle')
    // And the way in is present, which is the other half of the claim.
    expect(html).toContain('products:orders.newButton')
  })
})

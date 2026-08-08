import { renderToStaticMarkup } from 'react-dom/server'
import StocktakeScreen from './StocktakeScreen'

// ⚠️ THE COUNTS MUST NOT LIVE INSIDE THIS COMPONENT, and the whole suite passed
// for as long as they did.
//
// The page draws each tab as `{view === 'stocktake' && <StocktakeScreen/>}`, so
// leaving the tab unmounts the screen and React discards its state. Somebody
// halfway through counting a shelf who stepped over to the balances tab to
// check a figure came back to an empty sheet — nothing asked, nothing
// recoverable, and post_stocktake stores no counts (item 44) so it is gone for
// good.
//
// It also made the storage-lens guard worse than useless: the pending total was
// reported upward and survived the unmount, so changing storage after stepping
// away asked "you will lose 3 lines" about work already destroyed. The guard
// would have shown its red question and looked correct.
//
// Nothing in this project could catch that by reading state, so it is asked as
// a behaviour: hand the screen a count and see whether it draws it. A component
// holding its own would ignore the prop and render an empty box.
jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

const PRODUCTS = [
  { id: 'p-tube', name: 'شامبو', category_id: 'c1', is_active: true, units_per_package: 250, base_unit: 'ml', sort_order: 1 },
  { id: 'p-scis', name: 'مقص', category_id: 'c1', is_active: true, units_per_package: 1, base_unit: 'pcs', sort_order: 2 },
]

const BASE = {
  balances: [
    { storage_id: 's1', product_id: 'p-tube', balance_base: 500, avg_cost: 2, cost_has_estimate: false },
    { storage_id: 's1', product_id: 'p-scis', balance_base: 4, avg_cost: 10, cost_has_estimate: false },
  ],
  products: PRODUCTS,
  categories: [{ id: 'c1', parent_id: null, name: 'شعر' }],
  storageId: 's1',
  loading: false,
  error: null,
  onPosted: () => {},
  salonId: 'sal1',
  userId: 'u1',
}

// ⚠️ The counts arrive as one object now instead of four props, because they
// are a cache over rows rather than page state — but the claim these tests make
// has not changed and must not: this screen keeps NO count of its own. Handed
// different counts it draws different numbers, and there is no path by which it
// remembers one.
const sheet = (over) => ({
  session: null, startedBy: null, startedAt: null,
  counts: {}, uoms: {}, writeError: null,
  setCounts: () => {}, setUoms: () => {}, reload: () => {},
  writeCount: () => {}, discard: () => {}, clearAfterPost: () => {},
  ...over,
})

const render = (over = {}) => {
  const { counts, uoms, ...rest } = over
  // ⚠️ Only the keys actually given. Spreading `{ counts: undefined }` would
  // overwrite the default with undefined and every test would die reading a
  // property of it — a harness that fails LOUDLY, luckily, and the reason this
  // is written out rather than passed straight through.
  const given = {}
  if (counts !== undefined) given.counts = counts
  if (uoms !== undefined) given.uoms = uoms
  return renderToStaticMarkup(<StocktakeScreen {...BASE} {...rest} stocktake={sheet(given)} />)
}

const valuesOf = (html) => [...html.matchAll(/<input[^>]*value="([^"]*)"/g)].map((m) => m[1])

describe('the counts are owned above this screen', () => {
  it('draws a count it was handed', () => {
    // The property that makes them survive an unmount: they are not this
    // component's to lose.
    expect(valuesOf(render({ counts: { 'p-tube': '7' } }))).toContain('7')
  })

  it('draws nothing when handed nothing', () => {
    // The other direction, without which the assertion above would pass on a
    // screen that renders '7' for its own reasons.
    expect(valuesOf(render({ counts: {} }))).not.toContain('7')
  })

  it('reflects a changed count without any state of its own being touched', () => {
    // Two renders of the same component with different props. A screen holding
    // its own counts would show the first value both times.
    expect(valuesOf(render({ counts: { 'p-tube': '3' } }))).toContain('3')
    expect(valuesOf(render({ counts: { 'p-tube': '9' } }))).toContain('9')
  })

  it('takes the counting frame from above too', () => {
    // ⚠️ The frames have to travel with the counts. Keeping them here while the
    // counts moved would mean a sheet that survives a tab switch with its
    // numbers and loses the units they were counted in — three tubes reread as
    // three millilitres, which is a worse answer than an empty box because it
    // is a plausible one.
    const html = render({ counts: { 'p-tube': '3' }, uoms: { 'p-tube': 'unit' } })
    // Counted in base units, so no second frame is drawn: the two are one
    // number. With the default (packages) it would read "مل: 750".
    expect(html).not.toContain('750')
  })

  it('converts by the frame it was handed, not by a default it kept', () => {
    const html = render({ counts: { 'p-tube': '3' }, uoms: {} })
    expect(html).toContain('750')
  })
})

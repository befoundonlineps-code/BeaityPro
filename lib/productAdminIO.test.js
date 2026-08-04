import { saveSetComponents } from './productAdminIO'

// Only the component diff is covered. The four table writes go through a
// chained PostgREST builder, and a fake of that chain would be a test of the
// fake — what they send is decided in lib/productForm.js, which is tested
// directly. The diff is different: it is a decision, and it is the one that
// can be subtly wrong.
function fakeClient() {
  const calls = []
  const table = (name) => ({
    delete: () => ({ in: (col, ids) => { calls.push(['delete', name, col, ids]); return { error: null } } }),
    update: (patch) => ({ eq: (col, id) => { calls.push(['update', name, id, patch]); return { error: null } } }),
    insert: (rows) => { calls.push(['insert', name, rows]); return { error: null } },
  })
  return { client: { from: table }, calls }
}

// sort_order is NOT NULL on the table, so a row read back always carries it.
// The helper carries it too, because a stand-in row shaped differently from a
// real one is how a comparison against a missing field passes here and fails
// there.
const row = (id, productId, qty, sortOrder = 0) => ({
  id, component_product_id: productId, quantity_base: qty, sort_order: sortOrder,
})

describe('saveSetComponents', () => {
  it('inserts what was added, with its position', async () => {
    const { client, calls } = fakeClient()
    await saveSetComponents({
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [],
      components: [{ productId: 'p1', quantityBase: 2 }],
    }, client)

    expect(calls).toEqual([['insert', 'product_set_components', [{
      salon_id: 'sal1', set_product_id: 'set1', component_product_id: 'p1',
      quantity_base: 2, sort_order: 0,
    }]]])
  })

  it('numbers the inserted rows by their place in the list', async () => {
    // The column defaults to 0, so leaving it out is not "no opinion" — it is
    // every row claiming to be first, and .order('sort_order') then returns
    // them in whatever order it likes. Somebody who arranges a set carefully
    // finds it shuffled the next time they open it.
    const { client, calls } = fakeClient()
    await saveSetComponents({
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [],
      components: [
        { productId: 'p1', quantityBase: 1 },
        { productId: 'p2', quantityBase: 1 },
        { productId: 'p3', quantityBase: 1 },
      ],
    }, client)

    expect(calls[0][2].map((r) => [r.component_product_id, r.sort_order]))
      .toEqual([['p1', 0], ['p2', 1], ['p3', 2]])
  })

  it('moves a row that changed places without touching its quantity', async () => {
    const { client, calls } = fakeClient()
    await saveSetComponents({
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [row('r1', 'p1', 2, 0), row('r2', 'p2', 3, 1)],
      components: [
        { productId: 'p2', quantityBase: 3 },
        { productId: 'p1', quantityBase: 2 },
      ],
    }, client)

    expect(calls).toEqual([
      ['update', 'product_set_components', 'r1', { sort_order: 1 }],
      ['update', 'product_set_components', 'r2', { sort_order: 0 }],
    ])
  })

  it('renumbers the rows left behind when one in the middle is removed', async () => {
    // Deleting the first of three leaves the others at 1 and 2 with nothing at
    // 0. Harmless to read today, and a gap that grows every time it happens.
    const { client, calls } = fakeClient()
    await saveSetComponents({
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [row('r1', 'p1', 1, 0), row('r2', 'p2', 1, 1), row('r3', 'p3', 1, 2)],
      components: [{ productId: 'p2', quantityBase: 1 }, { productId: 'p3', quantityBase: 1 }],
    }, client)

    expect(calls).toEqual([
      ['delete', 'product_set_components', 'id', ['r1']],
      ['update', 'product_set_components', 'r2', { sort_order: 0 }],
      ['update', 'product_set_components', 'r3', { sort_order: 1 }],
    ])
  })

  it('deletes what was removed', async () => {
    const { client, calls } = fakeClient()
    await saveSetComponents({
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [row('r1', 'p1', 2)],
      components: [],
    }, client)

    expect(calls).toEqual([['delete', 'product_set_components', 'id', ['r1']]])
  })

  it('updates a quantity in place rather than deleting and re-adding', async () => {
    // unique(set_product_id, component_product_id) would reject the insert
    // before the delete had committed on some orderings, and the row's id
    // would change for no reason anybody could see.
    const { client, calls } = fakeClient()
    await saveSetComponents({
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [row('r1', 'p1', 2)],
      components: [{ productId: 'p1', quantityBase: 5 }],
    }, client)

    expect(calls).toEqual([['update', 'product_set_components', 'r1', { quantity_base: 5 }]])
  })

  it('leaves an unchanged component completely alone', async () => {
    const { client, calls } = fakeClient()
    await saveSetComponents({
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [row('r1', 'p1', 2)],
      components: [{ productId: 'p1', quantityBase: 2 }],
    }, client)

    expect(calls).toEqual([])
  })

  it('deletes before inserting when one component replaces another', async () => {
    const { client, calls } = fakeClient()
    await saveSetComponents({
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [row('r1', 'p1', 2)],
      components: [{ productId: 'p2', quantityBase: 3 }],
    }, client)

    expect(calls[0][0]).toBe('delete')
    expect(calls[1][0]).toBe('insert')
  })

  it('compares quantities and positions as numbers, not as strings', async () => {
    // The row comes back from PostgREST with numerics that may arrive as
    // strings. '2' !== 2 would rewrite every component on every save.
    const { client, calls } = fakeClient()
    await saveSetComponents({
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [{
        id: 'r1', component_product_id: 'p1', quantity_base: '2', sort_order: '0',
      }],
      components: [{ productId: 'p1', quantityBase: '2' }],
    }, client)

    expect(calls).toEqual([])
  })

  it('survives nothing on either side', async () => {
    const { client, calls } = fakeClient()
    await saveSetComponents({ setProductId: 'set1', salonId: 'sal1' }, client)
    expect(calls).toEqual([])
  })
})

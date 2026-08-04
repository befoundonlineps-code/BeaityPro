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

const row = (id, productId, qty) => ({ id, component_product_id: productId, quantity_base: qty })

describe('saveSetComponents', () => {
  it('inserts what was added', async () => {
    const { client, calls } = fakeClient()
    await saveSetComponents({
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [],
      components: [{ productId: 'p1', quantityBase: 2 }],
    }, client)

    expect(calls).toEqual([['insert', 'product_set_components', [{
      salon_id: 'sal1', set_product_id: 'set1', component_product_id: 'p1', quantity_base: 2,
    }]]])
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

  it('compares quantities as numbers, not as strings', async () => {
    // The row comes back from PostgREST with a numeric that may arrive as a
    // string. '2' !== 2 would rewrite every component on every save.
    const { client, calls } = fakeClient()
    await saveSetComponents({
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [{ id: 'r1', component_product_id: 'p1', quantity_base: '2' }],
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

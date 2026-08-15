import { saveSetComponents, linkFolderToStorages } from './productAdminIO'

// Only the component diff is covered. The four table writes go through a
// chained PostgREST builder, and a fake of that chain would be a test of the
// fake — what they send is decided in lib/productForm.js, which is tested
// directly. The diff is different: it is a decision, and it is the one that
// can be subtly wrong.
//
// ⚠️ Every verb ends in .select() and hands back rows, because that is the only
// thing that tells a write RLS refused apart from a write that succeeded — the
// refusal is 200 with an empty body. `refuse` makes one verb answer that way.
function fakeClient(refuse = {}) {
  const calls = []
  const answer = (verb, rows) => ({ data: refuse[verb] ? [] : rows, error: null })
  const table = (name) => ({
    delete: () => ({ in: (col, ids) => ({ select: () => {
      calls.push(['delete', name, col, ids])
      return answer('delete', ids.map((id) => ({ id })))
    } }) }),
    update: (patch) => ({ eq: (col, id) => ({ select: () => {
      calls.push(['update', name, id, patch])
      return answer('update', [{ id }])
    } }) }),
    insert: (rows) => ({ select: () => {
      calls.push(['insert', name, rows])
      return answer('insert', rows.map((r, i) => ({ id: `new${i}`, ...r })))
    } }),
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

  describe('a write that changed nothing is a refusal, not a success', () => {
    // This file's own header says it: under RLS a delete or an update that no
    // policy allows returns 200 with an empty body and no error. Only the
    // insert raises. So the two verbs that can lie were exactly the two that
    // were not being counted.
    const args = {
      setProductId: 'set1', salonId: 'sal1',
      existingRows: [row('r1', 'p1', 2), row('r2', 'p2', 1)],
      components: [{ productId: 'p2', quantityBase: 9 }, { productId: 'p3', quantityBase: 1 }],
    }

    it('catches a delete that removed nothing', async () => {
      const { client } = fakeClient({ delete: true })
      const { ok } = await saveSetComponents(args, client)
      expect(ok).toBe(false)
    })

    it('catches an update that changed nothing', async () => {
      const { client } = fakeClient({ update: true })
      const { ok } = await saveSetComponents(args, client)
      expect(ok).toBe(false)
    })

    it('catches an insert that wrote nothing', async () => {
      const { client } = fakeClient({ insert: true })
      const { ok } = await saveSetComponents(args, client)
      expect(ok).toBe(false)
    })

    it('stops at the first refusal instead of writing on top of it', async () => {
      // Carrying on would turn one silent refusal into a set whose components
      // are neither what was there nor what was asked for.
      const { client, calls } = fakeClient({ delete: true })
      await saveSetComponents(args, client)
      expect(calls.map((c) => c[0])).toEqual(['delete'])
    })

    it('reports the refusal with no error, so the screen says its own sentence', async () => {
      // There is nothing for reportDbError to translate — the database did not
      // complain. The caller has to have its own words for this.
      const { client } = fakeClient({ delete: true })
      expect(await saveSetComponents(args, client)).toEqual({ ok: false, error: null })
    })

    it('still succeeds when every write returned its rows', async () => {
      const { client } = fakeClient()
      expect(await saveSetComponents(args, client)).toEqual({ ok: true, error: null })
    })
  })
})

describe('linkFolderToStorages — a new folder joins the storages it inherited', () => {
  it('writes one row per storage, with the salon on each', () => {
    const { client, calls } = fakeClient()
    return linkFolderToStorages(
      { categoryId: 'c1', salonId: 'salon', storageIds: ['s1', 's2'] }, client
    ).then((result) => {
      expect(result.ok).toBe(true)
      expect(calls).toEqual([['insert', 'storage_categories', [
        { salon_id: 'salon', storage_id: 's1', category_id: 'c1' },
        { salon_id: 'salon', storage_id: 's2', category_id: 'c1' },
      ]]])
    })
  })

  it('never mentions `seeded`, so the default writes «a person decided this»', () => {
    // 🔴 العمودُ افتراضُه `false` = قرارُ إنسان، و٠٦٦ب وحدَه كتب `true` صراحةً
    // للبذرة الأولى. **وذكرُه هنا هو بالضبط ما يعيد الفرقَ إلى الضياع** — وهو
    // فرقٌ لزمه عمودٌ كامل ليمكن قولُه.
    const { client, calls } = fakeClient()
    return linkFolderToStorages(
      { categoryId: 'c1', salonId: 'salon', storageIds: ['s1'] }, client
    ).then(() => {
      expect(JSON.stringify(calls)).not.toMatch(/seeded/)
    })
  })

  it('deduplicates, because one repeated id takes the whole batch down', () => {
    // `unique(storage_id, category_id)` بالقاعدة: صفٌّ مكرَّرٌ يُسقط الدفعةَ
    // كلَّها — الصفوفَ السليمة معها.
    const { client, calls } = fakeClient()
    return linkFolderToStorages(
      { categoryId: 'c1', salonId: 'salon', storageIds: ['s1', 's1'] }, client
    ).then(() => {
      expect(calls[0][2]).toHaveLength(1)
    })
  })

  it('writes nothing at all rather than an empty insert', () => {
    const { client, calls } = fakeClient()
    return linkFolderToStorages(
      { categoryId: 'c1', salonId: 'salon', storageIds: [] }, client
    ).then((result) => {
      expect(result.ok).toBe(true)
      expect(calls).toEqual([])
    })
  })

  it('reads the rows back and counts them — a refusal is 200 with an empty body', () => {
    // ⚠️ الشكلُ الوحيد الذي يفرّق كتابةً رفضتها RLS عن كتابةٍ نجحت. بلا هذا
    // يرجع «تمّ» عن مجلّدٍ لم يُربط بشيء.
    const { client } = fakeClient({ insert: true })
    return linkFolderToStorages(
      { categoryId: 'c1', salonId: 'salon', storageIds: ['s1'] }, client
    ).then((result) => {
      expect(result.ok).toBe(false)
    })
  })
})

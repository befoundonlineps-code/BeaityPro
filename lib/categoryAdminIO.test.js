import { saveCategory, setCategoryArchived, setServiceArchived } from './categoryAdminIO'

// Records what was asked of the client. The shape of the request is the part
// that goes wrong invisibly: an update without its eq would archive every
// category in the salon and look identical from the calling component.
function fakeClient({ rows = [{ id: 'x' }], error = null } = {}) {
  const calls = []
  return {
    calls,
    from(table) {
      const call = { table }
      calls.push(call)
      return {
        insert(rowsIn) {
          call.op = 'insert'
          call.rows = rowsIn
          return { select: () => Promise.resolve({ data: error ? null : rows, error }) }
        },
        update(patch) {
          call.op = 'update'
          call.patch = patch
          return {
            eq(column, value) {
              call.eq = [column, value]
              return { select: () => Promise.resolve({ data: error ? null : rows, error }) }
            },
          }
        },
      }
    },
  }
}

describe('setCategoryArchived', () => {
  it('writes is_active false when archiving, by id', async () => {
    const client = fakeClient()
    expect(await setCategoryArchived('c1', true, client)).toEqual({ ok: true, error: null })
    expect(client.calls).toEqual([
      { table: 'service_categories', op: 'update', patch: { is_active: false }, eq: ['id', 'c1'] },
    ])
  })

  it('writes is_active true when restoring', async () => {
    const client = fakeClient()
    await setCategoryArchived('c1', false, client)
    expect(client.calls[0].patch).toEqual({ is_active: true })
  })

  it('touches nothing but the flag', async () => {
    // Categories carry a name, a parent, a business type and a pricing role;
    // a patch mentioning any of them would rewrite it from stale props.
    const client = fakeClient()
    await setCategoryArchived('c1', true, client)
    expect(Object.keys(client.calls[0].patch)).toEqual(['is_active'])
  })

  it('never sends an update without an id to match', async () => {
    const client = fakeClient()
    await setCategoryArchived('c1', true, client)
    expect(client.calls[0].eq).toEqual(['id', 'c1'])
  })

  it('treats a write that matched no row as a failure', async () => {
    // What RLS refusing an update looks like: no error, no data.
    const client = fakeClient({ rows: [] })
    expect(await setCategoryArchived('c1', true, client)).toEqual({ ok: false, error: null })
  })

  it('hands the database error back', async () => {
    const client = fakeClient({ error: { code: '42501', message: 'denied' } })
    const result = await setCategoryArchived('c1', true, client)
    expect(result.ok).toBe(false)
    expect(result.error).toMatchObject({ code: '42501' })
  })
})

describe('setServiceArchived', () => {
  it('is the same write against the services table', async () => {
    const client = fakeClient()
    expect(await setServiceArchived('s1', true, client)).toEqual({ ok: true, error: null })
    expect(client.calls).toEqual([
      { table: 'services', op: 'update', patch: { is_active: false }, eq: ['id', 's1'] },
    ])
  })

  it('restores as readily as it archives', async () => {
    const client = fakeClient()
    await setServiceArchived('s1', false, client)
    expect(client.calls[0].patch).toEqual({ is_active: true })
  })
})

describe('saveCategory', () => {
  // The bug this was written for: a folder created under a sub-category came
  // back somewhere other than where it was put. There was no test that a
  // non-root parent reached the database at all.
  it('sends the chosen parent, even when that parent is itself a child', async () => {
    const client = fakeClient()
    await saveCategory(
      { name: 'جراحة عامة', parentId: 'sub-2', businessType: '', salonId: 'salon-1' },
      client
    )

    expect(client.calls[0].op).toBe('insert')
    expect(client.calls[0].rows).toEqual([{
      name: 'جراحة عامة',
      parent_id: 'sub-2',
      business_type: null,
      salon_id: 'salon-1',
    }])
  })

  it('sends a root with its type and no parent', async () => {
    const client = fakeClient()
    await saveCategory({ name: 'جذر', parentId: '', businessType: 'nails', salonId: 'salon-1' }, client)
    expect(client.calls[0].rows[0]).toMatchObject({ parent_id: null, business_type: 'nails' })
  })

  it('clears the type when a root is moved under a parent', async () => {
    // The check constraint forbids a type on a sub-category, and an update
    // that left the key out would leave the old one there to be rejected.
    const client = fakeClient()
    await saveCategory({ id: 'c1', name: 'كان جذرًا', parentId: 'r', businessType: 'nails' }, client)
    expect(client.calls[0].op).toBe('update')
    expect(client.calls[0].patch).toEqual({ name: 'كان جذرًا', parent_id: 'r', business_type: null })
    expect(client.calls[0].eq).toEqual(['id', 'c1'])
  })

  it('always sends both keys, so neither can be left behind', async () => {
    const client = fakeClient()
    await saveCategory({ id: 'c1', name: 'x', parentId: '', businessType: 'nails' }, client)
    expect(Object.keys(client.calls[0].patch).sort()).toEqual(['business_type', 'name', 'parent_id'])
  })

  it('trims the name', async () => {
    const client = fakeClient()
    await saveCategory({ name: '  مسافات  ', parentId: 'p', salonId: 's' }, client)
    expect(client.calls[0].rows[0].name).toBe('مسافات')
  })

  it('treats a write that matched no row as a failure', async () => {
    const client = fakeClient({ rows: [] })
    expect(await saveCategory({ name: 'x', parentId: 'p', salonId: 's' }, client))
      .toEqual({ ok: false, error: null, row: null })
  })

  it('hands the saved row back so the caller can find it again', async () => {
    const client = fakeClient({ rows: [{ id: 'new-1', parent_id: 'sub-2' }] })
    const result = await saveCategory({ name: 'x', parentId: 'sub-2', salonId: 's' }, client)
    expect(result).toEqual({ ok: true, error: null, row: { id: 'new-1', parent_id: 'sub-2' } })
  })
})

import { setCategoryArchived, setServiceArchived } from './categoryAdminIO'

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
        update(patch) {
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
      { table: 'service_categories', patch: { is_active: false }, eq: ['id', 'c1'] },
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
      { table: 'services', patch: { is_active: false }, eq: ['id', 's1'] },
    ])
  })

  it('restores as readily as it archives', async () => {
    const client = fakeClient()
    await setServiceArchived('s1', false, client)
    expect(client.calls[0].patch).toEqual({ is_active: true })
  })
})

import { saveServicePrices } from './servicePricingIO'

// A stand-in for the supabase client that records exactly what was asked of
// it. The real one cannot be reached from a test, and the thing worth
// checking is the shape of the request rather than the round trip: an update
// missing its eq would wipe every price in the salon and look identical from
// here to one that did not.
function fakeClient({ failOn } = {}) {
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
              return Promise.resolve(
                failOn === value ? { error: { code: '23514', message: 'refused' } } : { error: null }
              )
            },
          }
        },
      }
    },
  }
}

describe('saveServicePrices', () => {
  it('updates services by id, one row at a time', async () => {
    const client = fakeClient()
    const result = await saveServicePrices([
      { id: 'a', price: 120 },
      { id: 'b', price: 0 },
    ], client)

    expect(result).toEqual({ written: ['a', 'b'], error: null })
    expect(client.calls).toEqual([
      { table: 'services', patch: { price: 120 }, eq: ['id', 'a'] },
      { table: 'services', patch: { price: 0 }, eq: ['id', 'b'] },
    ])
  })

  it('never sends an update without an id to match', async () => {
    // The failure that would empty a whole catalogue in one press.
    const client = fakeClient()
    await saveServicePrices([{ id: 'a', price: 5 }], client)
    for (const call of client.calls) {
      expect(call.eq).toEqual(['id', 'a'])
    }
  })

  it('writes nothing but the price', async () => {
    // services rows carry duration, colour, sex, sort order and active flag;
    // a patch that mentioned any of them would rewrite it from stale props.
    const client = fakeClient()
    await saveServicePrices([{ id: 'a', price: 5 }], client)
    expect(Object.keys(client.calls[0].patch)).toEqual(['price'])
  })

  it('stops at the first refusal and reports what got through', async () => {
    const client = fakeClient({ failOn: 'b' })
    const result = await saveServicePrices([
      { id: 'a', price: 1 },
      { id: 'b', price: 2 },
      { id: 'c', price: 3 },
    ], client)

    expect(result.written).toEqual(['a'])
    expect(result.error).toMatchObject({ code: '23514' })
    // 'c' was never attempted — the caller shows the error rather than
    // carrying on and leaving a half-written table nobody was told about.
    expect(client.calls.map((c) => c.eq[1])).toEqual(['a', 'b'])
  })

  it('does nothing at all when nothing changed', async () => {
    const client = fakeClient()
    expect(await saveServicePrices([], client)).toEqual({ written: [], error: null })
    expect(await saveServicePrices(null, client)).toEqual({ written: [], error: null })
    expect(client.calls).toEqual([])
  })
})

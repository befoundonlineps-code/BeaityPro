import { deleteServicePhoto } from './serviceAdminIO'

// Only the storage cleanup is covered here. The three table writes talk to
// PostgREST through a chained builder, and a fake of that chain would be a
// test of the fake — the payload they send is decided in lib/serviceForm.js,
// which is tested directly.
function fakeStorage() {
  const remove = jest.fn(async () => ({ error: null }))
  const from = jest.fn(() => ({ remove }))
  return { client: { storage: { from } }, from, remove }
}

describe('deleteServicePhoto', () => {
  it('removes the given path from the service bucket', async () => {
    const { client, from, remove } = fakeStorage()

    const result = await deleteServicePhoto('services/s1/1700.jpg', client)

    expect(from).toHaveBeenCalledWith('service-photos')
    expect(remove).toHaveBeenCalledWith(['services/s1/1700.jpg'])
    expect(result).toEqual({ ok: true, error: null })
  })

  it('does nothing at all when there is no old path', async () => {
    // A service that never had a picture has nothing to clean up. Asking
    // storage to remove '' is a request with no meaning, and a new service
    // reaches this on every first save.
    for (const nothing of ['', null, undefined]) {
      const { client, remove } = fakeStorage()
      const result = await deleteServicePhoto(nothing, client)

      expect(remove).not.toHaveBeenCalled()
      expect(result).toEqual({ ok: true, error: null })
    }
  })

  it('reports a refusal rather than claiming success', async () => {
    const error = { message: 'not allowed' }
    const client = { storage: { from: () => ({ remove: async () => ({ error }) }) } }

    expect(await deleteServicePhoto('services/s1/1700.jpg', client))
      .toEqual({ ok: false, error })
  })
})

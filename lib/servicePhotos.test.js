import { buildServicePhotoPath, getPublicServicePhotoUrl, BUCKET } from './servicePhotos'

describe('buildServicePhotoPath', () => {
  it('files the picture under the service it belongs to', () => {
    expect(buildServicePhotoPath('svc-1', 'photo.jpg')).toMatch(/^services\/svc-1\/\d+\.jpg$/)
  })

  it('keeps only the extension, lower-cased', () => {
    expect(buildServicePhotoPath('s', 'Photo.PNG')).toMatch(/\.png$/)
  })

  it('drops an Arabic file name instead of putting it in the key', () => {
    // Supabase object keys are restricted to a charset that has no Arabic in
    // it, and a salon here names files in Arabic — so this is the normal case,
    // not the rare one.
    const path = buildServicePhotoPath('svc-1', 'صورة القص.jpg')
    expect(path).toMatch(/^services\/svc-1\/\d+\.jpg$/)
    expect(path).not.toMatch(/[؀-ۿ]/)
  })

  it('survives a name with no extension at all', () => {
    expect(buildServicePhotoPath('s', 'photo')).toMatch(/^services\/s\/\d+$/)
    expect(buildServicePhotoPath('s', '')).toMatch(/^services\/s\/\d+$/)
    expect(buildServicePhotoPath('s', null)).toMatch(/^services\/s\/\d+$/)
  })

  it('does not mistake a dotfile for an extension', () => {
    expect(buildServicePhotoPath('s', '.hidden')).toMatch(/^services\/s\/\d+$/)
  })

  it('takes the last extension when the name has several dots', () => {
    expect(buildServicePhotoPath('s', 'my.photo.final.webp')).toMatch(/\.webp$/)
  })

  it('gives two uploads for one service different keys', async () => {
    const first = buildServicePhotoPath('s', 'a.jpg')
    await new Promise((r) => setTimeout(r, 2))
    expect(buildServicePhotoPath('s', 'a.jpg')).not.toBe(first)
  })
})

describe('getPublicServicePhotoUrl', () => {
  it('reads from the service bucket, not the client one', () => {
    const from = jest.fn(() => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://x/y' } }) }))
    const url = getPublicServicePhotoUrl({ storage: { from } }, 'services/s/1.jpg')

    expect(from).toHaveBeenCalledWith('service-photos')
    expect(BUCKET).toBe('service-photos')
    expect(url).toBe('https://x/y')
  })
})

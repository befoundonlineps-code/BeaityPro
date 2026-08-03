import { buildServicePhotoPath, getPublicServicePhotoUrl, photoSavePlan, BUCKET } from './servicePhotos'

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

describe('photoSavePlan', () => {
  const OLD = 'services/s1/1700000000000.jpg'
  const NEWER = 'services/s1/1800000000000.jpg'

  it('does nothing when the picture was not touched', () => {
    expect(photoSavePlan({ hasNewFile: false, imagePath: OLD, storedPath: OLD }))
      .toEqual({ action: 'none', newPath: null, removePrevious: null })
  })

  it('does nothing for a service that has no picture and got none', () => {
    expect(photoSavePlan({ hasNewFile: false, imagePath: '', storedPath: '' }))
      .toEqual({ action: 'none', newPath: null, removePrevious: null })
  })

  it('uploads without deleting anything for a first picture', () => {
    // Nothing to abandon: this service never had one.
    expect(photoSavePlan({ hasNewFile: true, imagePath: '', storedPath: '' }))
      .toEqual({ action: 'upload', removePrevious: null })
  })

  it('deletes the previous file when a picture is replaced', () => {
    // The bug this exists for. Every path carries Date.now(), so the upload
    // lands beside the old file rather than over it, and without this the old
    // one stays in the bucket with nothing pointing at it.
    expect(photoSavePlan({ hasNewFile: true, imagePath: OLD, storedPath: OLD }))
      .toEqual({ action: 'upload', removePrevious: OLD })
  })

  it('clears the column and deletes the file when a picture is removed', () => {
    expect(photoSavePlan({ hasNewFile: false, imagePath: '', storedPath: OLD }))
      .toEqual({ action: 'setPath', newPath: null, removePrevious: OLD })
  })

  it('measures against what the row points at, not against the first picture', () => {
    // Two saves in one open dialog: the first replaced OLD with NEWER, so the
    // second must abandon NEWER. Comparing against the service prop would name
    // OLD here — a file already deleted, while NEWER leaks instead.
    expect(photoSavePlan({ hasNewFile: true, imagePath: NEWER, storedPath: NEWER }))
      .toEqual({ action: 'upload', removePrevious: NEWER })
  })

  it('removes nothing on a picture picked and then removed before any save', () => {
    expect(photoSavePlan({ hasNewFile: true, imagePath: '', storedPath: '' }))
      .toEqual({ action: 'upload', removePrevious: null })
  })

  it('treats null and undefined as no path', () => {
    expect(photoSavePlan({ hasNewFile: false, imagePath: null, storedPath: undefined }))
      .toEqual({ action: 'none', newPath: null, removePrevious: null })
    expect(photoSavePlan({ hasNewFile: false, imagePath: null, storedPath: OLD }))
      .toEqual({ action: 'setPath', newPath: null, removePrevious: OLD })
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

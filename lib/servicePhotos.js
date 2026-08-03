// The one picture a service can carry. Same shape as the client avatar in
// lib/clientFiles.js — a path column on the row, the bytes in Storage — but a
// separate bucket, because a service picture is catalogue content shown to
// whoever is booking while a client photo is personal data.
const BUCKET = 'service-photos'

export function getPublicServicePhotoUrl(supabase, storagePath) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

// The original file name is dropped and only its extension survives.
//
// This diverges from buildAvatarPath, which keeps the name, and the reason is
// the alphabet: Supabase object keys are restricted to a list that does not
// include Arabic letters, and a salon here names files in Arabic. Keeping the
// name would mean an upload that fails, or worse silently mangles the key,
// for the normal case rather than a rare one. Nothing displays this name —
// there is one picture per service and it is found through the column.
export function buildServicePhotoPath(serviceId, fileName) {
  const name = String(fileName || '')
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  return `services/${serviceId}/${Date.now()}${ext ? `.${ext}` : ''}`
}

// What a save has to do about the picture: upload a new one, clear the column,
// or nothing — and in the first two cases, which older file stops being
// referenced and has to go.
//
// This is a pure decision on purpose. Living inside the dialog it could only
// be checked by reading it, and "replacing a picture leaves the old file in
// the bucket forever" is exactly the kind of thing that reads fine.
//
// storedPath is what the row points at right now, which is not the same fact
// as the service prop — that never updates after a save, so a second save in
// one open dialog would measure against a path that stopped being current.
export function photoSavePlan({ hasNewFile, imagePath, storedPath }) {
  const previous = storedPath || ''
  const wanted = imagePath || ''

  // Every path carries Date.now(), so an upload can never land on the path it
  // is replacing — the previous file is always a separate object.
  if (hasNewFile) return { action: 'upload', removePrevious: previous || null }

  // No new bytes but a different path is what removing a picture looks like.
  if (wanted !== previous) {
    return { action: 'setPath', newPath: wanted || null, removePrevious: previous || null }
  }

  return { action: 'none', newPath: null, removePrevious: null }
}

export { BUCKET }

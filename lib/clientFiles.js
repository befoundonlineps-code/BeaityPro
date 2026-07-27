const BUCKET = 'client-photos'

export function getPublicFileUrl(supabase, storagePath) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export function buildAttachmentPath(clientId, fileName) {
  return `files/${clientId}/${Date.now()}-${fileName}`
}

export function buildAvatarPath(clientId, fileName) {
  return `avatars/${clientId}/${Date.now()}-${fileName}`
}

export { BUCKET }

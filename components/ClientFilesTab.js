import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getAvatarColor, getInitials } from '../lib/avatarColor'
import { BUCKET, getPublicFileUrl, buildAttachmentPath, buildAvatarPath } from '../lib/clientFiles'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

export default function ClientFilesTab({ client, onPhotoUpdated }) {
  const clientId = client.id
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef(null)
  const photoInputRef = useRef(null)

  useEffect(() => { loadFiles() }, [clientId])

  async function loadFiles() {
    setLoading(true)
    const { data, error } = await supabase
      .from('client_files')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setFiles(data || [])
    setLoading(false)
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setUploadingFile(true)
    const path = buildAttachmentPath(clientId, file.name)
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
    if (uploadError) {
      setError(uploadError.message)
      setUploadingFile(false)
      return
    }
    const { error: insertError } = await supabase.from('client_files').insert([{
      client_id: clientId, file_name: file.name, storage_path: path,
    }])
    setUploadingFile(false)
    if (insertError) setError(insertError.message)
    else loadFiles()
  }

  async function handleDeleteFile(row) {
    await supabase.storage.from(BUCKET).remove([row.storage_path])
    await supabase.from('client_files').delete().eq('id', row.id)
    loadFiles()
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setUploadingPhoto(true)
    const path = buildAvatarPath(clientId, file.name)
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
    if (uploadError) {
      setError(uploadError.message)
      setUploadingPhoto(false)
      return
    }
    const { error: updateError } = await supabase.from('clients').update({ photo_path: path }).eq('id', clientId)
    setUploadingPhoto(false)
    if (updateError) setError(updateError.message)
    else onPhotoUpdated()
  }

  const initials = getInitials(client.first_name, client.last_name)
  const color = getAvatarColor(client.id)
  const photoUrl = client.photo_path ? getPublicFileUrl(supabase, client.photo_path) : null

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm">الملفات المرفقة</CardTitle>
          <Button size="sm" variant="outline" disabled={uploadingFile} onClick={() => fileInputRef.current?.click()}>
            {uploadingFile ? 'جاري الرفع...' : '+ رفع ملف'}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {error && <div className="text-sm text-destructive">{error}</div>}
          {loading ? (
            <div className="text-sm text-muted-foreground">جاري التحميل...</div>
          ) : files.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">ما في ملفات مرفقة لسا</div>
          ) : (
            files.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <a
                  href={getPublicFileUrl(supabase, f.storage_path)}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm font-medium text-primary hover:underline"
                >
                  {f.file_name}
                </a>
                <button type="button" className="shrink-0 text-xs text-destructive hover:underline" onClick={() => handleDeleteFile(f)}>حذف</button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader><CardTitle className="text-sm">الصورة الشخصية</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Avatar className="size-24">
            {photoUrl && <AvatarImage src={photoUrl} alt="" />}
            <AvatarFallback style={{ background: color, color: '#fff' }} className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <Button size="sm" variant="outline" disabled={uploadingPhoto} onClick={() => photoInputRef.current?.click()}>
            {uploadingPhoto ? 'جاري الرفع...' : client.photo_path ? 'تغيير الصورة' : 'رفع صورة'}
          </Button>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </CardContent>
      </Card>
    </div>
  )
}

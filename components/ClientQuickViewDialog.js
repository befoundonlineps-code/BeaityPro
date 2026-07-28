import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { buildClientPayload, clientToForm } from '../lib/clientMapping'
import { getDuplicateWarningMessage } from '../lib/duplicateCheck'
import { getAvatarColor, getInitials } from '../lib/avatarColor'
import { computeBalance } from '../lib/ledger'
import { BUCKET, getPublicFileUrl, buildAvatarPath } from '../lib/clientFiles'
import ClientForm from './ClientForm'
import ClientBalanceSummary from './ClientBalanceSummary'
import ClientRelationships from './ClientRelationships'
import AvatarUpload from './AvatarUpload'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

export default function ClientQuickViewDialog({ open, clientId, onOpenChange, onSaved, salonId }) {
  const { t } = useTranslation(['clientsList', 'common'])
  const [client, setClient] = useState(null)
  const [form, setForm] = useState(null)
  const [formTab, setFormTab] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [ledgerRows, setLedgerRows] = useState([])
  const [bookingNotice, setBookingNotice] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (!open || !clientId) return
    setEditMode(false)
    setError('')
    setBookingNotice(false)
    loadClient()
    loadLedger()
  }, [open, clientId])

  async function loadClient() {
    const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single()
    if (error) setError(error.message)
    else {
      setClient(data)
      setForm(clientToForm(data))
    }
  }

  async function loadLedger() {
    const { data } = await supabase.from('client_ledger').select('*').eq('client_id', clientId)
    setLedgerRows(data || [])
  }

  useEffect(() => {
    if (!editMode || !form || !clientId) return undefined
    const t = setTimeout(async () => {
      if (form.phone && form.phone.length >= 6) {
        const { data } = await supabase.from('clients').select('id,first_name,last_name').eq('phone_number', form.phone).neq('id', clientId)
        setDuplicateWarning(getDuplicateWarningMessage(data))
      } else {
        setDuplicateWarning(null)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [form?.phone, editMode, clientId])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function cancelEdit() {
    setForm(clientToForm(client))
    setDuplicateWarning(null)
    setError('')
    setEditMode(false)
  }

  async function save() {
    setError('')
    if (!form.firstName || !form.phone) {
      setError(t('common:validation.nameAndPhoneRequired'))
      return
    }
    if (duplicateWarning) {
      setError(t('common:validation.phoneAlreadyUsed', { name: duplicateWarning }))
      return
    }
    setSaving(true)
    const payload = buildClientPayload(form)
    const { error } = await supabase.from('clients').update(payload).eq('id', clientId)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    await loadClient()
    setEditMode(false)
    onSaved?.()
  }

  async function uploadPhoto(file) {
    setUploadingPhoto(true)
    const path = buildAvatarPath(clientId, file.name)
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
    if (uploadError) {
      setUploadingPhoto(false)
      setError(uploadError.message)
      return
    }
    const { error: updateError } = await supabase.from('clients').update({ photo_path: path }).eq('id', clientId)
    setUploadingPhoto(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await loadClient()
    onSaved?.()
  }

  const photoUrl = client?.photo_path ? getPublicFileUrl(supabase, client.photo_path) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-4xl max-h-[88vh] overflow-y-auto">
        {!client || !form ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{t('common:loading')}</div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                <div className="flex items-center gap-3">
                  <AvatarUpload
                    photoUrl={photoUrl}
                    fallbackColor={getAvatarColor(client.id)}
                    fallbackInitials={getInitials(client.first_name, client.last_name)}
                    uploading={uploadingPhoto}
                    disabled={!editMode}
                    onFileSelected={uploadPhoto}
                  />
                  <div>
                    <div className="text-base font-semibold text-foreground">{client.first_name} {client.last_name}</div>
                    <div className="text-sm font-normal text-muted-foreground">{client.phone_number}</div>
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
            )}
            {duplicateWarning && (
              <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                ⚠ {t('common:validation.phoneAlreadyUsed', { name: duplicateWarning })}
              </div>
            )}
            {bookingNotice && (
              <div className="rounded-lg bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                {t('clientsList:quickView.bookingNotice')}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
              <ClientForm form={form} update={update} activeTab={formTab} setActiveTab={setFormTab} readOnly={!editMode} salonId={salonId} />
              <div className="flex flex-col gap-4">
                <ClientBalanceSummary balance={computeBalance(ledgerRows)} />
                <ClientRelationships clientId={clientId} />
              </div>
            </div>

            <DialogFooter>
              {editMode ? (
                <>
                  <Button variant="outline" onClick={cancelEdit}>{t('common:cancel')}</Button>
                  <Button disabled={saving} onClick={save}>{saving ? t('common:saving') : t('common:save')}</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setBookingNotice(true)}>{t('clientsList:quickView.bookAppointment')}</Button>
                  <Button onClick={() => setEditMode(true)}>{t('clientsList:quickView.edit')}</Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

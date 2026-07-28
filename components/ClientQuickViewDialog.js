import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { buildClientPayload, clientToForm } from '../lib/clientMapping'
import { getDuplicateWarningMessage } from '../lib/duplicateCheck'
import { getAvatarColor, getInitials } from '../lib/avatarColor'
import { computeBalance } from '../lib/ledger'
import { getPublicFileUrl } from '../lib/clientFiles'
import ClientForm from './ClientForm'
import ClientBalanceSummary from './ClientBalanceSummary'
import ClientRelationships from './ClientRelationships'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

export default function ClientQuickViewDialog({ open, clientId, onOpenChange, onSaved }) {
  const [client, setClient] = useState(null)
  const [form, setForm] = useState(null)
  const [formTab, setFormTab] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [ledgerRows, setLedgerRows] = useState([])
  const [bookingNotice, setBookingNotice] = useState(false)

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
      setError('الاسم الأول ورقم الهاتف إجباريين')
      return
    }
    if (duplicateWarning) {
      setError(`رقم الهاتف مستخدم أصلًا لزبون: ${duplicateWarning}`)
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

  const photoUrl = client?.photo_path ? getPublicFileUrl(supabase, client.photo_path) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-4xl max-h-[88vh] overflow-y-auto">
        {!client || !form ? (
          <div className="py-10 text-center text-sm text-muted-foreground">جاري التحميل...</div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    {photoUrl && <AvatarImage src={photoUrl} alt="" />}
                    <AvatarFallback style={{ background: getAvatarColor(client.id), color: '#fff' }}>
                      {getInitials(client.first_name, client.last_name)}
                    </AvatarFallback>
                  </Avatar>
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
                ⚠ رقم الهاتف مستخدم أصلًا لزبون: {duplicateWarning}
              </div>
            )}
            {bookingNotice && (
              <div className="rounded-lg bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                قسم "حجز موعد" قيد التطوير — سيُبنى بنفس الأساس الحالي بالمراحل القادمة
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
              <ClientForm form={form} update={update} activeTab={formTab} setActiveTab={setFormTab} readOnly={!editMode} />
              <div className="flex flex-col gap-4">
                <ClientBalanceSummary balance={computeBalance(ledgerRows)} />
                <ClientRelationships clientId={clientId} />
              </div>
            </div>

            <DialogFooter>
              {editMode ? (
                <>
                  <Button variant="outline" onClick={cancelEdit}>إلغاء</Button>
                  <Button disabled={saving} onClick={save}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setBookingNotice(true)}>حجز موعد</Button>
                  <Button onClick={() => setEditMode(true)}>تعديل</Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

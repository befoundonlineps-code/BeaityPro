import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { getDuplicateWarningMessage } from '../lib/duplicateCheck'
import { isNewClient } from '../lib/clientStatus'
import { getAvatarColor, getInitials } from '../lib/avatarColor'
import { buildClientPayload } from '../lib/clientMapping'
import { computeBalance } from '../lib/ledger'
import { onLedgerChanged } from '../lib/ledgerEvents'
import { BUCKET, getPublicFileUrl, buildAvatarPath } from '../lib/clientFiles'
import { emptyForm } from '../constants'
import AppShell from './AppShell'
import ClientForm from './ClientForm'
import ClientQuickViewDialog from './ClientQuickViewDialog'
import AvatarUpload from './AvatarUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const TIP_DOT = {
  warning: 'bg-amber-500',
  danger: 'bg-destructive',
  success: 'bg-emerald-500',
  info: 'bg-primary',
}

export default function ClientsApp({ userEmail, salonId, onLogout }) {
  const { t } = useTranslation(['clientsList', 'common'])
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [listTab, setListTab] = useState('all')
  const [search, setSearch] = useState('')
  const [ledgerRows, setLedgerRows] = useState([])
  const [quickViewClientId, setQuickViewClientId] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null)

  useEffect(() => {
    loadClients()
    loadLedger()
  }, [])

  useEffect(() => onLedgerChanged(loadLedger), [])

  useEffect(() => {
    if (!formOpen) return undefined
    const t = setTimeout(async () => {
      if (form.phone && form.phone.length >= 6) {
        const { data } = await supabase.from('clients').select('id,first_name,last_name').eq('phone_number', form.phone)
        setDuplicateWarning(getDuplicateWarningMessage(data))
      } else {
        setDuplicateWarning(null)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [form.phone, formOpen])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function loadClients() {
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setClients(data)
  }

  async function loadLedger() {
    const { data } = await supabase.from('client_ledger').select('*')
    setLedgerRows(data || [])
  }

  function openNewClientForm() {
    setForm(emptyForm)
    setActiveTab(0)
    setError('')
    setFormOpen(true)
    setPhotoFile(null)
    setPhotoPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
  }

  function closeNewClientForm() {
    setForm(emptyForm)
    setFormOpen(false)
    setPhotoFile(null)
    setPhotoPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
  }

  function selectNewClientPhoto(file) {
    setPhotoFile(file)
    setPhotoPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
  }

  useEffect(() => {
    if (router.query.new !== undefined) {
      openNewClientForm()
      router.replace('/', undefined, { shallow: true })
    }
  }, [router.query.new])

  async function saveClient() {
    setError('')
    if (!form.firstName || !form.phone) {
      setError(t('common:validation.nameAndPhoneRequired'))
      return
    }
    if (duplicateWarning) {
      setError(t('common:validation.phoneAlreadyUsed', { name: duplicateWarning }))
      return
    }
    if (!salonId) {
      setError(t('clientsList:salonNotFound'))
      return
    }
    setSaving(true)

    const payload = buildClientPayload(form)
    const { data, error } = await supabase
      .from('clients')
      .insert([{ ...payload, salon_id: salonId, client_status: 'potential' }])
      .select()
      .single()

    if (error) {
      setSaving(false)
      setError(error.message)
      return
    }

    if (photoFile) {
      const path = buildAvatarPath(data.id, photoFile.name)
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, photoFile)
      if (!uploadError) await supabase.from('clients').update({ photo_path: path }).eq('id', data.id)
    }

    setSaving(false)
    router.push(`/clients/${data.id}`)
  }

  const balanceByClient = useMemo(() => {
    const rowsByClient = {}
    for (const row of ledgerRows) {
      ;(rowsByClient[row.client_id] ??= []).push(row)
    }
    const balances = {}
    for (const clientId of Object.keys(rowsByClient)) {
      balances[clientId] = computeBalance(rowsByClient[clientId])
    }
    return balances
  }, [ledgerRows])

  const newClients = clients.filter(isNewClient)
  const baseList = listTab === 'new' ? newClients : clients
  const q = search.trim().toLowerCase()
  const visibleClients = q
    ? baseList.filter((c) => `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(q) || (c.phone_number || '').includes(q))
    : baseList

  const tips = [
    { tone: 'info', text: t('clientsList:tipTotalClients', { count: clients.length }) },
    { tone: 'warning', text: t('clientsList:tipNewClients', { count: newClients.length }) },
  ]

  return (
    <AppShell userEmail={userEmail} onLogout={onLogout}>
      <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-primary">{t('clientsList:breadcrumbClients')}</span> / <span>{t('clientsList:breadcrumbList')}</span>
        </div>
      </div>

      {error && !formOpen && (
        <div className="mx-5 mt-4 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader className="gap-3">
            <CardTitle>{t('clientsList:listTitle')}</CardTitle>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tabs value={listTab} onValueChange={setListTab}>
                <TabsList>
                  <TabsTrigger value="all">{t('clientsList:tabAll', { count: clients.length })}</TabsTrigger>
                  <TabsTrigger value="new">{t('clientsList:tabNew', { count: newClients.length })}</TabsTrigger>
                </TabsList>
              </Tabs>
              <Input
                className="max-w-xs"
                placeholder={t('clientsList:searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {visibleClients.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleClients.map((c) => {
                  const balance = balanceByClient[c.id] ?? 0
                  const balanceClass = balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-destructive' : 'text-primary'
                  const photoUrl = c.photo_path ? getPublicFileUrl(supabase, c.photo_path) : null
                  return (
                    <Card
                      key={c.id}
                      className="cursor-pointer transition-shadow hover:shadow-xs"
                      onClick={() => setQuickViewClientId(c.id)}
                    >
                      <CardContent className="flex flex-col gap-3 p-4">
                        <div className="flex items-center gap-3">
                          <Avatar size="lg">
                            {photoUrl && <AvatarImage src={photoUrl} alt="" />}
                            <AvatarFallback style={{ background: getAvatarColor(c.id || c.phone_number), color: '#fff' }}>
                              {getInitials(c.first_name, c.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">{c.first_name} {c.last_name}</div>
                            <div className="truncate text-xs text-muted-foreground">{c.phone_number}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className={`font-semibold ${balanceClass}`}>{balance.toLocaleString('ar')}₪</span>
                          <span className="text-xs text-muted-foreground">{t('clientsList:noVisitsYet')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">{t('clientsList:noMatchingClients')}</div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">{t('clientsList:tipsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground/80">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${TIP_DOT[tip.tone]}`} />
                <span>{tip.text}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeNewClientForm() }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('clientsList:newClientDialogTitle')}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-3">
            <AvatarUpload
              photoUrl={photoPreviewUrl}
              fallbackInitials={form.firstName ? getInitials(form.firstName, form.lastName) : null}
              onFileSelected={selectNewClientPhoto}
            />
            <span className="text-sm text-muted-foreground">{t('clientsList:newClientPhotoHint')}</span>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
          )}
          {duplicateWarning && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              ⚠ {t('common:validation.phoneAlreadyUsed', { name: duplicateWarning })}
            </div>
          )}

          <ClientForm form={form} update={update} activeTab={activeTab} setActiveTab={setActiveTab} salonId={salonId} />

          <DialogFooter>
            <Button variant="outline" onClick={closeNewClientForm}>{t('common:cancel')}</Button>
            <Button disabled={saving} onClick={saveClient}>{saving ? t('common:saving') : t('common:save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientQuickViewDialog
        open={!!quickViewClientId}
        clientId={quickViewClientId}
        onOpenChange={(open) => { if (!open) setQuickViewClientId(null) }}
        onSaved={loadClients}
        salonId={salonId}
      />
    </AppShell>
  )
}

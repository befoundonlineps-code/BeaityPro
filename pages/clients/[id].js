import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useAuthSession } from '../../hooks/useAuthSession'
import { supabase } from '../../lib/supabaseClient'
import { buildClientPayload, clientToForm } from '../../lib/clientMapping'
import { getDuplicateWarningMessage } from '../../lib/duplicateCheck'
import { getAvatarColor, getInitials } from '../../lib/avatarColor'
import { computeBalance } from '../../lib/ledger'
import { getPublicFileUrl } from '../../lib/clientFiles'
import LoginScreen from '../../components/LoginScreen'
import AppShell from '../../components/AppShell'
import ClientForm from '../../components/ClientForm'
import ClientBalanceSummary from '../../components/ClientBalanceSummary'
import ClientRelationships from '../../components/ClientRelationships'
import ClientFilesTab from '../../components/ClientFilesTab'
import ClientCardsTab from '../../components/ClientCardsTab'
import ClientHistoryTab from '../../components/ClientHistoryTab'
import BalanceDialog from '../../components/BalanceDialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'clientForm', 'clientProfile', 'clientsList', 'topBar'])),
    },
  }
}

export default function ClientProfilePage() {
  const { t } = useTranslation(['clientProfile', 'common', 'clientsList'])
  const router = useRouter()
  const { id } = router.query
  const { session, salonId, loading, logout } = useAuthSession()
  const PAGE_LOADING = (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">{t('common:loading')}</div>
  )

  const [client, setClient] = useState(null)
  const [form, setForm] = useState(null)
  const [formTab, setFormTab] = useState(0)
  const [tab, setTab] = useState('information')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [ledgerRows, setLedgerRows] = useState([])
  const [balanceDialogType, setBalanceDialogType] = useState(null)

  useEffect(() => {
    if (!id) return
    loadClient()
    loadLedger()
  }, [id])

  async function loadClient() {
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
    if (error) setError(error.message)
    else {
      setClient(data)
      setForm(clientToForm(data))
    }
  }

  async function loadLedger() {
    const { data } = await supabase.from('client_ledger').select('*').eq('client_id', id).order('created_at', { ascending: false })
    setLedgerRows(data || [])
  }

  async function addLedgerEntry(amount, note) {
    const { error } = await supabase.from('client_ledger').insert([{
      client_id: id, type: balanceDialogType, amount, note: note || null,
    }])
    if (error) setError(error.message)
    else loadLedger()
  }

  useEffect(() => {
    if (!form || !id) return undefined
    const timer = setTimeout(async () => {
      if (form.phone && form.phone.length >= 6) {
        const { data } = await supabase.from('clients').select('id,first_name,last_name').eq('phone_number', form.phone).neq('id', id)
        setDuplicateWarning(getDuplicateWarningMessage(data))
      } else {
        setDuplicateWarning(null)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [form?.phone, id])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
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
    const { error } = await supabase.from('clients').update(payload).eq('id', id)
    setSaving(false)
    if (error) setError(error.message)
    else loadClient()
  }

  if (session === undefined) return PAGE_LOADING
  if (!session) return <LoginScreen />
  if (loading || !client || !form) return PAGE_LOADING

  const initials = getInitials(client.first_name, client.last_name)
  const color = getAvatarColor(client.id)
  const photoUrl = client.photo_path ? getPublicFileUrl(supabase, client.photo_path) : null

  return (
    <AppShell userEmail={session.user.email} onLogout={logout}>
      <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <div className="text-sm text-muted-foreground">
          <button className="font-semibold text-primary hover:underline" onClick={() => router.push('/')}>{t('clientsList:breadcrumbClients')}</button>
          {' / '}<span>{client.first_name} {client.last_name}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBalanceDialogType('credit')}>{t('clientProfile:addBalanceButton')}</Button>
          <Button size="sm" variant="outline" onClick={() => setBalanceDialogType('debit')}>{t('clientProfile:removeBalanceButton')}</Button>
          <Button size="sm" disabled={saving} onClick={save}>{saving ? t('common:saving') : t('clientProfile:saveChangesButton')}</Button>
        </div>
      </div>

      <BalanceDialog
        open={!!balanceDialogType}
        type={balanceDialogType}
        onOpenChange={(open) => { if (!open) setBalanceDialogType(null) }}
        onSubmit={addLedgerEntry}
      />

      {error && (
        <div className="mx-5 mt-4 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
      )}

      <div className="p-5">
        <div className="mb-5 flex items-center gap-3">
          <Avatar size="lg">
            {photoUrl && <AvatarImage src={photoUrl} alt="" />}
            <AvatarFallback style={{ background: color, color: '#fff' }}>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-lg font-semibold text-foreground">{client.first_name} {client.last_name}</div>
            <div className="text-sm text-muted-foreground">{client.phone_number}</div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mb-4">
          <TabsList>
            <TabsTrigger value="information">{t('clientProfile:tabs.information')}</TabsTrigger>
            <TabsTrigger value="cards">{t('clientProfile:tabs.cards')}</TabsTrigger>
            <TabsTrigger value="history">{t('clientProfile:tabs.history')}</TabsTrigger>
            <TabsTrigger value="files">{t('clientProfile:tabs.files')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'information' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
            <div className="flex flex-col gap-4">
              {duplicateWarning && (
                <div className="text-sm text-destructive">⚠ {t('common:validation.phoneAlreadyUsed', { name: duplicateWarning })}</div>
              )}
              <ClientForm form={form} update={update} activeTab={formTab} setActiveTab={setFormTab} />
            </div>
            <div className="flex flex-col gap-4">
              <ClientBalanceSummary balance={computeBalance(ledgerRows)} />
              <ClientRelationships clientId={id} />
            </div>
          </div>
        )}
        {tab === 'cards' && <ClientCardsTab />}
        {tab === 'history' && <ClientHistoryTab />}
        {tab === 'files' && (
          <ClientFilesTab client={client} onPhotoUpdated={loadClient} />
        )}
      </div>
    </AppShell>
  )
}

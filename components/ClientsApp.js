import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import { getDuplicateWarningMessage } from '../lib/duplicateCheck'
import { isNewClient } from '../lib/clientStatus'
import { getAvatarColor, getInitials } from '../lib/avatarColor'
import { buildClientPayload } from '../lib/clientMapping'
import { computeBalance } from '../lib/ledger'
import { emptyForm } from '../constants'
import AppShell from './AppShell'
import ClientForm from './ClientForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

const TIP_DOT = {
  warning: 'bg-amber-500',
  danger: 'bg-destructive',
  success: 'bg-emerald-500',
  info: 'bg-primary',
}

export default function ClientsApp({ userEmail, salonId, onLogout }) {
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [view, setView] = useState('list')
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [listTab, setListTab] = useState('all')
  const [search, setSearch] = useState('')
  const [ledgerRows, setLedgerRows] = useState([])

  useEffect(() => {
    loadClients()
    loadLedger()
  }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (form.phone && form.phone.length >= 6) {
        const { data } = await supabase.from('clients').select('id,first_name,last_name').eq('phone_number', form.phone)
        setDuplicateWarning(getDuplicateWarningMessage(data))
      } else {
        setDuplicateWarning(null)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [form.phone])

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
    setView('form')
  }

  function openClientProfile(client) {
    router.push(`/clients/${client.id}`)
  }

  async function saveClient() {
    setError('')
    if (!form.firstName || !form.phone) {
      setError('الاسم الأول ورقم الهاتف إجباريين')
      return
    }
    if (duplicateWarning) {
      setError(`رقم الهاتف مستخدم أصلًا لزبون: ${duplicateWarning}`)
      return
    }
    if (!salonId) {
      setError('لا يمكن الحفظ: لم يتم العثور على صالون مرتبط بحسابك')
      return
    }
    setSaving(true)

    const payload = buildClientPayload(form)
    const { data, error } = await supabase
      .from('clients')
      .insert([{ ...payload, salon_id: salonId, client_status: 'potential' }])
      .select()
      .single()

    setSaving(false)
    if (error) setError(error.message)
    else router.push(`/clients/${data.id}`)
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

  const tips = []
  if (view === 'form') {
    if (duplicateWarning) tips.push({ tone: 'danger', text: `⚠ رقم الهاتف مستخدم أصلًا لزبون: ${duplicateWarning}` })
    else if (form.phone) tips.push({ tone: 'success', text: 'رقم الهاتف غير مستخدم — يمكن الحفظ' })
    if (activeTab === 2) tips.push({ tone: 'info', text: 'سقف الدَّين يُحسب بالشيكل (₪)' })
    if (!form.firstName || !form.phone) tips.push({ tone: 'warning', text: 'الاسم الأول ورقم الهاتف إجباريان للحفظ' })
  } else {
    tips.push({ tone: 'info', text: `إجمالي الزبائن المسجّلين: ${clients.length}` })
    tips.push({ tone: 'warning', text: `زبائن جدد (لسا ما زاروا): ${newClients.length}` })
  }

  return (
    <AppShell userEmail={userEmail} onLogout={onLogout}>
      <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <div className="text-sm text-muted-foreground">
          <button className="font-semibold text-primary hover:underline" onClick={() => setView('list')}>الزبائن</button>
          {' / '}<span>{view === 'form' ? 'زبون جديد' : 'القائمة'}</span>
        </div>
        <div className="flex gap-2">
          {view === 'form' ? (
            <>
              <Button size="sm" disabled={saving} onClick={saveClient}>
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setForm(emptyForm); setView('list') }}>تجاهل</Button>
            </>
          ) : (
            <Button size="sm" onClick={openNewClientForm}>+ زبون جديد</Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[1fr_280px]">
        <div>
          {view === 'form' && (
            <ClientForm form={form} update={update} activeTab={activeTab} setActiveTab={setActiveTab} />
          )}

          {view === 'list' && (
            <Card>
              <CardHeader className="gap-3">
                <CardTitle>قائمة الزبائن</CardTitle>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Tabs value={listTab} onValueChange={setListTab}>
                    <TabsList>
                      <TabsTrigger value="all">كل الزبائن ({clients.length})</TabsTrigger>
                      <TabsTrigger value="new">جدد ({newClients.length})</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Input
                    className="max-w-xs"
                    placeholder="بحث بالاسم أو رقم الهاتف..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {visibleClients.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الاسم</TableHead>
                        <TableHead>الهاتف</TableHead>
                        <TableHead>البريد</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الرصيد</TableHead>
                        <TableHead className="text-end">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleClients.map((c) => (
                        <TableRow key={c.id} className="cursor-pointer" onClick={() => openClientProfile(c)}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar size="sm">
                                <AvatarFallback style={{ background: getAvatarColor(c.id || c.phone_number), color: '#fff' }}>
                                  {getInitials(c.first_name, c.last_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-foreground">{c.first_name} {c.last_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{c.phone_number}</TableCell>
                          <TableCell>{c.email || '—'}</TableCell>
                          <TableCell>
                            {isNewClient(c) ? <Badge variant="secondary">جديد</Badge> : <Badge variant="outline">نشط</Badge>}
                          </TableCell>
                          <TableCell className={(balanceByClient[c.id] ?? 0) < 0 ? 'text-destructive' : ''}>
                            {(balanceByClient[c.id] ?? 0).toLocaleString('ar')}₪
                          </TableCell>
                          <TableCell className="text-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); openClientProfile(c) }}
                            >
                              التفاصيل ‹
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-10 text-center text-sm text-muted-foreground">مافي زبائن مطابقين</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">تلميحات وتنبيهات</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {tips.map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground/80">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${TIP_DOT[t.tone]}`} />
                <span>{t.text}</span>
              </div>
            ))}
            {tips.length === 0 && <div className="text-[13px] text-muted-foreground">لا توجد تنبيهات حاليًا</div>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

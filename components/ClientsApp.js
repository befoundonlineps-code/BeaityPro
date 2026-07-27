import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getDuplicateWarningMessage } from '../lib/duplicateCheck'
import { isNewClient } from '../lib/clientStatus'
import { emptyForm } from '../constants'
import Sidebar from './Sidebar'
import ClientForm from './ClientForm'
import ClientCard from './ClientCard'
import {
  appShell, mainColumn, topBar, topBarTitle, logoCircle, logoutBtn, subBar, btnPrimary, btnSecondary,
  layout, card, cardHeader, sideCard, sideHeader, tipItem, dot, TEXT_MUTED, BLUE,
  listToolbar, listTabsRow, listTabBtn, searchInput, cardGrid,
} from '../styles'

function buildClientPayload(form) {
  return {
    first_name: form.firstName, last_name: form.lastName, gender: form.gender || null,
    category: form.category || null, phone_number: form.phone,
    birthday: form.birthday || null,
    email: form.email || null,
    email_opt_out: form.emailOptOut, facebook_url: form.facebook || null,
    viber_number: form.viber || null, instagram_handle: form.instagram || null,
    acquisition_source: form.acquisitionSource || null, utm_campaign: form.utmCampaign || null,
    utm_source: form.utmSource || null, utm_medium: form.utmMedium || null,
    card_number: form.cardNumber || null, max_debt_limit: form.maxDebt || 0,
    preferred_professional: form.preferredProfessional || null, company_name: form.companyName || null,
    position_title: form.positionTitle || null, address_index: form.addressIndex || null,
    address_city: form.addressCity || null, address_street: form.addressStreet || null,
    address_building: form.addressBuilding || null,
    registration_address_differs: form.registrationAddressDiffers,
    passport_series: form.passportSeries || null,
    passport_number: form.passportNumber || null, passport_issued_date: form.passportIssuedDate || null,
    passport_issued_by: form.passportIssuedBy || null, identification_code: form.identificationCode || null,
  }
}

function clientToForm(c) {
  return {
    firstName: c.first_name || '', lastName: c.last_name || '', gender: c.gender || '', category: c.category || '',
    phone: c.phone_number || '', birthday: c.birthday || '',
    email: c.email || '', emailOptOut: !!c.email_opt_out, facebook: c.facebook_url || '', viber: c.viber_number || '', instagram: c.instagram_handle || '',
    acquisitionSource: c.acquisition_source || '', utmCampaign: c.utm_campaign || '', utmSource: c.utm_source || '', utmMedium: c.utm_medium || '',
    cardNumber: c.card_number || '', maxDebt: c.max_debt_limit || 0, preferredProfessional: c.preferred_professional || '', companyName: c.company_name || '',
    positionTitle: c.position_title || '', addressIndex: c.address_index || '', addressCity: c.address_city || '', addressStreet: c.address_street || '',
    addressBuilding: c.address_building || '', registrationAddressDiffers: !!c.registration_address_differs,
    passportSeries: c.passport_series || '', passportNumber: c.passport_number || '', passportIssuedDate: c.passport_issued_date || '',
    passportIssuedBy: c.passport_issued_by || '', identificationCode: c.identification_code || '',
  }
}

export default function ClientsApp({ userEmail, salonId, onLogout }) {
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [focused, setFocused] = useState(null)
  const [view, setView] = useState('list')
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [notice, setNotice] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [listTab, setListTab] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { loadClients() }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (form.phone && form.phone.length >= 6) {
        let query = supabase.from('clients').select('id,first_name,last_name').eq('phone_number', form.phone)
        if (editingId) query = query.neq('id', editingId)
        const { data } = await query
        setDuplicateWarning(getDuplicateWarningMessage(data))
      } else {
        setDuplicateWarning(null)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [form.phone, editingId])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function loadClients() {
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setClients(data)
  }

  function openNewClientForm() {
    setForm(emptyForm)
    setEditingId(null)
    setActiveTab(0)
    setView('form')
  }

  function openClientForEdit(client) {
    setForm(clientToForm(client))
    setEditingId(client.id)
    setActiveTab(0)
    setView('form')
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
    const { error } = editingId
      ? await supabase.from('clients').update(payload).eq('id', editingId)
      : await supabase.from('clients').insert([{ ...payload, salon_id: salonId, client_status: 'potential' }])

    setSaving(false)
    if (error) setError(error.message)
    else {
      setForm(emptyForm)
      setEditingId(null)
      loadClients()
      setView('list')
    }
  }

  function handleDisabledSection(label) {
    setNotice(`قسم "${label}" قيد التطوير — سيُبنى بنفس الأساس الحالي بالمراحل القادمة`)
    setTimeout(() => setNotice(null), 4000)
  }

  const newClients = clients.filter(isNewClient)
  const baseList = listTab === 'new' ? newClients : clients
  const q = search.trim().toLowerCase()
  const visibleClients = q
    ? baseList.filter((c) => `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(q) || (c.phone_number || '').includes(q))
    : baseList

  const tips = []
  if (notice) tips.push({ color: '#e08a1e', text: notice })
  if (view === 'form') {
    if (duplicateWarning) tips.push({ color: '#d9534f', text: `⚠ رقم الهاتف مستخدم أصلًا لزبون: ${duplicateWarning}` })
    else if (form.phone) tips.push({ color: '#5cb85c', text: 'رقم الهاتف غير مستخدم — يمكن الحفظ' })
    if (activeTab === 2) tips.push({ color: BLUE, text: 'سقف الدَّين يُحسب بالشيكل (₪)' })
    if (!form.firstName || !form.phone) tips.push({ color: '#e08a1e', text: 'الاسم الأول ورقم الهاتف إجباريان للحفظ' })
  } else {
    tips.push({ color: BLUE, text: `إجمالي الزبائن المسجّلين: ${clients.length}` })
    tips.push({ color: '#e08a1e', text: `زبائن جدد (لسا ما زاروا): ${newClients.length}` })
  }

  return (
    <div style={appShell}>
      <Sidebar onDisabledClick={handleDisabledSection} />
      <div style={mainColumn}>
        <div style={topBar}>
          <div style={topBarTitle}>
            <div style={logoCircle}>B</div>
            نظام Beauty
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12.5, opacity: 0.9 }}>{userEmail}</span>
            <button style={logoutBtn} onClick={onLogout}>تسجيل خروج</button>
          </div>
        </div>

        <div style={subBar}>
          <div style={{ fontSize: 13, color: TEXT_MUTED }}>
            <span style={{ color: BLUE, fontWeight: 700, cursor: 'pointer' }} onClick={() => setView('list')}>الزبائن</span>
            {' / '}<span>{view === 'form' ? (editingId ? 'تعديل زبون' : 'زبون جديد') : 'القائمة'}</span>
          </div>
          <div>
            {view === 'form' ? (
              <>
                <button style={btnPrimary} disabled={saving} onClick={saveClient}>
                  {saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'حفظ'}
                </button>
                <button style={btnSecondary} onClick={() => { setForm(emptyForm); setEditingId(null); setView('list') }}>تجاهل</button>
              </>
            ) : (
              <button style={btnPrimary} onClick={openNewClientForm}>+ زبون جديد</button>
            )}
          </div>
        </div>

        {view === 'list' && (
          <div style={listToolbar}>
            <div style={listTabsRow}>
              <button style={listTabBtn(listTab === 'all')} onClick={() => setListTab('all')}>كل الزبائن ({clients.length})</button>
              <button style={listTabBtn(listTab === 'new')} onClick={() => setListTab('new')}>جدد ({newClients.length})</button>
            </div>
            <input
              style={searchInput}
              placeholder="بحث بالاسم أو رقم الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {error && (
          <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: '0 16px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ background: '#fdecea', color: '#a33', padding: '9px 16px', borderRadius: 5, fontSize: 13 }}>{error}</div>
          </div>
        )}

        <div style={layout}>
          <div>
            {view === 'form' && (
              <ClientForm form={form} update={update} activeTab={activeTab} setActiveTab={setActiveTab} focused={focused} setFocused={setFocused} />
            )}

            {view === 'list' && (
              <div style={card}>
                <div style={cardHeader}>قائمة الزبائن</div>
                <div style={{ padding: 14 }}>
                  {visibleClients.length > 0 ? (
                    <div style={cardGrid}>
                      {visibleClients.map((c) => (
                        <ClientCard key={c.id} client={c} onOpen={openClientForEdit} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: 24, textAlign: 'center', color: TEXT_MUTED }}>مافي زبائن مطابقين</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={sideCard}>
            <div style={sideHeader}>تلميحات وتنبيهات</div>
            <div>
              {tips.map((t, i) => (
                <div key={i} style={tipItem()}>
                  <span style={dot(t.color)} />
                  <span>{t.text}</span>
                </div>
              ))}
              {tips.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: TEXT_MUTED }}>لا توجد تنبيهات حاليًا</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const BLUE = '#2E5AAC'
const BLUE_DARK = '#1F3E7A'
const BLUE_LIGHT = '#EAF0FB'
const BORDER = '#d7dce3'
const TEXT_MUTED = '#8a8a8a'

const page = { fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: 'rtl', background: '#eef1f6', minHeight: '100vh' }

const topBar = {
  background: `linear-gradient(90deg, ${BLUE_DARK}, ${BLUE})`, color: '#fff',
  padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}
const topBarTitle = { fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }
const logoCircle = {
  width: 34, height: 34, borderRadius: '50%', background: '#fff', color: BLUE,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15,
}
const logoutBtn = {
  background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)',
  borderRadius: 5, padding: '6px 14px', fontSize: 12.5, cursor: 'pointer',
}

// ==================== Department nav bar ====================
const SECTIONS = [
  { key: 'clients', label: 'الزبائن', active: true },
  { key: 'appointments', label: 'دفتر المواعيد', active: false },
  { key: 'calls', label: 'المكالمات', active: false },
  { key: 'products', label: 'المنتجات', active: false },
  { key: 'services', label: 'الخدمات', active: false },
  { key: 'groups', label: 'المجموعات', active: false },
  { key: 'marketing', label: 'التسويق', active: false },
  { key: 'employees', label: 'الموظفون', active: false },
  { key: 'salary', label: 'الرواتب', active: false },
  { key: 'documents', label: 'المستندات', active: false },
  { key: 'cash', label: 'الصندوق اليومي', active: false },
  { key: 'reports', label: 'التقارير', active: false },
  { key: 'settings', label: 'الإعدادات', active: false },
]

const sectionsBar = {
  background: '#fff', borderBottom: `1px solid ${BORDER}`,
  display: 'flex', alignItems: 'center', overflowX: 'auto', padding: '0 20px',
}
const sectionBtnActive = {
  padding: '13px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  color: BLUE, borderBottom: `3px solid ${BLUE}`, background: 'none', border: 'none',
  marginBottom: -1, whiteSpace: 'nowrap', flexShrink: 0,
}
const sectionBtnDisabled = {
  padding: '13px 14px', fontSize: 13, fontWeight: 500, cursor: 'not-allowed',
  color: '#c3c8d1', border: 'none', background: 'none', display: 'flex',
  alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0,
}
const comingSoonBadge = {
  fontSize: 9, background: '#f0f2f5', color: '#a7acb5', borderRadius: 8,
  padding: '1px 6px', fontWeight: 700,
}

function SectionsBar({ onDisabledClick }) {
  return (
    <div style={sectionsBar}>
      {SECTIONS.map((s) =>
        s.active ? (
          <button key={s.key} style={sectionBtnActive}>{s.label}</button>
        ) : (
          <button key={s.key} style={sectionBtnDisabled} onClick={() => onDisabledClick(s.label)} title="قيد التطوير">
            {s.label}
            <span style={comingSoonBadge}>قريبًا</span>
          </button>
        )
      )}
    </div>
  )
}

const subBar = {
  background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '10px 28px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}
const btnPrimary = {
  background: BLUE, color: '#fff', border: 'none', borderRadius: 5,
  padding: '7px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginLeft: 8,
}
const btnSecondary = {
  background: '#fff', color: '#555', border: `1px solid ${BORDER}`, borderRadius: 5,
  padding: '7px 18px', fontSize: 13, cursor: 'pointer',
}

const layout = { display: 'grid', gridTemplateColumns: '1fr 260px', gap: 18, maxWidth: 1180, margin: '18px auto', padding: '0 16px' }

const card = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }
const cardHeader = {
  background: BLUE_LIGHT, color: BLUE_DARK, fontWeight: 700, fontSize: 13.5,
  padding: '10px 16px', borderBottom: `1px solid ${BORDER}`,
}
const cardBody = { padding: '16px 18px' }

const fieldGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }
const fieldRow = { display: 'flex', flexDirection: 'column', gap: 4 }
const bLabel = { fontSize: 12, color: '#555', fontWeight: 600 }
const bInput = {
  border: `1px solid ${BORDER}`, borderRadius: 5, padding: '8px 10px', fontSize: 13.5,
  outline: 'none', fontFamily: 'inherit', background: '#fff', color: '#222',
}
const bInputFocus = { border: `1px solid ${BLUE}`, boxShadow: `0 0 0 2px ${BLUE_LIGHT}` }

const tabBar = { display: 'flex', gap: 2, marginBottom: 0, borderBottom: `1px solid ${BORDER}`, background: '#fff', padding: '0 4px' }
const tabBtn = (active) => ({
  padding: '11px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  color: active ? BLUE : TEXT_MUTED,
  borderBottom: active ? `3px solid ${BLUE}` : '3px solid transparent',
  background: 'none', border: 'none', marginBottom: -1,
})

const sideCard = { ...card, height: 'fit-content' }
const sideHeader = { ...cardHeader, background: BLUE_DARK, color: '#fff' }
const tipItem = () => ({
  display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 14px',
  borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: '#444', lineHeight: 1.5,
})
const dot = (color) => ({ width: 7, height: 7, borderRadius: '50%', background: color, marginTop: 5, flexShrink: 0 })

function BField({ label, focusKey, focused, setFocused, ...props }) {
  const isFocused = focused === focusKey
  return (
    <div style={fieldRow}>
      <label style={bLabel}>{label}</label>
      <input
        style={{ ...bInput, ...(isFocused ? bInputFocus : {}) }}
        onFocus={() => setFocused(focusKey)}
        onBlur={() => setFocused(null)}
        {...props}
      />
    </div>
  )
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'بدون' },
  { value: 'blacklist', label: 'قائمة سوداء' },
  { value: 'family_friends', label: 'عائلة / أصدقاء' },
  { value: 'vip', label: 'VIP' },
]

const TABS = ['معلومات عامة', 'التواصل والتسويق', 'المعلومات المالية', 'العنوان والوثائق']

const emptyForm = {
  firstName: '', lastName: '', gender: '', category: '', phone: '',
  birthday: '',
  email: '', emailOptOut: false, facebook: '', viber: '', instagram: '',
  acquisitionSource: '', utmCampaign: '', utmSource: '', utmMedium: '',
  cardNumber: '', maxDebt: 0, preferredProfessional: '', companyName: '', positionTitle: '',
  addressIndex: '', addressCity: '', addressStreet: '', addressBuilding: '',
  registrationAddressDiffers: false,
  passportSeries: '', passportNumber: '', passportIssuedDate: '', passportIssuedBy: '',
  identificationCode: '',
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError('البريد الإلكتروني أو كلمة السر غير صحيحة')
  }

  return (
    <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleLogin} style={{
        background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10,
        padding: '36px 32px', width: 360, boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ ...logoCircle, background: BLUE, color: '#fff', margin: '0 auto 10px', width: 48, height: 48, fontSize: 20 }}>B</div>
          <h2 style={{ margin: 0, fontSize: 18, color: BLUE_DARK }}>نظام Beauty</h2>
          <p style={{ fontSize: 12.5, color: TEXT_MUTED, marginTop: 4 }}>تسجيل الدخول</p>
        </div>

        <div style={{ ...fieldRow, marginBottom: 14 }}>
          <label style={bLabel}>البريد الإلكتروني</label>
          <input style={bInput} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={{ ...fieldRow, marginBottom: 20 }}>
          <label style={bLabel}>كلمة السر</label>
          <input style={bInput} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p style={{ color: '#a33', fontSize: 12.5, marginBottom: 14 }}>{error}</p>}

        <button type="submit" disabled={loading} style={{ ...btnPrimary, width: '100%', marginLeft: 0, padding: '10px 0' }}>
          {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>
    </div>
  )
}

function ClientsApp({ userEmail, salonId, onLogout }) {
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [focused, setFocused] = useState(null)
  const [view, setView] = useState('form')
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => { loadClients() }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (form.phone && form.phone.length >= 6) {
        const { data } = await supabase.from('clients').select('first_name,last_name').eq('phone_number', form.phone)
        setDuplicateWarning(data && data.length > 0 ? `${data[0].first_name} ${data[0].last_name}` : null)
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

  async function addClient() {
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

    const { error } = await supabase.from('clients').insert([{
      salon_id: salonId,
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
    }])

    setSaving(false)
    if (error) setError(error.message)
    else {
      setForm(emptyForm)
      loadClients()
      setView('list')
    }
  }

  function handleDisabledSection(label) {
    setNotice(`قسم "${label}" قيد التطوير — سيُبنى بنفس الأساس الحالي بالمراحل القادمة`)
    setTimeout(() => setNotice(null), 4000)
  }

  const tips = []
  if (notice) tips.push({ color: '#e08a1e', text: notice })
  if (view === 'form') {
    if (duplicateWarning) tips.push({ color: '#d9534f', text: `⚠ رقم الهاتف مستخدم أصلًا لزبون: ${duplicateWarning}` })
    else if (form.phone) tips.push({ color: '#5cb85c', text: 'رقم الهاتف غير مستخدم — يمكن الحفظ' })
    if (activeTab === 2) tips.push({ color: BLUE, text: 'سقف الدَّين يُحسب بالشيكل (₪)' })
    if (!form.firstName || !form.phone) tips.push({ color: '#e08a1e', text: 'الاسم الأول ورقم الهاتف إجباريان للحفظ' })
  } else {
    tips.push({ color: BLUE, text: `إجمالي الزبائن المسجّلين: ${clients.length}` })
  }

  return (
    <div style={page}>
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

      <SectionsBar onDisabledClick={handleDisabledSection} />

      <div style={subBar}>
        <div style={{ fontSize: 13, color: TEXT_MUTED }}>
          <span style={{ color: BLUE, fontWeight: 700, cursor: 'pointer' }} onClick={() => setView('list')}>الزبائن</span>
          {' / '}<span>{view === 'form' ? 'زبون جديد' : 'القائمة'}</span>
        </div>
        <div>
          {view === 'form' ? (
            <>
              <button style={btnPrimary} disabled={saving} onClick={addClient}>{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
              <button style={btnSecondary} onClick={() => { setForm(emptyForm); setView('list') }}>تجاهل</button>
            </>
          ) : (
            <button style={btnPrimary} onClick={() => setView('form')}>+ زبون جديد</button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: '0 16px' }}>
          <div style={{ background: '#fdecea', color: '#a33', padding: '9px 16px', borderRadius: 5, fontSize: 13 }}>{error}</div>
        </div>
      )}

      <div style={layout}>
        <div>
          {view === 'form' && (
            <>
              <div style={card}>
                <div style={cardHeader}>بيانات الزبون الأساسية</div>
                <div style={cardBody}>
                  <div style={fieldGrid}>
                    <BField label="الاسم الأول *" focusKey="firstName" focused={focused} setFocused={setFocused} value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
                    <BField label="اسم العائلة" focusKey="lastName" focused={focused} setFocused={setFocused} value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
                    <BField label="رقم الهاتف *" focusKey="phone" focused={focused} setFocused={setFocused} value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={card}>
                <div style={tabBar}>
                  {TABS.map((t, i) => (
                    <button key={t} style={tabBtn(activeTab === i)} onClick={() => setActiveTab(i)}>{t}</button>
                  ))}
                </div>
                <div style={cardBody}>
                  {activeTab === 0 && (
                    <div style={fieldGrid}>
                      <div style={fieldRow}>
                        <label style={bLabel}>الجنس</label>
                        <select style={bInput} value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                          <option value="">غير محدد</option>
                          <option value="male">ذكر</option>
                          <option value="female">أنثى</option>
                        </select>
                      </div>
                      <div style={fieldRow}>
                        <label style={bLabel}>الفئة</label>
                        <select style={bInput} value={form.category} onChange={(e) => update('category', e.target.value)}>
                          {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <BField label="تاريخ الميلاد" type="date" focusKey="birthday" focused={focused} setFocused={setFocused} value={form.birthday} onChange={(e) => update('birthday', e.target.value)} />
                      <BField label="الاختصاصي المفضل" focusKey="pro" focused={focused} setFocused={setFocused} value={form.preferredProfessional} onChange={(e) => update('preferredProfessional', e.target.value)} />
                      <BField label="اسم الشركة" focusKey="company" focused={focused} setFocused={setFocused} value={form.companyName} onChange={(e) => update('companyName', e.target.value)} />
                      <BField label="المنصب" focusKey="position" focused={focused} setFocused={setFocused} value={form.positionTitle} onChange={(e) => update('positionTitle', e.target.value)} />
                    </div>
                  )}
                  {activeTab === 1 && (
                    <div style={fieldGrid}>
                      <BField label="البريد الإلكتروني" type="email" focusKey="cemail" focused={focused} setFocused={setFocused} value={form.email} onChange={(e) => update('email', e.target.value)} />
                      <div style={fieldRow}>
                        <label style={{ ...bLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="checkbox" checked={form.emailOptOut} onChange={(e) => update('emailOptOut', e.target.checked)} />
                          لا ترسل بريد إلكتروني
                        </label>
                      </div>
                      <BField label="فيسبوك" focusKey="fb" focused={focused} setFocused={setFocused} value={form.facebook} onChange={(e) => update('facebook', e.target.value)} />
                      <BField label="فايبر" focusKey="viber" focused={focused} setFocused={setFocused} value={form.viber} onChange={(e) => update('viber', e.target.value)} />
                      <BField label="انستقرام" focusKey="insta" focused={focused} setFocused={setFocused} value={form.instagram} onChange={(e) => update('instagram', e.target.value)} />
                      <BField label="مصدر اكتساب العميل" focusKey="acq" focused={focused} setFocused={setFocused} value={form.acquisitionSource} onChange={(e) => update('acquisitionSource', e.target.value)} />
                      <BField label="UTM Campaign" focusKey="utmc" focused={focused} setFocused={setFocused} value={form.utmCampaign} onChange={(e) => update('utmCampaign', e.target.value)} />
                      <BField label="UTM Source" focusKey="utms" focused={focused} setFocused={setFocused} value={form.utmSource} onChange={(e) => update('utmSource', e.target.value)} />
                      <BField label="UTM Medium" focusKey="utmm" focused={focused} setFocused={setFocused} value={form.utmMedium} onChange={(e) => update('utmMedium', e.target.value)} />
                    </div>
                  )}
                  {activeTab === 2 && (
                    <div style={fieldGrid}>
                      <BField label="رقم البطاقة" focusKey="card" focused={focused} setFocused={setFocused} value={form.cardNumber} onChange={(e) => update('cardNumber', e.target.value)} />
                      <BField label="سقف الدَّين الأقصى (₪)" type="number" step="0.01" focusKey="debt" focused={focused} setFocused={setFocused} value={form.maxDebt} onChange={(e) => update('maxDebt', e.target.value)} />
                    </div>
                  )}
                  {activeTab === 3 && (
                    <div style={fieldGrid}>
                      <BField label="الرمز البريدي" focusKey="idx" focused={focused} setFocused={setFocused} value={form.addressIndex} onChange={(e) => update('addressIndex', e.target.value)} />
                      <BField label="المدينة" focusKey="city" focused={focused} setFocused={setFocused} value={form.addressCity} onChange={(e) => update('addressCity', e.target.value)} />
                      <BField label="الشارع" focusKey="street" focused={focused} setFocused={setFocused} value={form.addressStreet} onChange={(e) => update('addressStreet', e.target.value)} />
                      <BField label="رقم المبنى" focusKey="building" focused={focused} setFocused={setFocused} value={form.addressBuilding} onChange={(e) => update('addressBuilding', e.target.value)} />
                      <div style={{ ...fieldRow, gridColumn: '1 / -1' }}>
                        <label style={{ ...bLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="checkbox" checked={form.registrationAddressDiffers} onChange={(e) => update('registrationAddressDiffers', e.target.checked)} />
                          عنوان التسجيل يختلف
                        </label>
                      </div>
                      <BField label="سلسلة جواز السفر" focusKey="pS" focused={focused} setFocused={setFocused} value={form.passportSeries} onChange={(e) => update('passportSeries', e.target.value)} />
                      <BField label="رقم جواز السفر" focusKey="pN" focused={focused} setFocused={setFocused} value={form.passportNumber} onChange={(e) => update('passportNumber', e.target.value)} />
                      <BField label="تاريخ الإصدار" type="date" focusKey="pD" focused={focused} setFocused={setFocused} value={form.passportIssuedDate} onChange={(e) => update('passportIssuedDate', e.target.value)} />
                      <BField label="جهة الإصدار" focusKey="pB" focused={focused} setFocused={setFocused} value={form.passportIssuedBy} onChange={(e) => update('passportIssuedBy', e.target.value)} />
                      <BField label="الرقم التعريفي" focusKey="idc" focused={focused} setFocused={setFocused} value={form.identificationCode} onChange={(e) => update('identificationCode', e.target.value)} />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {view === 'list' && (
            <div style={card}>
              <div style={cardHeader}>قائمة الزبائن</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafbfc', color: TEXT_MUTED, fontSize: 11.5 }}>
                    <th style={{ textAlign: 'right', padding: '10px 14px' }}>الاسم</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px' }}>الهاتف</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px' }}>الفئة</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px' }}>البريد</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px' }}>سقف الدَّين</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: `1px solid ${BORDER}`, background: i % 2 ? '#fafbfc' : '#fff' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: BLUE }}>{c.first_name} {c.last_name}</td>
                      <td style={{ padding: '10px 14px' }}>{c.phone_number}</td>
                      <td style={{ padding: '10px 14px' }}>{CATEGORY_OPTIONS.find((o) => o.value === c.category)?.label || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{c.email || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{c.max_debt_limit ?? 0}₪</td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: TEXT_MUTED }}>مافي زبائن لسا</td></tr>
                  )}
                </tbody>
              </table>
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
  )
}

export default function Home() {
  const [session, setSession] = useState(undefined)
  const [salonId, setSalonId] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      setProfileLoading(true)
      supabase.from('profiles').select('salon_id').eq('id', session.user.id).single()
        .then(({ data }) => {
          setSalonId(data ? data.salon_id : null)
          setProfileLoading(false)
        })
    }
  }, [session])

  async function handleLogout() {
    await supabase.auth.signOut()
    setSalonId(null)
  }

  if (session === undefined) {
    return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>جاري التحميل...</div>
  }
  if (!session) {
    return <LoginScreen />
  }
  if (profileLoading) {
    return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>جاري تحميل بيانات الصالون...</div>
  }
  return <ClientsApp userEmail={session.user.email} salonId={salonId} onLogout={handleLogout} />
}

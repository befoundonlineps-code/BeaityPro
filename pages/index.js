import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// ==================== Odoo-style design tokens ====================
const ODOO_PURPLE = '#714B67'
const BORDER = '#dcdcdc'
const TEXT_MUTED = '#8a8a8a'

const page = { fontFamily: "'Segoe UI', Lato, sans-serif", direction: 'rtl', background: '#f5f5f5', minHeight: '100vh' }
const breadcrumbBar = {
  background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '10px 24px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}
const breadcrumbText = { fontSize: 14, color: TEXT_MUTED }
const btnPrimary = {
  background: ODOO_PURPLE, color: '#fff', border: 'none', borderRadius: 4,
  padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 8,
}
const btnSecondary = {
  background: '#fff', color: '#444', border: `1px solid ${BORDER}`, borderRadius: 4,
  padding: '6px 16px', fontSize: 13, cursor: 'pointer',
}
const sheet = {
  maxWidth: 960, margin: '20px auto', background: '#fff', border: `1px solid ${BORDER}`,
  borderRadius: 4, padding: '28px 32px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
}
const titleRow = { display: 'flex', gap: 20, marginBottom: 20, alignItems: 'flex-start' }
const avatarBox = {
  width: 90, height: 90, background: '#f0f0f0', border: `1px solid ${BORDER}`,
  borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#bbb', fontSize: 11, flexShrink: 0, textAlign: 'center',
}
const nameInput = {
  fontSize: 22, fontWeight: 500, border: 'none', borderBottom: '2px solid transparent',
  outline: 'none', width: '100%', padding: '4px 0', color: '#2c2c2c', background: 'transparent',
}
const tabBar = { display: 'flex', gap: 4, borderBottom: `1px solid ${BORDER}`, marginBottom: 20 }
const tabBtn = (active) => ({
  padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  color: active ? ODOO_PURPLE : TEXT_MUTED,
  borderBottom: active ? `2px solid ${ODOO_PURPLE}` : '2px solid transparent',
  background: 'none', border: 'none', marginBottom: -1,
})
const fieldGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 32px' }
const fieldRow = { display: 'flex', flexDirection: 'column', gap: 3 }
const oLabel = { fontSize: 12.5, color: '#444', fontWeight: 400 }
const oInput = {
  border: 'none', borderBottom: `1px solid ${BORDER}`, padding: '5px 2px', fontSize: 14,
  outline: 'none', background: 'transparent', fontFamily: 'inherit', color: '#2c2c2c',
}
const oInputFocus = { borderBottom: `1px solid ${ODOO_PURPLE}` }

function OField({ label, focusKey, focused, setFocused, ...props }) {
  const isFocused = focused === focusKey
  return (
    <div style={fieldRow}>
      <label style={oLabel}>{label}</label>
      <input
        style={{ ...oInput, ...(isFocused ? oInputFocus : {}) }}
        onFocus={() => setFocused(focusKey)}
        onBlur={() => setFocused(null)}
        {...props}
      />
    </div>
  )
}

const TABS = ['معلومات عامة', 'التواصل والتسويق', 'المعلومات المالية', 'العنوان والوثائق']

const emptyForm = {
  firstName: '', lastName: '', gender: '', category: '', phone: '',
  email: '', emailOptOut: false, facebook: '', viber: '', instagram: '',
  acquisitionSource: '', utmCampaign: '', utmSource: '', utmMedium: '',
  cardNumber: '', maxDebt: 0, preferredProfessional: '', companyName: '', positionTitle: '',
  addressIndex: '', addressCity: '', addressStreet: '', addressBuilding: '',
  passportSeries: '', passportNumber: '', passportIssuedDate: '', passportIssuedBy: '',
  identificationCode: '',
}

export default function Home() {
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [focused, setFocused] = useState(null)
  const [view, setView] = useState('form') // 'form' | 'list'

  useEffect(() => { loadClients() }, [])

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
    setSaving(true)

    const { data: existing } = await supabase
      .from('clients').select('id, first_name, last_name').eq('phone_number', form.phone)

    if (existing && existing.length > 0) {
      setError(`رقم الهاتف مستخدم أصلًا لزبون: ${existing[0].first_name} ${existing[0].last_name}`)
      setSaving(false)
      return
    }

    const { error } = await supabase.from('clients').insert([{
      first_name: form.firstName, last_name: form.lastName, gender: form.gender || null,
      category: form.category || null, phone_number: form.phone, email: form.email || null,
      email_opt_out: form.emailOptOut, facebook_url: form.facebook || null,
      viber_number: form.viber || null, instagram_handle: form.instagram || null,
      acquisition_source: form.acquisitionSource || null, utm_campaign: form.utmCampaign || null,
      utm_source: form.utmSource || null, utm_medium: form.utmMedium || null,
      card_number: form.cardNumber || null, max_debt_limit: form.maxDebt || 0,
      preferred_professional: form.preferredProfessional || null, company_name: form.companyName || null,
      position_title: form.positionTitle || null, address_index: form.addressIndex || null,
      address_city: form.addressCity || null, address_street: form.addressStreet || null,
      address_building: form.addressBuilding || null, passport_series: form.passportSeries || null,
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

  return (
    <div style={page}>
      {/* ===== Breadcrumb bar ===== */}
      <div style={breadcrumbBar}>
        <div style={breadcrumbText}>
          <span style={{ color: ODOO_PURPLE, fontWeight: 600, cursor: 'pointer' }} onClick={() => setView('list')}>الزبائن</span>
          {' / '}<span>{view === 'form' ? 'زبون جديد' : 'القائمة'}</span>
        </div>
        {view === 'form' && (
          <div>
            <button style={btnPrimary} disabled={saving} onClick={addClient}>
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button style={btnSecondary} onClick={() => { setForm(emptyForm); setView('list') }}>تجاهل</button>
          </div>
        )}
        {view === 'list' && (
          <button style={btnPrimary} onClick={() => setView('form')}>+ زبون جديد</button>
        )}
      </div>

      {error && (
        <div style={{ maxWidth: 960, margin: '12px auto 0', background: '#fdecea', color: '#a33', padding: '8px 16px', borderRadius: 4, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ===== FORM VIEW ===== */}
      {view === 'form' && (
        <div style={sheet}>
          <div style={titleRow}>
            <div style={avatarBox}>لا توجد صورة</div>
            <div style={{ flex: 1 }}>
              <input
                style={{ ...nameInput, ...(focused === 'firstName' ? { borderBottom: `2px solid ${ODOO_PURPLE}` } : {}) }}
                placeholder="اسم الزبون *"
                value={form.firstName}
                onFocus={() => setFocused('firstName')}
                onBlur={() => setFocused(null)}
                onChange={(e) => update('firstName', e.target.value)}
              />
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <input
                  style={{ ...oInput, flex: 1, ...(focused === 'lastName' ? oInputFocus : {}) }}
                  placeholder="اسم العائلة"
                  value={form.lastName}
                  onFocus={() => setFocused('lastName')}
                  onBlur={() => setFocused(null)}
                  onChange={(e) => update('lastName', e.target.value)}
                />
                <input
                  style={{ ...oInput, flex: 1, ...(focused === 'phone' ? oInputFocus : {}) }}
                  placeholder="رقم الهاتف *"
                  value={form.phone}
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Notebook tabs */}
          <div style={tabBar}>
            {TABS.map((t, i) => (
              <button key={t} style={tabBtn(activeTab === i)} onClick={() => setActiveTab(i)}>{t}</button>
            ))}
          </div>

          {activeTab === 0 && (
            <div style={fieldGrid}>
              <div style={fieldRow}>
                <label style={oLabel}>الجنس</label>
                <select style={oInput} value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                  <option value="">غير محدد</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
              <OField label="الفئة" focusKey="category" focused={focused} setFocused={setFocused} value={form.category} onChange={(e) => update('category', e.target.value)} />
              <OField label="الاختصاصي المفضل" focusKey="pro" focused={focused} setFocused={setFocused} value={form.preferredProfessional} onChange={(e) => update('preferredProfessional', e.target.value)} />
              <OField label="اسم الشركة" focusKey="company" focused={focused} setFocused={setFocused} value={form.companyName} onChange={(e) => update('companyName', e.target.value)} />
              <OField label="المنصب" focusKey="position" focused={focused} setFocused={setFocused} value={form.positionTitle} onChange={(e) => update('positionTitle', e.target.value)} />
            </div>
          )}

          {activeTab === 1 && (
            <div style={fieldGrid}>
              <OField label="البريد الإلكتروني" type="email" focusKey="email" focused={focused} setFocused={setFocused} value={form.email} onChange={(e) => update('email', e.target.value)} />
              <div style={fieldRow}>
                <label style={{ ...oLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={form.emailOptOut} onChange={(e) => update('emailOptOut', e.target.checked)} />
                  لا ترسل بريد إلكتروني
                </label>
              </div>
              <OField label="فيسبوك" focusKey="fb" focused={focused} setFocused={setFocused} value={form.facebook} onChange={(e) => update('facebook', e.target.value)} />
              <OField label="فايبر" focusKey="viber" focused={focused} setFocused={setFocused} value={form.viber} onChange={(e) => update('viber', e.target.value)} />
              <OField label="انستقرام" focusKey="insta" focused={focused} setFocused={setFocused} value={form.instagram} onChange={(e) => update('instagram', e.target.value)} />
              <div />
              <OField label="مصدر اكتساب العميل" focusKey="acq" focused={focused} setFocused={setFocused} value={form.acquisitionSource} onChange={(e) => update('acquisitionSource', e.target.value)} />
              <OField label="UTM Campaign" focusKey="utmc" focused={focused} setFocused={setFocused} value={form.utmCampaign} onChange={(e) => update('utmCampaign', e.target.value)} />
              <OField label="UTM Source" focusKey="utms" focused={focused} setFocused={setFocused} value={form.utmSource} onChange={(e) => update('utmSource', e.target.value)} />
              <OField label="UTM Medium" focusKey="utmm" focused={focused} setFocused={setFocused} value={form.utmMedium} onChange={(e) => update('utmMedium', e.target.value)} />
            </div>
          )}

          {activeTab === 2 && (
            <div style={fieldGrid}>
              <OField label="رقم البطاقة" focusKey="card" focused={focused} setFocused={setFocused} value={form.cardNumber} onChange={(e) => update('cardNumber', e.target.value)} />
              <OField label="سقف الدَّين الأقصى" type="number" step="0.01" focusKey="debt" focused={focused} setFocused={setFocused} value={form.maxDebt} onChange={(e) => update('maxDebt', e.target.value)} />
            </div>
          )}

          {activeTab === 3 && (
            <div style={fieldGrid}>
              <OField label="الرمز البريدي" focusKey="idx" focused={focused} setFocused={setFocused} value={form.addressIndex} onChange={(e) => update('addressIndex', e.target.value)} />
              <OField label="المدينة" focusKey="city" focused={focused} setFocused={setFocused} value={form.addressCity} onChange={(e) => update('addressCity', e.target.value)} />
              <OField label="الشارع" focusKey="street" focused={focused} setFocused={setFocused} value={form.addressStreet} onChange={(e) => update('addressStreet', e.target.value)} />
              <OField label="رقم المبنى" focusKey="building" focused={focused} setFocused={setFocused} value={form.addressBuilding} onChange={(e) => update('addressBuilding', e.target.value)} />
              <OField label="سلسلة جواز السفر" focusKey="pS" focused={focused} setFocused={setFocused} value={form.passportSeries} onChange={(e) => update('passportSeries', e.target.value)} />
              <OField label="رقم جواز السفر" focusKey="pN" focused={focused} setFocused={setFocused} value={form.passportNumber} onChange={(e) => update('passportNumber', e.target.value)} />
              <OField label="تاريخ الإصدار" type="date" focusKey="pD" focused={focused} setFocused={setFocused} value={form.passportIssuedDate} onChange={(e) => update('passportIssuedDate', e.target.value)} />
              <OField label="جهة الإصدار" focusKey="pB" focused={focused} setFocused={setFocused} value={form.passportIssuedBy} onChange={(e) => update('passportIssuedBy', e.target.value)} />
              <OField label="الرقم التعريفي" focusKey="idc" focused={focused} setFocused={setFocused} value={form.identificationCode} onChange={(e) => update('identificationCode', e.target.value)} />
              <div />
              <p style={{ fontSize: 11, color: TEXT_MUTED, gridColumn: '1 / -1', marginTop: 4 }}>
                ملاحظة: بيانات حساسة — قبل الإطلاق الفعلي لازم تُشفَّر، مش تُخزَّن كنص عادي.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== LIST VIEW (Odoo-style table) ===== */}
      {view === 'list' && (
        <div style={sheet}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BORDER}`, color: TEXT_MUTED, fontSize: 12 }}>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>الاسم</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>الهاتف</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>الفئة</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>البريد الإلكتروني</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>سقف الدَّين</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '9px 6px', fontWeight: 600, color: ODOO_PURPLE }}>{c.first_name} {c.last_name}</td>
                  <td style={{ padding: '9px 6px' }}>{c.phone_number}</td>
                  <td style={{ padding: '9px 6px' }}>{c.category || '—'}</td>
                  <td style={{ padding: '9px 6px' }}>{c.email || '—'}</td>
                  <td style={{ padding: '9px 6px' }}>{c.max_debt_limit ?? 0}$</td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: TEXT_MUTED }}>مافي زبائن لسا</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 12, color: TEXT_MUTED }}>{clients.length} زبون</div>
        </div>
      )}
    </div>
  )
}

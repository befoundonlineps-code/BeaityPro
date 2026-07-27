import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getDuplicateWarningMessage } from '../lib/duplicateCheck'
import { CATEGORY_OPTIONS, TABS, emptyForm } from '../constants'
import BField from './BField'
import SectionsBar from './SectionsBar'
import {
  page, topBar, topBarTitle, logoCircle, logoutBtn, subBar, btnPrimary, btnSecondary,
  layout, card, cardHeader, cardBody, fieldGrid, fieldRow, bLabel, bInput, tabBar, tabBtn,
  sideCard, sideHeader, tipItem, dot, TEXT_MUTED, BLUE, BORDER,
} from '../styles'

export default function ClientsApp({ userEmail, salonId, onLogout }) {
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

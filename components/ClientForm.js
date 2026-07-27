import { CATEGORY_OPTIONS, TABS } from '../constants'
import BField from './BField'
import { card, cardHeader, cardBody, fieldGrid, fieldRow, bLabel, bInput, tabBar, tabBtn } from '../styles'

export default function ClientForm({ form, update, activeTab, setActiveTab, focused, setFocused }) {
  return (
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
  )
}

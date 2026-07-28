import { CATEGORY_OPTIONS, TABS } from '../constants'
import BField from './BField'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

const NONE = '__none__'

function PickField({ label, value, onChange, options, disabled }) {
  const items = Object.fromEntries(options.map((o) => [o.value || NONE, o.label]))
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select items={items} value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value || NONE} value={o.value || NONE}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function ClientForm({ form, update, activeTab, setActiveTab, readOnly = false }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>بيانات الزبون الأساسية</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <BField label="الاسم الأول *" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} disabled={readOnly} />
            <BField label="اسم العائلة" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} disabled={readOnly} />
            <BField label="رقم الهاتف *" value={form.phone} onChange={(e) => update('phone', e.target.value)} disabled={readOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <Tabs value={String(activeTab)} onValueChange={(v) => setActiveTab(Number(v))}>
          <CardHeader>
            <TabsList className="w-full sm:w-fit">
              {TABS.map((t, i) => (
                <TabsTrigger key={t} value={String(i)}>{t}</TabsTrigger>
              ))}
            </TabsList>
          </CardHeader>
          <CardContent>
            {activeTab === 0 && (
              <TabsContent value="0" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <PickField
                  label="الجنس"
                  value={form.gender}
                  onChange={(v) => update('gender', v)}
                  options={[{ value: '', label: 'غير محدد' }, { value: 'male', label: 'ذكر' }, { value: 'female', label: 'أنثى' }]}
                  disabled={readOnly}
                />
                <PickField label="الفئة" value={form.category} onChange={(v) => update('category', v)} options={CATEGORY_OPTIONS} disabled={readOnly} />
                <BField label="تاريخ الميلاد" type="date" value={form.birthday} onChange={(e) => update('birthday', e.target.value)} disabled={readOnly} />
                <BField label="الاختصاصي المفضل" value={form.preferredProfessional} onChange={(e) => update('preferredProfessional', e.target.value)} disabled={readOnly} />
                <BField label="اسم الشركة" value={form.companyName} onChange={(e) => update('companyName', e.target.value)} disabled={readOnly} />
                <BField label="المنصب" value={form.positionTitle} onChange={(e) => update('positionTitle', e.target.value)} disabled={readOnly} />
              </TabsContent>
            )}

            {activeTab === 1 && (
              <TabsContent value="1" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <BField label="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} disabled={readOnly} />
                <label className="flex items-center gap-2 self-end pb-1 text-sm font-medium">
                  <input type="checkbox" className="accent-primary" checked={form.emailOptOut} onChange={(e) => update('emailOptOut', e.target.checked)} disabled={readOnly} />
                  لا ترسل بريد إلكتروني
                </label>
                <BField label="فيسبوك" value={form.facebook} onChange={(e) => update('facebook', e.target.value)} disabled={readOnly} />
                <BField label="فايبر" value={form.viber} onChange={(e) => update('viber', e.target.value)} disabled={readOnly} />
                <BField label="انستقرام" value={form.instagram} onChange={(e) => update('instagram', e.target.value)} disabled={readOnly} />
                <BField label="مصدر اكتساب العميل" value={form.acquisitionSource} onChange={(e) => update('acquisitionSource', e.target.value)} disabled={readOnly} />
                <BField label="UTM Campaign" value={form.utmCampaign} onChange={(e) => update('utmCampaign', e.target.value)} disabled={readOnly} />
                <BField label="UTM Source" value={form.utmSource} onChange={(e) => update('utmSource', e.target.value)} disabled={readOnly} />
                <BField label="UTM Medium" value={form.utmMedium} onChange={(e) => update('utmMedium', e.target.value)} disabled={readOnly} />
              </TabsContent>
            )}

            {activeTab === 2 && (
              <TabsContent value="2" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <BField label="رقم البطاقة" value={form.cardNumber} onChange={(e) => update('cardNumber', e.target.value)} disabled={readOnly} />
                <BField label="سقف الدَّين الأقصى (₪)" type="number" step="0.01" value={form.maxDebt} onChange={(e) => update('maxDebt', e.target.value)} disabled={readOnly} />
              </TabsContent>
            )}

            {activeTab === 3 && (
              <TabsContent value="3" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <BField label="الرمز البريدي" value={form.addressIndex} onChange={(e) => update('addressIndex', e.target.value)} disabled={readOnly} />
                <BField label="المدينة" value={form.addressCity} onChange={(e) => update('addressCity', e.target.value)} disabled={readOnly} />
                <BField label="الشارع" value={form.addressStreet} onChange={(e) => update('addressStreet', e.target.value)} disabled={readOnly} />
                <BField label="رقم المبنى" value={form.addressBuilding} onChange={(e) => update('addressBuilding', e.target.value)} disabled={readOnly} />
                <label className="flex items-center gap-2 sm:col-span-2 lg:col-span-3 text-sm font-medium">
                  <input type="checkbox" className="accent-primary" checked={form.registrationAddressDiffers} onChange={(e) => update('registrationAddressDiffers', e.target.checked)} disabled={readOnly} />
                  عنوان التسجيل يختلف
                </label>
                <BField label="سلسلة جواز السفر" value={form.passportSeries} onChange={(e) => update('passportSeries', e.target.value)} disabled={readOnly} />
                <BField label="رقم جواز السفر" value={form.passportNumber} onChange={(e) => update('passportNumber', e.target.value)} disabled={readOnly} />
                <BField label="تاريخ الإصدار" type="date" value={form.passportIssuedDate} onChange={(e) => update('passportIssuedDate', e.target.value)} disabled={readOnly} />
                <BField label="جهة الإصدار" value={form.passportIssuedBy} onChange={(e) => update('passportIssuedBy', e.target.value)} disabled={readOnly} />
                <BField label="الرقم التعريفي" value={form.identificationCode} onChange={(e) => update('identificationCode', e.target.value)} disabled={readOnly} />
              </TabsContent>
            )}
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}

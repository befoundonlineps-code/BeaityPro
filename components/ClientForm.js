import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { Pencil } from 'lucide-react'
import { useAcquisitionSources } from '../hooks/useAcquisitionSources'
import { useCategories } from '../hooks/useCategories'
import BField from './BField'
import AcquisitionSourceManagerDialog from './AcquisitionSourceManagerDialog'
import CategoryManagerDialog from './CategoryManagerDialog'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
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

export default function ClientForm({ form, update, activeTab, setActiveTab, readOnly = false, salonId }) {
  const { t } = useTranslation('clientForm')
  const { sources: acquisitionSources, loading: acquisitionSourcesLoading, reload: reloadAcquisitionSources } = useAcquisitionSources()
  const { categories, loading: categoriesLoading, reload: reloadCategories } = useCategories()
  const [managerOpen, setManagerOpen] = useState(false)
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)

  const tabs = [t('tabs.general'), t('tabs.contact'), t('tabs.financial'), t('tabs.address')]
  const genderOptions = [
    { value: '', label: t('genderOptions.unspecified') },
    { value: 'male', label: t('genderOptions.male') },
    { value: 'female', label: t('genderOptions.female') },
  ]
  const categoryOptions = [
    { value: '', label: t('categoryUnspecified') },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ]
  const acquisitionSourceOptions = [
    { value: '', label: t('acquisitionSourceUnspecified') },
    ...acquisitionSources.map((s) => ({ value: s.id, label: s.name })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>{t('basicDataTitle')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <BField label={t('firstNameLabel')} value={form.firstName} onChange={(e) => update('firstName', e.target.value)} disabled={readOnly} />
            <BField label={t('lastNameLabel')} value={form.lastName} onChange={(e) => update('lastName', e.target.value)} disabled={readOnly} />
            <BField label={t('phoneLabel')} value={form.phone} onChange={(e) => update('phone', e.target.value)} disabled={readOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <Tabs value={String(activeTab)} onValueChange={(v) => setActiveTab(Number(v))}>
          <CardHeader>
            <TabsList className="group-data-horizontal/tabs:h-11 w-full flex-wrap gap-2 bg-muted p-1.5 sm:w-fit">
              {tabs.map((label, i) => (
                <TabsTrigger
                  key={label}
                  value={String(i)}
                  className="px-3.5 py-2 data-active:bg-primary data-active:text-primary-foreground dark:data-active:bg-primary dark:data-active:text-primary-foreground"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </CardHeader>
          <CardContent>
            {activeTab === 0 && (
              <TabsContent value="0" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <PickField
                  label={t('genderLabel')}
                  value={form.gender}
                  onChange={(v) => update('gender', v)}
                  options={genderOptions}
                  disabled={readOnly}
                />
                <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <PickField
                        label={t('categoryLabel')}
                        value={form.categoryId}
                        onChange={(v) => update('categoryId', v)}
                        options={categoryOptions}
                        disabled={readOnly}
                      />
                    </div>
                    {!readOnly && (
                      <Button type="button" variant="outline" size="icon-sm" title={t('manageCategoriesButton')} onClick={() => setCategoryManagerOpen(true)}>
                        <Pencil />
                      </Button>
                    )}
                  </div>
                </div>
                <BField label={t('birthdayLabel')} type="date" value={form.birthday} onChange={(e) => update('birthday', e.target.value)} disabled={readOnly} />
                <BField label={t('preferredProfessionalLabel')} value={form.preferredProfessional} onChange={(e) => update('preferredProfessional', e.target.value)} disabled={readOnly} />
                <BField label={t('companyNameLabel')} value={form.companyName} onChange={(e) => update('companyName', e.target.value)} disabled={readOnly} />
                <BField label={t('positionTitleLabel')} value={form.positionTitle} onChange={(e) => update('positionTitle', e.target.value)} disabled={readOnly} />
              </TabsContent>
            )}

            {activeTab === 1 && (
              <TabsContent value="1" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <BField label={t('emailLabel')} type="email" value={form.email} onChange={(e) => update('email', e.target.value)} disabled={readOnly} />
                <label className="flex items-center gap-2 self-end pb-1 text-sm font-medium">
                  <input type="checkbox" className="accent-primary" checked={form.emailOptOut} onChange={(e) => update('emailOptOut', e.target.checked)} disabled={readOnly} />
                  {t('emailOptOutLabel')}
                </label>
                <BField label={t('facebookLabel')} value={form.facebook} onChange={(e) => update('facebook', e.target.value)} disabled={readOnly} />
                <BField label={t('whatsappLabel')} value={form.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} disabled={readOnly} />
                <BField label={t('instagramLabel')} value={form.instagram} onChange={(e) => update('instagram', e.target.value)} disabled={readOnly} />
                <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <PickField
                        label={t('acquisitionSourceLabel')}
                        value={form.acquisitionSourceId}
                        onChange={(v) => update('acquisitionSourceId', v)}
                        options={acquisitionSourceOptions}
                        disabled={readOnly}
                      />
                    </div>
                    {!readOnly && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setManagerOpen(true)}>
                        {t('manageAcquisitionSourcesButton')}
                      </Button>
                    )}
                  </div>
                </div>
                <BField label={t('utmCampaignLabel')} value={form.utmCampaign} onChange={(e) => update('utmCampaign', e.target.value)} disabled={readOnly} />
                <BField label={t('utmSourceLabel')} value={form.utmSource} onChange={(e) => update('utmSource', e.target.value)} disabled={readOnly} />
                <BField label={t('utmMediumLabel')} value={form.utmMedium} onChange={(e) => update('utmMedium', e.target.value)} disabled={readOnly} />
              </TabsContent>
            )}

            {activeTab === 2 && (
              <TabsContent value="2" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <BField label={t('cardNumberLabel')} value={form.cardNumber} onChange={(e) => update('cardNumber', e.target.value)} disabled={readOnly} />
                <BField label={t('maxDebtLabel')} type="number" step="0.01" value={form.maxDebt} onChange={(e) => update('maxDebt', e.target.value)} disabled={readOnly} />
              </TabsContent>
            )}

            {activeTab === 3 && (
              <TabsContent value="3" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <BField label={t('addressIndexLabel')} value={form.addressIndex} onChange={(e) => update('addressIndex', e.target.value)} disabled={readOnly} />
                <BField label={t('addressCityLabel')} value={form.addressCity} onChange={(e) => update('addressCity', e.target.value)} disabled={readOnly} />
                <BField label={t('addressStreetLabel')} value={form.addressStreet} onChange={(e) => update('addressStreet', e.target.value)} disabled={readOnly} />
                <BField label={t('addressBuildingLabel')} value={form.addressBuilding} onChange={(e) => update('addressBuilding', e.target.value)} disabled={readOnly} />
                <label className="flex items-center gap-2 sm:col-span-2 lg:col-span-3 text-sm font-medium">
                  <input type="checkbox" className="accent-primary" checked={form.registrationAddressDiffers} onChange={(e) => update('registrationAddressDiffers', e.target.checked)} disabled={readOnly} />
                  {t('registrationAddressDiffersLabel')}
                </label>
                <BField label={t('passportSeriesLabel')} value={form.passportSeries} onChange={(e) => update('passportSeries', e.target.value)} disabled={readOnly} />
                <BField label={t('passportNumberLabel')} value={form.passportNumber} onChange={(e) => update('passportNumber', e.target.value)} disabled={readOnly} />
                <BField label={t('passportIssuedDateLabel')} type="date" value={form.passportIssuedDate} onChange={(e) => update('passportIssuedDate', e.target.value)} disabled={readOnly} />
                <BField label={t('passportIssuedByLabel')} value={form.passportIssuedBy} onChange={(e) => update('passportIssuedBy', e.target.value)} disabled={readOnly} />
                <BField label={t('identificationCodeLabel')} value={form.identificationCode} onChange={(e) => update('identificationCode', e.target.value)} disabled={readOnly} />
              </TabsContent>
            )}
          </CardContent>
        </Tabs>
      </Card>

      <AcquisitionSourceManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        sources={acquisitionSources}
        loading={acquisitionSourcesLoading}
        onChanged={reloadAcquisitionSources}
        salonId={salonId}
      />

      <CategoryManagerDialog
        open={categoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
        categories={categories}
        loading={categoriesLoading}
        onChanged={reloadCategories}
        salonId={salonId}
      />
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'next-i18next'
import { Plus, Minus, ImageOff } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { reportDbError } from '../lib/dbErrors'
import { useResources } from '../hooks/useResources'
import { linksFor } from '../lib/resourceLinks'
import { validateServiceForm, serviceFormPayload, SEX_OPTIONS, ACCOUNTING_DIRECTIONS } from '../lib/serviceForm'
import { saveService, setServiceImagePath, saveServiceResources } from '../lib/serviceAdminIO'
import { buildServicePhotoPath, getPublicServicePhotoUrl, BUCKET } from '../lib/servicePhotos'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const DEFAULT_COLOR = '#7C3AED'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const FIELD = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function CheckboxField({ label, hint, checked, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="accent-primary" checked={checked} onChange={onChange} />
        <span>{label}</span>
      </label>
      {hint && <p className="text-xs text-muted-foreground ps-6">{hint}</p>}
    </div>
  )
}

export default function ServiceFormDialog({ open, onOpenChange, service, categoryId, salonId, onSaved }) {
  const { t } = useTranslation(['services', 'settings', 'common'])

  const [name, setName] = useState('')
  const [abbreviation, setAbbreviation] = useState('')
  const [barCode, setBarCode] = useState('')
  const [duration, setDuration] = useState('30')
  const [price, setPrice] = useState('0')
  const [plannedCost, setPlannedCost] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [sex, setSex] = useState('all')
  const [accountingDirection, setAccountingDirection] = useState('')
  const [priceProportional, setPriceProportional] = useState(false)
  const [anyoneCanSell, setAnyoneCanSell] = useState(true)
  const [description, setDescription] = useState('')

  const [imagePath, setImagePath] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const fileInputRef = useRef(null)

  const [selectedResourceIds, setSelectedResourceIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // A service created here that then fails on its picture or its resource
  // links must not be created twice when the person presses save again. The id
  // of what was just inserted turns every retry into an update.
  const [createdId, setCreatedId] = useState(null)
  const effectiveId = service ? service.id : createdId
  const isEdit = !!service

  // Resources load once on mount. Switching to the Resources view unmounts
  // this whole screen, so coming back from adding one remounts and refetches —
  // there is nothing stale to reload on open.
  const { resources, serviceResources, loading: resourcesLoading } = useResources()
  const linksInitialisedFor = useRef(null)

  useEffect(() => {
    if (!open) return
    setError('')
    setCreatedId(null)
    setName(service ? service.name || '' : '')
    setAbbreviation(service ? service.abbreviation || '' : '')
    setBarCode(service ? service.bar_code || '' : '')
    setDuration(service ? String(service.duration_minutes) : '30')
    setPrice(service ? String(service.price) : '0')
    setPlannedCost(service && service.planned_cost !== null && service.planned_cost !== undefined
      ? String(service.planned_cost) : '')
    setColor(service && service.color ? service.color : DEFAULT_COLOR)
    setSex(service && service.sex ? service.sex : 'all')
    setAccountingDirection(service ? service.accounting_direction || '' : '')
    setPriceProportional(service ? !!service.price_proportional_to_duration : false)
    setAnyoneCanSell(service ? service.anyone_can_sell !== false : true)
    setDescription(service ? service.description || '' : '')
    setImagePath(service ? service.image_path || '' : '')
    setImageFile(null)
  }, [open, service])

  // Ticking the resource boxes waits for the links to arrive, and happens once
  // per opening. Re-running it whenever serviceResources changed would wipe
  // boxes somebody had just ticked, the moment any refetch landed.
  useEffect(() => {
    if (!open) {
      linksInitialisedFor.current = null
      return
    }
    if (resourcesLoading) return

    const key = service ? service.id : 'new'
    if (linksInitialisedFor.current === key) return
    linksInitialisedFor.current = key

    setSelectedResourceIds(
      linksFor(serviceResources, 'service_id', service ? service.id : null).map((row) => row.resource_id)
    )
  }, [open, service, serviceResources, resourcesLoading])

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(imageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const shownImage = previewUrl || (imagePath ? getPublicServicePhotoUrl(supabase, imagePath) : '')

  function pickImage(event) {
    const file = event.target.files && event.target.files[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_IMAGE_BYTES) {
      setError(t('services:serviceDialog.imageTooLargeError'))
      return
    }
    setError('')
    setImageFile(file)
  }

  function removeImage() {
    setImageFile(null)
    setImagePath('')
  }

  function toggleResource(resourceId) {
    setSelectedResourceIds((prev) =>
      prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId]
    )
  }

  const values = {
    name, duration, price, color, sex, abbreviation, barCode, description,
    plannedCost, accountingDirection,
    priceProportionalToDuration: priceProportional,
    anyoneCanSell,
  }

  async function handleSave() {
    const validationKey = validateServiceForm(values)
    if (validationKey) {
      setError(t(validationKey))
      return
    }

    setError('')
    setSaving(true)

    const { ok, error: saveError, row } = await saveService({
      id: effectiveId,
      payload: serviceFormPayload(values),
      salonId,
      categoryId,
    })

    if (!ok) {
      setSaving(false)
      setError(saveError
        ? t(reportDbError(saveError, 'ServiceFormDialog.save'))
        : t('services:serviceDialog.noRowsError'))
      return
    }

    const serviceId = row.id
    setCreatedId(serviceId)

    // The picture is a second write because its storage path contains the id,
    // which a new service only has once it exists. A failure here leaves a
    // saved service without its picture — real, recoverable, and said plainly
    // rather than swallowed.
    if (imageFile) {
      const path = buildServicePhotoPath(serviceId, imageFile.name)
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, imageFile)
      if (uploadError) {
        setSaving(false)
        onSaved()
        setError(t('services:serviceDialog.imageUploadFailedError'))
        return
      }
      const { ok: pathOk } = await setServiceImagePath(serviceId, path)
      if (!pathOk) {
        setSaving(false)
        onSaved()
        setError(t('services:serviceDialog.imageUploadFailedError'))
        return
      }
      setImagePath(path)
      setImageFile(null)
    } else if (imagePath !== (service ? service.image_path || '' : '')) {
      // Nothing new to upload but the path changed, which is what removing a
      // picture looks like from here.
      const { ok: pathOk } = await setServiceImagePath(serviceId, imagePath || null)
      if (!pathOk) {
        setSaving(false)
        onSaved()
        setError(t('services:serviceDialog.imageUploadFailedError'))
        return
      }
    }

    const { ok: linksOk } = await saveServiceResources({
      serviceId,
      salonId,
      existingLinks: linksFor(serviceResources, 'service_id', service ? service.id : null),
      selectedResourceIds,
    })

    setSaving(false)

    if (!linksOk) {
      onSaved()
      setError(t('services:serviceDialog.resourcesFailedError'))
      return
    }

    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogContent is display:grid by default, and under a grid every
          min-h-0 and flex-1 below is inert — which is how a long form ended up
          pushing save and discard off the bottom of the screen once already.
          flex flex-col is what makes the body scroll and the footer stay. */}
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden max-w-[calc(100%-2rem)] lg:max-w-[1000px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('services:serviceDialog.editTitle') : t('services:serviceDialog.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pe-1">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="flex flex-col gap-3">
              <Section title={t('services:serviceDialog.sectionBasics')}>
                <Field label={t('services:serviceDialog.nameLabel')}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label={t('services:serviceDialog.abbreviationLabel')}
                    hint={t('services:serviceDialog.abbreviationHint')}
                  >
                    <Input value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} />
                  </Field>
                  <Field
                    label={t('services:serviceDialog.barCodeLabel')}
                    hint={t('services:serviceDialog.barCodeHint')}
                  >
                    <Input value={barCode} onChange={(e) => setBarCode(e.target.value)} />
                  </Field>
                </div>
              </Section>

              <Section title={t('services:serviceDialog.sectionPricing')}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label={t('services:serviceDialog.durationLabel')}>
                    <Input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
                  </Field>
                  <Field label={t('services:serviceDialog.priceLabel')}>
                    <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </Field>
                  <Field label={t('services:serviceDialog.colorLabel')}>
                    <Input
                      type="color"
                      className="h-9 p-1"
                      value={color}
                      onChange={(e) => setColor(e.target.value.toUpperCase())}
                    />
                  </Field>
                </div>
                <Field
                  label={t('services:serviceDialog.plannedCostLabel')}
                  hint={t('services:serviceDialog.plannedCostHint')}
                >
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={plannedCost}
                    onChange={(e) => setPlannedCost(e.target.value)}
                  />
                </Field>
              </Section>

              <Section title={t('services:serviceDialog.sectionClassification')}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={t('services:serviceDialog.sexLabel')}>
                    <select className={FIELD} value={sex} onChange={(e) => setSex(e.target.value)}>
                      {SEX_OPTIONS.map((v) => (
                        <option key={v} value={v}>{t(`services:sexOptions.${v}`)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={t('services:serviceDialog.directionLabel')}
                    hint={t('services:serviceDialog.directionHint')}
                  >
                    <select
                      className={FIELD}
                      value={accountingDirection}
                      onChange={(e) => setAccountingDirection(e.target.value)}
                    >
                      <option value="">{t('services:serviceDialog.directionNone')}</option>
                      {ACCOUNTING_DIRECTIONS.map((value) => (
                        <option key={value} value={value}>
                          {value === 'common'
                            ? t('services:serviceDialog.directionCommon')
                            : t(`settings:businessTypes.types.${value}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <CheckboxField
                  label={t('services:serviceDialog.proportionalLabel')}
                  hint={t('services:serviceDialog.proportionalHint')}
                  checked={priceProportional}
                  onChange={(e) => setPriceProportional(e.target.checked)}
                />
                <CheckboxField
                  label={t('services:serviceDialog.anyoneCanSellLabel')}
                  hint={t('services:serviceDialog.anyoneCanSellHint')}
                  checked={anyoneCanSell}
                  onChange={(e) => setAnyoneCanSell(e.target.checked)}
                />
              </Section>
            </div>

            <Section title={t('services:serviceDialog.sectionMedia')}>
              <div className="flex flex-col gap-2">
                <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30">
                  {shownImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shownImage} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageOff className="size-8 text-muted-foreground" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={pickImage}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  >
                    {shownImage
                      ? t('services:serviceDialog.imageChangeButton')
                      : t('services:serviceDialog.imageChooseButton')}
                  </Button>
                  {shownImage && (
                    <Button type="button" variant="ghost" size="sm" onClick={removeImage}>
                      {t('services:serviceDialog.imageRemoveButton')}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t('services:serviceDialog.imageHint')}</p>
              </div>

              <Field
                label={t('services:serviceDialog.descriptionLabel')}
                hint={t('services:serviceDialog.descriptionHint')}
              >
                <textarea
                  className={`${FIELD} h-24 resize-none py-2`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </Section>
          </div>

          {/* The same service_resources link ResourceFormDialog writes, seen
              from the other end. No new table, and both ends share the diff in
              lib/resourceLinks.js so they cannot drift apart. */}
          <Section title={t('services:serviceDialog.sectionResources')}>
            <p className="text-xs text-muted-foreground">{t('services:serviceDialog.resourcesHint')}</p>
            {resources.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                {t('services:serviceDialog.resourcesEmpty')}
              </div>
            ) : (
              <>
                <Label>{t('services:serviceDialog.resourcesLabel', { count: selectedResourceIds.length })}</Label>
                <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-border p-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {resources.map((resource) => (
                    <label
                      key={resource.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={selectedResourceIds.includes(resource.id)}
                        onChange={() => toggleResource(resource.id)}
                      />
                      <span className="truncate">{resource.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </Section>

          {/* Shape only, and disabled so it says so by behaving that way.
              There are no products, inventory, warehouse or stock tables in
              this database — checked, none of the four exist — so every
              control here would be typing into nothing. Live-looking inputs
              that silently discard what is typed are worse than greyed ones.
              Tracked as a deferred feature in docs/PROJECT_HANDOFF.md. */}
          <Section title={t('services:serviceDialog.sectionProducts')}>
            <p className="text-xs text-muted-foreground">{t('services:serviceDialog.productsHint')}</p>
            <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              {t('services:serviceDialog.productsDisabledNotice')}
            </div>

            <div className="pointer-events-none opacity-55">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[240px_minmax(0,1fr)]">
                <Field label={t('services:serviceDialog.productsWarehouseLabel')}>
                  <select className={FIELD} disabled>
                    <option>{t('services:serviceDialog.productsWarehousePlaceholder')}</option>
                  </select>
                </Field>
              </div>

              <div className="mt-2 flex flex-col gap-2">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Label>{t('services:serviceDialog.productsProductColumn')}</Label>
                    <Input
                      className="mt-1.5"
                      disabled
                      placeholder={t('services:serviceDialog.productsProductPlaceholder')}
                    />
                  </div>
                  <div className="w-24">
                    <Label>{t('services:serviceDialog.productsQuantityColumn')}</Label>
                    <Input className="mt-1.5" type="number" disabled placeholder="1" />
                  </div>
                  <Button type="button" variant="outline" size="icon" className="size-8" disabled
                    aria-label={t('services:serviceDialog.productsRemoveRow')}>
                    <Minus className="size-3.5" />
                  </Button>
                </div>

                <Button type="button" variant="outline" size="sm" className="self-start" disabled>
                  <Plus className="size-3.5" />
                  {t('services:serviceDialog.productsAddRow')}
                </Button>
              </div>
            </div>
          </Section>
        </div>

        {error && <div className="shrink-0 text-sm text-destructive">{error}</div>}

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? t('common:saving') : t('common:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

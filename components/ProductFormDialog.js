import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { reportDbError } from '../lib/dbErrors'
import { saveProduct, saveSetComponents } from '../lib/productAdminIO'
import {
  validateProductForm, productFormPayload, productSaveAction,
  ACCOUNTING_DIRECTIONS, PRODUCT_UNITS,
} from '../lib/productForm'
import { supplierChoices } from '../lib/supplierForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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

function CheckboxField({ label, hint, checked, onChange, disabled }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
        <input type="checkbox" className="accent-primary" checked={checked} onChange={onChange} disabled={disabled} />
        <span>{label}</span>
      </label>
      {hint && <p className="text-xs text-muted-foreground ps-6">{hint}</p>}
    </div>
  )
}

// The product window.
//
// Two shapes behind one title, because the reference does the same and for the
// same reason: a set is not a product with fields left blank. Choosing "set"
// takes away the package, the purchase price, the low-supply threshold, the
// abbreviation and consignment — a set is never bought, only assembled from
// things that were — and puts a component list in their place. Which fields
// survive the switch is decided in lib/productForm.js so it can be tested,
// not read.
export default function ProductFormDialog({
  open, onOpenChange, product, categoryId, categories, products, suppliers, salonId, onSaved,
}) {
  const { t } = useTranslation(['products', 'settings', 'common'])

  const [name, setName] = useState('')
  const [kind, setKind] = useState('product')
  const [accountingDirection, setAccountingDirection] = useState('')
  const [baseUnit, setBaseUnit] = useState('pcs')
  const [unitsPerPackage, setUnitsPerPackage] = useState('1')
  const [portionOutput, setPortionOutput] = useState('1')
  const [isConsignment, setIsConsignment] = useState(false)
  const [supplierId, setSupplierId] = useState('')

  const [sellByPackages, setSellByPackages] = useState(true)
  const [packagePrice, setPackagePrice] = useState('')
  const [sellByPortions, setSellByPortions] = useState(false)
  const [unitsPerPortion, setUnitsPerPortion] = useState('')
  const [portionPrice, setPortionPrice] = useState('')

  const [purchasePrice, setPurchasePrice] = useState('')
  const [lowSupplyUnits, setLowSupplyUnits] = useState('')
  const [abbreviation, setAbbreviation] = useState('')
  const [barCode, setBarCode] = useState('')
  const [partOfActualCost, setPartOfActualCost] = useState(true)
  const [description, setDescription] = useState('')

  const [components, setComponents] = useState([])
  const [existingComponentRows, setExistingComponentRows] = useState([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // A set created here that then fails on its components must not be created
  // twice when somebody presses save again — the same reason the service
  // dialog holds the id of what it just inserted.
  const [createdId, setCreatedId] = useState(null)
  const [confirmDrop, setConfirmDrop] = useState(false)
  const effectiveId = product ? product.id : createdId
  const isEdit = !!product
  const isSet = kind === 'set'

  // Derived on every render, not stored, so switching the kind back to "set"
  // withdraws a pending question by itself — the same reason the browser
  // derives its visible selection rather than clearing it.
  const saveAction = productSaveAction({
    kind,
    isEdit,
    savedKind: product ? product.kind : null,
    componentCount: existingComponentRows.length,
    confirmed: confirmDrop,
  })
  // The answer has been given and the delete is waiting on one more press.
  const needsDropConfirm = saveAction === 'dropThenSave'

  useEffect(() => {
    if (!open) return
    setError('')
    setCreatedId(null)
    setConfirmDrop(false)
    setName(product ? product.name || '' : '')
    setKind(product ? product.kind || 'product' : 'product')
    setAccountingDirection(product ? product.accounting_direction || '' : '')
    setBaseUnit(product ? product.base_unit || 'pcs' : 'pcs')
    setUnitsPerPackage(product ? String(product.units_per_package ?? 1) : '1')
    setPortionOutput(product && product.portion_output != null ? String(product.portion_output) : '1')
    setIsConsignment(product ? !!product.is_consignment : false)
    setSupplierId(product ? product.supplier_id || '' : '')
    setSellByPackages(product ? product.sell_by_packages !== false : true)
    setPackagePrice(product && product.package_price != null ? String(product.package_price) : '')
    setSellByPortions(product ? !!product.sell_by_portions : false)
    setUnitsPerPortion(product && product.units_per_portion != null ? String(product.units_per_portion) : '')
    setPortionPrice(product && product.portion_price != null ? String(product.portion_price) : '')
    setPurchasePrice(product && product.nominal_purchase_price != null ? String(product.nominal_purchase_price) : '')
    setLowSupplyUnits(product && product.low_supply_units != null ? String(product.low_supply_units) : '')
    setAbbreviation(product ? product.abbreviation || '' : '')
    setBarCode(product ? product.bar_code || '' : '')
    setPartOfActualCost(product ? product.part_of_actual_cost !== false : true)
    setDescription(product ? product.description || '' : '')
    setComponents([])
    setExistingComponentRows([])
  }, [open, product])

  // A set's components, read only when there is a set to read them for.
  useEffect(() => {
    if (!open || !product || product.kind !== 'set') return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('product_set_components')
        .select('*')
        .eq('set_product_id', product.id)
        .order('sort_order')
      if (cancelled) return
      const rows = data || []
      setExistingComponentRows(rows)
      setComponents(rows.map((r) => ({
        productId: r.component_product_id,
        quantityBase: String(r.quantity_base),
      })))
    })()
    return () => { cancelled = true }
  }, [open, product])

  // What the table holds now, after a component save that stopped partway.
  // The diff is three writes without a transaction, so a delete can land and
  // the insert be rejected; pressing save again would then diff against a
  // picture of what was there and try to insert rows that already exist,
  // colliding with unique(set_product_id, component_product_id). Only
  // existingComponentRows is refreshed — `components` is what the person
  // typed and is not ours to overwrite.
  async function rereadComponentRows(setId) {
    const { data } = await supabase
      .from('product_set_components')
      .select('*')
      .eq('set_product_id', setId)
      .order('sort_order')
    // A failed read leaves the old rows in place. Emptying them here would
    // turn "we could not look" into "there is nothing there", which is the
    // exact retry collision this function exists to prevent.
    if (data) setExistingComponentRows(data)
  }

  // Only real products can be components. The database refuses a set inside a
  // set structurally, and offering one here would be offering a choice that
  // was always going to be rejected.
  const componentChoices = (products || []).filter(
    (p) => p.kind !== 'set' && p.is_active !== false && p.id !== (product ? product.id : null)
  )

  const values = {
    name, categoryId: product ? product.category_id : categoryId, kind, accountingDirection,
    baseUnit, unitsPerPackage, portionOutput, isConsignment, supplierId,
    sellByPackages, packagePrice, sellByPortions, unitsPerPortion, portionPrice,
    purchasePrice, lowSupplyUnits, abbreviation, barCode, partOfActualCost, description,
  }

  function setComponentAt(index, patch) {
    setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  async function handleSave() {
    const validationKey = validateProductForm(values)
    if (validationKey) {
      setError(t(validationKey))
      return
    }

    // A component row somebody started and left blank must not disappear on
    // its own. Dropping it silently is the same fault as reading an untouched
    // count as zero: the person sees a save succeed and their line gone, with
    // nothing having said why.
    if (isSet && components.some((c) => c.productId && !(Number(c.quantityBase) > 0))) {
      setError(t('products:productDialog.componentQuantityError'))
      return
    }
    if (isSet && components.some((c) => !c.productId && String(c.quantityBase ?? '').trim() !== '')) {
      setError(t('products:productDialog.componentProductError'))
      return
    }

    // Deleting rows is not something to do because somebody changed a dropdown
    // and pressed save. The count is named, and the second press is the answer.
    if (saveAction === 'confirmDrop') {
      setConfirmDrop(true)
      setError('')
      return
    }

    setError('')
    setSaving(true)

    // The components go before the kind does, and the order is forced rather
    // than chosen: the mirror key refuses a component whose set has stopped
    // being a set, so updating the product first is the rejected direction.
    //
    // If this succeeds and the update below fails, the set keeps its kind and
    // loses its components — a partial state, and one the window shows: switch
    // back to "set" and the list is empty, which is the truth. That is the
    // whole reason this table's writes are allowed to be separate calls at all
    // (lib/productAdminIO.js).
    if (saveAction === 'dropThenSave') {
      const { ok: dropped, error: dropError } = await saveSetComponents({
        setProductId: product.id,
        salonId,
        existingRows: existingComponentRows,
        components: [],
      })

      if (!dropped) {
        setSaving(false)
        await rereadComponentRows(product.id)
        setError(dropError
          ? t(reportDbError(dropError, 'ProductFormDialog.dropComponents'))
          : t('products:productDialog.dropComponentsFailedError'))
        return
      }
      setExistingComponentRows([])
    }

    const { ok, error: saveError, row } = await saveProduct({
      id: effectiveId,
      payload: productFormPayload(values),
      salonId,
      categoryId,
    })

    if (!ok) {
      setSaving(false)
      setError(saveError
        ? t(reportDbError(saveError, 'ProductFormDialog.save'))
        : t('products:productDialog.noRowsError'))
      return
    }

    const productId = row.id
    setCreatedId(productId)

    if (isSet) {
      const usable = components.filter((c) => c.productId && Number(c.quantityBase) > 0)
      const { ok: componentsOk, error: componentsError } = await saveSetComponents({
        setProductId: productId,
        salonId,
        existingRows: existingComponentRows,
        components: usable,
      })

      if (!componentsOk) {
        setSaving(false)
        onSaved()
        await rereadComponentRows(productId)
        setError(componentsError
          ? t(reportDbError(componentsError, 'ProductFormDialog.components'))
          : t('products:productDialog.componentsFailedError'))
        return
      }
    }

    setSaving(false)
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogContent is display:grid by default, and under a grid every
          min-h-0 and flex-1 below it is inert — which is how a long form once
          pushed save and discard off the bottom of the screen. */}
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden max-w-[calc(100%-2rem)] lg:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('products:productDialog.editTitle') : t('products:productDialog.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pe-1">
          <Section title={t('products:productDialog.sectionBasics')}>
            <Field label={t('products:productDialog.nameLabel')}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label={t('products:productDialog.directionLabel')}
                hint={t('products:productDialog.directionHint')}
              >
                <select className={FIELD} value={accountingDirection}
                  onChange={(e) => setAccountingDirection(e.target.value)}>
                  <option value="">{t('products:productDialog.directionNone')}</option>
                  {ACCOUNTING_DIRECTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value === 'common'
                        ? t('products:productDialog.directionCommon')
                        : t(`settings:businessTypes.types.${value}`)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label={t('products:productDialog.kindLabel')}
                hint={t('products:productDialog.kindHint')}
              >
                {/* Changing this changes which fields exist, not just which are
                    filled in — so it is a choice, not a checkbox. Changing it
                    also withdraws a pending "delete the components" answer, so
                    that going out to "product" and back again asks again
                    rather than acting on a yes given about a different state. */}
                <select className={FIELD} value={kind}
                  onChange={(e) => { setKind(e.target.value); setConfirmDrop(false) }}>
                  <option value="product">{t('products:productDialog.kindProduct')}</option>
                  <option value="set">{t('products:productDialog.kindSet')}</option>
                </select>
              </Field>
            </div>

            {!isSet ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field
                  label={t('products:productDialog.inContainerLabel')}
                  hint={t('products:productDialog.inContainerHint')}
                >
                  <Input type="number" min="0" step="0.001" value={unitsPerPackage}
                    onChange={(e) => setUnitsPerPackage(e.target.value)} />
                </Field>
                <Field label={t('products:productDialog.baseUnitLabel')}>
                  <select className={FIELD} value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)}>
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u}>{t(`products:units.${u}`)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('products:productDialog.barCodeLabel')}>
                  <Input value={barCode} onChange={(e) => setBarCode(e.target.value)} />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label={t('products:productDialog.portionOutputLabel')}
                  hint={t('products:productDialog.portionOutputHint')}
                >
                  <Input type="number" min="0" step="0.001" value={portionOutput}
                    onChange={(e) => setPortionOutput(e.target.value)} />
                </Field>
                <Field label={t('products:productDialog.barCodeLabel')}>
                  <Input value={barCode} onChange={(e) => setBarCode(e.target.value)} />
                </Field>
              </div>
            )}

            {!isSet && (
              <>
                <CheckboxField
                  label={t('products:productDialog.consignmentLabel')}
                  hint={t('products:productDialog.consignmentHint')}
                  checked={isConsignment}
                  onChange={(e) => setIsConsignment(e.target.checked)}
                />
                {isConsignment && (
                  <Field
                    label={t('products:productDialog.supplierLabel')}
                    hint={supplierChoices(suppliers, supplierId).length === 0
                      ? t('products:productDialog.supplierEmptyHint')
                      : undefined}
                  >
                    {/* An archived supplier that is already chosen stays on the
                        list: dropping it would show an empty box and the next
                        save would reassign the product to nobody — which the
                        CHECK on is_consignment refuses anyway, so the person
                        would get a database error for a choice they never
                        made. */}
                    <select className={FIELD} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                      <option value="">{t('products:productDialog.supplierNone')}</option>
                      {supplierChoices(suppliers, supplierId).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.is_active === false
                            ? t('products:productDialog.supplierArchived', { name: s.name })
                            : s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            )}
          </Section>

          <Section title={t('products:productDialog.sectionSale')}>
            <CheckboxField
              label={t('products:productDialog.sellByPackagesLabel')}
              checked={sellByPackages}
              onChange={(e) => setSellByPackages(e.target.checked)}
            />
            {sellByPackages && (
              <Field label={t('products:productDialog.packagePriceLabel')}>
                <Input type="number" min="0" step="0.01" value={packagePrice}
                  onChange={(e) => setPackagePrice(e.target.value)} />
              </Field>
            )}

            {!isSet && (
              <>
                <CheckboxField
                  label={t('products:productDialog.sellByPortionsLabel')}
                  hint={t('products:productDialog.sellByPortionsHint')}
                  checked={sellByPortions}
                  onChange={(e) => setSellByPortions(e.target.checked)}
                />
                {sellByPortions && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t('products:productDialog.portionSizeLabel', { unit: t(`products:units.${baseUnit}`) })}>
                      <Input type="number" min="0" step="0.001" value={unitsPerPortion}
                        onChange={(e) => setUnitsPerPortion(e.target.value)} />
                    </Field>
                    <Field label={t('products:productDialog.portionPriceLabel')}>
                      <Input type="number" min="0" step="0.01" value={portionPrice}
                        onChange={(e) => setPortionPrice(e.target.value)} />
                    </Field>
                  </div>
                )}
              </>
            )}
          </Section>

          {!isSet && (
            <Section title={t('products:productDialog.sectionCharacteristics')}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field
                  label={t('products:productDialog.purchasePriceLabel')}
                  hint={t('products:productDialog.purchasePriceHint')}
                >
                  <Input type="number" min="0" step="0.01" value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)} />
                </Field>
                <Field
                  label={t('products:productDialog.lowSupplyLabel', { unit: t(`products:units.${baseUnit}`) })}
                >
                  <Input type="number" min="0" step="0.001" value={lowSupplyUnits}
                    onChange={(e) => setLowSupplyUnits(e.target.value)} />
                </Field>
                <Field label={t('products:productDialog.abbreviationLabel')}>
                  <Input value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} />
                </Field>
              </div>

              <CheckboxField
                label={t('products:productDialog.partOfActualCostLabel')}
                hint={t('products:productDialog.partOfActualCostHint')}
                checked={partOfActualCost}
                onChange={(e) => setPartOfActualCost(e.target.checked)}
              />
            </Section>
          )}

          {isSet && (
            <Section title={t('products:productDialog.sectionComponents')}>
              <p className="text-xs text-muted-foreground">{t('products:productDialog.componentsHint')}</p>

              {components.map((c, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Label>{t('products:productDialog.componentLabel')}</Label>
                    <select
                      className={`${FIELD} mt-1.5`}
                      value={c.productId}
                      onChange={(e) => setComponentAt(index, { productId: e.target.value })}
                    >
                      <option value="">{t('products:productDialog.componentNone')}</option>
                      {componentChoices
                        .filter((p) => p.id === c.productId || !components.some((x) => x.productId === p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <Label>{t('products:productDialog.componentQuantityLabel')}</Label>
                    <Input
                      className="mt-1.5"
                      type="number"
                      min="0"
                      step="0.001"
                      value={c.quantityBase}
                      onChange={(e) => setComponentAt(index, { quantityBase: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button" variant="outline" size="icon" className="size-8"
                    title={t('products:productDialog.componentRemove')}
                    onClick={() => setComponents((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}

              <Button
                type="button" variant="outline" size="sm" className="self-start"
                onClick={() => setComponents((prev) => [...prev, { productId: '', quantityBase: '' }])}
              >
                <Plus className="size-3.5" />
                {t('products:productDialog.componentAdd')}
              </Button>
            </Section>
          )}

          <Section title={t('products:productDialog.sectionDescription')}>
            <textarea
              className={`${FIELD} h-24 resize-none py-2`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('products:productDialog.descriptionHint')}</p>
          </Section>
        </div>

        {needsDropConfirm && (
          <div className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-sm">
            {/* `n`, not `count`: passing `count` puts i18next into plural
                resolution and makes the message depend on which of Arabic's
                six plural suffixes happens to exist in the file. */}
            {t('products:productDialog.dropComponentsConfirm', { n: existingComponentRows.length })}
          </div>
        )}

        {error && <div className="shrink-0 text-sm text-destructive">{error}</div>}

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
          <Button disabled={saving} variant={needsDropConfirm ? 'destructive' : 'default'} onClick={handleSave}>
            {saving
              ? t('common:saving')
              : needsDropConfirm
                ? t('products:productDialog.dropComponentsButton')
                : t('common:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { User } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { saveStorage, saveStorageResponsibles } from '../lib/inventoryAdminIO'
import {
  validateStorage, storagePayload, responsiblesVisible, responsibleKey,
  storageSaveAction, responsibleCounts,
  STORAGE_KINDS, FINE_BASES,
} from '../lib/storageForm'
import { EMPLOYEE_ROLES } from '../lib/employeeRoles'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const FIELD = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function CheckboxField({ label, hint, checked, onChange, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="accent-primary" checked={checked} onChange={onChange} />
        <span>{label}</span>
      </label>
      {hint && <p className="text-xs text-muted-foreground ps-6">{hint}</p>}
    </div>
  )
}

// The storage window.
//
// ⚠️ The one deliberate departure from the reference in this module: it binds a
// professional's storage to a ROLE, and this binds it to an EMPLOYEE. A balance
// per person does not survive a shared pool — two hairdressers drawing from one
// "Hairdresser" storage means neither can be short of anything, and the fine
// that this window configures has nobody to charge. The role dropdown is still
// here, but as a way to create several storages at once rather than as what a
// storage points at.
//
// And nothing is created automatically. Eight employees would mean eight
// storages and eight transfer documents on every delivery — a daily cost that
// does not appear anywhere in a schema diagram. A salon adds the ones it
// actually works with.
export default function StorageFormDialog({
  open, onOpenChange, storage, employees, responsibles, salonId, onSaved,
}) {
  const { t } = useTranslation(['products', 'employees', 'common'])

  const [name, setName] = useState('')
  const [kind, setKind] = useState('common')
  const [ownerEmployeeId, setOwnerEmployeeId] = useState('')
  const [packagesOnly, setPackagesOnly] = useState(false)
  const [saleEnabled, setSaleEnabled] = useState(true)
  const [saleByVolume, setSaleByVolume] = useState(true)
  const [saleByPortion, setSaleByPortion] = useState(true)
  const [saleByUnits, setSaleByUnits] = useState(true)
  // ⚠️ Blank, not 100. These defaulted to '100' and 'purchase_price', and both
  // live storages were saved with them untouched — a 100% wage deduction that
  // nobody decided on. A pre-filled field is an answer the screen gives on the
  // user's behalf, and there is no way to tell it later from one they meant.
  const [finePercent, setFinePercent] = useState('')
  const [fineBasis, setFineBasis] = useState('')
  const [selectedKeys, setSelectedKeys] = useState([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // A storage created here whose responsibles then fail must not be created
  // twice when somebody presses save again.
  const [createdId, setCreatedId] = useState(null)
  const [confirmDrop, setConfirmDrop] = useState(false)

  const isEdit = !!storage
  const effectiveId = storage ? storage.id : createdId
  const existingRows = storage
    ? (responsibles || []).filter((r) => r.storage_id === storage.id)
    : []

  // Derived every render, so putting the kind back to "common" withdraws the
  // question by itself.
  //
  // ⚠️ Counted, not measured by length. A row naming neither an employee nor a
  // role appears in no list on screen, so counting it here would put a number
  // in the question that nothing on the screen accounts for — "2 responsibles
  // will be removed" beside one name. Such a row is still removed by the save;
  // it is just not something to tell somebody they are losing.
  const { people, roles } = responsibleCounts(existingRows)
  const saveAction = storageSaveAction({
    kind, isEdit, responsibleCount: people + roles, confirmed: confirmDrop,
  })
  const needsDropConfirm = saveAction === 'dropThenSave'

  useEffect(() => {
    if (!open) return
    setError('')
    setCreatedId(null)
    setConfirmDrop(false)
    setName(storage ? storage.name || '' : '')
    setKind(storage ? storage.kind || 'common' : 'common')
    setOwnerEmployeeId(storage ? storage.owner_employee_id || '' : '')
    setPackagesOnly(storage ? !!storage.packages_only : false)
    setSaleEnabled(storage ? storage.sale_enabled !== false : true)
    setSaleByVolume(storage ? storage.sale_by_volume !== false : true)
    setSaleByPortion(storage ? storage.sale_by_portion !== false : true)
    setSaleByUnits(storage ? storage.sale_by_units !== false : true)
    // ⚠️ A null column loads as blank and stays blank. These used to fall back
    // to '100' / 'purchase_price', so opening a storage that had no policy and
    // saving anything at all would give it one silently — the absence could be
    // stored but never survived being looked at.
    setFinePercent(storage && storage.fine_percent != null ? String(storage.fine_percent) : '')
    setFineBasis(storage && storage.fine_basis ? storage.fine_basis : '')
    setSelectedKeys(storage
      ? (responsibles || []).filter((r) => r.storage_id === storage.id).map(responsibleKey)
      : [])
  }, [open, storage, responsibles])

  const values = {
    name, kind, ownerEmployeeId, packagesOnly, saleEnabled,
    saleByVolume, saleByPortion, saleByUnits, finePercent, fineBasis,
  }

  function toggleKey(key) {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  async function handleSave() {
    const validationKey = validateStorage(values)
    if (validationKey) {
      setError(t(validationKey))
      return
    }

    // Somebody stops being answerable for a storage because a radio button
    // moved. That is worth one question, with the count in it.
    if (saveAction === 'confirmDrop') {
      setConfirmDrop(true)
      setError('')
      return
    }

    setError('')
    setSaving(true)

    // The rows go before the kind does, and the order is forced rather than
    // chosen: the mirror key on (storage_id, storage_kind) refuses a
    // responsible whose storage has stopped being common, so updating the
    // storage first is the rejected direction. Same as the set → product
    // switch in ProductFormDialog, deliberately.
    if (saveAction === 'dropThenSave') {
      const { ok: dropped, error: dropError } = await saveStorageResponsibles({
        storageId: storage.id, salonId, existingRows, selectedKeys: [],
      })

      if (!dropped) {
        setSaving(false)
        setError(dropError
          ? dbErrorSentence(dropError, t, 'StorageFormDialog.dropResponsibles')
          : t('products:storageDialog.dropResponsiblesFailedError'))
        return
      }
    }

    const { ok, error: saveError, row } = await saveStorage({
      id: effectiveId,
      payload: storagePayload(values),
      salonId,
    })

    if (!ok) {
      setSaving(false)
      setError(saveError
        ? dbErrorSentence(saveError, t, 'StorageFormDialog.save')
        : t('products:storageDialog.noRowsError'))
      return
    }

    const storageId = row.id
    setCreatedId(storageId)

    if (responsiblesVisible(kind)) {
      const { ok: linksOk, error: linksError } = await saveStorageResponsibles({
        storageId, salonId, existingRows, selectedKeys,
      })

      if (!linksOk) {
        setSaving(false)
        onSaved()
        setError(linksError
          ? dbErrorSentence(linksError, t, 'StorageFormDialog.responsibles')
          : t('products:storageDialog.responsiblesFailedError'))
        return
      }
    }

    setSaving(false)
    onSaved()
    onOpenChange(false)
  }

  const byRole = (role) => (employees || []).filter((e) => e.role === role)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Grid is DialogContent's default, and under a grid every min-h-0 and
          flex-1 below it is inert — which is how a long form once pushed save
          and discard off the bottom of the screen. */}
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden max-w-[calc(100%-2rem)] lg:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('products:storageDialog.editTitle') : t('products:storageDialog.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pe-1">
          <Section title={t('products:storageDialog.sectionBasics')}>
            <div className="flex flex-col gap-1.5">
              <Label>{t('products:storageDialog.nameLabel')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>

            <CheckboxField
              label={t('products:storageDialog.packagesOnlyLabel')}
              hint={t('products:storageDialog.packagesOnlyHint')}
              checked={packagesOnly}
              onChange={(e) => setPackagesOnly(e.target.checked)}
            />

            <CheckboxField
              label={t('products:storageDialog.saleEnabledLabel')}
              checked={saleEnabled}
              onChange={(e) => setSaleEnabled(e.target.checked)}
            />
            {/* The three are children of the box above, on screen and in the
                row: storagePayload turns them off with their parent. */}
            {saleEnabled && (
              <div className="flex flex-col gap-1 rounded-lg border border-border/60 p-2.5 ms-6">
                <CheckboxField
                  label={t('products:storageDialog.saleByVolumeLabel')}
                  checked={saleByVolume}
                  onChange={(e) => setSaleByVolume(e.target.checked)}
                />
                <CheckboxField
                  label={t('products:storageDialog.saleByPortionLabel')}
                  checked={saleByPortion}
                  onChange={(e) => setSaleByPortion(e.target.checked)}
                />
                <CheckboxField
                  label={t('products:storageDialog.saleByUnitsLabel')}
                  checked={saleByUnits}
                  onChange={(e) => setSaleByUnits(e.target.checked)}
                />
              </div>
            )}
          </Section>

          <Section title={t('products:storageDialog.sectionKind')}>
            <div className="flex flex-col gap-2">
              {STORAGE_KINDS.map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                  {/* Changing the kind withdraws a pending "remove them" answer,
                      so going out to professional and back asks again rather
                      than acting on a yes given about a different state. */}
                  <input
                    type="radio"
                    className="accent-primary"
                    name="storage-kind"
                    checked={kind === k}
                    onChange={() => { setKind(k); setConfirmDrop(false) }}
                  />
                  <span>{t(`products:storageDialog.kind_${k}`)}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('products:storageDialog.kindHint')}</p>

            {kind === 'professional' && (
              <div className="flex flex-col gap-1.5">
                <Label>{t('products:storageDialog.ownerLabel')}</Label>
                <select className={FIELD} value={ownerEmployeeId}
                  onChange={(e) => setOwnerEmployeeId(e.target.value)}>
                  <option value="">{t('products:storageDialog.ownerNone')}</option>
                  {(employees || []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} — {t(`employees:roles.${e.role}`)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{t('products:storageDialog.ownerHint')}</p>
              </div>
            )}
          </Section>

          <Section title={t('products:storageDialog.sectionFine')}>
            {/* Shown for both kinds. A professional storage has no picker
                because its owner is the answerable one, but the percentage and
                what it is taken from still apply to them. */}
            {/* ⚠️ "Leave it blank" is a concept the system invented and nobody
                asked for, so it is explained where it appears, with an example
                and with the action that ends it — the third part being the one
                that turns a description into something the reader can act on. */}
            <p className="text-xs text-muted-foreground">{t('products:storageDialog.fineOptionalHint')}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{t('products:storageDialog.finePercentLabel')}</Label>
                <Input type="number" min="0" max="100" step="0.01" value={finePercent}
                  placeholder={t('products:storageDialog.fineBlankPlaceholder')}
                  onChange={(e) => setFinePercent(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('products:storageDialog.fineBasisLabel')}</Label>
                <select className={FIELD} value={fineBasis} onChange={(e) => setFineBasis(e.target.value)}>
                  {/* The empty option is the default and has to be selectable:
                      a blank policy you cannot get back to is not a state. */}
                  <option value="">{t('products:storageDialog.fineBlankPlaceholder')}</option>
                  {FINE_BASES.map((b) => (
                    <option key={b} value={b}>{t(`products:storageDialog.fineBasis_${b}`)}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('products:storageDialog.fineHint')}</p>

            {responsiblesVisible(kind) && (
              <div className="flex flex-col gap-1.5">
                <Label>{t('products:storageDialog.responsiblesLabel')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('products:storageDialog.responsiblesHint')}
                </p>
                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                  {EMPLOYEE_ROLES.map((role) => (
                    <div key={role} className="flex flex-col">
                      {/* ⚠️ A role row and a person row are different kinds of
                          promise, and they used to be indistinguishable: same
                          weight, same box, same alignment, with only "that
                          reads like a name" to tell them apart — which fails
                          on the first employee whose name resembles a trade.
                          Ticking a role makes everybody hired into it next
                          year answerable at this fine percentage, and nobody
                          should write that rule without being shown they are
                          writing one. Hence the badge, not just the nesting. */}
                      <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm font-medium hover:bg-muted/60">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={selectedKeys.includes(`role:${role}`)}
                          onChange={() => toggleKey(`role:${role}`)}
                        />
                        <span>{t(`employees:roles.${role}`)}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {t('products:storageDialog.roleBadge')}
                        </Badge>
                      </label>
                      {byRole(role).map((e) => (
                        <label key={e.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm ps-6 text-muted-foreground hover:bg-muted/60">
                          <input
                            type="checkbox"
                            className="accent-primary"
                            checked={selectedKeys.includes(`employee:${e.id}`)}
                            onChange={() => toggleKey(`employee:${e.id}`)}
                          />
                          <User className="size-3.5 shrink-0" />
                          <span className="text-foreground">{e.name}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>

        {needsDropConfirm && (
          <div className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-sm">
            {t('products:storageDialog.dropResponsiblesConfirm', { n: people + roles })}
          </div>
        )}

        {error && <div className="shrink-0 text-sm text-destructive">{error}</div>}

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
          <Button disabled={saving} variant={needsDropConfirm ? 'destructive' : 'default'} onClick={handleSave}>
            {saving
              ? t('common:saving')
              : needsDropConfirm
                ? t('products:storageDialog.dropResponsiblesButton')
                : t('common:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

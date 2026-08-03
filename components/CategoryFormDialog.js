import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { reportDbError } from '../lib/dbErrors'
import { saveCategory } from '../lib/categoryAdminIO'
import { parentOptionsFor } from '../lib/categoryVisibility'
import { BUSINESS_TYPES } from '../lib/serviceTree'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const FIELD = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

// Adding or renaming a folder in the service catalogue.
//
// A business type is optional at every depth, and this used to insist it was
// required on a root and forbidden below one. That rule was real once and
// ADR-019 withdrew it: any category at any depth may carry its own type, and
// one that carries none inherits from the nearest ancestor that does. There
// is no constraint in the database enforcing the old shape — two direct
// queries came back with no CHECK and no trigger on service_categories — so
// the form had been imposing, on its own, a rule the project had decided
// against, and blocking the mixed folder ADR-019 exists to allow.
//
// Every category is offered as a parent except the one being edited and
// everything beneath it. Moving a folder inside its own descendant makes a
// cycle in parent_id, and the tree builder survives cycles quietly, so the
// whole branch would stop appearing with nothing on screen to explain it.
export default function CategoryFormDialog({ open, onOpenChange, category, categories, defaultParentId, salonId, onSaved }) {
  const { t } = useTranslation(['services', 'settings', 'common'])

  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!category

  useEffect(() => {
    if (!open) return
    setError('')
    setName(category ? category.name || '' : '')
    setParentId(category ? category.parent_id || '' : defaultParentId || '')
    setBusinessType(category ? category.business_type || '' : '')
  }, [open, category, defaultParentId])

  // The rule lives in lib/categoryVisibility.js so it is the thing under test
  // rather than a copy of it: itself and every descendant are off the list.
  const parentOptions = parentOptionsFor(category, categories)

  function validate() {
    if (!name.trim()) return t('services:categoryDialog.nameRequiredError')
    return ''
  }

  async function handleSave() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setSaving(true)

    // The write lives in lib/categoryAdminIO.js, not here. Inline it could not
    // be asked what it had actually sent, which is exactly what was needed
    // when a folder came back at the wrong place in the tree.
    const { ok, error: saveError } = await saveCategory({
      id: isEdit ? category.id : null,
      name,
      parentId,
      businessType,
      salonId,
    })

    setSaving(false)

    if (!ok) {
      setError(saveError
        ? t(reportDbError(saveError, 'CategoryFormDialog.save'))
        : t('services:toggleFailedMessage'))
      return
    }

    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('services:categoryDialog.editTitle') : t('services:categoryDialog.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t('services:categoryDialog.nameLabel')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <p className="text-xs text-muted-foreground">{t('services:categoryDialog.nameHint')}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('services:categoryDialog.parentLabel')}</Label>
            <select className={FIELD} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">{t('services:categoryDialog.parentNone')}</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('services:categoryDialog.parentHint')}</p>
          </div>

          {/* Offered at every depth, and optional at every depth (ADR-019).
              Leaving it empty is the common case and means "inherit". */}
          <div className="flex flex-col gap-1.5">
            <Label>{t('services:categoryDialog.typeLabel')}</Label>
            <select className={FIELD} value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
              <option value="">{t('services:categoryDialog.typeInherit')}</option>
              {BUSINESS_TYPES.map((bt) => (
                <option key={bt} value={bt}>{t(`settings:businessTypes.types.${bt}`)}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('services:categoryDialog.typeHint')}</p>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? t('common:saving') : t('common:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

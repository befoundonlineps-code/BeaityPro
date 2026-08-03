import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { reportDbError } from '../lib/dbErrors'
import { saveCategory } from '../lib/categoryAdminIO'
import { BUSINESS_TYPES } from '../lib/serviceTree'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const FIELD = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

// Adding or renaming a folder in the service catalogue.
//
// The parent decides the shape of the rest of the form, because the database
// does: a root category must declare a business type and a sub-category is
// forbidden one (service_categories_business_type_check). Rather than let
// somebody fill in a field that will be rejected on save, the field appears
// only when it is the one that applies.
//
// Only roots and their direct children are offered as parents. The tree the
// catalogue draws is two deep and every screen that reads it assumes that;
// a third level would render but sit outside what buildServiceTree returns.
export default function CategoryFormDialog({ open, onOpenChange, category, categories, defaultParentId, salonId, onSaved }) {
  const { t } = useTranslation(['services', 'settings', 'common'])

  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!category
  const isRoot = !parentId

  useEffect(() => {
    if (!open) return
    setError('')
    setName(category ? category.name || '' : '')
    setParentId(category ? category.parent_id || '' : defaultParentId || '')
    setBusinessType(category ? category.business_type || '' : '')
  }, [open, category, defaultParentId])

  // A category cannot be its own parent, nor a child of its own descendant.
  const parentOptions = (categories || []).filter((c) => {
    if (category && c.id === category.id) return false
    if (category && c.parent_id === category.id) return false
    return true
  })

  function validate() {
    if (!name.trim()) return t('services:categoryDialog.nameRequiredError')
    if (isRoot && !businessType) return t('services:categoryDialog.typeRequiredError')
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('services:categoryDialog.parentLabel')}</Label>
            <select className={FIELD} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">{t('services:categoryDialog.parentNone')}</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Only for a root: the database forbids it on a sub-category. */}
          {isRoot && (
            <div className="flex flex-col gap-1.5">
              <Label>{t('services:categoryDialog.typeLabel')}</Label>
              <select className={FIELD} value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                <option value="">{t('services:categoryDialog.typePlaceholder')}</option>
                {BUSINESS_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{t(`settings:businessTypes.types.${bt}`)}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t('services:categoryDialog.typeHint')}</p>
            </div>
          )}

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

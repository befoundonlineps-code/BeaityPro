import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { reportDbError } from '../lib/dbErrors'
import { saveProductCategory } from '../lib/productAdminIO'
import { productCategoryPayload, validateProductCategory } from '../lib/productForm'
import { parentOptionsFor } from '../lib/categoryVisibility'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const FIELD = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

// Adding or renaming a folder in the products catalogue.
//
// Two fields, and one of them carries the only rule here worth writing down.
//
// ⚠️ parentOptionsFor is imported from lib/categoryVisibility.js and not
// reimplemented, and that is the whole point of this file being short. The
// services screen once filtered out direct children only, which left a
// grandchild on offer as a parent for its own grandparent — choosing it wrote
// a cycle into parent_id, and a cycle makes its entire branch vanish from the
// tree with nothing on screen to say why. The set-nesting cycle was closed
// structurally in the database because a foreign key could reach it; this one
// cannot be, so the single application guard must not be copied out in a
// shortened form for a fourth time.
//
// No business type here, unlike the services folder. That column decides who
// sees a service category (ADR-019) and the question has no meaning for a
// product — shampoo is shampoo whoever is asking.
export default function ProductCategoryFormDialog({
  open, onOpenChange, category, categories, defaultParentId, salonId, onSaved,
}) {
  const { t } = useTranslation(['products', 'common'])

  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!category

  useEffect(() => {
    if (!open) return
    setError('')
    setName(category ? category.name || '' : '')
    setParentId(category ? category.parent_id || '' : defaultParentId || '')
  }, [open, category, defaultParentId])

  // ⚠️ `categories` is the whole list, deliberately — never the tree's filtered
  // copy. Passing a list thinned by "hide archived" would leave an archived
  // folder out of the parent options, which reads as "you may not put it
  // there" when the truth is only that it is not on screen. The rule is about
  // cycles, and nothing else may narrow it.
  const parentOptions = parentOptionsFor(category, categories)

  async function handleSave() {
    const validationKey = validateProductCategory({ name })
    if (validationKey) {
      setError(t(validationKey))
      return
    }

    setError('')
    setSaving(true)

    const { ok, error: saveError } = await saveProductCategory({
      id: isEdit ? category.id : null,
      payload: productCategoryPayload({ name, parentId }),
      salonId,
    })

    setSaving(false)

    if (!ok) {
      setError(saveError
        ? t(reportDbError(saveError, 'ProductCategoryFormDialog.save'))
        : t('products:categoryDialog.noRowsError'))
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
            {isEdit ? t('products:categoryDialog.editTitle') : t('products:categoryDialog.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t('products:categoryDialog.nameLabel')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <p className="text-xs text-muted-foreground">{t('products:categoryDialog.nameHint')}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('products:categoryDialog.parentLabel')}</Label>
            <select className={FIELD} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">{t('products:categoryDialog.parentNone')}</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('products:categoryDialog.parentHint')}</p>
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

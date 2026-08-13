import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { dbErrorSentence } from '../lib/dbErrors'
import { saveProductCategory, linkFolderToStorages } from '../lib/productAdminIO'
import { productCategoryPayload, validateProductCategory } from '../lib/productForm'
import { storagesForNewFolder, parentChoicesForFolder } from '../lib/folderStorageInherit'
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
  // 🔴 THE STORAGE ARRIVES AS CONTEXT, NOT AS A FIELD — AND THERE IS NO FIELD.
  //
  // The owner's decision: a new folder takes the storages of its parent, or of
  // the storage the screen is standing on, and where neither exists the
  // creation is refused rather than guessed. So this dialog never asks; it
  // derives, and lib/folderStorageInherit.js is the one place that decides.
  //
  // ⚠️ **صار جمعًا:** المجلّدُ يمكن أن يكون في أكثر من مستودع، والابنُ يأخذ
  // **كلَّ** روابط أبيه — فلا يمكن أن يولد عقدةً معلَّقة.
  lensStorageId = null, links = [],
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
  // folder out of the parent options, which reads as "you may not put it there"
  // when the truth is only that it is not on screen. VIEW FILTERS may not narrow
  // this; the storage is not a view filter, and on CREATE it does.
  //
  // The rule itself — cycles, plus «never offer a parent that would make the new
  // folder invisible», plus why an edit is left alone — lives in
  // lib/folderStorageInherit.js, where it is the thing under test. This dialog
  // portals, so nothing it renders reaches a static render to assert on.
  const parentOptions = parentChoicesForFolder({ category, categories, lensStorageId, links })

  // ⚠️ Recomputed from the parent CURRENTLY chosen in the dialog, not from the
  // one it opened with. Somebody who changes the parent changes the storages in
  // the same act — which is the rule «a subfolder takes its parent's storages»
  // behaving rather than being remembered.
  const chosenParent = parentId ? (categories || []).find((c) => c.id === parentId) || null : null
  const derivedStorageIds = storagesForNewFolder({ parent: chosenParent, lensStorageId, links })

  // ⚠️ ONLY ON CREATE. An edit writes no links at all, so renaming a folder
  // cannot move it between storages — moving is done from the storage window,
  // where the assortment is ticked. Two places for one decision is the fault
  // this whole round removed; it is not reopened from the opposite door.
  const missingContext = !isEdit && derivedStorageIds.length === 0

  async function handleSave() {
    const validationKey = validateProductCategory({ name })
    if (validationKey) {
      setError(t(validationKey))
      return
    }
    // The screen disables «add folder» in this case, so reaching here means the
    // parent was cleared after the dialog opened. Refused rather than saved
    // with a blank storage — a fourth unassigned folder is a state nobody
    // decided to create.
    if (missingContext) {
      setError(t('products:categoryDialog.noStorageContext'))
      return
    }

    setError('')
    setSaving(true)

    const { ok, error: saveError, row } = await saveProductCategory({
      id: isEdit ? category.id : null,
      payload: productCategoryPayload({ name, parentId }),
      salonId,
    })

    if (!ok) {
      setSaving(false)
      setError(saveError
        ? dbErrorSentence(saveError, t, 'ProductCategoryFormDialog.save')
        : t('products:categoryDialog.noRowsError'))
      return
    }

    // الانتماءُ نداءٌ ثانٍ، وعلى الإنشاء وحدَه. الحالةُ الناقصة — مجلّدٌ بلا
    // روابط — **مرئيّةٌ وقابلةٌ للتصحيح**: يظهر تحت «كل المستودعات» بشارة «بلا
    // مستودع»، ويُؤشَّر من نافذة المستودع. فلا يلزمها RPC (البند ١، «الكتابات»).
    if (!isEdit) {
      const { ok: linked, error: linkError } = await linkFolderToStorages({
        categoryId: row.id, salonId, storageIds: derivedStorageIds,
      })

      if (!linked) {
        setSaving(false)
        // ⚠️ `onSaved()` أوّلًا: المجلّدُ **انكتب فعلًا**، فإخفاؤه عن الشاشة
        // بحجّة أن نصفَه الثاني فشل يجعل الشخصَ ينشئه من جديد — ويصير اثنان.
        onSaved()
        setError(linkError
          ? dbErrorSentence(linkError, t, 'ProductCategoryFormDialog.link')
          : t('products:categoryDialog.linkFailedError'))
        return
      }
    }

    setSaving(false)
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

import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { User } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { saveStorage, saveStorageResponsibles, saveStorageCategories } from '../lib/inventoryAdminIO'
import {
  validateStorage, storagePayload, responsiblesVisible, responsibleKey,
  storageSaveAction, responsibleCounts,
  STORAGE_KINDS, FINE_BASES,
} from '../lib/storageForm'
import {
  folderKey, folderLinksFor, folderTickRows, stockedFolders, blockedUnticks,
} from '../lib/storageFolders'
import { EMPLOYEE_ROLES } from '../lib/employeeRoles'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import NumberField from '@/components/ui/NumberField'
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
  // 🔴 التشكيلة: أيُّ مجلّداتٍ يحفظها هذا المستودع.
  //
  // ⚠️ والأرصدةُ والمنتجاتُ تصل معها **لأن الرفضَ لازم يسمّي الأصناف**. الصفحةُ
  // محمَّلٌ عندها الاثنان أصلًا، فلا استعلامَ جديدًا هنا — و٠٦٨ب_٣ يكتب نفسَ
  // السؤال بـSQL للتشخيص من المحرّر، لا طريقًا ثانيًا للشاشة.
  categories = [], products = [], balances = [], storageCategories = [],
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
  // ⚠️ Blank, not 100. These defaulted to '100' and 'purchase_price', and
  // storages were saved with them untouched — a 100% wage deduction that
  // nobody decided on. A pre-filled field is an answer the screen gives on the
  // user's behalf, and there is no way to tell it later from one they meant.
  //
  // ⚠️ Said as a past event on purpose. The sibling comment in lib/storageForm
  // once claimed the live rows still carried it, and that was measured false
  // (110 §③, 26 Aug 2026: four storages, all null/null). The reason to keep
  // this blank does not depend on any row being wrong today.
  const [finePercent, setFinePercent] = useState('')
  const [fineBasis, setFineBasis] = useState('')
  const [fineEnabled, setFineEnabled] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState([])
  const [folderKeys, setFolderKeys] = useState([])

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
  // الروابطُ القائمة لهذا المستودع، ومجلّداتُه الممنوعةُ من الشيل.
  //
  // ⚠️ مشتقّةٌ كلَّ رسمة لا محفوظة، لنفس سبب `existingRows` فوقها: حالةٌ محفوظةٌ
  // عن مستودعٍ تغيّر هي حالةٌ تصف ما لم يعد على الشاشة.
  const existingFolderRows = storage ? folderLinksFor(storageCategories, storage.id) : []
  const stocked = storage
    ? stockedFolders({ storageId: storage.id, categories, products, balances })
    : new Map()
  const tickRows = folderTickRows(categories)

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
    // 🔴 والتأشيرُ مشتقٌّ من الصفّ لا مخزَّنٌ بعمود — قرارُ المالك: «بقول زيّك
    // تنمسح». ⇒ صفرُ تغييرٍ في المخطّط وصفرُ هجرة.
    //
    // ⚠️ **ويُشتقّ بـ«أو» لا بـ«و»، والفرقُ ليس تشدُّدًا:** اللازمةُ «مؤشَّرٌ
    // ⟺ الحقلان غيرُ فارغَين» تصدق على ما **حُفظ** من الشاشة، لأن التحقُّق
    // يرفض واحدًا من اثنين. **وصفٌّ نصفيٌّ ممكنٌ رغم ذلك** — يُكتب من محرّر
    // SQL مباشرةً، وهو ما يفعله المالكُ فعلًا. **فاشتقاقٌ بـ«و» يُظهره غيرَ
    // مؤشَّرٍ فيُخفي قيمةً مخزَّنة، وأوّلُ حفظٍ بعدها يمحوها بلا أن يراها أحد.**
    setFineEnabled(!!(storage && (storage.fine_percent != null || storage.fine_basis)))
    setSelectedKeys(storage
      ? (responsibles || []).filter((r) => r.storage_id === storage.id).map(responsibleKey)
      : [])
    // ⚠️ مستودعٌ جديدٌ يفتح **بلا أيّ تأشير**، لا بكلّ المجلّدات. تأشيرُ الكلّ
    // يكتب قرارًا لم يتّخذه أحد على كلّ مجلّدٍ في الصالون — وهو بالحرف ما فعلته
    // بذرةُ ٠٦٦ب، والتي احتاجت عمودَ `seeded` كاملًا كي يمكن تمييزُها لاحقًا
    // عن قرار. الفراغُ حالةٌ يراها صاحبُها ويملؤها؛ التأشيرُ الكامل حالةٌ تبدو
    // مقرَّرة.
    setFolderKeys(storage ? folderLinksFor(storageCategories, storage.id).map(folderKey) : [])
  }, [open, storage, responsibles, storageCategories])

  const values = {
    name, kind, ownerEmployeeId, packagesOnly, saleEnabled,
    saleByVolume, saleByPortion, saleByUnits, finePercent, fineBasis, fineEnabled,
  }

  const fineGridClass = 'grid grid-cols-1 gap-3 sm:grid-cols-2'
    + (fineEnabled ? '' : ' opacity-50')

  function toggleKey(key) {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function toggleFolder(id) {
    setFolderKeys((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]))
  }

  async function handleSave() {
    const validationKey = validateStorage(values)
    if (validationKey) {
      setError(t(validationKey))
      return
    }

    // 🔴 الرفضُ يُقال هنا أوّلًا، وبأسماء الأصناف — وهو المطلبُ الذي كتبته
    // ترويسةُ ٠٦٨أ ولم يُبنَ. المُشغِّلُ في القاعدة يرفض على أيّ حال، لكن رمزَه
    // له مفتاحٌ مسمّى **يغلب الـ`hint`**، فقائمةُ الأصناف التي يبنيها لا تصل
    // المستخدمَ إطلاقًا. بلا هذه الجملة يُقال له «لأ» ويُترك يدوّر على الرفّ.
    const blocked = blockedUnticks({
      existingKeys: existingFolderRows.map(folderKey),
      selectedKeys: folderKeys,
      stocked,
    })
    if (blocked.length > 0) {
      const first = blocked[0]
      const folder = (categories || []).find((c) => c.id === first.categoryId)
      setError(t('products:storageDialog.folderStillStockedError', {
        folder: folder?.name || '—',
        products: first.products.join(' · '),
      }))
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

    // التشكيلة. ⚠️ بعد المستودع لأن مستودعًا جديدًا لا معرِّفَ له قبل حفظه —
    // نفسُ ترتيب المسؤولين وللسبب نفسِه.
    const { ok: foldersOk, error: foldersError } = await saveStorageCategories({
      storageId, salonId, existingRows: existingFolderRows, selectedKeys: folderKeys,
    })

    if (!foldersOk) {
      setSaving(false)
      onSaved()
      setError(foldersError
        ? dbErrorSentence(foldersError, t, 'StorageFormDialog.folders')
        : t('products:storageDialog.foldersFailedError'))
      return
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

          {/* 🔴 التشكيلة — أيُّ أصنافٍ مسموحٌ تكون بهذا المستودع.
              القرار: «كل مستودع إله أصناف محددة، من الأول صح، بلا اعتماد على
              انتباه الموظف». والمجلّدُ يقدر يكون بأكتر من مستودع — وبدون ذلك
              «الوجهةُ لازم تحفظ هالمجلّد» تصير «الوجهةُ = مستودعُه الوحيد»، أي
              منعَ كلِّ نقل. */}
          <Section title={t('products:storageDialog.sectionFolders')}>
            <p className="text-xs text-muted-foreground">
              {t('products:storageDialog.foldersHint')}
            </p>

            {tickRows.length === 0 ? (
              // ⚠️ الفراغُ يُسمّى بدل أن يُترك لوحًا أبيض. بعد التصفير هذه هي
              // الحالةُ الأولى التي سيراها أحد، وبلا جملةٍ فيها تُقرأ عطلًا.
              <p className="text-xs text-muted-foreground" data-empty-state="no-folders">
                {t('products:storageDialog.foldersEmpty')}
              </p>
            ) : (
              <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-2">
                {tickRows.map((row) => {
                  const names = stocked.get(row.id)
                  return (
                    <label
                      key={row.id}
                      data-folder-tick={row.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/60"
                      style={{ paddingInlineStart: `${4 + row.depth * 16}px` }}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={folderKeys.includes(row.id)}
                        onChange={() => toggleFolder(row.id)}
                      />
                      <span className={row.archived ? 'text-muted-foreground line-through' : ''}>
                        {row.name}
                      </span>
                      {/* ⚠️ يُقال على السطر، لا عند الحفظ وحدَه. من يؤشّر يحتاج
                          أن يعرف قبل أن يضغط أيُّ صفٍّ لا يمكن التراجع عنه —
                          والاسمُ في العنوان لأن سردَ الأصناف على السطر يغرق
                          اللوح. */}
                      {names && (
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                          title={t('products:storageDialog.folderStockedHint', {
                            products: names.join(' · '),
                          })}
                        >
                          {t('products:storageDialog.folderStockedBadge')}
                        </Badge>
                      )}
                    </label>
                  )
                })}
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

            {/* 🔴 قرارُ المالك: مؤشَّرٌ ⟶ في سياسة · غيرُ مؤشَّرٍ ⟶ لا سياسة.
                **والسطران يبقيان ظاهرَين مظلَّلَين مقفلَين، لا يُخفَيان** —
                بنصّه: «بتضل السطور ظاهرة بس غير فعالة للكتابة».
                ⚠️ **والفرقُ ليس ذوقًا:** حقلٌ يختفي يمحو من الشاشة أنّ للمستودع
                سياسةَ غرامةٍ أصلًا، فمن لم يؤشّر لا يعرف ما فاته — والمظلَّلُ
                يقول «هذا موجودٌ ومطفأ»، والغائبُ لا يقول شيئًا. */}
            <CheckboxField
              label={t('products:storageDialog.fineEnabledLabel')}
              checked={fineEnabled}
              onChange={(e) => setFineEnabled(e.target.checked)}
            />

            <div className={fineGridClass}>
              <div className="flex flex-col gap-1.5">
                <Label>{t('products:storageDialog.finePercentLabel')}</Label>
                {/* ⚠️ والقيمةُ تبقى في حالة المكوّن عند رفع التأشير، فإعادةُ
                    التأشير تستردّها — ورفعٌ ثمّ حفظٌ يكتب `null` في العمودين.
                    **«باقٍ على الشاشة» ليس «باقيًا في الصفّ».** */}
                <NumberField min="0" max="100" step="1" value={finePercent}
                  disabled={!fineEnabled}
                  placeholder={t('products:storageDialog.fineBlankPlaceholder')}
                  onChange={(e) => setFinePercent(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('products:storageDialog.fineBasisLabel')}</Label>
                <select className={FIELD} value={fineBasis} disabled={!fineEnabled}
                  onChange={(e) => setFineBasis(e.target.value)}>
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

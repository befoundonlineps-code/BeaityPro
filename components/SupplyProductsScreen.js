import { useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { Search, FileSpreadsheet, FileInput, Filter } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { orderFolderRows, allSelectableIds, canOpenGrid, toggleFolder } from '../lib/orderFolderPick'
import { orderGridRows, orderGridTotal, ORDER_PRICE_COLUMN } from '../lib/orderGrid'
import { destinationNarrows } from '../lib/supplyDestinationScope'
import { stockDocumentPayload, storageChoices } from '../lib/stockDocumentForm'
import { postStockDocument } from '../lib/stockIO'
import { today, maxDocumentDate } from '../lib/documentDate'
import { supplierChoices } from '../lib/supplierForm'
import { DISCOUNT_KINDS, TRANSPORT_PAID_TO } from '../lib/documentMoney'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from './ref/RefGrid'
import { RefActionButton, RefCancelButton } from './ref/RefModal'
import NumberField from '@/components/ui/NumberField'
import { Input } from '@/components/ui/input'

// «توريد بضاعة» — ثاني الشاشات العشر، على شكل التطبيق المرجعيّ.
//
// ⚠️ **ولا يستبدل `StockDocumentScreen`.** تلك تخدم أربعَ عمليّاتٍ خلف
// `docType`، والثلاثُ الباقياتُ (شطب · إرجاع · نقل) ما زالت عليها — فالتوجيهُ
// يُشتقّ من `REFERENCE_FORM_VIEWS` بدل استثناءٍ يُكتب بيدٍ في الصفحة.
//
// 🔴 **و«إلى مستودع» هو مستودعُ المستند نفسُه، لا وجهةٌ ثانية.** مقيسٌ من
// `DOC_FORMS`: `supply` عندها `twoStorages: false` — البضاعةُ تأتي من مورّدٍ
// إلى مستودعٍ واحد، و`to_storage_id` تخصّ النقلَ وحدَه. فالحقلُ يُسمّى كما
// يسمّيه المرجع، **ويُرسَل `storageId`**.

const FIELD = 'h-7 rounded-none border border-[var(--rule)] bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring'

function ShellControl({ icon: Icon, label, why }) {
  return (
    <button
      type="button"
      disabled
      title={why}
      data-shell-control={label}
      className="flex h-7 cursor-not-allowed items-center gap-1 border border-[var(--rule)] px-2 text-xs text-muted-foreground opacity-60"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

export default function SupplyProductsScreen({
  salonId, storageId, storages, categories, products, balances, storageCategories,
  suppliers, loading, error, onPosted, onClose,
}) {
  const { t } = useTranslation(['products', 'common'])

  const folderRows = useMemo(
    () => orderFolderRows({ categories, storageId, links: storageCategories }),
    [categories, storageId, storageCategories]
  )

  const [step, setStep] = useState('folders')
  const [selected, setSelected] = useState(() => allSelectableIds(folderRows))
  const [packages, setPackages] = useState({})
  const [supplierId, setSupplierId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [docDate, setDocDate] = useState(today())
  // ⚠️ يُملأ افتراضيًّا بمستودع العدسة — «المستودعُ عدسة»، ونفسُ سلوك المرجع.
  const [toStorageId, setToStorageId] = useState(storageId || '')
  const [discountKind, setDiscountKind] = useState('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [transportAmount, setTransportAmount] = useState('')
  const [transportPaidTo, setTransportPaidTo] = useState('supplier')
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState(null)

  // 🔴 قاعدةُ التطابق. **والاختيارُ المخزَّن لا يُمسّ** — التضييقُ عرضٌ لا حذف،
  // وإلّا أكلَ تبديلُ الوجهةِ ذهابًا وإيابًا المجلّداتِ واحدًا واحدًا بلا أن
  // يشتكي شيء.
  const narrowed = useMemo(
    () => destinationNarrows({ selectedFolderIds: selected, links: storageCategories, toStorageId }),
    [selected, storageCategories, toStorageId]
  )

  const rows = useMemo(() => orderGridRows({
    selectedFolderIds: narrowed.kept,
    categories,
    products,
    balances,
    // ⚠️ «الرصيدُ الحاليّ» من المستودع الذي **ستصل إليه** البضاعة، لا من العدسة.
    // حبّةُ الرقم: رصيدُ مستودعٍ آخرَ هنا يقول «عندك بضاعة» عن رفٍّ فارغ.
    storageId: toStorageId,
    packages,
  }), [narrowed.kept, categories, products, balances, toStorageId, packages])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (needle === '') return rows
    const kept = rows.filter((r) => r.kind === 'product' && String(r.name).toLowerCase().includes(needle))
    const folders = new Set(kept.map((r) => r.folderId))
    return rows.filter((r) => (r.kind === 'folder' ? folders.has(r.id) : kept.includes(r)))
  }, [rows, search])

  const totals = useMemo(() => orderGridTotal(rows), [rows])

  // 🔴 سطورُ المستند. **والسعرُ يأتي من الكتالوج ولا يُكتب هنا** — المرجعُ لا
  // يعرض عمودَ سعرٍ إطلاقًا، وأعمدتُه خمسةٌ ليس بينها واحد.
  //
  // ⚠️ **وهذا يقلب رفضًا متعمَّدًا في `StockDocumentScreen`**، وهو مكتوبٌ هناك
  // بالنصّ: العمودُ «documented as this document's default and is deliberately
  // not used as one»، لأن ما يُكتب في خانة التكلفة **يُختم على كلّ صرفٍ يليه**.
  // وسببُ الرفض كان بند ٣١ — وحدةُ العمود غيرُ مسجَّلة.
  //
  // ✅ **وذلك السببُ سقط:** الملصقُ صار «سعر الشراء الاسمي **للعبوة**»، فالضربُ
  // في العبوات معرَّف. **وما لم يسقط هو أن الرقمَ يُختم**، وذاك قرارُ مالكٍ
  // مفتوحٌ أُعلن ولم يُبتلع.
  const documentRows = useMemo(() => rows
    .filter((r) => r.kind === 'product' && String(r.packages ?? '').trim() !== '')
    .map((r) => {
      const product = (products || []).find((p) => p.id === r.id)
      return {
        productId: r.id,
        enteredQuantity: r.packages,
        enteredUom: 'package',
        enteredUnitPrice: product?.[ORDER_PRICE_COLUMN] ?? '',
        lineDiscountKind: 'percent',
        lineDiscountValue: '',
        bonusQuantity: '',
      }
    }), [rows, products])

  async function post() {
    const values = {
      storageId: toStorageId,
      supplierId,
      supplierDocNumber: invoiceNo,
      docDate,
      note,
      rows: documentRows,
      discountKind,
      discountValue,
      transportAmount,
      transportPaidTo,
    }
    const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
    const { payload, error: validation } = stockDocumentPayload('supply', values, productsById)
    if (validation) { setFailure({ key: validation }); return }

    setSaving(true)
    setFailure(null)
    const result = await postStockDocument({ docType: 'supply', ...payload })
    setSaving(false)

    if (result.error) {
      setFailure({ key: 'products:supplyRef.postFailed', error: result.error })
      return
    }
    if (onPosted) onPosted()
    if (onClose) onClose()
  }

  if (loading) return <p className="p-4 text-sm text-muted-foreground">{t('common:loading')}</p>

  if (error) {
    return (
      <div className="m-4 border border-destructive/40 bg-destructive/10 p-3 text-sm">
        <p className="font-medium">{t('products:supplyRef.loadFailedTitle')}</p>
        <p className="mt-1 text-muted-foreground">{dbErrorSentence(error, t)}</p>
      </div>
    )
  }

  // ------------------------------------------------------------------ النافذةُ الأولى
  if (step === 'folders') {
    const selectable = folderRows.filter((r) => r.selectable)

    return (
      <div className="flex h-full flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t('products:supplyRef.pickHint')}</p>

        <div className="min-h-[280px] flex-1 overflow-y-auto border border-[var(--rule)] p-1">
          {selectable.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {t('products:orders.noFoldersHint')}
            </p>
          ) : folderRows.map((row) => (
            <label
              key={row.id}
              data-folder-pick={row.id}
              className={`flex items-center gap-2 px-1 py-[3px] text-sm ${row.selectable ? 'cursor-pointer hover:bg-[var(--group)]' : 'cursor-default opacity-60'}`}
              style={{ paddingInlineStart: `${row.depth * 16 + 4}px` }}
            >
              <input
                type="checkbox"
                disabled={!row.selectable}
                checked={selected.includes(row.id)}
                onChange={() => setSelected(toggleFolder(selected, folderRows, row.id))}
              />
              <span>{row.name}</span>
              {!row.selectable && <RefTag>{t('products:orders.passThroughTag')}</RefTag>}
              {row.archived && <RefTag>{t('products:archivedBadge')}</RefTag>}
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <RefCancelButton onClick={() => setSelected(allSelectableIds(folderRows))}>
              {t('products:orders.checkAll')}
            </RefCancelButton>
            <RefCancelButton onClick={() => setSelected([])}>
              {t('products:orders.uncheckAll')}
            </RefCancelButton>
          </div>
          <div className="flex gap-2">
            <RefCancelButton onClick={onClose}>{t('products:orders.cancelButton')}</RefCancelButton>
            <RefActionButton disabled={!canOpenGrid(selected)} onClick={() => setStep('grid')}>
              {t('products:orders.selectButton')}
            </RefActionButton>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------ النافذةُ الثانية
  const COLUMNS = 5

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-1.5 text-xs">
          {t('products:supplyRef.fromSupplier')}
          <select className={FIELD} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{t('products:docs.supplierNone')}</option>
            {supplierChoices(suppliers, supplierId).map((s) => (
              <option key={s.id} value={s.id}>
                {s.is_active === false ? t('products:archivedOption', { name: s.name }) : s.name}
              </option>
            ))}
          </select>
        </label>

        {/* 🔴 مستودعُ المستند، لا وجهةٌ ثانية — و`supply` عندها `twoStorages: false`. */}
        <label className="flex items-center gap-1.5 text-xs">
          {t('products:supplyRef.toStorage')}
          <select
            className={FIELD}
            data-to-storage
            value={toStorageId}
            onChange={(e) => setToStorageId(e.target.value)}
          >
            {storageChoices(storages, toStorageId).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs">
          {t('products:orders.invoiceLabel')}
          <Input className={FIELD} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </label>

        <label className="flex items-center gap-1.5 text-xs">
          {t('products:orders.fromLabel')}
          <Input
            type="date"
            className={FIELD}
            max={maxDocumentDate()}
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
          />
        </label>
      </div>

      {/* ⚠️ الفراغُ بعد التضييق حالةٌ تُقال بجملةٍ فيها الفعلُ الذي يزيلها — لا
          جدولٌ فارغٌ يُقرأ عطلًا. */}
      {narrowed.empty && (
        <p data-no-shared-folders className="border border-[var(--rule)] bg-[var(--group)] p-2 text-xs">
          {t('products:supplyRef.noSharedFolders')}
        </p>
      )}

      <div className="min-h-[220px] flex-1 overflow-auto border border-[var(--rule)]">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh>{t('products:orders.productColumn')}</RefTh>
              <RefTh className="w-24">{t('products:orders.packagesColumn')}</RefTh>
              <RefTh className="w-28">{t('products:orders.numberColumn')}</RefTh>
              <RefTh className="w-32">{t('products:orders.inStockColumn')}</RefTh>
              <RefTh className="w-28">{t('products:orders.amountColumn')}</RefTh>
            </tr>
          </RefHead>
          <tbody>
            {visible.map((row) => (row.kind === 'folder' ? (
              <RefGroupRow key={`f-${row.id}`} columns={COLUMNS} data-folder-row={row.id}>
                <span className="flex items-center gap-2">
                  {row.name}
                  {row.packages !== null && <RefTag>{t('products:orders.folderSum', { n: row.packages })}</RefTag>}
                  {row.childCount === 0 && <RefTag>{t('products:orders.folderEmpty')}</RefTag>}
                </span>
              </RefGroupRow>
            ) : (
              <RefRow key={row.id} data-product-row={row.id}>
                <RefTd>{row.name}</RefTd>
                <RefTd write>
                  <NumberField
                    min="0"
                    step="1"
                    className={FIELD}
                    value={row.packages}
                    onChange={(e) => setPackages({ ...packages, [row.id]: e.target.value })}
                  />
                </RefTd>
                <RefTd>{row.number === null ? '—' : t('products:orders.qtyWithUnit', { n: row.number, unit: t(`products:units.${row.unit}`) })}</RefTd>
                <RefTd>{t('products:orders.qtyWithUnit', { n: row.inStock, unit: t(`products:units.${row.unit}`) })}</RefTd>
                <RefTd>{row.amount === null ? '—' : row.amount}</RefTd>
              </RefRow>
            )))}
            <RefFillerRow columns={COLUMNS} />
          </tbody>
        </RefTable>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            className={`${FIELD} w-56`}
            placeholder={t('products:orders.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <ShellControl icon={Filter} label={t('products:orders.filterLabel')} why={t('products:orders.laterHint')} />
        <ShellControl icon={FileInput} label={t('products:orders.enterLabel')} why={t('products:orders.laterHint')} />
        <ShellControl icon={FileSpreadsheet} label={t('products:orders.excelLabel')} why={t('products:orders.laterHint')} />
      </div>

      <div className="flex flex-wrap items-end gap-3 text-xs">
        <span className="text-sm font-semibold">
          {t('products:orders.totalLabel')}{' '}
          {totals.total === null
            ? t('products:orders.totalUnpriced')
            : t('products:orders.totalPartial', { total: totals.total, priced: totals.priced, count: totals.lines })}
        </span>

        <label className="flex items-center gap-1.5">
          {t('products:supplyRef.discount')}
          <NumberField min="0" step="1" className={`${FIELD} w-20`} value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)} />
          <select className={FIELD} value={discountKind} onChange={(e) => setDiscountKind(e.target.value)}>
            {DISCOUNT_KINDS.map((k) => (
              <option key={k} value={k}>{t(`products:docs.discountKind_${k}`)}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          {t('products:supplyRef.transport')}
          <NumberField min="0" step="1" className={`${FIELD} w-24`} value={transportAmount}
            onChange={(e) => setTransportAmount(e.target.value)} />
          {/* ⚠️ يبقى بقرار المالك: «الحقولُ تكسب» — المرجعُ يعرض المبلغَ وحدَه،
              وحذفُ الجهةِ يخسّر معلومةً مخزَّنة. */}
          <select className={FIELD} value={transportPaidTo} onChange={(e) => setTransportPaidTo(e.target.value)}>
            {TRANSPORT_PAID_TO.map((k) => (
              <option key={k} value={k}>{t(`products:docs.transportPaidTo_${k}`)}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        {t('products:orders.noteLabel')}
        <textarea rows={2} className={`${FIELD} h-auto py-1`} value={note}
          onChange={(e) => setNote(e.target.value)} />
      </label>

      {failure && (
        <div className="border border-destructive/40 bg-destructive/10 p-2 text-xs">
          <p>{t(failure.key)}</p>
          {failure.error && <p className="mt-1 text-muted-foreground">{dbErrorSentence(failure.error, t, 'SupplyProductsScreen')}</p>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {/* ⚠️ مرسومٌ ولا يُشتغل عليه — مؤجَّلٌ مع «تسعير الطقم» حتى تنسيق الجدول،
            بقرار المالك. ومعطَّلٌ بسببٍ ظاهرٍ بدل أن يبدو زرًّا لا يفعل شيئًا. */}
        <label className="flex cursor-not-allowed items-center gap-1.5 text-xs text-muted-foreground opacity-60"
          title={t('products:orders.laterHint')}>
          <input type="checkbox" disabled data-shell-control="changeRetailPrice" />
          {t('products:supplyRef.changeRetailPrice')}
        </label>

        <div className="flex gap-2">
          <RefCancelButton onClick={() => setStep('folders')}>{t('products:orders.backToFolders')}</RefCancelButton>
          <RefCancelButton onClick={onClose}>{t('products:orders.cancelButton')}</RefCancelButton>
          <RefActionButton disabled={saving || documentRows.length === 0 || !supplierId} onClick={post}>
            {t('products:supplyRef.toDebitButton')}
          </RefActionButton>
        </div>
      </div>
    </div>
  )
}

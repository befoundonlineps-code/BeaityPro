import { useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { Search, FileSpreadsheet, FileInput, Filter } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { orderFolderRows, allSelectableIds, canOpenGrid, toggleFolder } from '../lib/orderFolderPick'
import { orderGridRows, orderGridTotal, orderLinesFromGrid } from '../lib/orderGrid'
import { createProductOrder } from '../lib/productOrderIO'
import { today, maxDocumentDate } from '../lib/documentDate'
import { supplierChoices } from '../lib/supplierForm'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from './ref/RefGrid'
import { RefActionButton, RefCancelButton } from './ref/RefModal'
import NumberField from '@/components/ui/NumberField'
import { Input } from '@/components/ui/input'

// «طلب بضاعة» — أولى الشاشات العشر، على شكل التطبيق المرجعيّ.
//
// نافذتان: تأشيرُ مجلّدات المستودع، ثمّ جدولٌ صفوفُه مجلّداتٌ وأبناؤها.
// والمنطقُ كلُّه في lib/orderFolderPick.js و lib/orderGrid.js — هذا الملفّ
// يرسم ولا يحسب.
//
// 🔴 **والمستودعُ عدسةٌ لا عمود.** يقرّر أيَّ مجلّداتٍ تُعرض وما يقوله «الرصيد
// الحاليّ»، ولا يُكتب في أيِّ صفّ — `product_orders` بلا عمود مستودعٍ إطلاقًا،
// وهذا لم يتغيّر.

const FIELD = 'h-7 rounded-none border border-[var(--rule)] bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring'

// ⚠️ الضوابطُ المرسومةُ بلا وظيفة — **معطَّلةٌ وبسببٍ ظاهرٍ عند التحويم**، لا
// مخفيّةً ولا كاذبة.
//
// قاعدةُ المشروع «ما لا بيانات خلفه يُحذف لا يُرسم فارغًا» تخصّ ما يخترعه
// النظامُ من عنده. **وهذه قرارُ المالك صراحةً: «الإكسل شكل فقط بهالمرحلة، زر
// وقائمة منسدلة موجودين».** فالتوفيقُ ليس إخفاءَها بل **ألّا تكذب**: زرٌّ
// معطَّلٌ يقول «لاحقًا» ليس زرًّا لا يفعل شيئًا.
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

export default function OrderProductsScreen({
  salonId, storageId, categories, products, balances, storageCategories,
  suppliers, loading, error, onSaved, onClose,
}) {
  const { t } = useTranslation(['products', 'common'])

  const folderRows = useMemo(
    () => orderFolderRows({ categories, storageId, links: storageCategories }),
    [categories, storageId, storageCategories]
  )

  const [step, setStep] = useState('folders')
  const [selected, setSelected] = useState(() => allSelectableIds(folderRows))
  const [packages, setPackages] = useState({})
  const [invoiceNo, setInvoiceNo] = useState('')
  const [orderDate, setOrderDate] = useState(today())
  const [supplierId, setSupplierId] = useState('')
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState(null)

  const rows = useMemo(() => orderGridRows({
    selectedFolderIds: selected, categories, products, balances, storageId, packages,
  }), [selected, categories, products, balances, storageId, packages])

  // ⚠️ البحثُ يرشّح **المنتجاتِ وحدَها**، والمجلّدُ يبقى ما دام أحدُ أبنائه باقيًا
  // — مجلّدٌ يختفي وابنُه ظاهرٌ يترك صفًّا بلا عنوان، ومجلّدٌ يبقى بلا أبناءَ
  // يترك عنوانًا بلا مضمون.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (needle === '') return rows

    const kept = rows.filter((r) => r.kind === 'product' && String(r.name).toLowerCase().includes(needle))
    const folders = new Set(kept.map((r) => r.folderId))
    return rows.filter((r) => (r.kind === 'folder' ? folders.has(r.id) : kept.includes(r)))
  }, [rows, search])

  const totals = useMemo(() => orderGridTotal(rows), [rows])
  const lines = useMemo(() => orderLinesFromGrid(rows), [rows])

  async function save() {
    setSaving(true)
    setFailure(null)
    const result = await createProductOrder({
      order: {
        supplier_id: supplierId,
        order_date: orderDate,
        note: note.trim() === '' ? null : note.trim(),
        // ⚠️ الفراغُ يصل عدمًا لا نصًّا فارغًا — القيدُ في ٠٩٠ يرفض `''`، وهو
        // موجودٌ كي يبقى لـ«بلا رقم» تهجئةٌ واحدة.
        invoice_no: invoiceNo.trim() === '' ? null : invoiceNo.trim(),
      },
      lines: lines.map((line) => ({
        product_id: line.productId,
        entered_quantity: line.enteredQuantity,
        entered_uom: line.enteredUom,
        sort_order: line.sortOrder,
      })),
      salonId,
    })
    setSaving(false)

    if (!result.ok) {
      setFailure({ key: result.orphaned ? 'products:orders.orphanedHint' : 'products:orders.saveFailed', error: result.error })
      return
    }
    if (onSaved) onSaved()
    if (onClose) onClose()
  }

  if (loading) return <p className="p-4 text-sm text-muted-foreground">{t('common:loading')}</p>

  if (error) {
    return (
      <div className="m-4 border border-destructive/40 bg-destructive/10 p-3 text-sm">
        <p className="font-medium">{t('products:orders.loadFailedTitle')}</p>
        <p className="mt-1 text-muted-foreground">{dbErrorSentence(error, t)}</p>
      </div>
    )
  }

  // ------------------------------------------------------------------ النافذةُ الأولى
  if (step === 'folders') {
    const selectable = folderRows.filter((r) => r.selectable)

    return (
      <div className="flex h-full flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t('products:orders.pickHint')}</p>

        <div className="min-h-[280px] flex-1 overflow-y-auto border border-[var(--rule)] p-1">
          {selectable.length === 0 ? (
            // ⚠️ مستودعٌ بلا أصنافٍ مسموحة ليس عطلًا — وهي حالةٌ يصنعها المستودعُ
            // الجديد، فيفتح بلا شيءٍ مؤشَّر. والجملةُ تقول الفعلَ الذي يزيلها.
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
              {/* المعلَّقُ يُعرَض ولا يُؤشَّر — والشارةُ تقول لماذا بدل أن يبدو معطّلًا بلا سبب. */}
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
            {/* «إلغاء» هنا يلغي العمليّةَ كلَّها ولا يرجع خطوة — لا شيءَ خلفها. */}
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
          {t('products:orders.invoiceLabel')}
          <Input className={FIELD} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          {t('products:orders.fromLabel')}
          <Input
            type="date"
            className={FIELD}
            max={maxDocumentDate()}
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
          />
        </label>
        {/* ⚠️ المورّدُ ليس في لقطات المرجع، وعمودُنا `NOT NULL` — فالحقولُ تكسب
            والتصميمُ ينحني (§٢ج من وثيقة المطابقة). والمنتقي هو نفسُه المستعملُ
            في شاشة الطلبيّات، لا واحدٌ ثانٍ. */}
        <label className="flex items-center gap-1.5 text-xs">
          {t('products:orders.supplierLabel')}
          <select className={FIELD} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{t('products:docs.supplierNone')}</option>
            {supplierChoices(suppliers, supplierId).map((s) => (
              <option key={s.id} value={s.id}>
                {s.is_active === false ? t('products:archivedOption', { name: s.name }) : s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="min-h-[240px] flex-1 overflow-auto border border-[var(--rule)]">
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
              // صفُّ المجلّد: عنوانٌ غيرُ قابلٍ للتعديل، ورقمُه مجموعُ أبنائه.
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
                  {/* العمودُ الوحيدُ القابلُ للتعديل في هذا الجدول. */}
                  <NumberField
                    min="0"
                    step="1"
                    className={FIELD}
                    value={row.packages}
                    onChange={(e) => setPackages({ ...packages, [row.id]: e.target.value })}
                  />
                </RefTd>
                {/* ⚠️ الوحدةُ مع الرقم دائمًا، ومن `base_unit` لا ثابتةً — خللُ
                    المرجع `0.0 pcs (0 ml)` لا يُنسخ. */}
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
        {/* ⚠️ الفلترُ مبنيٌّ فعلًا لأن «حدّ التنبيه» موجودٌ عندنا — بينما هذان
            شكلٌ حتى إشعارٍ آخر، بقرار المالك. */}
        <ShellControl icon={Filter} label={t('products:orders.filterLabel')} why={t('products:orders.laterHint')} />
        <ShellControl icon={FileInput} label={t('products:orders.enterLabel')} why={t('products:orders.laterHint')} />
        <ShellControl icon={FileSpreadsheet} label={t('products:orders.excelLabel')} why={t('products:orders.laterHint')} />
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold">
        {t('products:orders.totalLabel')}
        {/* ثلاثُ جملٍ لا رقمٌ واحد — «لا أسعارَ متّفقٌ عليها» ليست «يساوي صفرًا». */}
        <span>
          {totals.total === null
            ? t('products:orders.totalUnpriced')
            : t('products:orders.totalPartial', { total: totals.total, priced: totals.priced, count: totals.lines })}
        </span>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        {t('products:orders.noteLabel')}
        <textarea
          rows={2}
          className={`${FIELD} h-auto py-1`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {failure && (
        <div className="border border-destructive/40 bg-destructive/10 p-2 text-xs">
          <p>{t(failure.key)}</p>
          {failure.error && <p className="mt-1 text-muted-foreground">{dbErrorSentence(failure.error, t)}</p>}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <RefCancelButton onClick={() => setStep('folders')}>{t('products:orders.backToFolders')}</RefCancelButton>
        <RefCancelButton onClick={onClose}>{t('products:orders.cancelButton')}</RefCancelButton>
        {/* ⚠️ لا سطورَ = لا طلبيّة. والزرُّ معطَّلٌ بدل رسالةِ رفضٍ تشرح ما تقوله
            الشاشةُ أصلًا — ولا مورّدَ كذلك، لأن العمودَ `NOT NULL`. */}
        <RefActionButton disabled={saving || lines.length === 0 || !supplierId} onClick={save}>
          {t('products:orders.toOrderButton')}
        </RefActionButton>
      </div>
    </div>
  )
}

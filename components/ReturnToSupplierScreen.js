import { useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { Search, FileSpreadsheet, FileInput } from 'lucide-react'
import { dbErrorSentence, dbErrorKey } from '../lib/dbErrors'
import { orderFolderRows, allSelectableIds, canOpenGrid, toggleFolder } from '../lib/orderFolderPick'
import { returnGridRows, returnTotal, returnLinesFromGrid, returnBlocked } from '../lib/returnGrid'
import {
  PAYMENT_CHOICES, ON_ACCOUNT, paymentChoiceOf, applyPaymentChoice, validateDocumentMoney,
} from '../lib/documentMoney'
import { postStockDocument } from '../lib/stockIO'
import { supplyPickerRows, fillFromSupplyInvoices, fillReport } from '../lib/writeOffFromInvoice'
import InvoicePickerDialog from './InvoicePickerDialog'
import { today, maxDocumentDate } from '../lib/documentDate'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from './ref/RefGrid'
import { RefActionButton, RefCancelButton } from './ref/RefModal'
import NumberField from '@/components/ui/NumberField'
import { Input } from '@/components/ui/input'

// «إرجاعٌ إلى مورّد» — على شكل التطبيق المرجعيّ، والمنطقُ كلُّه في
// `lib/returnGrid.js`. **هذا الملفُّ يرسم ولا يحسب.**
//
// 🔴 **وهذه الشاشةُ إحلالٌ لا إضافة:** الإرجاعُ يعمل اليوم عبر
// `StockDocumentScreen` بوضع `isReturn`. **وكلُّ ما تكتبه تلك الشاشةُ يُكتب هنا**
// (`paid_amount` · `payment_method` · `entered_unit_price`)، **وجملةُ الحساب
// معها** — إسقاطُ شيءٍ يعمل اليوم انحدارٌ لا تبسيط.
//
// 🔴 **والفرقُ الجوهريُّ عن الشطب: عمودُ السعر خانةُ إدخال.** الشطبُ يقيّم خسارةً
// وقعت فثمنُه ما كلّفتنا؛ **والإرجاعُ يسجّل مطالبةً بائتمان، وما يقبله المورّدُ
// ليس بالضرورة ما دفعناه.** والمكتوبُ يسافر في `entered_unit_price`،
// **و`unit_cost` تختمه القاعدةُ من الدفعة الحقيقيّة ولا يمسّه أحد.**

const FIELD = 'h-7 rounded-none border border-[var(--rule)] bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring'

const UNEXPLAINED = ['common:dbError.unexpected', 'common:dbError.ruleRefused']

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

export default function ReturnToSupplierScreen({
  storageId, categories, products, storageCategories, lots, movements,
  documents, suppliers,
  loading, error, onSaved, onClose,
}) {
  const { t } = useTranslation(['products', 'common'])

  const folderRows = useMemo(
    () => orderFolderRows({ categories, storageId, links: storageCategories }),
    [categories, storageId, storageCategories]
  )

  const [step, setStep] = useState('folders')
  const [selected, setSelected] = useState(() => allSelectableIds(folderRows))
  const [picks, setPicks] = useState({})
  const [supplierId, setSupplierId] = useState('')
  const [consignmentOnly, setConsignmentOnly] = useState(false)
  const [docNumber, setDocNumber] = useState('')
  const [docDate, setDocDate] = useState(today())
  const [paidAmount, setPaidAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState(false)
  const [clipped, setClipped] = useState([])
  const [outcome, setOutcome] = useState(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState(null)

  const rows = useMemo(() => returnGridRows({
    selectedFolderIds: selected, categories, products, lots, movements, storageId, picks,
    consignmentOnly, supplierId,
  }), [selected, categories, products, lots, movements, storageId, picks, consignmentOnly, supplierId])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (needle === '') return rows

    const kept = rows.filter((r) => r.kind === 'product' && String(r.name).toLowerCase().includes(needle))
    const folders = new Set(kept.map((r) => r.folderId))
    return rows.filter((r) => (r.kind === 'folder' ? folders.has(r.id) : kept.includes(r)))
  }, [rows, search])

  const productsById = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.id, p])),
    [products]
  )

  const total = useMemo(() => returnTotal(rows), [rows])
  const lines = useMemo(() => returnLinesFromGrid(rows, productsById), [rows, productsById])
  const blocked = useMemo(() => returnBlocked(rows), [rows])

  // ⚠️ **المقارنةُ على المقصوص لا الخام**، وإلّا مرّ «١٢ » و«١٢» رقمين.
  const duplicateNumber = useMemo(() => {
    const typed = docNumber.trim()
    if (typed === '') return false
    return (documents || []).some((doc) => String(doc.doc_number ?? '').trim() === typed)
  }, [documents, docNumber])

  // 🔴 **الخيارُ الرابعُ مشتقٌّ لا محفوظ** — والقائمةُ تعرضه مختارًا حين لا مبلغ.
  const paymentChoice = paymentChoiceOf({ paidAmount, paymentMethod })

  // 🔴 **حارسُ المال القائم، منادًى لا معادَ كتابتُه.**
  //
  // ⚠️ **وغيابُه كان عطلًا حقيقيًّا قاسه المالك:** حُفظ `paid_amount = 3000` مع
  // `payment_method = null` — أي «مالٌ تحرّك» بلا «كيف تحرّك»، وهي الحالةُ التي
  // يرفضها `documentMoney.js:208` بالاسم (`paymentMethodRequired`).
  //
  // 🔴 **والشاشةُ القديمةُ كانت ترفضه**: تمرّ بـ`stockDocumentForm` التي تنادي
  // هذا الحارس. **وشاشتي تبني الحمولةَ بنفسها فتخطّت طبقةَ المال كلَّها** — وهو
  // بالضبط صنفُ «الإحلالُ يُسقط حارسًا كان قائمًا»، الذي حذّرتُ منه في جملة
  // الحساب ثمّ وقعتُ فيه هنا.
  //
  // ⚠️ **ويُنادى كلُّه لا شرطُه وحدَه:** نسخُ «مبلغٌ ⟵ طريقةٌ إلزاميّة» هنا يعطي
  // نسختين لقاعدةٍ واحدة، **والباقي فيه** (`paidNegative` مثلًا) يبقى غائبًا.
  const moneyError = validateDocumentMoney({
    lines: [], paidAmount, paymentMethod: paymentChoice === ON_ACCOUNT ? null : paymentMethod,
  })

  function setPick(row, patch) {
    if (failure) setFailure(null)

    const current = row.picks[0] || {}
    setPicks({
      ...picks,
      [row.id]: [{
        lotId: current.lotId ?? null,
        packages: current.packages ?? '',
        // ⚠️ **النصُّ الخامُّ يُنقل لا القيمةُ المحسوبة**، وإلّا صار المقترَحُ
        // مكتوبًا بأوّل تعديلٍ لأيّ حقلٍ آخر — **فيُقرأ سعرًا اختاره إنسان.**
        unitPrice: current.priceText ?? '',
        ...patch,
      }],
    })
  }

  async function save() {
    setSaving(true)
    setFailure(null)

    const result = await postStockDocument({
      docType: 'return_to_supplier',
      storageId,
      supplierId,
      docDate,
      docNumber: docNumber.trim() === '' ? null : docNumber.trim(),
      note: note.trim() === '' ? null : note.trim(),
      // ⚠️ **الفراغُ عدمٌ لا صفر** — والصفرُ المكتوب مبلغٌ مقصود.
      paidAmount: paidAmount.trim() === '' ? null : Number(paidAmount),
      // 🔴 **`ON_ACCOUNT` لا يصل القاعدةَ أبدًا** — القيدُ يقصر العمودَ على
      // الثلاثة، **والحالةُ تُقرأ من `paid_amount` لا من هذا العمود.**
      paymentMethod: paymentChoice === ON_ACCOUNT ? null : (paymentMethod || null),
      lines: lines.map((line) => ({
        product_id: line.productId,
        lot_id: line.lotId,
        quantity_base: line.quantityBase,
        entered_quantity: line.enteredQuantity,
        entered_uom: line.enteredUom,
        // 🔴 **المطالبةُ تسافر هنا، والتكلفةُ تختمها القاعدةُ من الدفعة.**
        entered_unit_price: line.enteredUnitPrice,
      })),
    })

    setSaving(false)
    if (!result.ok) {
      setFailure({ key: 'products:returnSupplier.saveFailed', error: result.error })
      return
    }
    if (onSaved) onSaved()
    if (onClose) onClose()
  }

  if (loading) return <p className="p-4 text-sm text-muted-foreground">{t('common:loading')}</p>

  if (error) {
    return (
      <div className="m-4 border border-destructive/40 bg-destructive/10 p-3 text-sm">
        <p className="font-medium">{t('products:returnSupplier.loadFailedTitle')}</p>
        <p className="mt-1 text-muted-foreground">{dbErrorSentence(error, t)}</p>
      </div>
    )
  }

  // ------------------------------------------------------------------ النافذةُ الأولى
  if (step === 'folders') {
    const selectable = folderRows.filter((r) => r.selectable)

    return (
      <div className="flex h-full flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t('products:returnSupplier.pickHint')}</p>

        <div className="min-h-[280px] flex-1 overflow-y-auto border border-[var(--rule)] p-1">
          {selectable.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {t('products:returnSupplier.noFoldersHint')}
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
            <RefCancelButton onClick={onClose}>{t('products:returnSupplier.cancelButton')}</RefCancelButton>
            <RefActionButton disabled={!canOpenGrid(selected)} onClick={() => setStep('grid')}>
              {t('products:returnSupplier.selectButton')}
            </RefActionButton>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------ النافذةُ الثانية
  //
  // سبعةُ أعمدة: ستّةُ الشطب **و«سعر الوحدة» بينها وبين المبلغ** — لأنه يُقرأ
  // بعد الدفعة التي يقترح ثمنَها، وقبل المبلغ الذي يشتقّ منه.
  const COLUMNS = 7

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        {/* 🔴 **المورّدُ إجباريّ** — والإرجاعُ بلا جهةٍ ليس إرجاعًا. */}
        <label className="flex items-center gap-1.5 text-xs">
          {t('products:returnSupplier.supplierLabel')}
          <select
            className={`${FIELD} w-48`}
            data-return-supplier
            value={supplierId}
            onChange={(e) => { setSupplierId(e.target.value); setFailure(null) }}
          >
            <option value="">{t('products:returnSupplier.supplierPlaceholder')}</option>
            {(suppliers || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs">
          {t('products:returnSupplier.docNumberLabel')}
          <Input
            className={FIELD}
            data-return-doc-number
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
          />
        </label>
        {duplicateNumber && (
          <RefTag data-duplicate-doc-number>{t('products:returnSupplier.duplicateNumber')}</RefTag>
        )}

        <label className="flex items-center gap-1.5 text-xs">
          {t('products:returnSupplier.fromLabel')}
          <Input
            type="date"
            className={FIELD}
            max={maxDocumentDate()}
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
          />
        </label>

        {/* 🔴 **مربّعُ الأمانة يرشّح بالمورّد** — ومنتجُ أمانةٍ لمورّدٍ آخرَ ملكُ
            ذلك المورّد، فإرجاعُه إلى هذا خطأٌ لا نقصُ عرض. */}
        <label
          className="flex items-center gap-1.5 text-xs"
          title={t('products:returnSupplier.consignmentHint')}
        >
          <input
            type="checkbox"
            data-consignment-only
            checked={consignmentOnly}
            onChange={(e) => setConsignmentOnly(e.target.checked)}
          />
          {t('products:returnSupplier.consignmentLabel')}
        </label>
      </div>

      <div className="min-h-[240px] flex-1 overflow-auto border border-[var(--rule)]">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh>{t('products:returnSupplier.productColumn')}</RefTh>
              <RefTh className="w-24">{t('products:returnSupplier.packagesColumn')}</RefTh>
              <RefTh className="w-28">{t('products:returnSupplier.numberColumn')}</RefTh>
              <RefTh className="w-32">{t('products:returnSupplier.inStockColumn')}</RefTh>
              <RefTh className="w-64">{t('products:returnSupplier.lotColumn')}</RefTh>
              <RefTh className="w-32">{t('products:returnSupplier.unitPriceColumn')}</RefTh>
              <RefTh className="w-28">{t('products:returnSupplier.amountColumn')}</RefTh>
            </tr>
          </RefHead>
          <tbody>
            {visible.map((row) => (row.kind === 'folder' ? (
              <RefGroupRow key={`f-${row.id}`} columns={COLUMNS} data-folder-row={row.id}>
                <span className="flex items-center gap-2">
                  {row.name}
                  {row.packages !== null && <RefTag>{t('products:returnSupplier.folderSum', { n: row.packages })}</RefTag>}
                  {row.childCount === 0 && <RefTag>{t('products:returnSupplier.folderEmpty')}</RefTag>}
                </span>
              </RefGroupRow>
            ) : (
              <RefRow key={row.id} data-product-row={row.id} data-locked={row.locked ? '' : undefined}>
                <RefTd>
                  <span className="flex items-center gap-2">
                    {row.name}
                    {row.isConsignment && <RefTag>{t('products:returnSupplier.consignmentTag')}</RefTag>}
                    {row.locked && <RefTag>{t('products:returnSupplier.noStockTag')}</RefTag>}
                  </span>
                </RefTd>
                <RefTd write={!row.locked}>
                  <span className="flex items-center gap-1">
                    <NumberField
                      min="0"
                      step="1"
                      disabled={row.locked}
                      className={FIELD}
                      data-packages-for={row.id}
                      value={row.packages}
                      onChange={(e) => setPick(row, { packages: e.target.value })}
                    />
                    {!row.locked && (
                      <button
                        type="button"
                        data-fill-all={row.id}
                        title={t('products:returnSupplier.fillAllHint')}
                        className="h-7 shrink-0 border border-[var(--rule)] px-1.5 text-[11px] text-muted-foreground hover:bg-[var(--group)]"
                        onClick={() => setPick(row, { packages: String(row.inStockPackages) })}
                      >
                        {t('products:returnSupplier.fillAll')}
                      </button>
                    )}
                  </span>
                </RefTd>
                <RefTd>
                  {row.number === null
                    ? '—'
                    : t('products:orders.qtyWithUnit', { n: row.number, unit: t(`products:units.${row.unit}`) })}
                </RefTd>
                <RefTd>
                  {t('products:orders.qtyWithUnit', { n: row.inStock, unit: t(`products:units.${row.unit}`) })}
                </RefTd>
                <RefTd>
                  {row.locked ? '—' : (
                    <span className="flex items-center gap-1.5">
                      <select
                        className={FIELD}
                        data-lot-for={row.id}
                        value={row.picks[0]?.lotId ?? ''}
                        onChange={(e) => setPick(row, { lotId: e.target.value || null })}
                      >
                        <option value="">{t('products:returnSupplier.lotAuto')}</option>
                        {row.lots.map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {t('products:returnSupplier.lotOption', {
                              date: String(lot.receivedAt).slice(0, 10),
                              remaining: lot.remaining,
                              cost: lot.unitCost === null ? '—' : lot.unitCost,
                            })}
                          </option>
                        ))}
                      </select>
                      {row.picks[0]?.costIsEstimated && (
                        <RefTag title={t('products:returnSupplier.estimatedHelp')}>
                          {t('products:returnSupplier.estimatedTag')}
                        </RefTag>
                      )}
                      {/* 🔴 **شارتان لا واحدة، والمسارُ يختار.** بعد ١٠١ صار
                          الإرجاعُ يرفض النقصَ كالشطب، **فإخفاءُ الشارة على
                          التلقائيّ صار كذبًا عن سلوك القاعدة** — وكان صحيحًا
                          يومًا واحدًا.
                          ⚠️ **والنصّان يفترقان لأن المخرجَ يختلف:** تجاوزُ
                          دفعةٍ بعينها يُحلّ بتبديلها أو بالرجوع للتلقائيّ،
                          **وتجاوزُ الإجماليِّ لا يُحلّ إلّا بإنقاص الكمّيّة.** */}
                      {row.picks[0]?.overRemaining && (
                        <RefTag data-over-remaining={row.id}>
                          {row.picks[0].auto
                            ? t('products:returnSupplier.overStockTag')
                            : t('products:returnSupplier.overRemainingTag')}
                        </RefTag>
                      )}
                    </span>
                  )}
                </RefTd>
                {/* 🔴 **خانةُ إدخالٍ لا رقمٌ محسوب** — وهذا الفرقُ الجوهريُّ عن
                    الشطب. **والفارغةُ تعرض المقترَحَ عنصرًا نائبًا**، فيُقرأ
                    «هذا ما سيُرسَل إن لم تكتب» لا «صفر». */}
                <RefTd write={!row.locked}>
                  {row.locked ? '—' : (
                    <span className="flex items-center gap-1">
                      {/* ⚠️ **الخطوةُ واحدٌ صحيحٌ لأنه حقلُ مال** — القرارُ قائمٌ
                          ومحروسٌ (`numberFieldStep`): الوصولُ من صفرٍ إلى خمسين
                          بخطوة `0.01` خمسةُ آلاف ضغطة. **والكسرُ يبقى مكتوبًا
                          باليد**، فالخطوةُ للسهمين لا للقيمة. */}
                      <NumberField
                        min="0"
                        step="1"
                        className={FIELD}
                        data-unit-price-for={row.id}
                        title={t('products:returnSupplier.priceHint')}
                        placeholder={row.picks[0]?.suggestedPrice === null ? '—' : String(row.picks[0]?.suggestedPrice)}
                        value={row.picks[0]?.priceText ?? ''}
                        onChange={(e) => setPick(row, { unitPrice: e.target.value })}
                      />
                      {/* ⚠️ **«معدَّل» تعني اختلافًا عن التكلفة الحقيقيّة**، لا
                          مجرّدَ كتابة — ومؤشّرٌ يضيء على إعادة كتابة نفسِ الرقم
                          يكذب فيُتجاهَل. */}
                      {row.picks[0]?.priceEdited && (
                        <RefTag
                          data-price-edited={row.id}
                          title={t('products:returnSupplier.priceEditedHint')}
                        >
                          {t('products:returnSupplier.priceEditedTag')}
                        </RefTag>
                      )}
                    </span>
                  )}
                </RefTd>
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
            placeholder={t('products:returnSupplier.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          type="button"
          data-open-invoice-picker
          onClick={() => setPicking(true)}
          className="flex h-7 items-center gap-1 border border-[var(--rule)] px-2 text-xs hover:bg-[var(--group)]"
        >
          <FileInput className="size-3.5" />
          {t('products:returnSupplier.enterLabel')}
        </button>
        <ShellControl icon={FileSpreadsheet} label={t('products:returnSupplier.excelLabel')} why={t('products:returnSupplier.laterHint')} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          {t('products:returnSupplier.totalLabel')}
          <span data-return-total>{total}</span>
        </span>

        <label className="flex items-center gap-1.5 text-xs font-normal">
          {t('products:returnSupplier.paidLabel')}
          <NumberField
            min="0"
            step="1"
            className={`${FIELD} w-28`}
            data-return-paid
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
          />
        </label>

        {/* 🔴 **مرسومةٌ دائمًا، حتى عند صفر.** كانت تُرسم عند مبلغٍ موجبٍ وحدَه
            (`StockDocumentScreen:676`)، **فاختيارُ «على الحساب» يصفّر المبلغَ
            فتختفي القائمةُ لحظةَ الاختيار** — وهو الإصلاحُ الوحيدُ الذي طلبته
            المواصفة. */}
        <label className="flex items-center gap-1.5 text-xs font-normal">
          {t('products:returnSupplier.paymentLabel')}
          <select
            className={`${FIELD} w-40`}
            data-return-payment
            value={paymentChoice}
            onChange={(e) => {
              const patch = applyPaymentChoice(e.target.value)
              if (patch.paidAmount !== undefined) setPaidAmount(patch.paidAmount)
              setPaymentMethod(patch.paymentMethod)
            }}
          >
            {/* حالةُ «مبلغٌ بلا طريقةٍ بعد» — تُعرض ولا تُبتلع في «على الحساب». */}
            {paymentChoice === '' && (
              <option value="">{t('products:returnSupplier.paymentPlaceholder')}</option>
            )}
            {PAYMENT_CHOICES.map((k) => (
              <option key={k} value={k}>
                {k === ON_ACCOUNT
                  ? t('products:returnSupplier.payment_on_account')
                  : t(`products:docs.paymentMethod_${k}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        {t('products:returnSupplier.noteLabel')}
        <textarea rows={2} className={`${FIELD} h-auto py-1`} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {/* 🔴 **الصنفُ يختار الجملة، ولا سردَ أرقامٍ يفكّه القارئ.** والصمتُ
          محجوزٌ للاكتمال وحدَه — `fillReport` تردّ العدمَ هناك فقط. */}
      {outcome && (
        <div className="border border-[var(--rule)] bg-[var(--group)] p-2 text-xs" data-fill-outcome data-fill-kind={outcome.kind}>
          {t(`products:returnSupplier.fill_${outcome.kind}`, outcome)}
        </div>
      )}

      {clipped.length > 0 && (
        <div className="border border-[var(--rule)] bg-[var(--group)] p-2 text-xs" data-clipped-notice>
          {t('products:returnSupplier.clippedNotice', { count: clipped.length })}
        </div>
      )}

      {failure && (
        <div className="border border-destructive/40 bg-destructive/10 p-2 text-xs" data-return-failure>
          <p>{t(failure.key)}</p>
          {failure.error && <p className="mt-1 text-muted-foreground">{dbErrorSentence(failure.error, t)}</p>}
          {failure.error && UNEXPLAINED.includes(dbErrorKey(failure.error)) && (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground" data-db-code>
              {`${failure.error.code ?? '—'} · ${failure.error.message ?? '—'}`}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {/* ⚠️ **سببُ التعطيل يُقال، ولا يُترك الزرُّ صامتًا** — «معطَّلٌ بلا سبب»
            يجعل المستخدمَ يجرّب الحقولَ واحدًا واحدًا. */}
        {supplierId === '' && lines.length > 0 && (
          <span className="text-xs text-muted-foreground" data-supplier-required>
            {t('products:returnSupplier.supplierRequired')}
          </span>
        )}
        {/* ⚠️ **الرسالةُ تُقال قبل الضغط لا بعده** — زرٌّ معطَّلٌ بلا سببٍ يجعل
            المستخدمَ يجرّب الحقولَ واحدًا واحدًا. */}
        {moneyError && (
          <span className="text-xs text-destructive" data-money-error>{t(moneyError)}</span>
        )}
        <RefCancelButton onClick={() => setStep('folders')}>{t('products:returnSupplier.backToFolders')}</RefCancelButton>
        <RefCancelButton onClick={onClose}>{t('products:returnSupplier.cancelButton')}</RefCancelButton>
        <RefActionButton
          disabled={saving || lines.length === 0 || blocked || supplierId === '' || moneyError !== ''}
          title={blocked ? t('products:returnSupplier.blockedHint') : undefined}
          onClick={save}
        >
          {t('products:returnSupplier.returnButton')}
        </RefActionButton>
      </div>

      {picking && (
        // 🔴 **مقصورٌ على التوريد وعلى مورّدِ الشاشة.** الطلبيّةُ لا تولّد دفعةً،
        // **وفاتورةُ موردٍ آخرَ تولّد دفعاتٍ لا يصحُّ إرجاعُها إلى هذا المورّد.**
        <InvoicePickerDialog
          kind="supply"
          rows={supplyPickerRows({ documents, lots, movements, suppliers, storageId, supplierId })}
          suppliers={suppliers}
          onCancel={() => setPicking(false)}
          onSelect={(ids) => {
            const filled = fillFromSupplyInvoices({
              documentIds: ids, lots, movements, products, storageId,
            })

            // 🔴 **ملءٌ نجح وصفٌّ اختفى — وهو صمتٌ أخطرُ من ملءٍ لم يقع.**
            //
            // الجدولُ يرشّح بمربّع الأمانة **بعد** الملء، فمنتجٌ ليس أمانةً لهذا
            // المورّد يُملأ ثمّ لا يُعرض — **واختيارُ الفاتورة يبدو بلا أثرٍ
            // إطلاقًا، بلا رسالةٍ ولا خطأ.**
            //
            // ⚠️ **ولا يُلغى الترشيحُ تلقائيًّا:** المستخدمُ أشّره بقصد، **وتراجُعُ
            // الشاشة عن اختيارٍ صريحٍ أسوأُ من إخبارِه.**
            //
            // ⚠️ **والمخفيُّ صنفٌ منفصلٌ عن المستنفَد عمدًا** — الأوّلُ يُحلّ
            // بإزالة تأشيرٍ والثاني لا يُحلّ إطلاقًا، **فجملةٌ واحدةٌ لهما تُرسل
            // القارئَ إلى الطريق الخطأ.**
            const shownIds = new Set(rows.filter((r) => r.kind === 'product').map((r) => r.id))
            const hidden = Object.keys(filled.picks).filter((id) => !shownIds.has(id))

            setPicks({ ...picks, ...filled.picks })
            setClipped(filled.clipped)
            setOutcome(fillReport(filled, { hiddenProductIds: hidden }))
            setFailure(null)
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}

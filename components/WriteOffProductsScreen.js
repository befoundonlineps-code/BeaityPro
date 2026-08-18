import { useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { Search, FileSpreadsheet, FileInput } from 'lucide-react'
import { dbErrorSentence, dbErrorKey } from '../lib/dbErrors'
import { orderFolderRows, allSelectableIds, canOpenGrid, toggleFolder } from '../lib/orderFolderPick'
import { writeOffGridRows, writeOffTotal, writeOffLinesFromGrid, writeOffBlocked } from '../lib/writeOffGrid'
import { postStockDocument } from '../lib/stockIO'
import { supplyPickerRows, fillFromSupplyInvoices, fillReport } from '../lib/writeOffFromInvoice'
import InvoicePickerDialog from './InvoicePickerDialog'
import { today, maxDocumentDate } from '../lib/documentDate'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from './ref/RefGrid'
import { RefActionButton, RefCancelButton } from './ref/RefModal'
import NumberField from '@/components/ui/NumberField'
import { Input } from '@/components/ui/input'

// «شطب بضاعة» — على شكل التطبيق المرجعيّ، والمنطقُ كلُّه في
// `lib/writeOffGrid.js` و`lib/lotPicker.js`. **هذا الملفُّ يرسم ولا يحسب.**
//
// 🔴 **ولا مورّدَ ولا خصمَ ولا نقلَ ولا دفع** — مقيسٌ من لقطات المرجع الخمس: ولا
// واحدٌ منها فيها، ومؤكَّدٌ من المالك. **والشطبُ بلا طرفٍ مقابل**، و«المبلغ» فيه
// تقييمُ خسارةٍ لا ثمنٌ متفاوَضٌ عليه — ولذلك هو أبيضُ محسوبٌ لا خانةَ إدخال.
//
// 🔴 **وعمودُ «الدفعة» إضافتُنا لا المرجع.** المرجعُ لا يعرف الدفعات إطلاقًا،
// **والشاشةُ تُرسل `lot_id` دائمًا** — فالأقدمُ افتراضًا اختيارٌ صريحٌ للأقدم لا
// غيابُ اختيار، والقاعدةُ ترفض ما عداه (`write_off_needs_lot`، ٠٩٦).
//
// ⚠️ **والانقسامُ و«إدخال من فاتورة» في ٤ب**، لا هنا.

const FIELD = 'h-7 rounded-none border border-[var(--rule)] bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring'

// المفتاحان اللذان يعنيان «لم نستطع الشرح» — وعندهما وحدَهما يظهر الرمزُ الخامّ.
const UNEXPLAINED = ['common:dbError.unexpected', 'common:dbError.ruleRefused']

// الضوابطُ المرسومةُ بلا وظيفة — **معطَّلةٌ وبسببٍ ظاهرٍ عند التحويم**، لا
// مخفيّةً ولا كاذبة. نفسُ قرار شاشة الطلب.
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

export default function WriteOffProductsScreen({
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
  const [docNumber, setDocNumber] = useState('')
  const [docDate, setDocDate] = useState(today())
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState(false)
  // ⚠️ **الأسطرُ المقصوصةُ تُذكَر ولا تُبتلع:** ملءٌ يعطي رقمًا أصغرَ ممّا في
  // الفاتورة **يُقرأ خطأً في الفاتورة** ما لم يُقَل إنه قُصَّ وعند أيّ حدّ.
  const [clipped, setClipped] = useState([])
  // ⚠️ **ملءٌ لم يملأ شيئًا يقول لماذا** — الصمتُ لا يُميّز «لا دفعاتٍ تطابق»
  // من «كلُّها مستنفَدة»، وكلاهما يبدو زرًّا لا يفعل.
  const [outcome, setOutcome] = useState(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState(null)

  const rows = useMemo(() => writeOffGridRows({
    selectedFolderIds: selected, categories, products, lots, movements, storageId, picks,
  }), [selected, categories, products, lots, movements, storageId, picks])

  // ⚠️ البحثُ يرشّح **المنتجاتِ وحدَها**، والمجلّدُ يبقى ما دام أحدُ أبنائه باقيًا
  // — مجلّدٌ يختفي وابنُه ظاهرٌ يترك صفًّا بلا عنوان.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (needle === '') return rows

    const kept = rows.filter((r) => r.kind === 'product' && String(r.name).toLowerCase().includes(needle))
    const folders = new Set(kept.map((r) => r.folderId))
    return rows.filter((r) => (r.kind === 'folder' ? folders.has(r.id) : kept.includes(r)))
  }, [rows, search])

  const total = useMemo(() => writeOffTotal(rows), [rows])
  const lines = useMemo(() => writeOffLinesFromGrid(rows), [rows])
  // ⚠️ يمنع بلوغَ القاعدة بكمّيّةٍ نعرف سلفًا أنها سترفَض — **والقاعدةُ تبقى
  // الضمانَ النهائيّ** لما لا تعرفه الشاشة (تبويبٌ قديم · شخصٌ ثانٍ سحب بيننا).
  const blocked = useMemo(() => writeOffBlocked(rows), [rows])

  // ⚠️ **المقارنةُ على المقصوص لا الخام**، وإلّا مرّ «١٢ » و«١٢» على أنهما رقمان.
  // والفراغُ لا يُقارَن أصلًا: مستندان بلا رقمٍ ليسا تكرارًا.
  const duplicateNumber = useMemo(() => {
    const typed = docNumber.trim()
    if (typed === '') return false
    return (documents || []).some((doc) => String(doc.doc_number ?? '').trim() === typed)
  }, [documents, docNumber])

  // ⚠️ **الدفعةُ والكمّيّةُ يُكتبان معًا دائمًا**، وإلّا ضاعت إحداهما عند تغيير
  // الأخرى. وصفُّ الجدول يحمل اختيارَه الحاليَّ فيُقرأ منه — **لا من حالةٍ
  // موازيةٍ قد تتباعد عنه.**
  function setPick(row, patch) {
    // ⚠️ **رسالةُ الرفض تُمسح عند أوّل تغييرٍ للمُدخَل.** بلا هذا تبقى ظاهرةً بعد
    // تصحيح الكمّيّة، **فتقول عن الحالة الحاليّة ما كان صحيحًا عن حالةٍ مضت** —
    // والقارئُ يظنّ التصحيحَ لم ينفع فيعيد المحاولةَ أو يستسلم.
    //
    // ⚠️ **وتُمسح على أيّ تغيير، لا على ما يبدو ذا صلة:** رسالةُ
    // `insufficient_stock` عن سطرٍ قد يزول بتعديل سطرٍ آخرَ تمامًا (تقليلُ
    // كمّيّةٍ يفرّغ دفعةً يستعملها غيرُه)، **و«أيُّ تعديلٍ يُبطلها» أصدقُ من
    // محاولة تتبّع أيُّها يخصّ أيًّا.**
    if (failure) setFailure(null)

    const current = row.picks[0] || {}
    setPicks({
      ...picks,
      [row.id]: [{ lotId: current.lotId ?? null, packages: current.packages ?? '', ...patch }],
    })
  }

  async function save() {
    setSaving(true)
    setFailure(null)

    const result = await postStockDocument({
      docType: 'write_off',
      storageId,
      docDate,
      // ⚠️ **الفراغُ يصل عدمًا لا نصًّا فارغًا** — القيدُ في ٠٩٨ يرفض `''`، وهو
      // موجودٌ كي يبقى لـ«بلا رقم» تهجئةٌ واحدة.
      docNumber: docNumber.trim() === '' ? null : docNumber.trim(),
      note: note.trim() === '' ? null : note.trim(),
      lines: lines.map((line) => ({
        product_id: line.productId,
        // 🔴 الدفعةُ ترافق كلَّ سطر — والقاعدةُ ترفض السطرَ بدونها.
        lot_id: line.lotId,
        quantity_base: line.quantityBase,
        entered_quantity: line.enteredQuantity,
        entered_uom: line.enteredUom,
      })),
    })

    setSaving(false)
    if (!result.ok) {
      setFailure({ key: 'products:writeOff.saveFailed', error: result.error })
      return
    }
    if (onSaved) onSaved()
    if (onClose) onClose()
  }

  if (loading) return <p className="p-4 text-sm text-muted-foreground">{t('common:loading')}</p>

  if (error) {
    return (
      <div className="m-4 border border-destructive/40 bg-destructive/10 p-3 text-sm">
        <p className="font-medium">{t('products:writeOff.loadFailedTitle')}</p>
        <p className="mt-1 text-muted-foreground">{dbErrorSentence(error, t)}</p>
      </div>
    )
  }

  // ------------------------------------------------------------------ النافذةُ الأولى
  //
  // **نفسُ نافذة التأشير المشتركة**، وعنوانُها يأتي من `OPERATION_LABEL_KEY`
  // بالبناء — مقيسٌ من اللقطة السادسة: «Select products for write-off products».
  if (step === 'folders') {
    const selectable = folderRows.filter((r) => r.selectable)

    return (
      <div className="flex h-full flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t('products:writeOff.pickHint')}</p>

        <div className="min-h-[280px] flex-1 overflow-y-auto border border-[var(--rule)] p-1">
          {selectable.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {t('products:writeOff.noFoldersHint')}
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
            <RefCancelButton onClick={onClose}>{t('products:writeOff.cancelButton')}</RefCancelButton>
            <RefActionButton disabled={!canOpenGrid(selected)} onClick={() => setStep('grid')}>
              {t('products:writeOff.selectButton')}
            </RefActionButton>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------ النافذةُ الثانية
  //
  // ستّةُ أعمدة: الخمسةُ من المرجع، **و«الدفعة» بينها** — لا في طرفها، لأنها
  // تُقرأ مع المتوفّر وقبل المبلغ الذي يشتقّ ثمنَه منها.
  const COLUMNS = 6

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        {/* ⚠️ **رقمُ مستند الشطب نفسِه، لا رقمُ مستند مورّد** — ولذلك لا يُرسل
            في `supplierDocNumber` (معناه «مستند مورّد»). **وهو حقلُ عرضٍ حتى
            ينزل عمودُه**، مقيسٌ عند المالك أنه يدويٌّ لا تلقائيّ. */}
        <label className="flex items-center gap-1.5 text-xs">
          {t('products:writeOff.docNumberLabel')}
          <Input
            className={FIELD}
            data-write-off-doc-number
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
          />
        </label>
        {/* 🔴 **تنبيهٌ لا منع** — قرارُ المالك، ومتّسقٌ مع `supplier_doc_number`
            بشاشة التوريد. **ولا قيدَ تفرّدٍ بالقاعدة**، فرقمٌ مكرَّرٌ مشروعٌ قد
            يكون مقصودًا، **وحجبُ الحفظ عليه يمنع عملًا صحيحًا لأجل شكٍّ.** */}
        {duplicateNumber && (
          <RefTag data-duplicate-doc-number>{t('products:writeOff.duplicateNumber')}</RefTag>
        )}
        <label className="flex items-center gap-1.5 text-xs">
          {t('products:writeOff.fromLabel')}
          <Input
            type="date"
            className={FIELD}
            max={maxDocumentDate()}
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
          />
        </label>
      </div>

      <div className="min-h-[240px] flex-1 overflow-auto border border-[var(--rule)]">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh>{t('products:writeOff.productColumn')}</RefTh>
              <RefTh className="w-24">{t('products:writeOff.packagesColumn')}</RefTh>
              <RefTh className="w-28">{t('products:writeOff.numberColumn')}</RefTh>
              <RefTh className="w-32">{t('products:writeOff.inStockColumn')}</RefTh>
              <RefTh className="w-64">{t('products:writeOff.lotColumn')}</RefTh>
              <RefTh className="w-28">{t('products:writeOff.amountColumn')}</RefTh>
            </tr>
          </RefHead>
          <tbody>
            {visible.map((row) => (row.kind === 'folder' ? (
              <RefGroupRow key={`f-${row.id}`} columns={COLUMNS} data-folder-row={row.id}>
                <span className="flex items-center gap-2">
                  {row.name}
                  {row.packages !== null && <RefTag>{t('products:writeOff.folderSum', { n: row.packages })}</RefTag>}
                  {row.childCount === 0 && <RefTag>{t('products:writeOff.folderEmpty')}</RefTag>}
                </span>
              </RefGroupRow>
            ) : (
              <RefRow key={row.id} data-product-row={row.id} data-locked={row.locked ? '' : undefined}>
                <RefTd>
                  <span className="flex items-center gap-2">
                    {row.name}
                    {/* 🔴 القاعدة (أ): **يُعرَض ولا يُشطب**، والشارةُ تقول لماذا
                        بدل أن تبدو الخانةُ معطَّلةً بلا سبب. */}
                    {row.locked && <RefTag>{t('products:writeOff.noStockTag')}</RefTag>}
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
                    {/* 🔴 «شطبُ الكلّ» = **إدخالُ المتوفّر، لا علامةٌ خاصّة.**
                        فيبقى مسارٌ واحدٌ للكمّيّة — والقاعدةُ تقرأ رقمًا كأيّ رقم.
                        ⚠️ **وبالعبوة لا بالوحدة الأساسيّة**، لأن الخانةَ عبوات:
                        كتابةُ المتوفّرِ الأساسيِّ فيها تضربه بمعامل التعبئة. */}
                    {!row.locked && (
                      <button
                        type="button"
                        data-fill-all={row.id}
                        title={t('products:writeOff.fillAllHint')}
                        className="h-7 shrink-0 border border-[var(--rule)] px-1.5 text-[11px] text-muted-foreground hover:bg-[var(--group)]"
                        onClick={() => setPick(row, { packages: String(row.inStockPackages) })}
                      >
                        {t('products:writeOff.fillAll')}
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
                        // ⚠️ `''` من المنسدل تعني «تلقائيّ» — تُحوَّل عدمًا هنا
                        // فلا تصل القاعدةَ نصًّا فارغًا يُحوَّل إلى `uuid`.
                        onChange={(e) => setPick(row, { lotId: e.target.value || null })}
                      >
                        {/* 🔴 **الافتراضُ، وأوّلُ خيارٍ في القائمة.** الشطبُ
                            العاديُّ لا يعيّن دفعةً، **والاستهدافُ يبقى متاحًا
                            لمن يريده** — قرارُ المالك بعد التراجع عن الإلزام. */}
                        <option value="">{t('products:writeOff.lotAuto')}</option>
                        {row.lots.map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {t('products:writeOff.lotOption', {
                              date: String(lot.receivedAt).slice(0, 10),
                              remaining: lot.remaining,
                              cost: lot.unitCost === null ? '—' : lot.unitCost,
                            })}
                          </option>
                        ))}
                      </select>
                      {/* ⚠️ **التقديرُ يُوسَم حيث يُقرأ الرقم** — «ما حدا بصالون
                          بيعرف شو التكلفة المقدَّرة»، فالشارةُ تُفتح عند الطلب. */}
                      {row.picks[0]?.costIsEstimated && (
                        <RefTag title={t('products:writeOff.estimatedHelp')}>
                          {t('products:writeOff.estimatedTag')}
                        </RefTag>
                      )}
                      {/* الرفضُ المرئيُّ قبل الإرسال: القاعدةُ آخرُ خطٍّ لا أوّلُه. */}
                      {/* ⚠️ **شارتان لا واحدة**، لأن المخرجَ يختلف: تجاوزُ دفعةٍ
                          بعينها يُحلّ بتبديلها أو بتقسيم السطر، **وتجاوزُ
                          الإجماليّ لا يُحلّ إلّا بإنقاص الكمّيّة.** */}
                      {row.picks[0]?.overRemaining && (
                        <RefTag data-over-remaining={row.id}>
                          {row.picks[0].auto
                            ? t('products:writeOff.overStockTag')
                            : t('products:writeOff.overRemainingTag')}
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
            placeholder={t('products:writeOff.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {/* 🔴 «إدخال من فاتورة» — **اختيارُ فاتورةِ توريدٍ هو اختيارٌ للدفعات التي
            ولّدها**، فهذا الزرُّ وعمودُ «الدفعة» وجهان لشيءٍ واحد. */}
        <button
          type="button"
          data-open-invoice-picker
          onClick={() => setPicking(true)}
          className="flex h-7 items-center gap-1 border border-[var(--rule)] px-2 text-xs hover:bg-[var(--group)]"
        >
          <FileInput className="size-3.5" />
          {t('products:writeOff.enterLabel')}
        </button>
        <ShellControl icon={FileSpreadsheet} label={t('products:writeOff.excelLabel')} why={t('products:writeOff.laterHint')} />
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold">
        {t('products:writeOff.totalLabel')}
        <span data-write-off-total>{total}</span>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        {t('products:writeOff.noteLabel')}
        <textarea rows={2} className={`${FIELD} h-auto py-1`} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {/* ⚠️ **يُقال أنّ الملءَ قُصَّ وعند أيّ حدّ** — رقمٌ أصغرُ ممّا في الفاتورة
          بلا تفسيرٍ يُقرأ خطأً في الفاتورة لا استهلاكًا سابقًا. */}
      {outcome && (
        <div className="border border-[var(--rule)] bg-[var(--group)] p-2 text-xs" data-fill-outcome data-fill-kind={outcome.kind}>
          {t(`products:writeOff.fill_${outcome.kind}`, outcome)}
        </div>
      )}

      {clipped.length > 0 && (
        <div className="border border-[var(--rule)] bg-[var(--group)] p-2 text-xs" data-clipped-notice>
          {t('products:writeOff.clippedNotice', { count: clipped.length })}
        </div>
      )}

      {failure && (
        <div className="border border-destructive/40 bg-destructive/10 p-2 text-xs" data-write-off-failure>
          <p>{t(failure.key)}</p>
          {failure.error && <p className="mt-1 text-muted-foreground">{dbErrorSentence(failure.error, t)}</p>}
          {/* 🔴 **الرمزُ الخامُّ يظهر حين تعجز الجملةُ عن التفسير، وحينها وحدَه.**
              وقعت فعلًا: رفضٌ صحيحٌ من القاعدة وصل الشاشةَ «صار خطأ غير متوقّع»،
              **فلم يُعرف أهو الرفضُ المتوقَّع أم عطلٌ آخر** — والعامّةُ أخفت
              التشخيصَ كما أخفت السبب.
              ⚠️ **ولا يُعرض مع جملةٍ مسمّاة:** عرضُ الداخليّات لمن أمامه جملةٌ
              مفهومةٌ هو بالضبط ما يوجد `dbErrors` لمنعه. **يظهر حين نكون قد فشلنا
              في الشرح، لا قبله.** */}
          {failure.error && UNEXPLAINED.includes(dbErrorKey(failure.error)) && (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground" data-db-code>
              {`${failure.error.code ?? '—'} · ${failure.error.message ?? '—'}`}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <RefCancelButton onClick={() => setStep('folders')}>{t('products:writeOff.backToFolders')}</RefCancelButton>
        <RefCancelButton onClick={onClose}>{t('products:writeOff.cancelButton')}</RefCancelButton>
        {/* ⚠️ **لا سطورَ = لا شطب**، والزرُّ معطَّلٌ بدل رسالةِ رفضٍ تشرح ما تقوله
            الشاشةُ أصلًا. */}
        <RefActionButton
          disabled={saving || lines.length === 0 || blocked}
          title={blocked ? t('products:writeOff.blockedHint') : undefined}
          onClick={save}
        >
          {t('products:writeOff.writeOffButton')}
        </RefActionButton>
      </div>

      {picking && (
        // ⚠️ **نفسُ النافذة المبنيّة لشاشة التوريد، بصفوفٍ محقونة** — لا نسخةٌ
        // ثانية. والمرشِّحاتُ الأربعةُ و`Shift/Ctrl` تعمل عليها كما هي.
        <InvoicePickerDialog
          kind="supply"
          rows={supplyPickerRows({ documents, lots, movements, suppliers, storageId })}
          suppliers={suppliers}
          onCancel={() => setPicking(false)}
          onSelect={(ids) => {
            const filled = fillFromSupplyInvoices({
              documentIds: ids, lots, movements, products, storageId,
            })
            // ⚠️ **يُدمج مع المكتوب ولا يمحوه:** مَن ملأ سطرًا بيده ثمّ استدعى
            // فاتورةً لا يريد أن يختفي عملُه — والمكتوبُ باليد أحدثُ من المُستدعى
            // إلّا حيث تقول الفاتورةُ عن نفس الدفعة.
            setPicks({ ...picks, ...filled.picks })
            setClipped(filled.clipped)
            // 🔴 **والملءُ الناقصُ كان صامتًا هنا أيضًا** — نفسُ الثقب، وجده
            // المالكُ في شاشة الإرجاع. **والعطلُ المصلَّحُ نقطيًّا يبقى نقطيًّا
            // حتى يُسأل: وين بيعيش كمان؟**
            setOutcome(fillReport(filled))
            setFailure(null)
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}

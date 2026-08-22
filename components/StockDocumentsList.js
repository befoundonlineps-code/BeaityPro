import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle, Undo2, Eye, ArrowRight, X } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { numberOrNull } from '../lib/decimalPlaces'
import { reverseStockDocument } from '../lib/stockIO'
import {
  EMPTY_FILTERS, filterDocuments, supplierFilterApplies, filterEmptyReason, FILTER_EMPTY,
  storageInForce,
} from '../lib/documentFilters'
import {
  sortDocuments, movementsOf, movementFrames, reversalState,
  documentProductNames, documentDate, documentTime, documentParties,
  costFrames, documentValue, documentValueLabel,
  cancellationState, visibleDocuments,
} from '../lib/stockDocumentList'
import { RECEIPT_TYPES, ISSUE_TYPES, OWN_FUNCTION, ORDER_DOC_TYPE } from '../lib/stockDocument'
// 🔴 **نفسُ الخريطة التي تقرأ منها الصفحةُ عنوانَ شريط شاشة الإنشاء.**
import { OPERATION_LABEL_KEY } from '../lib/productsOperations'
import { mergedRows, rowIsOrder, rowValue, orderViewLines } from '../lib/documentsWithOrders'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefFillerRow, RefTag } from './ref/RefGrid'
// 🔴 **`RefCancelButton` وحدَه — ولا `RefModal` ثانية، وهذا تصحيحٌ لخطّةٍ
// أُقرّت.** طُلبت النافذةُ بـ`RefModal` ووافقتُ، **ثمّ قِيس أن الصفحةَ تلفّ كلَّ
// عمليّةٍ بـ`RefModal` واحدةٍ أصلًا** (`pages/products/index.js:227`) — فهذه
// الشاشةُ **داخلها**، ونافذةٌ ثانيةٌ فوقها تعشيشُ حوارٍ في حوار.
//
// ⚠️ **وترويسةُ `InvoicePickerDialog` تقول إن ذلك كلّف جولةً كاملةً في هذا
// المشروع:** «تعشيشُ حوارٍ داخل حوارٍ يتنازع على بؤرة اللوحة». **وهي نفسُها
// حلّت هذه الحالةَ بلوحٍ مطلقِ الموضع لا بحوارٍ ثانٍ** — فالمظهرُ هو المطلوب
// والآليّةُ آمنة. ⇒ **نفسُ نمطها هنا: النيّةُ لم تتغيّر، والوسيلةُ فقط.**
import { RefCancelButton } from './ref/RefModal'
// 🔴 **الشكلُ وحدَه** — لا بنيةَ Dialog ولا Portal، بشرط المالك.
import RefChromeBar, { CHROME_TITLE, CHROME_CLOSE } from './ref/RefChromeBar'
// 🔴 **يوصَّل ما اكتمل، ولا يُنتظَر الأربعة.** الطلبيّةُ والشطبُ جاهزتان
// ومرّتا بحارس «غيرُ تفاعليٍّ بالبناء» — **والتوريدُ والإرجاعُ يبقيان على
// اللوح العامّ حتى تكتملا.** ⚠️ **والانتظارُ كان سيُفقد فائدةَ الدفع المبكر:**
// فحصُ كلّ شاشةٍ أوّلَ ما تجهز بدل مراجعةٍ واحدةٍ كبيرةٍ في الآخر.
import OrderDocumentView from './documentView/OrderDocumentView'
import WriteOffDocumentView from './documentView/WriteOffDocumentView'
import SupplyDocumentView from './documentView/SupplyDocumentView'
import ReturnDocumentView from './documentView/ReturnDocumentView'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

// The types the filter offers. Derived from the two lists that already decide
// what a document can be, plus the three with their own functions — rather
// than a fourth hand-typed list that drifts from them.
//
// 🔴 **وصارت قائمتين، والاشتقاقُ لم يعد كاملًا — وذلك مكتوبٌ لا مسكوتٌ عنه.**
//
// «طلب بضاعة» ليست قيمةً في `stock_doc_type` (التسعُ مقيسةٌ بـ٠٩٦ب)، **فلا
// اشتقاقَ يبلغها.** واستثناؤها من المرشِّح يترك فجوةً يلاحظها أوّلُ من يسأل
// «ليش ما بقدر أفلتر عالطلبيّات؟» — **وهي صفوفٌ كاملةُ الحقوق بقرار المالك.**
//
// ⚠️ **والثمنُ يُقال: تحديثٌ يدويٌّ إن أُضيف نوعٌ من خارج الـenum مستقبلًا.**
// وقُبل مقابل فجوةِ استخدامٍ حقيقيّة، **ولم يُقايَض بصمت.**
const DOC_TYPE_OPTIONS = [
  ...RECEIPT_TYPES, ...ISSUE_TYPES, ...OWN_FUNCTION,   // المشتقّةُ من الـenum
  ORDER_DOC_TYPE,                                      // وما ليس نوعَ مستندٍ أصلًا
]

// 🔴 **شبكةٌ لا بطاقات — والشبكةُ هي `RefGrid` القائمة، لا جدولٌ جديد.**
//
// ستُّ شاشاتٍ تستعملها اليوم (`ProductsBrowser` · الثلاثُ شاشاتِ إدخالٍ ·
// `OrderProductsScreen` · `InvoicePickerDialog`)، **وهذه آخرُ من بقي على
// البطاقات.** ⚠️ **وألوانُها زرقاءُ بحكم البنية لا بالمصادفة:**
// `--chrome: var(--primary)` **مربوطٌ لا منسوخ**، وبقيّةُ رموزها على درجةِ
// الأزرق نفسِها — **فشرطُ «شكلُ المرجع بألواننا» بنيةٌ قائمةٌ لا عملٌ يُطلب.**
//
// ⚠️ **والعددُ مُعلَنٌ مرّةً واحدةً** لأن `RefFillerRow` والخليّةَ الممتدّةَ
// يحتاجانه: رقمان متقابلان يتباعدان بصمت، **فتُرسم خانةٌ ناقصةٌ ولا شيءَ يشتكي.**
// **وصار ١١ بفصل «من/إلى» إلى عمودين**، وحارسُ التطابق مع عدد `<RefTh>` يمسك
// الفارقَ فورًا.
const COLUMNS = 11

// أزرارُ الإجراءات — أيقونةٌ بلا نصّ، **واسمُها مكتوبٌ لمن لا يرى الأيقونة.**
//
// 🔴 **زرٌّ بأيقونةٍ وحدَها بلا اسمٍ مقروءٍ هو زرٌّ بلا اسم** — والنصُّ كان
// ظاهرًا («عكس») قبل الشبكة. **فالمفتاحُ نفسُه يذهب إلى `aria-label` و`title`
// معًا**: الأوّلُ لقارئ الشاشة والثاني للتحويم، **ولا كلمةَ عربيّةٌ جديدةٌ
// تُخترع للأيقونة.**
const ICON_BUTTON = 'inline-flex size-5 items-center justify-center border border-[var(--rule)] text-muted-foreground hover:text-foreground disabled:opacity-40'

// The documents that have been posted, newest first, and one thing to do with
// them: undo one.
//
// ⚠️ This is a condition of the module being usable, not a convenience. Without
// it a document posted wrongly is permanent and invisible, and somebody who
// cannot correct a mistake works around it — a fake issue to cancel it out,
// which corrupts the ledger, or a hand-edited row, which corrupts the principle
// the whole module rests on. Two documents were already posted with a zero cost
// before the screen that could undo them existed.
//
// Narrow on purpose: no paging, no filters, no search. Those arrive when the
// number of documents asks for them. Reversal was needed with the first wrong
// one.
export default function StockDocumentsList({
  documents, movements, products, storages, suppliers, storageId, loading, error, reload,
  // 🔴 **المصدرُ الثاني.** `product_orders` جدولٌ منفصلٌ تمامًا، **ومحمَّلٌ في
  // الصفحة أصلًا** — فلا استعلامَ جديد. والمواصفةُ في
  // `design/documents-with-orders-spec.md`.
  orders, orderLines,
  // ⚠️ **لشاشات العرض وحدَها** — التصنيفاتُ للتجميع، والدفعاتُ لتفصيل الشطب
  // (د/٣). **وكلتاهما محمَّلةٌ للصفحة أصلًا**، فلا استعلامَ جديد.
  categories, lots,
  // ⚠️ **لعمود «الرصيد الحاليّ»/«المتوفر»** — يُعرض في شاشات العرض كما في
  // شاشات الإنشاء بقرار المالك. **ومحمَّلةٌ للصفحة أصلًا.**
  balances,
  // ⚠️ **لصفوف الحشو في شاشات العرض** — مجلّداتُ المستودع، وهي ما تبني منه
  // شاشةُ الإنشاء جدولَها. **والسطورُ الحقيقيّةُ لا تعتمد عليها إطلاقًا**، وهو
  // شرطُ المالك: «سطور المستند الحقيقية هي المرجع الأساسي… وكتالوج اليوم
  // يُستخدم بعدها بس لملء الصفوف الباقية».
  storageCategories,
  // 🔴 **مقبضُ الخروج كان موجودًا وغيرَ موصولٍ بهذه الشاشة وحدَها.**
  // `closeOperation` مبنيٌّ في الصفحة وتأخذه كلُّ عمليّةٍ أخرى — **وهذه لم
  // تأخذه**، وهو الصنفُ نفسُه الذي جعل `return_to_supplier` ترسم شاشتين.
  onClose,
}) {
  const { t } = useTranslation(['products', 'common'])

  // 🔴 **مستندٌ واحدٌ معروضٌ لا مجموعةُ مفتوحين.** كان `Set` لأن الطيَّ كان في
  // مكانه، **واللوحُ يعرض واحدًا** — فمجموعةٌ هنا تعني حالةً لا يمكن أن تُرسم.
  const [viewing, setViewing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const [filters, setFilters] = useState(EMPTY_FILTERS)

  // 🔴 **مؤشَّرةٌ افتراضيًّا، كـ`hideArchived`** — والملغى ضجيجٌ في القائمة
  // اليوميّة، **وليس سرًّا**: رفعُ التأشير يعيده مع عاكسه.
  const [hideCancelled, setHideCancelled] = useState(true)

  // 🔴 **سببُ الإلغاء إلزاميّ، ويسافر في `p_note`** — ولا عمودَ جديدَ له.
  // ⚠️ **والإلزامُ على المقصوص لا الخام**، وإلّا مرّت مسافةٌ سببًا.
  const [reason, setReason] = useState('')

  // ⚠️ A WIDENING, NOT A SECOND STORAGE PICKER — and the first attempt was the
  // second storage picker, which is the fault this whole stage exists to remove.
  //
  // Seeding the filter from the lens once left TWO storage controls on this tab:
  // the lens in the header and a picker in the toolbar. Worse, the seeded copy
  // did not follow the lens, so changing storage in the header while reading
  // documents changed nothing at all — a control that looks like it worked while
  // the content does not follow, which is the class closed in the stocktake one
  // round ago wearing a different screen.
  //
  // So the storage is not this screen's state at all. It follows the lens, and
  // the only thing kept here is whether to look PAST it — the one screen where
  // "all storages" is a real question rather than an implicit choice. The lens
  // says where somebody is working; this asks what happened in the salon.
  //
  // ⚠️ And the widening is deliberately lost on leaving the tab. The page
  // unmounts each view, which destroyed work in the stocktake and is right here:
  // the difference is whether the state is WORK SOMEBODY DID or A VIEW THEY
  // CHOSE. A count is the first; "show me everywhere for a moment" is the second.
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  // ⚠️ NARROWED HERE, IN MEMORY — never in the query, and this is a safety
  // property rather than a preference. reversalState below is handed
  // `documents` (the whole loaded set) and not `rows`: a reversal filtered out
  // of the view must still answer "was this reversed?". Filtering in the query
  // would drop it from both, the button would light up on an already-reversed
  // document, and the database would refuse with a sentence this screen never
  // expected. Measured in lib/documentFilters.test.js.
  // One object, so the table, the empty-state reason and the toolbar cannot
  // disagree about which storage is in force.
  const inForce = { ...filters, storageId: storageInForce(storageId) }

  // 🔴 **المصدران يُدمجان قبل كلِّ شيء، ثمّ لا يُسأل عنهما مرّةً أخرى.**
  //
  // الطلبيّةُ مقولَبةٌ على شكل المستند، **فالترشيحُ والترتيبُ والإخفاءُ
  // والحالةُ الفارغةُ كلُّها تعمل عليها بلا فرعٍ يُكتب لها.** ⚠️ **ويُمرَّر
  // `all` لا `documents` إلى ما يسأل عن المجموعة كاملةً** — وإلّا صار للشاشة
  // مفهومان لكلمة «الكلّ».
  const all = mergedRows({ documents, orders, orderLines })

  // ⚠️ **الإخفاءُ بعد الترشيح وقبل الحالة الفارغة**، فرسالةُ «لا نتائج» تصف ما
  // يراه المستخدمُ فعلًا. ويُمرَّر `all` كاملةً لا `rows` — عاكسٌ رشّحه
  // مرشِّحُ النوعِ خارجًا يجعل أصلَه يبدو حيًّا.
  const matched = sortDocuments(filterDocuments(all, inForce))
  const rows = visibleDocuments(matched, all, hideCancelled)
  const hiddenCount = matched.length - rows.length
  const emptyKind = filterEmptyReason({ documents: all, filtered: rows, filters: inForce })
  const supplierUsable = supplierFilterApplies(filters.docType)
  const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
  const nameOf = (list, id) => (list || []).find((x) => x.id === id)?.name || '—'

  // متى يُقال للمستخدم إن الطلبيّاتِ غائبةٌ عمدًا — والشرحُ عند موضع الرسم.
  const ordersHidden = !!inForce.storageId && (orders || []).length > 0

  // الصفُّ المعروضُ يُقرأ من المجموعة الكاملة لا من الصفوف — فتغييرُ مرشِّحٍ
  // واللوحُ مفتوحٌ لا يُفرّغه من محتواه.
  const viewed = viewing ? all.find((d) => d && d.id === viewing) : null

  // 🔴 **أيُّ عمليّةٍ لهذا الصفّ شاشةُ عرضٍ خاصّة؟** — تُحسب مرّةً وتُقرأ مرّتين:
  // للعنوان، ولإخفاء زرّ الإغلاق السفليّ.
  //
  // ⚠️ **والقيمةُ اسمُ العمليّة لا نوعُ المستند** (`orders` لا `order`)، لأنها
  // مفتاحُ `OPERATION_LABEL_KEY` — **وهو ما تقرأ منه الصفحةُ عنوانَ شريط شاشة
  // الإنشاء** (`pages/products/index.js:231`). ⇒ **مصدرٌ واحدٌ للعنوانين.**
  //
  // ⚠️ **والسببُ الثاني أن الشاشاتِ الأربعَ ترسم أزرارَها هي** (ديكورًا بلا
  // وظيفة، بقرار المالك) — **فزرُّ إغلاقٍ حقيقيٌّ تحتها زرٌّ خامسٌ لا وجودَ له
  // في شاشة الإنشاء.** والمَخرجُ الحقيقيُّ صار `×` في الشريط.
  const dedicatedOperation = !viewed ? null
    : rowIsOrder(viewed) ? 'orders'
      : ['write_off', 'supply', 'return_to_supplier'].includes(viewed.doc_type) ? viewed.doc_type
        : null

  // 🔴 **عنوانُ اللوح = نصُّ شريط شاشة الإنشاء نفسِه، لا نصٌّ ثانٍ يشبهه.**
  //
  // **قرارُ المالك:** «العنوان = نص شريط شاشة الإدخال الحقيقي بالضبط».
  //
  // ⚠️ **وكان يُقرأ من `docs.<type>.title` — فتطابق ثلاثةٌ وافترقت الطلبيّة:**
  // «طلب بضاعة» مقابل «الطلبيّات». **والمصدرُ الواحدُ يُلغي الافتراقَ بنيويًّا
  // بدل أن يُعلنه ويحرسه** — فلا مقارنةَ تُكتب ولا حارسَ يُنتظر منه أن يُمسك
  // تباعدًا، **لأن التباعدَ غيرُ ممكن.**
  //
  // ⚠️ **و`docs.<type>.title` يبقى حيث هو صحيح** — مرشِّحُ النوع (`:350`)
  // وخليّةُ النوع في الصفّ (`:513`) ونافذةُ تأكيد العكس: **هناك «طلب بضاعة»
  // اسمُ ما يُقرأ، وهنا «الطلبيّات» اسمُ الشاشة التي تُنشئه.**
  const panelTitle = !viewed ? ''
    : dedicatedOperation
      ? t(`products:secondaryItems.${OPERATION_LABEL_KEY[dedicatedOperation]}`)
      : t(`products:docs.${viewed.doc_type}.title`)

  async function confirmReverse() {
    if (!confirming) return
    setBusy(true)
    setActionError('')
    // 🔴 **السببُ يصل القاعدةَ فعلًا، لا يبقى في الشاشة.** `p_note` موجودٌ في
    // توقيع الدالّة منذ بنائها، **فالإلزامُ واجهةٌ والحفظُ قائم.**
    const { ok, error: rpcError } = await reverseStockDocument({
      documentId: confirming.id, note: reason.trim(),
    })
    setBusy(false)
    if (!ok) {
      setActionError(rpcError
        // ⚠️ 23505 here has one meaning and it is not "that already exists".
        // reverse_stock_document checks already_reversed BEFORE it takes its
        // lock, so two attempts at once both read "not reversed" — and the
        // unique index on reverses_document_id is what stops the second from
        // doubling the correction (item 51). Whoever sees this did nothing
        // wrong and has no data to review: the document was reversed a moment
        // ago somewhere else, and reloading shows it.
        ? dbErrorSentence(rpcError, t, 'StockDocumentsList.reverse', {
          23505: 'products:stock.reversedElsewhere',
        })
        : t('products:stock.noRowsError'))
      return
    }
    setConfirming(null)
    setReason('')
    reload()
  }

  // ⚠️ **يُفرَّغ عند الفتح والإغلاق معًا**: سببٌ باقٍ من إلغاءٍ سابقٍ يُرسَل
  // على مستندٍ آخرَ بلا أن يقرأه أحد — **حقلٌ ممتلئٌ سلفًا يُقرأ مكتوبًا.**
  function openConfirm(doc) {
    setConfirming(doc)
    setReason('')
    setActionError('')
  }
  function closeConfirm() {
    setConfirming(null)
    setReason('')
    setActionError('')
  }

  // ⚠️ Unit first, number second — every quantity, everywhere.
  //
  // "5 عبوات" versus "5 عبوة" is a grammar branch we refuse to have, so the
  // number never governs the word after it (CLAUDE.md). And both frames are
  // shown because neither alone is honest: the person who typed 5 does not
  // recognise 75, and 5 cannot be added to a line entered in pieces.
  function quantityText(movement) {
    const product = productsById[movement.product_id]
    const f = movementFrames(movement, product)
    const baseText = t('products:documents.inBase', {
      unit: t(`products:units.${f.baseUnit || 'pcs'}`),
      n: f.base,
    })
    if (f.entered === null || f.sameFrame) return baseText
    return `${t('products:documents.inEntered', {
      uom: t(`products:docs.uom_${f.uom}`), n: f.entered,
    })} · ${baseText}`
  }

  // ⚠️ The same rule as quantityText, on the other half of the line — the rule
  // is about every NUMBER, not every quantity. "تكلفة الوحدة: 100 ₪" named no
  // unit while the quantity two centimetres away named both, and unit_cost is
  // per BASE unit, so on a product of 15 per package the figure is 6.6667 and
  // not the 100 somebody typed.
  //
  // The unit is named and nothing is derived — see costFrames for why the
  // typed price is not reconstructed here.
  function costText(movement) {
    const c = costFrames(movement, productsById[movement.product_id])
    if (!c) return null
    return t('products:documents.unitCost', {
      unit: t(`products:units.${c.baseUnit || 'pcs'}`),
      price: c.base.toLocaleString('ar', { maximumFractionDigits: 4 }),
    })
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{t('common:loading')}</div>
  }

  return (
    // ⚠️ `relative` **حاملةٌ لا تزيين:** لوحُ «مشاهدة» أدناه `absolute inset-0`،
    // **وبلا أبٍ موضَّعٍ يقيس نفسَه على `RefModal`** فيغطّي شريطَ عنوانها
    // وزرَّ إغلاقها معًا.
    <div className="relative flex flex-col gap-4">
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-sm font-medium text-destructive">{t('products:loadFailedTitle')}</span>
          <span className="text-xs text-muted-foreground">
            {dbErrorSentence(error, t, 'StockDocumentsList.load')}
          </span>
          <Button type="button" variant="outline" size="sm" className="ms-auto" onClick={reload}>
            {t('products:retry')}
          </Button>
        </div>
      )}

      {/* 🔴 **مَخرجٌ مُسمًّى — و`×` كان موجودًا ولم يُقرأ مَخرجًا.**
          `RefModal` تضع زرَّ إغلاقٍ في شريطها بـ`aria-label` صحيح، **فالشاشةُ
          لم تكن بلا مَخرجٍ قطّ** — لكنّ أيقونةً في شريطٍ ملوّنٍ تُقرأ زينةً،
          والمالكُ خرج بالضغط خارج اللوح. ⇒ **زرٌّ بكلمةٍ لا يلغي `×` بل يسمّيه**،
          وأثرُهما واحد: `closeOperation` نفسُها.
          ⚠️ **ولا `router.back()`:** العمليّةُ محمولةٌ في `?op=`، فالإغلاقُ
          يعيد إلى الكتالوج بالبنية — **ودخولٌ مباشرٌ أو تحديثٌ لا يتركان تاريخًا
          يُرجَع إليه**، وهو الفخُّ الذي حذّرت منه المراجعة. */}
      {onClose && (
        <div>
          <Button type="button" variant="outline" size="sm" data-documents-back onClick={onClose}>
            <ArrowRight className="size-3.5" />
            {t('products:documents.backButton')}
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground">{t('products:documents.hint')}</p>

      {actionError && <div className="text-sm text-destructive">{actionError}</div>}

      {/* ⚠️ The supplier control is DISABLED for a type that cannot have one,
          not silently ignored. A filter that is ignored is a filter that lies:
          it shows rows that do not match what was asked and nothing says so.
          Same language the reference uses when it dims the document buttons
          under «all storages». */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('products:documents.filterFrom')}
          <input type="date" className={'h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50'}
            value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('products:documents.filterTo')}
          <input type="date" className={'h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50'}
            value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('products:documents.filterType')}
          <select className={'h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50'}
            value={filters.docType} onChange={(e) => setFilter('docType', e.target.value)}>
            <option value="">{t('products:documents.filterAll')}</option>
            {DOC_TYPE_OPTIONS.map((k) => (
              <option key={k} value={k}>{t(`products:docs.${k}.title`)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('products:documents.filterNumber')}
          <input className={'h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50'} value={filters.docNumber}
            onChange={(e) => setFilter('docNumber', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('products:documents.filterSupplier')}
          <select className={'h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50'} disabled={!supplierUsable}
            title={supplierUsable ? undefined : t('products:documents.filterSupplierNa')}
            value={supplierUsable ? filters.supplierId : ''}
            onChange={(e) => setFilter('supplierId', e.target.value)}>
            <option value="">{t('products:documents.filterAll')}</option>
            {(suppliers || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        {/* 🔴 **خانةٌ لا مرشِّح**، ولذلك ليست في `EMPTY_FILTERS`: «امسح
            المرشِّحات» يوسّع البحث، **وإظهارُ الملغاة ليس توسيعًا بل تبديلُ
            سؤال.** ولو كانت فيها لأعادها المسحُ إلى «مخفيّة» فبدت الخانةُ
            تُلغي نفسَها. */}
        {/* ⚠️ **الاثنان معًا في طرفٍ واحد، و`ms-auto` هي التي تدفعهما** — لا
            عرضٌ مثبَّتٌ ولا ترتيبٌ يعتمد على عدد الحقول قبلهما. **وفي RTL يقع
            الطرفُ يسارًا** كما طُلب، بلا `left` مكتوبةٍ بيدٍ تنقلب لو صار
            للشاشة اتّجاهٌ ثانٍ يومًا. */}
        <div className="ms-auto flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm"
            onClick={() => setFilters(EMPTY_FILTERS)}>
            {t('products:documents.filterClear')}
          </Button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              data-hide-cancelled
              checked={hideCancelled}
              onChange={(e) => setHideCancelled(e.target.checked)}
            />
            {t('products:documents.hideCancelled')}
          </label>
        </div>
        {/* ⚠️ **العددُ المخفيُّ يُقال، وإلّا بدا الإخفاءُ نقصًا في البيانات.**
            وهو الفرقُ بين «ما في مستندات» و«في مستنداتٌ لا تراها الآن».
            **وسطرٌ كاملٌ له لا ذيلٌ في صفّ المرشِّحات** — جملةٌ تُقرأ لا وسمٌ
            يتزحلق بين حقلين. */}
        {hideCancelled && hiddenCount > 0 && (
          <p className="w-full text-xs text-muted-foreground" data-hidden-count={hiddenCount}>
            {t('products:documents.hiddenCancelled', { n: hiddenCount })}
          </p>
        )}
        {/* 🔴 **شرطُ قرار د/١، لا زينةٌ بعده.** اختار المالكُ أن تختفي
            الطلبيّاتُ مع مرشِّح المستودع كأيّ معاملةٍ أخرى — **وقرأ معه الشرطَ
            المكتوبَ داخل الخيار: «يجب أن يقول شيءٌ للمستخدم لماذا اختفت،
            وإلّا كان صمتًا».**
            ⚠️ **والصياغةُ تقول سببَها لا حالتَها** — نصُّها في
            `documents.ordersHiddenByStorage`، **ولا يُنسَخ هنا**: جملةٌ
            مقتبسةٌ في تعليقٍ نسخةٌ ثانيةٌ تتباعد عن الأولى، **وتُقرأ ادّعاءً عن
            طورِ المشروع بدل أن تُقرأ نصًّا للمستخدم.** */}
        {ordersHidden && (
          <p className="w-full text-xs text-muted-foreground" data-orders-hidden>
            {t('products:documents.ordersHiddenByStorage')}
          </p>
        )}
      </div>


      {rows.length === 0 ? (
        <div className="flex flex-col gap-1 py-10 text-center text-sm text-muted-foreground">
          {/* ⚠️ Three empty states, not one. «none yet» sends somebody to post a
              document, «nothing matched» sends them to widen the filter — and
              the third is the case where widening the SUPPLIER cannot help at
              all, because nothing recorded is of a type that can carry one. It
              is not the same as this supplier having no documents, which is an
              ordinary no-match; see filterEmptyReason for the boundary. */}
          {emptyKind === FILTER_EMPTY.NO_SUPPLIER_DOCS ? (
            <span>{t('products:documents.emptyNoSupplierDocs')}</span>
          ) : emptyKind === FILTER_EMPTY.NO_MATCH ? (
            <>
              <span>{t('products:documents.emptyNoMatchTitle')}</span>
              <span className="text-xs">{t('products:documents.emptyNoMatchHint')}</span>
            </>
          ) : (
            <>
              <span>{t('products:documents.emptyTitle')}</span>
              <span className="text-xs">{t('products:documents.emptyHint')}</span>
            </>
          )}
        </div>
      ) : (
        <div className="min-h-[220px] overflow-auto border border-[var(--rule)]">
          <RefTable>
            <RefHead>
              <tr>
                <RefTh>{t('products:documents.colType')}</RefTh>
                <RefTh>{t('products:documents.colNumber')}</RefTh>
                <RefTh>{t('products:documents.colDate')}</RefTh>
                {/* 🔴 **عمودان صريحان لا خليّةٌ واحدة** — والاتّجاهُ هو المعنى:
                    «من مورّدٍ إلى مستودع» و«من مستودعٍ إلى مورّد» يرسمان نفسَ
                    الاسمين ويقولان شيئين متضادّين. */}
                <RefTh>{t('products:documents.colFrom')}</RefTh>
                <RefTh>{t('products:documents.colTo')}</RefTh>
                <RefTh>{t('products:documents.colNote')}</RefTh>
                <RefTh>{t('products:documents.colValue')}</RefTh>
                <RefTh>{t('products:documents.colPaid')}</RefTh>
                {/* 🔴 **بعيدًا عن عمود التاريخ عمدًا.** مجاورتُهما تجعلهما
                    يُقرآن نصفَي ختمٍ زمنيٍّ واحد **وهما سؤالان مختلفان**:
                    التاريخُ يومٌ اختاره إنسانٌ وقابلٌ للتأريخ للوراء، وهذا
                    لحظةُ التسجيل. **وملاصقتُهما تعرض لحظةً لم توجد قطّ.** */}
                <RefTh>{t('products:documents.colRecordedAt')}</RefTh>
                <RefTh>{t('products:documents.colStatus')}</RefTh>
                <RefTh>{t('products:documents.colActions')}</RefTh>
              </tr>
            </RefHead>
            <tbody>
              {rows.map((doc) => {
                // ⚠️ **والطلبيّةُ لا حركاتٍ لها إطلاقًا، فعددُ سطورها محفوظٌ
                // على الصفّ** — و`movementsOf` كانت سترجع صفرًا صادقًا عن
                // الحركات وكاذبًا عن السطور.
                const lines = movementsOf(movements, doc.id)
                const lineCount = rowIsOrder(doc) ? doc.order_line_count : lines.length
                const state = reversalState(doc, all)
                const cancel = cancellationState(doc, all)
                // ⚠️ **المجموعةُ كاملةً لا الصفوف** — العاكسُ يقرأ أصلَه عبر
                // `reverses_document_id`، **وأصلٌ رشّحه مرشِّحُ النوعِ خارجًا
                // يجعل العاكسَ بلا اتّجاه.** نفسُ سبب `cancellationState`.
                const parties = documentParties(doc, { storages, suppliers, allDocuments: all })
                // ⚠️ **مصدران، وفرعٌ واحدٌ في المكتبة لا في الخليّة** —
                // المستندُ يشتقّها من حركاته والطلبيّةُ لا حركةَ لها إطلاقًا.
                const value = rowValue(doc, documentValue(movements, doc.id, productsById))
                // 🔴 **الغيابُ يُفحَص قبل `toLocaleString`** — `Number(null)`
                // ترجع «٠٫٠٠ ₪»، وهو الصنفُ المؤجَّلُ على أربع شاشاتٍ أخرى.
                const paid = numberOrNull(doc.paid_amount)

                return (
                  <RefRow
                    key={doc.id}
                    data-doc-id={doc.id}
                    data-doc-type={doc.doc_type}
                    // 🔴 **مميِّزُ الجدول — والخطرُ ليس التصادم.** `uuid` يجعل
                    // تصادمَ المُعرِّفات مهملًا، **والخطرُ أن قارئَ `data-doc-id`
                    // مجرَّدةً لا يعرف من أيّ جدولٍ هي** — ⚠️ **وذلك في كلِّ
                    // مرّةٍ لا احتمالٌ نادر.** فالعلاجُ ضرورةٌ لا احتياط.
                    data-row-kind={rowIsOrder(doc) ? 'order' : 'document'}
                    data-cancelled={cancel.cancelled ? cancel.kind : undefined}
                    className={cancel.cancelled ? 'opacity-60' : ''}
                  >
                    {/* ⚠️ Identity on the row, not position. Every false check
                        this session came from the browser drive, and the last
                        one named the cause exactly: it pressed "the first
                        enabled reverse button", which describes where a thing
                        is rather than which thing it is — so it targeted the
                        wrong document and reported a defect in working code.
                        Worse in the other direction: the same selection can
                        find what it expected on a document it did not mean and
                        announce a success that never happened.

                        This is "write the condition, not the count" on the DOM.
                        🔴 **والملغى مميَّزٌ بصريًّا ولا يُلخبط بالشغّال** —
                        باهتٌ ومشطوبُ العنوان، **وليس مخفيًّا حين يُطلَب
                        عرضُه.** */}
                      <RefTd>
                        <span className={cancel.cancelled ? 'line-through' : ''}>
                          {t(`products:docs.${doc.doc_type}.title`)}
                        </span>
                        {/* ⚠️ **لاحقةٌ لا عمود.** «كم سطرًا» ليس ما يبحث عنه
                            أحدٌ يفتح قائمةَ مستندات، **وعمودٌ كاملٌ له يزاحم
                            ما يُبحَث عنه فعلًا.** */}
                        {' '}
                        <span className="text-[10px] text-muted-foreground">
                          {t('products:documents.lineCount', { n: lineCount })}
                        </span>
                      </RefTd>

                      {/* 🔴 **رقمُ المستند عمودًا** — كان لا يُعرض إطلاقًا قبل
                          جولةٍ واحدة، **وهو المقبضُ البشريُّ الذي بُني ٠٩٨
                          لأجله**: مستندان بنفس التاريخ والمستودع والمورّد لا
                          يفترقان بغيره. */}
                      <RefTd data-doc-number={doc.doc_number || undefined}>
                        {doc.doc_number || '—'}
                      </RefTd>

                      <RefTd>{documentDate(doc.doc_date) || '—'}</RefTd>

                      {/* 🔴 **والجردُ يمتدّ على العمودين بخليّةٍ واحدة** — لأنه
                          يحمل الاتّجاهين في مستندٍ واحد (شامبو −٢ وباكيج +٥
                          بنفس المستند، مقيسًا)، **فوضعُ مستودعه في «من» يجعله
                          يُقرأ صادرًا وهو نصفُه وارد.**
                          ⚠️ **والامتدادُ يُشرَح ولا يُترك يُقرأ خللَ رسم** —
                          «الاتّجاه في السطور» جملةٌ تقول لماذا اختفى العمود.
                          ⚠️ **ولا سهمَ بين اسمين:** السهمُ محايدٌ فيأخذ اتّجاهَ
                          الفقرة **وينقلب النصفان على الشاشة والـDOM سليم** —
                          وهو ما بُني `timeRangeDirection` لأجله. فالعمودان
                          يفصلان بلا حرفٍ بينهما. */}
                      {parties.directional ? (
                        <>
                          <RefTd data-party-from={parties.from || undefined}>
                            {parties.from || '—'}
                          </RefTd>
                          <RefTd data-party-to={parties.to || undefined}>
                            {parties.to || '—'}
                          </RefTd>
                        </>
                      ) : (
                        <RefTd colSpan={2} data-party-perline={doc.id}>
                          {parties.from || '—'}
                          {' '}
                          <span className="text-[10px] text-muted-foreground">
                            {t('products:documents.directionInLines')}
                          </span>
                        </RefTd>
                      )}

                      {/* 🔴 **وعلى صفِّ العاكس هذه الخانةُ هي سببُ الإلغاء** —
                          السببُ الإلزاميُّ يسافر في `p_note` إلى مستند
                          التصحيح، **فيصير مقروءًا في القائمة بلا فتحِ شيء.**
                          وهو حرفيًّا ما وعدت به رسالةُ الإلزام: «بينحفظ مع
                          مستند التصحيح وبينقرا بعد أشهر». */}
                      <RefTd className="max-w-[16rem] truncate" title={doc.note || undefined}>
                        {doc.note || '—'}
                      </RefTd>

                      {/* 🔴 **الترويسةُ «القيمة» والكلمةُ الخاصّةُ داخلَ
                          الخليّة.** الرقمُ متطابقُ الشكل في كلّ الأنواع
                          (`documentValue` تُرجع الجانبَ الأثقل)، **فالكلمةُ
                          وحدَها تمنع صفرَ النقل وصفرَ التوريد المسموم من أن
                          يُقرآ الشيءَ نفسَه** — والثاني توقيعُ العطل الذي
                          استهلك الموديولَ كلَّه.
                          ⚠️ **وترويسةٌ تقول «مبلغ» تدّعي مالًا دُفع** — ولا
                          مالَ في نقلٍ ولا في جرد. */}
                      <RefTd>
                        {value === null ? '—' : (
                          <span className="flex flex-col leading-tight">
                            <span>
                              {t('products:documents.money', {
                                total: value.toLocaleString('ar', { maximumFractionDigits: 2 }),
                              })}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {t(documentValueLabel(doc.doc_type))}
                            </span>
                          </span>
                        )}
                      </RefTd>

                      <RefTd data-paid-for={paid === null ? undefined : doc.id}>
                        {paid === null ? '—' : t('products:documents.money', {
                          total: paid.toLocaleString('ar', { maximumFractionDigits: 2 }),
                        })}
                      </RefTd>

                      <RefTd>{documentTime(doc.created_at) || '—'}</RefTd>

                      {/* 🔴 **والزوجُ يقول أيَّ نصفٍ هو** — «ملغى» على الأصل
                          و«تصحيح» على العاكس، **فلا يُقرأ العاكسُ عمليّةً
                          مستقلّة.** */}
                      <RefTd>
                        {cancel.kind === 'original' && (
                          <span data-status="cancelled">
                            <RefTag className="border-destructive/50 text-destructive">
                              {t('products:documents.cancelledBadge')}
                            </RefTag>
                          </span>
                        )}
                        {cancel.kind === 'reversal' && (
                          <span data-status="reversal">
                            <RefTag>{t('products:documents.isReversalBadge')}</RefTag>
                          </span>
                        )}
                        {!cancel.cancelled && '—'}
                      </RefTd>

                      <RefTd>
                        <span className="flex items-center gap-1">
                          {/* 👁 يفتح لوحًا لا يوسّع الصفَّ — **ومستندٌ بعشرين
                              سطرًا كان يدفع كلَّ ما بعده خارج الشاشة.** */}
                          <button
                            type="button"
                            data-view-for={doc.id}
                            aria-label={t('products:documents.viewButton')}
                            title={t('products:documents.viewButton')}
                            className={ICON_BUTTON}
                            onClick={() => setViewing(doc.id)}
                          >
                            <Eye className="size-3" />
                          </button>

                          {/* 🔴 **يُخفى لا يُعطَّل** — قرارُ المالك على الأنواع
                              التي لا تُعكَس (`sale` · `service_consumption` ·
                              `reversal`) وعلى الملغى.
                              ⚠️ **والفرقُ حقيقيّ:** زرٌّ معطَّلٌ يقول «هذا
                              ممكنٌ لكن ليس الآن» فيُجرَّب مرارًا، **وغيابُه
                              يقول «ليس من هنا»** — ولهذه الأنواع مسارُ تصحيحٍ
                              آخرُ بالكامل. */}
                          {state.canReverse && (
                            <button
                              type="button"
                              data-reverse-for={doc.id}
                              disabled={busy}
                              aria-label={t('products:documents.reverseButton')}
                              title={t('products:documents.reverseButton')}
                              className={ICON_BUTTON}
                              onClick={() => openConfirm(doc)}
                            >
                              <Undo2 className="size-3" />
                            </button>
                          )}
                        </span>
                      </RefTd>
                  </RefRow>
                )
              })}
              {/* 🔴 **المساحةُ الفارغةُ تحتفظ بأعمدتها** — بلا هذا الصفّ تقف
                  الخطوطُ عند آخر مستندٍ فتُقرأ شبكةٌ نصفَ محمَّلةٍ لوحًا أبيض،
                  **وهي نفسُ صورةِ شاشةٍ فشل تحميلُها.** */}
              <RefFillerRow columns={COLUMNS} />
            </tbody>
          </RefTable>
        </div>
      )}

      {/* 🔴 **لوحُ «مشاهدة» — للقراءة فقط، وصفرُ حقولِ إدخال.**
          والطيُّ في مكانه كان يدفع كلَّ ما بعد المستند خارجَ الشاشة على مستندٍ
          بعشرين سطرًا. **وتعديلُ مستندٍ مرحَّلٍ محرَّمٌ من الأصل** (ADR-051:
          «الرصيد مجموع حركات، لا عمودًا يُصحَّح») — فهذا امتدادُ الحدّ لا شكلُه.
          ⚠️ **ولوحٌ لا حوارٌ ثانٍ:** الصفحةُ تلفّ العمليّةَ بـ`RefModal` أصلًا،
          **وحوارٌ داخل حوارٍ كلّف جولةً في هذا المشروع.** فهذا نفسُ نمط
          `InvoicePickerDialog` — مطلقُ الموضع فوق أبيه، بمصيدةِ بؤرةٍ واحدة. */}
      {viewed && (
        <div
          data-document-view={viewed.id}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 p-4"
        >
          <div className="flex max-h-full w-full max-w-[900px] flex-col border border-[var(--rule)] bg-background shadow-lg">
            {/* ══════════════════════════════════════════════════════════
                🔴 شريطُ العنوان — **شكلُ `RefModal` بلا آليّته**
                ══════════════════════════════════════════════════════════

                **بلفظ المالك:** «الاستخراجُ تجميليٌّ فقط (شكلُ الشريط)، بلا أيّ
                إعادةِ استعمالٍ لبنية Dialog/Portal تبع RefModal. لوحُ العرض
                يبقى `<div>` يدويّ، **يستعير الشكلَ لا الآلية**».

                ⚠️ **ولماذا يستحيل غيرُ ذلك، مقيسًا:** الصفحةُ تلفّ العمليّةَ
                بـ`RefModal` أصلًا، **وحوارٌ داخل حوارٍ كلّف جولةً كاملةً في هذا
                المشروع** — فبنيةٌ ثانيةٌ تتنازع على بؤرة اللوحة، **والشكلُ
                وحدَه لا يتنازع.**

                ✅ **والعنوانُ من `secondaryItems.<OPERATION_LABEL_KEY[op]>`** —
                **وهو المفتاحُ نفسُه** الذي تقرأ منه الصفحةُ عنوانَ شريط شاشة
                الإنشاء (`pages/products/index.js:231`). ⇒ **مصدرٌ واحد، فلا
                افتراقَ ممكن.**

                ⚠️ **وكان يُقرأ من `docs.<type>.title` فافترقت الطلبيّة** —
                «طلب بضاعة» مقابل «الطلبيّات». **والعلاجُ مصدرٌ واحدٌ لا حارسٌ
                يعلن الافتراقَ ويحفظه:** «هذا يُلغي الانحرافَ كلّيًّا بدل ما
                يعلنه ويحافظ عليه» (لفظُ المالك). */}
            <RefChromeBar
              title={(
                <span className={`${CHROME_TITLE} flex items-center gap-2`}>
                  {panelTitle}
                  {viewed.doc_number && <RefTag>{viewed.doc_number}</RefTag>}
                  <span className="font-normal opacity-80">{documentDate(viewed.doc_date)}</span>
                </span>
              )}
              close={(
                <button
                  type="button"
                  data-view-close
                  aria-label={t('common:close')}
                  className={CHROME_CLOSE}
                  onClick={() => setViewing(null)}
                >
                  <X className="size-3.5" />
                </button>
              )}
            />

            <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">

            {/* 🔴 **النوعان الجاهزان يفتحان شاشتيهما، والباقي على اللوح العامّ.**
                ⚠️ **ووصلٌ تدريجيٌّ لا انتظارٌ للأربعة:** التوريدُ والإرجاعُ
                يبقيان كما كانا **فلا شيءَ ينكسر ولا شيءَ يختفي**، ويُفحص
                الجاهزُ أوّلَ ما يجهز. */}
            {rowIsOrder(viewed) ? (
              <OrderDocumentView
                order={viewed}
                orderLines={orderLines}
                products={products}
                categories={categories}
                suppliers={suppliers}
                balances={balances}
                // ⚠️ **مستودعُ العدسة** — والطلبيّةُ بلا مستودعٍ أصلًا، فهذا ما
                // تقرأ منه شاشةُ الإنشاء «الرصيد الحاليّ» كذلك.
                storageId={storageId}
              />
            ) : viewed.doc_type === 'write_off' ? (
              <WriteOffDocumentView
                document={viewed}
                movements={movements}
                products={products}
                categories={categories}
                storageCategories={storageCategories}
                lots={lots}
              />
            ) : viewed.doc_type === 'supply' ? (
              <SupplyDocumentView
                document={viewed}
                movements={movements}
                products={products}
                categories={categories}
                storageCategories={storageCategories}
                storages={storages}
                suppliers={suppliers}
                balances={balances}
              />
            ) : viewed.doc_type === 'return_to_supplier' ? (
              <ReturnDocumentView
                document={viewed}
                movements={movements}
                products={products}
                categories={categories}
                storageCategories={storageCategories}
                lots={lots}
                suppliers={suppliers}
              />
            ) : (
            <>
            {/* 🔴 **«فيه: أسماءُ المنتجات» مكانُها هنا.** بُنيت على واقعةٍ
                حقيقيّة: لبشّار مستندا توريدٍ بنفس التاريخ والمستودع والمورّد
                وعددِ السطور **فلم يفرّقهما بعد ساعةٍ من ترحيلهما.**
                ⚠️ **وحجّتُها ضعُفت ولم تسقط:** `doc_number` صار عمودًا مستقلًّا
                وهو مقبضٌ أدقّ، **فبقيت حيث تُطلَب لا على صفٍّ تزاحم فيه ما
                يُبحَث عنه.** */}
            {(() => {
              const { names, more } = documentProductNames(movements, viewed.id, productsById)
              if (names.length === 0) return null
              return (
                <p className="text-xs text-muted-foreground">
                  {t('products:documents.contains', {
                    names: names.join('، ') + (more > 0 ? '…' : ''),
                  })}
                </p>
              )
            })()}

            {/* ⚠️ **والملاحظةُ كاملةً هنا** — خليّتُها في الصفّ تقصُّ الطويلَ
                منها، **و`title` لا يُقرأ بلمسة.** */}
            {viewed.note && <p className="text-xs text-muted-foreground">{viewed.note}</p>}

            {/* اللوحُ العامُّ — ما لم تُبنَ له شاشةٌ بعد (توريدٌ وإرجاعٌ وعكسٌ
                وجرد). **يبقى كما كان**، فلا شيءَ ينكسر بالوصل التدريجيّ. */}
            <div className="min-h-0 flex-1 overflow-auto border border-[var(--rule)]">
              <table className="w-full text-xs">
                <tbody>
                  {movementsOf(movements, viewed.id).map((m) => (
                    <tr key={m.id} className="border-b border-[var(--rule)] last:border-0">
                      <td className="px-1.5 py-1">{productsById[m.product_id]?.name || '—'}</td>
                      <td className="px-1.5 py-1 text-muted-foreground">
                        {nameOf(storages, m.storage_id)}
                      </td>
                      {/* ⚠️ Direction on every line, as a word. Without it a
                          write-off line reads exactly like a supply line, and a
                          reversal — whose lines are the exact opposite of the
                          document it undoes — reads as a copy of the mistake
                          rather than its correction. A word and not a sign,
                          because a minus inside an Arabic line is a neutral
                          character between two directions.
                          🔴 **وهذه الكلمةُ هي التي كشفت أن الترويسةَ كانت
                          مقلوبة** — وحارسٌ دائمٌ يقارنهما الآن. */}
                      <td className="px-1.5 py-1">
                        {movementFrames(m, productsById[m.product_id]).direction && (
                          <RefTag>
                            {t(`products:documents.direction_${movementFrames(m, productsById[m.product_id]).direction}`)}
                          </RefTag>
                        )}
                      </td>
                      <td className="px-1.5 py-1">{quantityText(m)}</td>
                      <td className="px-1.5 py-1 text-muted-foreground">
                        {/* A stamped cost of zero is a real number here, not a
                            blank — and it is exactly what the two bad documents
                            carried. */}
                        {costText(m) || '—'}
                      </td>
                    </tr>
                  ))}
                  {movementsOf(movements, viewed.id).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-muted-foreground">
                        {t('products:documents.noLines')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
            )}

            {/* ⚠️ **مَخرجٌ صريحٌ لا اعتمادٌ على الضغط خارجَ اللوح** — نفسُ
                ملاحظة زرّ الرجوع، على مستوى اللوح.
                🔴 **ويُخفى عن الشاشات الأربع وحدَها:** هنّ يرسمن أزرارَهنّ
                (ديكورًا)، **فزرٌّ حقيقيٌّ تحتها زرٌّ خامسٌ لا وجودَ له في شاشة
                الإنشاء** — والمَخرجُ هناك هو `×` في الشريط. */}
            {!dedicatedOperation && (
              <div className="flex justify-end">
                <RefCancelButton onClick={() => setViewing(null)}>
                  {t('common:close')}
                </RefCancelButton>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!confirming} onOpenChange={(o) => { if (!o) closeConfirm() }}>
        {/* The box says which document it is about, in machine-readable form
            as well as in words. Without it a check can only ask "did a box
            open", which is true of the wrong box too. */}
        <DialogContent data-confirming-doc-id={confirming?.id || ''} className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('products:documents.reverseTitle')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2 text-sm">
            {/* The document is named, because "undo" with nothing beside it is
                a button somebody presses on the wrong row.
                ⚠️ Two elements, not one joined string. A date is a run of EN
                digits, and joining it to Arabic with a neutral dash is the
                shape lib/timeRangeDirection.test.js exists to stop — the dash
                takes the paragraph direction and the halves swap on screen
                while the DOM stays correct. Separate nodes have no pair to
                reorder. */}
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {confirming && <span>{t(`products:docs.${confirming.doc_type}.title`)}</span>}
              {confirming && <span className="text-muted-foreground">{documentDate(confirming.doc_date)}</span>}
            </p>
            {/* ⚠️ What is IN it, because nothing else tells two apart. The owner
                has two supply documents on the same date, into the same
                storage, from the same supplier, with the same line count — the
                box described both, and he could not tell them apart an hour
                after posting them. stock_documents has no doc_number, so the
                contents are the only human handle there is. A destructive
                confirmation described by something that does not identify its
                target is worse than one with no description: the first
                reassures. */}
            {confirming && (() => {
              const { names, more } = documentProductNames(movements, confirming.id, productsById)
              if (names.length === 0) return null
              return (
                <p className="flex flex-wrap items-center gap-1.5">
                  {names.map((name) => <Badge key={name} variant="secondary">{name}</Badge>)}
                  {more > 0 && <Badge variant="outline">{t('products:documents.andMore', { n: more })}</Badge>}
                  <Badge variant="outline">{nameOf(storages, confirming.storage_id)}</Badge>
                  {confirming.supplier_id && (
                    <Badge variant="outline">{nameOf(suppliers, confirming.supplier_id)}</Badge>
                  )}
                </p>
              )
            })()}
            <p className="text-muted-foreground">{t('products:documents.reverseMessage')}</p>

            {/* 🔴 **السببُ إلزاميٌّ ويُحفظ مع المستند** — يسافر في `p_note`
                إلى مستند العكس، **فيبقى مقروءًا بعد أشهرٍ بجانب الحدث نفسِه**
                لا في ذاكرة مَن ضغط.
                ⚠️ **والزرُّ معطَّلٌ حتى يُكتب، والسببُ مكتوبٌ بجانبه** — تعطيلٌ
                بلا تفسيرٍ يجعل المستخدمَ يجرّب الحقولَ واحدًا واحدًا. */}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {t('products:documents.reasonLabel')}
              </span>
              <input
                data-cancel-reason
                autoFocus
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>

            {actionError && <div className="text-destructive">{actionError}</div>}
          </div>

          <DialogFooter>
            {/* ⚠️ يُقاس على المقصوص لا الخام: مسافةٌ ليست سببًا. */}
            {reason.trim() === '' && (
              <span className="me-auto text-xs text-muted-foreground" data-reason-required>
                {t('products:documents.reasonRequired')}
              </span>
            )}
            <Button variant="outline" onClick={closeConfirm}>
              {t('common:discard')}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || reason.trim() === ''}
              onClick={confirmReverse}
            >
              {busy ? t('common:saving') : t('products:documents.reverseConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

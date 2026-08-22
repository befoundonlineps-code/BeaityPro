import { RECEIPT_TYPES, ISSUE_TYPES, OWN_FUNCTION } from './stockDocument'
import { numberOrNull } from './decimalPlaces'

// حركةُ الفترة لمستودعٍ واحد — تفصيلُ ما جرى بين جردَين.
//
// 🔴 **وهذا الملفُّ وُجد لأن أعمدةَ الشاشة المرجعيّة لا تغطّي أنواعَنا التسعة.**
// المرجعُ يعرض: وارد · منقول · شطب · إرجاع. **وعندنا `sale` و
// `service_consumption` و`reversal` وتسويةُ جردٍ سابقٍ بلا عمود** — و
// `post_stocktake_session` تحسب النظريَّ من **كلّ** الحركات:
//
// ```sql
// select coalesce(sum(quantity_base), 0) into v_balance …
// ```
//
// ⇒ **فجدولٌ بأعمدة المرجع وحدَها يقول رقمًا وتقول الدالّةُ رقمًا آخر على نفس
// السطر، والفرقُ صامت:** الموظّفةُ تجمع ما تراه فلا تصل إلى «المتوقَّع»،
// **فتظنّ أن عدَّها خطأ** — وهي علّةُ «رقمٌ أصغر من الحقيقة، متّسقٌ مع نفسه،
// بلا خطأٍ ولا سطر» بلبوس عرض.
//
// ⇒ **فعمودُ «أخرى» ليس تزيّدًا، هو ما يجعل السطرَ يُصالِح.**

// كلُّ نوعٍ يُرحَّل، مشتقًّا من الثلاثة التي تعرّفه — لا مكتوبًا بيد.
//
// ⚠️ **والاشتقاقُ هو الحارس:** قائمةٌ بأسماءٍ هنا كانت ستتباعد عن
// `stockDocument.js` بصمت، وهو الصنفُ المسجَّلُ بأربع نسخٍ في `CLAUDE.md`.
// **و`order` خارجها عمدًا** — الطلبيّةُ قالبٌ لا تحرّك شيئًا، وإدخالُها هنا
// يفتح بابَ عدّها حركة.
export const POSTED_DOC_TYPES = [...RECEIPT_TYPES, ...ISSUE_TYPES, ...OWN_FUNCTION]

// أعمدةُ التفصيل، بترتيب رسمها.
export const PERIOD_COLUMNS = ['incoming', 'move', 'writeOff', 'returnToSupplier', 'other']

// 🔴 **الخريطةُ صريحةٌ لأربعةٍ، والباقي «أخرى» — والمجهولُ يُسجَّل ولا يُبتلع.**
//
// ⚠️ **ولا تُبنى الخريطةُ على `RECEIPT_TYPES`/`ISSUE_TYPES` وحدَهما**، لأن
// السؤالَ هنا غيرُ سؤالهما: هما يقرّران **إشارةَ** الحركة عند الترحيل، وهذا
// يقرّر **في أيّ عمودٍ تُقرأ**. و`sale` و`return_to_supplier` كلاهما `ISSUE`،
// **وللثاني عمودٌ في المرجع وللأوّل لا.** فخريطتان لسؤالين، لا واحدةٌ لسؤالٍ
// نصفُه.
const COLUMN_OF = {
  supply: 'incoming',
  opening: 'incoming',
  transfer: 'move',
  write_off: 'writeOff',
  return_to_supplier: 'returnToSupplier',
  sale: 'other',
  service_consumption: 'other',
  reversal: 'other',
  stocktake: 'other',
}

/**
 * عمودُ هذا النوع، و`'other'` لما لا تعرفه الخريطة.
 *
 * ⚠️ **المجهولُ يذهب إلى «أخرى» ولا يُرمى** — فالحسابُ يبقى صحيحًا على شاشةٍ
 * حيّة. **وتسجيلُه في `unknownTypes` هو ما يُسقط الحزمةَ** لاحقًا، فيكون
 * الجهلُ خبرًا في الفحص لا نقصًا على الشاشة.
 */
export function columnOf(docType) {
  return COLUMN_OF[docType] || 'other'
}

/**
 * هل لهذا النوع مدخلٌ **صريح** في الخريطة؟
 *
 * 🔴 **مُصدَّرةٌ للحارس وحدَه، والفرقُ بينها وبين `columnOf` هو كلُّ المسألة:**
 * `columnOf('نوعٌ جديد')` تُرجع `'other'` فيبقى الحسابُ صحيحًا، **وهذه تُرجع
 * `false` فيسقط الفحص.** ⇒ **صحيحٌ على الشاشة، وصاخبٌ في الحزمة.**
 */
export function isMapped(docType) {
  return Object.prototype.hasOwnProperty.call(COLUMN_OF, docType)
}

/**
 * تاريخُ آخر جردٍ مرحَّلٍ لهذا المستودع — بدايةُ الفترة.
 *
 * ⚠️ **ولا جردَ سابقًا يعطي `null`، لا تاريخَ اليوم** — و«الفترةُ من أوّل حركة»
 * جملةٌ تُقال للموظّف، **لا ترويسةٌ فارغةٌ تُقرأ عطلًا.**
 */
export function previousStocktakeAt(documents, storageId) {
  let latest = null
  for (const doc of documents || []) {
    if (!doc || doc.doc_type !== 'stocktake') continue
    if (doc.storage_id !== storageId) continue
    const at = doc.doc_date
    if (!at) continue
    if (latest === null || String(at) > String(latest)) latest = at
  }
  return latest
}

const EMPTY = () => ({
  begin: 0, incoming: 0, move: 0, writeOff: 0, returnToSupplier: 0, other: 0,
})

/**
 * تفصيلُ حركة الفترة لكلّ منتجٍ في مستودعٍ واحد.
 *
 * ⚠️ **الإشاراتُ محفوظةٌ كما هي في `quantity_base`** — شطبٌ يصل سالبًا، ونقلٌ
 * يصل بإشارة هذا المستودع. **فالعمودُ يُجمع لا يُطرح**، و«البداية + مجموعُ
 * الأعمدة» تساوي الرصيدَ النظريَّ بالجمع وحدَه.
 *
 * ⚠️ **والمقارنةُ نصّيّةٌ على `doc_date`** لأن العمود `timestamptz` يصل نصًّا
 * بصيغة ISO، **وترتيبُها المعجميُّ هو ترتيبُها الزمنيّ.** وتحويلُها إلى `Date`
 * يُدخل منطقةً زمنيّةً في سؤالٍ لا يسأل عنها.
 */
export function periodMovement({ movements, documents, storageId, since } = {}) {
  const docById = new Map()
  for (const doc of documents || []) if (doc && doc.id) docById.set(doc.id, doc)

  const rows = new Map()
  const unknownTypes = new Set()
  let orphanMovements = 0
  // 🔴 **حركةٌ بكمّيّةٍ لا تُقرأ لا تُعدّ صفرًا** — و`Number(null) === 0` هو
  // البندُ المؤجَّلُ (أ) في `CLAUDE.md` بعينه. **وحارسُ `nullableNumberRatchet`
  // عضّ هذا الملفَّ على `Number(move.quantity_base)` قبل أن يُدفَع**، فصار
  // `numberOrNull` والعدمُ يُحصى ولا يُبتلع.
  let unreadableQuantities = 0

  for (const move of movements || []) {
    if (!move || move.storage_id !== storageId) continue
    const doc = docById.get(move.document_id)
    // ⚠️ **حركةٌ بلا مستندٍ لا تُلقى ولا تُصنَّف** — تُعدّ في البداية إن كانت
    // قبل الفترة، وفي «أخرى» إن كانت داخلها، **وتُحصى كي يظهر عددُها.**
    if (!doc) orphanMovements += 1
    const type = doc ? doc.doc_type : null
    if (type && !COLUMN_OF[type]) unknownTypes.add(type)

    const qty = numberOrNull(move.quantity_base)
    if (qty === null) { unreadableQuantities += 1; continue }

    const key = move.product_id
    if (!rows.has(key)) rows.set(key, EMPTY())
    const row = rows.get(key)

    const at = doc ? doc.doc_date : null
    const beforePeriod = since !== null && since !== undefined
      && at !== null && at !== undefined
      && String(at) < String(since)

    if (beforePeriod) row.begin += qty
    else row[columnOf(type)] += qty
  }

  return { rows, unknownTypes: [...unknownTypes].sort(), orphanMovements, unreadableQuantities }
}

/**
 * الرصيدُ النظريُّ لسطر — **بالجمع لا بالطرح.**
 *
 * 🔴 **وهو ما يجب أن يساوي `sum(quantity_base)` التي تحسبها
 * `post_stocktake_session`** — والمصالحةُ محروسةٌ باختبارٍ لا موصوفةٌ بتعليق.
 */
export function planOf(row) {
  if (!row) return 0
  return PERIOD_COLUMNS.reduce((sum, key) => sum + (row[key] || 0), row.begin || 0)
}

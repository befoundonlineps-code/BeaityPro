import { numberOrNull } from './decimalPlaces'
import { orderTotal } from './productOrder'
import { ORDER_DOC_TYPE } from './stockDocument'

// دمجُ «طلب بضاعة» في قائمة المستندات — **مصدرُ بياناتٍ ثانٍ في جدولٍ صُمّم
// لواحد.** والمواصفةُ الكاملةُ في `design/documents-with-orders-spec.md`.
//
// 🔴 **والطلبيّةُ تُقولَب على شكل المستند بدل أن تتعلّم الشاشةُ شكلًا ثانيًا.**
//
// ⚠️ **وهذا ليس تجميلًا — هو ما يجعل القراراتِ الأربعةَ تتحقّق بلا كودٍ يفرضها:**
//
// ```
// «من» و«إلى» فارغتان   ⟵ `doc_type: 'order'` ليس في RECEIPT_TYPES ولا في
//                          نوعَي المورّد، فـ`documentParties` تسقط لقاعدتها
//                          الأخيرة و`storage_id` عدمٌ ⟵ الطرفان `null`
// لا زرَّ عكس            ⟵ 'order' ليس في REVERSIBLE_TYPES ⟵ `canReverse: false`
// لا حالةَ إلغاء         ⟵ لا `reverses_document_id` ولا مَن يشير إليه ⟵ «حيّ»
// تختفي مع المستودع      ⟵ `storage_id: null` ⟵ `inStorage` تُقيَّم false (قرار د/١)
// ```
//
// ⇒ **فأربعةُ سلوكيّاتٍ صحيحةٌ بحكم الشكل لا بحكم شرطٍ يُكتب** — وشرطٌ يُكتب
// هو ما يُنسى في الحالة الخامسة. **وكلُّها مقيسةٌ في `documentsWithOrders.test.js`
// لا مستنتَجةٌ من هذا التعليق.**
//
// ⚠️ **والعدمُ يُكتب صراحةً لا يُترك غيابًا:** `doc_number: null` أوضحُ من عمودٍ
// غيرِ موجود، **لأن `undefined` تُقرأ «لم يُحمَّل» و`null` تُقرأ «لا يوجد»** —
// والفرقُ هو ما تبحث عنه الشاشةُ حين ترسم «—».

// ⚠️ **يُعاد تصديرُها ولا تُعرَّف هنا:** موضعُها `stockDocument.js` بجانب
// تصنيفات الأنواع، **لأن ثلاثةَ ملفّاتٍ تسألها ونسخةٌ حرفيّةٌ في كلٍّ منها هي
// الصنفُ نفسُه الذي نطارده.** وهناك أيضًا مكتوبٌ لماذا هي **خارج** الثلاثة.
export { ORDER_DOC_TYPE }

export function rowIsOrder(row) {
  return !!row && row.doc_type === ORDER_DOC_TYPE
}

// ⚠️ **ولا دالّةَ يومٍ هنا:** التسويةُ التي يحتاجها الترتيبُ هي `documentDate`
// نفسُها في `stockDocumentList.js` — **قصٌّ إلى عشرة محارف، بنفس الدلالة
// حرفًا.** ونسخةٌ ثانيةٌ باسمٍ ثانٍ (`rowDay`) كُتبت هنا أوّلًا ثمّ حُذفت،
// **لأنها بالضبط الصنفُ المسجَّلُ مؤجَّلًا بأربع نسخٍ من «الفراغُ عدمٌ لا صفر»:
// اسمان يفعلان الشيءَ نفسَه اليومَ ويتباعدان غدًا بصمت.**

// الطلبيّةُ صفًّا بشكل المستند.
//
// ⚠️ **و`orderTotal` تُستورد ولا تُكتب ثانيةً** — تُرجع `null` حين لا سطرَ
// مسعَّر («لا أحدَ اتّفق على الأسعار» ليست «هذا بلا ثمن»)، **وتجمع المسعَّر
// وحدَه وتقول كم هو** حين يكون بعضُه مسعَّرًا. وهي القسمةُ نفسُها التي يحفظها
// `documentValue` للمستند.
export function orderAsRow(order, lines) {
  if (!order) return null
  const totals = orderTotal(lines || [])

  return {
    id: order.id,
    doc_type: ORDER_DOC_TYPE,
    // التاريخُ كما هو، **والتسويةُ عند الترتيب لا عند البناء** — فلا يُخترع
    // طابعٌ زمنيٌّ لصفٍّ لا يملكه.
    doc_date: order.order_date ?? null,
    created_at: order.created_at ?? null,
    note: order.note ?? null,
    supplier_id: order.supplier_id ?? null,

    // 🔴 **عدمٌ صريحٌ لا غياب** — خمسُ خاناتٍ من إحدى عشرةَ فارغةٌ على هذا
    // الصفّ، **وهو أثرٌ قُبل بعد عرضه** (المواصفة أ/٤): طلبيّتان لنفس المورّد
    // في نفس اليوم لا يفرّقهما إلّا الملاحظةُ أو القيمة.
    doc_number: null,
    supplier_doc_number: null,
    paid_amount: null,
    storage_id: null,
    to_storage_id: null,
    reverses_document_id: null,

    // ما لا يُشتقّ من الحركات لأن الطلبيّةَ لا تولّد حركة.
    order_total: numberOrNull(totals.total),
    order_priced_lines: totals.pricedLines,
    order_line_count: totals.lineCount,
  }
}

// قيمةُ الصفّ — **من مصدرين مختلفين، والفرعُ هنا مرّةً واحدةً لا في الخليّة.**
//
// 🔴 **والمستندُ يشتقّها من حركاته، والطلبيّةُ لا حركةَ لها إطلاقًا** — فقيمتُها
// مجموعُ سطورها المسعَّرة. **وخليّةٌ تسأل السؤالين معًا تصير فرعًا في الرسم**،
// وهو ما لا يراه اختبارُ مكتبة.
//
// ⚠️ **والعدمُ يمرّ عدمًا في المسارين:** `documentValue` تُرجع `null` حين لا
// حركةَ مسعَّرة، و`orderTotal` تُرجع `null` حين لا سطرَ مسعَّر — **و«لا أحدَ
// اتّفق على الأسعار» ليست «هذا بلا ثمن».**
export function rowValue(row, documentValue) {
  if (!row) return null
  return rowIsOrder(row) ? row.order_total : documentValue
}

// سطورُ الطلبيّة للعرض — **ومكانُها هنا لأن اللوحَ كان يكذب بدونها.**
//
// 🔴 **اللوحُ يقرأ `movementsOf` لكلّ صفّ، والطلبيّةُ لا حركاتٍ لها إطلاقًا**
// ⇒ فرجعت المصفوفةُ فارغةً ورُسمت «المستند بلا سطور» **على طلبيّةٍ لها سطور.**
//
// ⚠️ **وهذه ليست «ميزةً لم تُبنَ بعد» — هي جملةٌ خاطئةٌ تُعرض على إنسان.**
// والفراغُ المشروعُ الشكلِ مكانَ الحقيقة هو الصنفُ الذي يلاحقه هذا المشروعُ
// كلُّه: `Number(null)` تعطي `0`، وخاصّيّةٌ لم تُمرَّر تعطي «لا بيانات»،
// **ومصدرٌ خاطئٌ يعطي «بلا سطور».**
//
// ⚠️ **و`entered_unit_price` يقبل العدم** ⇒ `numberOrNull` لا `Number` —
// **وسقّاطةُ الحقول القابلة للعدم تحرس هذا الملفَّ الآن.** والعدمُ يبقى عدمًا
// فترسم الشاشةُ «—» بدل «٠٫٠٠ ₪».
export function orderViewLines(orderLines, orderId) {
  return (orderLines || [])
    .filter((l) => l && l.order_id === orderId)
    // نفسُ ترتيب شاشة الطلبيّة — `sort_order` ثمّ المعرِّف، فلا يتبدّل الترتيبُ
    // بين الشاشتين للطلبيّة نفسِها.
    .sort((a, b) => {
      const left = numberOrNull(a.sort_order) ?? 0
      const right = numberOrNull(b.sort_order) ?? 0
      if (left !== right) return left - right
      return String(a.id ?? '').localeCompare(String(b.id ?? ''))
    })
    .map((l) => ({
      id: l.id,
      productId: l.product_id,
      quantity: numberOrNull(l.entered_quantity),
      uom: l.entered_uom || null,
      // 🔴 **سعرٌ مطلوبٌ لا كلفة** — لا شراءَ وقع ولا دفعةَ وُلدت.
      askingPrice: numberOrNull(l.entered_unit_price),
    }))
}

// المستنداتُ والطلبيّاتُ صفًّا واحدًا.
//
// ⚠️ **الترتيبُ ليس هنا** — `sortDocuments` تملكه، وهي التي تعرف قاعدةَ
// التعادل. **ودالّتان ترتّبان تتباعدان.**
export function mergedRows({ documents, orders, orderLines } = {}) {
  const byOrder = new Map()
  for (const line of orderLines || []) {
    if (!line) continue
    if (!byOrder.has(line.order_id)) byOrder.set(line.order_id, [])
    byOrder.get(line.order_id).push(line)
  }

  const asRows = (orders || [])
    .filter(Boolean)
    .map((o) => orderAsRow(o, byOrder.get(o.id) || []))

  return [...(documents || []).filter(Boolean), ...asRows]
}

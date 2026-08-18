import { roundToPlaces, numberOrNull } from './decimalPlaces'

// دفعاتُ منتجٍ في مستودعٍ واحد — ما يعرضه عمودُ «الدفعة» في شاشة الشطب.
//
// 🔴 **والمتبقّي يُشتقّ هنا بنفس قاعدة القاعدة حرفًا:** `sum(quantity_base)` على
// `lot_id` — الداخلُ موجبٌ والخارجُ سالب. **لا عمودَ مخزَّنٌ للمتبقّي** (ADR-051،
// و٠٩٤ يشرح لماذا: عكسٌ ينسى أن يزيده ينحرف عن الحركات ولا شيءَ يلاحظ).
//
// ⚠️ **وحسابُه هنا ليس تكرارًا للقاعدة بل شرطُ صدقٍ معها:** الشاشةُ تعرض متبقّيًا
// والقاعدةُ ترفض على متبقٍّ، **فلو اختلف الحسابان لعرضت الشاشةُ رقمًا ورفضت
// القاعدةُ على غيره** — والمستخدمُ يقرأ «١٢ متاح» ويُرفض عند ١٠ بلا تفسير.
// ⇒ فالقاعدةُ واحدةٌ مكتوبةٌ مرّتين، **ومثبَّتةٌ باختبارٍ يقارن الصيغتين.**

// ⚠️ الحركاتُ المُمرَّرةُ هي **حركاتُ هذه الدفعات وحدَها**، لا كلُّ حركات النظام.
// وطبقةُ الجلب هي التي تضيّق، لأن هذا الملفَّ دالّاتٌ نقيّةٌ لا يعرف الشبكة.
export function remainingByLot(movements) {
  const index = new Map()
  for (const row of movements || []) {
    if (!row || row.lot_id === null || row.lot_id === undefined) continue
    // ⚠️ حركةٌ بلا كمّيّةٍ تُتخطّى ولا تُحسب صفرًا — `quantity_base` هو
    // `NOT NULL` بالقاعدة، فوصولُ العدم هنا يعني صفًّا ناقصًا لا حركةً صفريّة.
    const n = numberOrNull(row.quantity_base)
    if (n === null) continue
    index.set(row.lot_id, (index.get(row.lot_id) || 0) + n)
  }
  // التقريبُ بعد الجمع لا قبله: جمعُ أرقامٍ مقرَّبةٍ يراكم فرقَ التقريب.
  for (const [id, sum] of index) index.set(id, roundToPlaces(sum))
  return index
}

// 🔴 الترتيبُ **تامٌّ عمدًا: `(received_at, created_at, id)`** — نفسُ ترتيب
// `draw_stock_from_lots` بالحرف.
//
// ⚠️ **ودفعتان بنفس اليوم تتساويان بـ`received_at` وحدَه، وترتيبٌ غيرُ تامٍّ
// يعطي قراءتين مختلفتين لنفس السؤال:** الشاشةُ تسمّي «الأقدم» واحدةً والقاعدةُ
// تسحب أخرى، **والرقمان صحيحان كلاهما ولا يتطابقان.** وهي علّةُ ترتيب
// الطلبيّات نفسُها (`sort_order` ثمّ `id`).
function byAge(a, b) {
  const received = String(a.received_at ?? '').localeCompare(String(b.received_at ?? ''))
  if (received !== 0) return received
  const created = String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
  if (created !== 0) return created
  return String(a.id ?? '').localeCompare(String(b.id ?? ''))
}

// دفعاتُ هذا المنتج في هذا المستودع، **التي فيها متبقٍّ**، الأقدمُ أوّلًا.
//
// ⚠️ **والمستنفَدةُ تُطوى ولا تُعرض:** دفعةٌ متبقّيها صفرٌ أو سالبٌ لا يمكن
// السحبُ منها — القاعدةُ ترفضها بـ`lot_insufficient` — **وعرضُها يجعل المستخدم
// يختار ما سيُرفض.** والشاشةُ لا تعرض بابًا مغلقًا.
export function lotsForLine({ lots, movements, storageId, productId } = {}) {
  const remaining = remainingByLot(movements)

  return (lots || [])
    .filter((lot) => lot
      && lot.storage_id === storageId
      && lot.product_id === productId)
    .map((lot) => ({
      id: lot.id,
      receivedAt: lot.received_at,
      // ⚠️ **يُحمل وإن لم يُعرض.** الفرزُ يستعمله، وأوّلُ مسوّدةٍ لهذا الملفّ
      // أسقطته من الإسقاط وأبقته في `byAge` — **فصار المقارِنُ يقرأ عدمًا في كلّ
      // صفّ، والترتيبُ يسقط من تامٍّ إلى جزئيٍّ بلا سطرٍ يشتكي.** وهو أخطرُ من
      // فرزٍ مقلوب: يعمل صحيحًا كلّما اختلفت التواريخُ، ويعطي قراءتين لنفس
      // السؤال يومَ تتساوى — وذلك اليومُ هو دفعتان وصلتا معًا.
      createdAt: lot.created_at,
      remaining: remaining.get(lot.id) ?? 0,
      // 🔴 **وهنا وقعت الرابعةُ من الصنف، بعد ساعةٍ من إصلاح `amountOf`:**
      // كان `Number(lot.unit_cost)`، **فدفعةٌ بلا ثمنٍ تُقرأ `0`** ويعرضها
      // عمودُ «الدفعة» ثمنًا مجّانيًّا. **أُصلح المستهلِكُ وتُرك المنتِج** — وهو
      // الشكلُ الذي لا يمسكه إصلاحٌ نقطيّ، ولذلك صار `numberOrNull` مشتركًا.
      unitCost: numberOrNull(lot.unit_cost),
      costIsEstimated: lot.cost_is_estimated === true,
    }))
    .filter((row) => row.remaining > 0)
    .sort((a, b) => byAge(
      { received_at: a.receivedAt, created_at: a.createdAt, id: a.id },
      { received_at: b.receivedAt, created_at: b.createdAt, id: b.id },
    ))
}

// 🔴 الافتراضُ هو الأقدم — **وهو اختيارٌ صريحٌ للأقدم لا غيابُ اختيار.**
//
// وهذا ما يجعل شاشةَ الشطب تُرسل `lot_id` دائمًا فلا تسلك المسارَ الضمنيَّ الذي
// يقدّر عند النقص، **فيصير التوفّرُ بنيويًّا** (٠٩٦: `write_off_needs_lot`).
export function defaultLotId(rows) {
  return (rows || []).length > 0 ? rows[0].id : null
}

// 🔴 هل يُشطب هذا المنتجُ أصلًا — **القاعدة (أ)**، وقياسُها من الدفعات لا من
// جدول أرصدةٍ منفصل.
//
// ⚠️ **والرقمان متساويان اليوم، والاشتقاقُ من الدفعات هو الصحيح مع ذلك:** ما
// يقيّد الشطبَ هو ما **يمكن سحبُه**، ودفعةٌ متبقّيها سالبٌ تُطرح من رصيد المنتج
// بينما لا يُسحب منها شيء. فقراءةُ الرصيد تعطي رقمًا أصغرَ من المتاح للسحب في
// تلك الحالة — **ومصدرٌ واحدٌ للحقيقة يعني أن الخانةَ المعطَّلة والمنتقيَ الفارغَ
// لا يمكن أن يتخالفا.**
export function availableForWriteOff(rows) {
  return (rows || []).reduce((sum, row) => sum + row.remaining, 0)
}

export function canWriteOff(rows) {
  return availableForWriteOff(rows) > 0
}

// 🔴 سيرُ FIFO — **نسخةٌ ثانيةٌ من قاعدةٍ تعيش في القاعدة، وتُقال صراحةً.**
//
// المستخدمُ يحتاج قيمةَ الخسارة **قبل** التأكيد، والتوزيعُ التلقائيُّ يعبر
// دفعاتٍ بأثمانٍ مختلفة — **فالمبلغُ مجموعُ شرائحَ لا كمّيّةٌ × سعر.** ولا سبيل
// لعرضه بلا إعادة السير هنا.
//
// ⚠️ **وهذا هو صنفُ الانحراف الذي يلاحقه هذا المشروع** («طريقان لسؤالٍ واحدٍ هما
// جوابان»)، ولا يصير مأمونًا بالحذر بل بشرطين:
//
//   ١. **الترتيبُ مطابقٌ حرفًا** — `(received_at, created_at, id)` ثمّ
//      `least(remaining, needed)` تراكميًّا. **واختلافُ فاصلِ التعادل وحدَه يعطي
//      مبلغًا مختلفًا يوم تتساوى التواريخ**، لا يوم تختلف — فالعطلُ نائمٌ حتى
//      دفعتين تصلان معًا.
//   ٢. **فحصُ انحرافٍ متقاطع** بنفس التجهيزة: ما يُعرض هنا == ما تختمه القاعدة.
//      و`097b` يحمل نصفَه الآخر بنفس الأرقام.
//
// ⚠️ **والصفوفُ تصل مرتَّبةً ومصفّاةً من `lotsForLine`** — لا يُعاد الفرزُ هنا،
// وإلّا صار ترتيبان قابلان للتباعد بدل واحد.
export function fifoSlices(rows, needed) {
  const want = numberOrNull(needed)
  if (want === null || want <= 0) return { slices: [], short: 0 }

  let left = want
  const slices = []

  for (const row of rows || []) {
    if (left <= 0) break
    const take = Math.min(row.remaining, left)
    left = roundToPlaces(left - take)
    slices.push({
      lotId: row.id,
      drawn: take,
      unitCost: row.unitCost,
      costIsEstimated: row.costIsEstimated,
    })
  }

  // ⚠️ **والنقصُ يُرجَع رقمًا لا يُبتلع:** الشطبُ يُرفض عنده بـ`insufficient_stock`
  // (٠٩٧)، **ولا يفتح دفعةً مقدَّرة** — فالشاشةُ تعرف قبل الإرسال.
  return { slices, short: left > 0 ? left : 0 }
}

// مبلغُ الشرائح — **وثمنٌ مجهولٌ في أيّ شريحةٍ يُبطل المجموعَ كلَّه.**
//
// ⚠️ **ولا يُجمع ما عُرف ويُتجاهل ما جُهل:** مجموعٌ ناقصُ شريحةٍ رقمٌ أصغرُ من
// الحقيقة **متّسقٌ مع نفسه** — وهي علّةُ التسميم بأنظف صورها، وأخفى من الصفر.
export function slicesAmount(slices) {
  let total = 0
  for (const slice of slices || []) {
    if (slice.unitCost === null || slice.unitCost === undefined) return null
    total += slice.drawn * slice.unitCost
  }
  return roundToPlaces(total)
}

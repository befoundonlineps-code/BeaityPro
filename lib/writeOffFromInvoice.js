import { remainingByLot } from './lotPicker'
import { perPackage } from './orderGrid'
import { roundToPlaces, numberOrNull } from './decimalPlaces'

// «إدخال من فاتورة» في شاشة الشطب — **اختيارُ فاتورةِ توريدٍ هو اختيارٌ للدفعات
// التي ولّدها ذلك التوريد.**
//
// 🔴 وهذا ما يجعل المنتقيَ وعمودَ «الدفعة» **وجهين لشيءٍ واحد** لا ميزتين
// متجاورتين: التوريدُ يلد الدفعة، فاسمُ الفاتورة اسمٌ آخرُ لها.
//
// ⚠️ **والمنتقي مثبَّتٌ على التوريد**، لأن الطلبيّة **لا تولّد دفعةً إطلاقًا** —
// فاختيارُها هنا لا يعني شيئًا. (مرشِّحُ `Type` في لقطة المرجع يُحذف، وقرارُ
// المالك صريحٌ فيه.)

// صفوفُ المنتقي — مستنداتُ التوريد وحدَها، بشكل `pickerRows` نفسِه كي تعمل
// `filterPickerRows` و`toggleSelection` عليها بلا نسخةٍ ثانية.
//
// ⚠️ **والمبلغُ يحتاج الاثنين:** الثمنُ من الدفعة (`unit_cost` مختومٌ عليها)
// **والكمّيّةُ من حركاتها** — فالدفعةُ لا تحمل «كم دخل» عمودًا، وهذا هو قرارُ
// ٠٩٤ نفسُه («المتبقّي مجموعُ حركاتٍ لا عمودٌ يُصحَّح»). **وسطرٌ سابقٌ هنا كان
// يقول «من الدفعات لا من الحركات» فصار كذبًا حين حُسب المبلغُ فعلًا.**
// ⚠️ **و`supplierId` اختياريٌّ وله مُنادٍ واحد:** شاشةُ الإرجاع تعرف مورّدَها
// سلفًا، **وفاتورةُ موردٍ آخرَ تولّد دفعاتٍ لا يصحُّ إرجاعُها إليه** — فعرضُها
// يجعل المستخدمَ يختار ما لا معنى له. **والشطبُ بلا مورّدٍ فلا يمرّره**، فيبقى
// السلوكُ القديمُ كما هو بالبناء لا بشرطٍ إضافيّ.
export function supplyPickerRows({ documents, lots, movements, suppliers, storageId, supplierId }) {
  const supplierName = new Map((suppliers || []).map((s) => [s.id, s.name]))

  // ما دخل كلَّ دفعة — الموجبُ من حركاتها. **ومنه مبلغُ الفاتورة.**
  const received = new Map()
  for (const move of movements || []) {
    const n = numberOrNull(move && move.quantity_base)
    if (n === null || n <= 0) continue
    received.set(move.lot_id, (received.get(move.lot_id) || 0) + n)
  }

  const lotsByDoc = new Map()
  for (const lot of lots || []) {
    if (!lotsByDoc.has(lot.source_document_id)) lotsByDoc.set(lot.source_document_id, [])
    lotsByDoc.get(lot.source_document_id).push(lot)
  }

  return (documents || [])
    .filter((doc) => doc && doc.doc_type === 'supply')
    // ⚠️ **مستودعُ العدسة وحدَه.** فاتورةُ توريدٍ لمستودعٍ آخر تولّد دفعاتٍ لا
    // يمكن الشطبُ منها هنا — وعرضُها يجعل المستخدمَ يختار ما سيُرفض
    // بـ`lot_not_in_storage`.
    .filter((doc) => !storageId || doc.storage_id === storageId)
    .filter((doc) => !supplierId || doc.supplier_id === supplierId)
    .map((doc) => {
      const own = lotsByDoc.get(doc.id) || []

      // 🔴 **المبلغُ يُحسب، ولا يُترك عدمًا.** كان `null` فعرضت النافذةُ «بلا
      // أسعار» على فواتيرِ توريدٍ **والتوريدُ لا يقبل سطرًا بلا ثمنٍ أصلًا**
      // (`unit_cost_required`) — فجملةٌ صحيحةٌ عن الطلبيّة كذبٌ عن التوريد.
      //
      // ⚠️ **وثمنٌ مجهولٌ في دفعةٍ واحدةٍ يُبطل المجموعَ كلَّه** — مجموعٌ ناقصُ
      // دفعةٍ رقمٌ أصغرُ من الحقيقة متّسقٌ مع نفسه، وهي علّةُ التسميم بأنظف صورها.
      let amount = 0
      for (const lot of own) {
        const cost = numberOrNull(lot.unit_cost)
        const qty = received.get(lot.id) || 0
        if (cost === null) { amount = null; break }
        amount += qty * cost
      }

      return {
        id: doc.id,
        kind: 'supply',
        invoiceNo: doc.supplier_doc_number || doc.doc_number || '',
        date: String(doc.doc_date || '').slice(0, 10),
        createdAt: doc.created_at || '',
        from: supplierName.get(doc.supplier_id) || '',
        // ⚠️ **اسمُ المستودع لا يُخترع هنا:** المنتقي مقصورٌ على مستودع العدسة
        // أصلًا، **فعمودٌ يقول الشيءَ نفسَه في كلّ صفٍّ لا يقول شيئًا** — وهو عينُ
        // ما فعله عمودُ «النوع» حين كُتب ثابتًا.
        to: '',
        lineCount: own.length,
        amount: amount === null ? null : roundToPlaces(amount),
      }
    })
}

// 🔴 الملءُ — **دفعةٌ لكلّ سطر، وكمّيّةٌ مقصوصةٌ عند المتبقّي.**
//
// المرجعُ يملأ **ما وُرِّد**. ومحرّكُنا يرفض ما يتجاوز المتبقّي، **فملءُ ما وُرِّد
// بعد استهلاك نصفِه يكتب رقمًا سترفضه القاعدة** — وذلك فخٌّ لا تسهيل.
//
// ⇒ **يُملأ الأقلُّ من (ما وُرِّد، ما تبقّى)**، و`clipped` يقول أيُّ سطرٍ قُصّ
// **كي لا يُقرأ الرقمُ الأصغرُ خطأً في الفاتورة.**
//
// ⚠️ **والدفعةُ المستنفَدةُ تُسقَط ولا تُملأ بصفر:** سطرٌ بصفرٍ لا يُرسَل أصلًا
// (`packagesOf` تردّ العدم)، **وصفٌّ ظاهرٌ بكمّيّةِ صفرٍ يقول «هذا متاح» وهو ليس.**
// 🔴 **ويُرجع ما لم يفعله كما يُرجع ما فعله.**
//
// وقع: اختِيرت فاتورةٌ فلم يُملأ شيء — **ولا رسالةَ ولا خطأ.** والسببُ لا يمكن
// تمييزُه من الشاشة: **«لا دفعاتٍ تطابق» و«كلُّها مستنفَدة» و«منتجٌ غيرُ محمَّل»
// كلُّها تبدو صمتًا واحدًا.**
//
// ⚠️ **وأخطرُها الأولى لأنها لا تُحسب أصلًا:** حلقةُ التخطّي لا تدور، **فتبقى
// `skipped` فارغةً بجانب `picks` فارغة** — أي لا خبرَ عن لا شيء. فصار
// `matchedLots` يُرجَع صراحةً، **والصفرُ فيه خبرٌ لا صمت.**
export function fillFromSupplyInvoices({ documentIds, lots, movements, products, storageId }) {
  const wanted = new Set(documentIds || [])
  if (wanted.size === 0) return { picks: {}, clipped: [], skipped: [], matchedLots: 0 }

  const remaining = remainingByLot(movements)
  const byProduct = new Map((products || []).map((p) => [p.id, p]))

  const picks = {}
  const clipped = []
  const skipped = []

  // ⚠️ **بترتيب الدفعات لا بترتيب الاختيار.** الأقدمُ أوّلًا كما يقرؤها الجدولُ
  // والمحرّك، **فلا يتغيّر شكلُ الشاشة بتغيّر ترتيب ضغطات المستخدم.**
  const chosen = (lots || [])
    .filter((lot) => wanted.has(lot.source_document_id))
    .filter((lot) => !storageId || lot.storage_id === storageId)
    .sort((a, b) => String(a.received_at ?? '').localeCompare(String(b.received_at ?? ''))
      || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
      || String(a.id ?? '').localeCompare(String(b.id ?? '')))

  for (const lot of chosen) {
    const product = byProduct.get(lot.product_id)
    // ⚠️ **و`productId` يُحمل مع كلّ تخطٍّ**، لأن ما يُقرأ للمستخدم منتجاتٌ لا
    // دفعات: «امتلأ ٢ من ٥ منتجات» جملةٌ يفهمها، **و«٧ دفعات مستنفَدة» ليست.**
    // وثلاثُ دفعاتٍ لمنتجٍ واحدٍ تجعل عدَّ الدفعات يبالغ ثلاثةَ أضعاف.
    if (!product) { skipped.push({ lotId: lot.id, productId: lot.product_id, reason: 'product' }); continue }

    const left = remaining.get(lot.id) ?? 0
    if (left <= 0) { skipped.push({ lotId: lot.id, productId: lot.product_id, reason: 'empty' }); continue }

    // ما دخل هذه الدفعة أصلًا — الموجبُ من حركاتها.
    const received = (movements || [])
      .filter((m) => m.lot_id === lot.id && Number(m.quantity_base) > 0)
      .reduce((sum, m) => sum + Number(m.quantity_base), 0)

    const take = Math.min(received, left)
    if (take < received) clipped.push({ lotId: lot.id, received, filled: take })

    // ⚠️ **بالعبوة لا بالوحدة الأساسيّة** — الخانةُ عبوات، وكتابةُ الأساسيّ فيها
    // تضربه بمعامل التعبئة.
    const packages = roundToPlaces(take / perPackage(product))
    if (!picks[product.id]) picks[product.id] = []
    picks[product.id].push({ lotId: lot.id, packages: String(packages) })
  }

  return { picks, clipped, skipped, matchedLots: chosen.length }
}

// 🔴 تقريرُ الملء — **صنفٌ واحدٌ يُسمّى، لا سردُ أرقامٍ يفكّه القارئ.**
//
// ⚠️ **والثقبُ الذي أُصلح هنا كلّف جولةً عند المالك:** كان
// `if (picked > 0) return null` — **فالملءُ الناقصُ يصمت تمامًا.** والتعليقُ
// المبرِّرُ («شرحٌ فوق نتيجةٍ ظاهرةٍ ضجيج») صحيحٌ عن ملءٍ **تامّ** وخاطئٌ عن
// **ناقص**: الناقصُ يبدو تامًّا حرفيًّا — أرقامٌ تظهر، ولا شيءَ يقول إن منتجاتٍ
// سقطت. **فالصمتُ هنا ليس هدوءًا بل ادّعاءُ اكتمال.**
//
// 🔴 **والعدُّ بالمنتجات لا بالدفعات**، لأنه ما يُقرأ: «امتلأ ٢ من ٥ منتجات»
// جملةٌ يفهمها صاحبُ الصالون، **و«٧ دفعات مستنفَدة» ليست** — وثلاثُ دفعاتٍ
// لمنتجٍ واحدٍ تجعل عدَّ الدفعات يبالغ ثلاثةَ أضعاف.
//
// ⚠️ **والأصنافُ مصدرُ الحقيقة للرسائل**: كلُّ صنفٍ هنا لازمه مفتاحُ ترجمةٍ في
// كلّ شاشةٍ تستعمله، **وحارسٌ يشتقُّ القائمةَ من هنا فيسقط يومَ يُضاف صنفٌ بلا
// جملة** — بدل أن يُعرض مفتاحٌ خامٌّ للمستخدم.
export const FILL_KINDS = ['noLots', 'allEmpty', 'partialEmpty', 'hidden', 'unknownProduct']

export function fillReport(filled, { hiddenProductIds = [] } = {}) {
  const picks = (filled && filled.picks) || {}
  const skipped = (filled && filled.skipped) || []
  const matchedLots = (filled && filled.matchedLots) || 0

  const distinct = (reason) => new Set(
    skipped.filter((s) => s.reason === reason).map((s) => s.productId)
  ).size

  const empty = distinct('empty')
  const unknown = distinct('product')
  const hidden = hiddenProductIds.length
  // ما امتلأ **وظهر** — المخفيُّ محسوبٌ في `picks` لكنّه غيرُ مرئيّ.
  const filledCount = Object.keys(picks).length
  const shown = filledCount - hidden
  const total = filledCount + empty + unknown

  // ولا شيءَ امتلأ إطلاقًا — والسببُ يفترق ثلاثًا، وكلُّها تبدو زرًّا لا يفعل.
  if (filledCount === 0) {
    if (matchedLots === 0) return { kind: 'noLots', matchedLots: 0 }
    if (empty > 0) return { kind: 'allEmpty', empty, total }
    if (unknown > 0) return { kind: 'unknownProduct', unknown, total }
    return { kind: 'noLots', matchedLots }
  }

  // 🔴 **امتلأ شيءٌ ولم يظهر** — أخبثُها، لأن الشاشةَ تبدو كأنها لم تستجب.
  if (shown === 0 && hidden > 0) return { kind: 'hidden', hidden, total }
  if (hidden > 0) return { kind: 'hidden', hidden, total, shown }

  // امتلأ بعضٌ وسقط بعض — **وهذا هو الذي كان صامتًا.**
  if (empty > 0 || unknown > 0) return { kind: 'partialEmpty', shown, total, empty, unknown }

  // ⚠️ **والاكتمالُ يبقى صامتًا عمدًا:** شرحٌ فوق نتيجةٍ صحيحةٍ وكاملةٍ ضجيجٌ
  // يعلّم صاحبَه تجاهلَ الشريط — فتضيع معه المرّةُ التي يهمّ فيها.
  return null
}

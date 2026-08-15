// «إدخال من فاتورة» — تعبئةُ جدول التوريد من طلبيّةٍ سابقة.
//
// ⚠️ **وجدولُ المرجعيّة عمودُه الوحيدُ القابلُ للتعديل هو «العبوات»**، بينما
// سطرُ الطلبيّة يحمل إطارَه الذي كُتب فيه (`entered_uom`): عبوة أو حصّة أو
// وحدة. **فليس كلُّ سطرِ طلبيّةٍ قابلًا للتمثيل في هذا الجدول** — وهذا ليس
// نقصًا في التعبئة، هو فرقٌ بين شكلين.
//
// 🔴 **والخطرُ ليس أن تفشل التعبئة، بل أن تنجح جزئيًّا وتسكت.** خمسةُ أسطرٍ
// تصير ثلاثة بلا كلمة هو بالضبط صنفُ «رقمٌ أصغر من الحقيقة، متّسقٌ مع نفسه،
// بلا خطأ ولا سطر». فما لم يُملأ **يُسمّى بأسماء منتجاته وبسببه**.

// أيُّ منتجاتٍ يعرضها الجدولُ الآن — فما ليس معروضًا لا مكانَ له.
function shownProductIds(rows) {
  const ids = new Set()
  for (const row of rows || []) {
    if (row.kind === 'product') ids.add(row.id)
  }
  return ids
}

// 🔴 الجواب: ما يُملأ، وما لا يُملأ ولماذا.
//
// ⚠️ **والسببان مختلفان ولا يُجمعان في جملةٍ واحدة**، لأن لكلٍّ منهما فعلًا
// مختلفًا يزيله: الإطارُ يحتاج إدخالًا يدويًّا، والمنتجُ غيرُ المعروض يحتاج
// تأشيرَ مجلّدِه في النافذة الأولى. **ورسالةٌ واحدةٌ لهما تشرح الحالةَ الخطأ
// لأحدهما** — وهي علّةُ خانتَي الغرامة نفسُها: الرفضُ صحيحٌ والسببُ المعروضُ
// ليس سببَه.
export function fillPackagesFromOrder({ orderLines, rows } = {}) {
  const shown = shownProductIds(rows)
  const packages = {}
  const skipped = []

  for (const line of orderLines || []) {
    const productId = line.product_id

    if (!shown.has(productId)) {
      skipped.push({ productId, reason: 'notShown' })
      continue
    }

    // ⚠️ يُقارَن بالإطار المخزَّن لا بوجود رقم. سطرٌ بالحصّة كمّيّتُه صالحةٌ
    // تمامًا — **وهي رقمٌ عن شيءٍ آخر**، ووضعُه في خانة العبوات يضربه في معامل
    // التعبئة مرّةً ثانية.
    if ((line.entered_uom || '') !== 'package') {
      skipped.push({ productId, reason: 'uom' })
      continue
    }

    const quantity = Number(line.entered_quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      skipped.push({ productId, reason: 'quantity' })
      continue
    }

    // ⚠️ **يُجمع ولا يُستبدَل حين يتكرّر المنتج.** طلبيّةٌ فيها سطران لنفس
    // المنتج حالةٌ لا يمنعها شيءٌ في القاعدة، والاستبدالُ يبتلع أحدهما بصمت.
    packages[productId] = (packages[productId] || 0) + quantity
  }

  return {
    packages: Object.fromEntries(Object.entries(packages).map(([id, n]) => [id, String(n)])),
    skipped,
  }
}

// هل في الجدول شغلٌ يُفقَد لو استُبدل.
//
// ⚠️ **ويُسأل فقط حين يكون هناك ما يُخسَر.** خانةٌ فارغةٌ ليست عملًا، وسؤالٌ
// جوابُه واحدٌ معقولٌ هو الاحتكاكُ الذي يعلّم الناسَ الضغطَ على الأسئلة بلا قراءة.
export function gridHoldsWork(packages) {
  return Object.values(packages || {}).some((v) => String(v ?? '').trim() !== '')
}

// أسماءُ ما لم يُملأ، مجموعةً بسببه — كي تقول الرسالةُ «أيّ منتجات» لا «كم سطرًا».
export function skippedByReason(skipped, products) {
  const byId = new Map((products || []).map((p) => [p.id, p.name]))
  const groups = {}
  for (const item of skipped || []) {
    if (!groups[item.reason]) groups[item.reason] = []
    const name = byId.get(item.productId)
    // ⚠️ منتجٌ لا يعرفه الكتالوجُ المحمَّل يُذكر بمعرِّفه لا يُسقَط: إسقاطُه
    // يجعل العدَّ يكذب، وهو نفسُ الفرق بين «صفر» و«شرطة».
    groups[item.reason].push(name || item.productId)
  }
  for (const reason of Object.keys(groups)) {
    groups[reason].sort((a, b) => String(a).localeCompare(String(b), 'ar'))
  }
  return groups
}

import { folderTickRows } from './storageFolders'
import { roundToPlaces, numberOrNull } from './decimalPlaces'
import { packagesOf, numberInBase, perPackage } from './orderGrid'
import { lotsForLine, availableForWriteOff, fifoSlices, slicesAmount } from './lotPicker'
import { amountOf } from './writeOffGrid'

// جدولُ «إرجاعٌ إلى مورّد» — **توأمُ جدول الشطب، بفرقٍ واحدٍ جوهريّ: الثمنُ
// يكتبه إنسان.**
//
// 🔴 **والفرقُ ليس خانةً إضافيّةً بل معنًى مختلفًا للرقم:** الشطبُ يقيّم خسارةً
// وقعت، **فثمنُه ما كلّفتنا البضاعةُ ولا شيءَ غيره.** والإرجاعُ يسجّل مطالبةً
// بائتمان، **وما يقبله المورّدُ ليس بالضرورة ما دفعناه** — فالرقمان مختلفان
// بطبيعتهما، لا بخطأِ أحدهما.
//
// ✅ **ولذلك لا يُمسّ `unit_cost` إطلاقًا** (ADR-051): القاعدةُ تختم تكلفةَ
// الدفعة الحقيقيّة كما تفعل لكلّ خروج، **والثمنُ المكتوبُ يسافر في
// `entered_unit_price`** — عمودٌ قائمٌ تكتبه الدالّةُ للإرجاع أصلًا. **فضمانُ
// الشطب سليمٌ بالبناء، لا بحارسٍ يُكتب ويُصان.**

// 🔴 الثمنُ المقترَح — **ما كلّفتنا فعلًا، نقطةَ بدايةٍ لا قيدًا.**
//
// ⚠️ **ويُشتقُّ من الشرائح لا من دفعةٍ واحدة**، لأن التوزيعَ التلقائيَّ يعبر
// دفعاتٍ بأثمانٍ مختلفة: **المتوسّطُ المرجَّحُ لما سيُسحب فعلًا** = المبلغُ ÷
// العدد. ودفعةٌ واحدةٌ حالةٌ خاصّةٌ منه تعطي ثمنَها نفسَه، **فلا فرعان لقاعدةٍ
// واحدة.**
//
// ⚠️ **والعدمُ يبقى عدمًا:** شريحةٌ بثمنٍ مجهولٍ تُبطل المجموعَ كلَّه
// (`slicesAmount`)، **ومتوسّطٌ ناقصُ شريحةٍ رقمٌ أصغرُ من الحقيقة متّسقٌ مع
// نفسه** — وهي علّةُ التسميم بأنظف صورها.
export function suggestedUnitPrice(slices, base) {
  const amount = slicesAmount(slices)
  const qty = numberOrNull(base)
  if (amount === null || qty === null || qty <= 0) return null
  return roundToPlaces(amount / qty)
}

// اختياراتُ سطرٍ واحد — **دفعةٌ وكمّيّةٌ وثمن.**
//
// ⚠️ **والثمنُ يبدأ عدمًا لا صفرًا**، ليُقرأ «لم يُكتب بعد» فيحلَّ محلَّه
// المقترَح. **وصفرٌ مكتوبٌ يبقى صفرًا مقصودًا** — «لا أعرف» و«مجّانًا» يفترقان
// هنا كما افترقا في القاعدة (`if not found` لا `if v_cost is null`).
export function picksFor(picks, productId) {
  const stored = (picks || {})[productId]
  if (Array.isArray(stored) && stored.length > 0) return stored
  return [{ lotId: null, packages: '', unitPrice: '' }]
}

// 🔴 المنتجاتُ المعروضة — **ومربّعُ «منتجات الأمانة» يرشّح، لا يخفي عيبًا.**
//
// ⚠️ **والمورّدُ شرطٌ في الترشيح لا زينةٌ فيه:** منتجُ أمانةٍ لمورّدٍ آخرَ
// **ملكُ ذلك المورّد**، وإرجاعُه إلى هذا خطأٌ لا نقصُ عرض. والقيدُ
// `products_consignment_supplier_check` يضمن ألّا أمانةَ بلا مورّد، **فالترشيحُ
// لا يسقط صفًّا بعدمٍ في `supplier_id`.**
//
// ⚠️ **وبلا مورّدٍ مختارٍ لا يُرشَّح شيء** ويعود الجدولُ فارغًا: عرضُ كلّ
// الأمانات لمورّدٍ مجهولٍ يقول «هذه قابلةٌ للإرجاع» وهي ليست بعد.
export function consignmentFilter(products, { consignmentOnly, supplierId } = {}) {
  if (!consignmentOnly) return products || []
  if (!supplierId) return []
  return (products || []).filter((p) => p && p.is_consignment === true && p.supplier_id === supplierId)
}

// 🔴 صفوفُ الجدول: مجلّدٌ ⟵ منتجٌ ⟵ **دفعاتٌ عند الانقسام وحدَه** — نفسُ الشطب.
//
// ✅ **والأصفرُ صفُّ مجلّدٍ لا حالةَ منتج**، مقيسًا من اللقطات الأربع: كلُّ صفٍّ
// أصفرَ نصُّه اسمُ مجلّدٍ ويليه منتجُه (`design/return-to-supplier-spec.md` §٩).
export function returnGridRows({
  selectedFolderIds, categories, products, lots, movements, storageId, picks,
  consignmentOnly, supplierId,
} = {}) {
  const wanted = new Set(selectedFolderIds || [])
  if (wanted.size === 0) return []

  const pool = consignmentFilter(products, { consignmentOnly, supplierId })
  const rows = []

  for (const folder of folderTickRows(categories)) {
    if (!wanted.has(folder.id)) continue

    const own = pool
      .filter((p) => p.category_id === folder.id && p.is_active !== false)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'))

    const children = []

    for (const product of own) {
      const available = lotsForLine({ lots, movements, storageId, productId: product.id })
      const inStock = availableForWriteOff(available)
      const chosen = picksFor(picks, product.id)

      // 🔴 نفسُ القاعدة (أ): لا دفعاتٍ ⟵ لا شيءَ يُرجَع ⟵ **الخانةُ معطَّلة.**
      // **والمنتجُ يُعرض ولا يُخفى** — إخفاؤه يجعل مَن يبحث عنه يظنّه غيرَ موجود.
      const locked = available.length === 0

      const perLot = chosen.map((pick, index) => {
        const base = numberInBase(product, pick.packages)
        const lot = pick.lotId ? (available.find((l) => l.id === pick.lotId) || null) : null

        const auto = pick.lotId === null || pick.lotId === undefined || pick.lotId === ''
        const poolForWalk = auto ? available : (lot ? [lot] : [])
        const walk = base === null ? { slices: [], short: 0 } : fifoSlices(poolForWalk, base)

        const suggested = suggestedUnitPrice(walk.slices, base)
        // ⚠️ **المكتوبُ يغلب المقترَح، والفراغُ يعني «لم يُكتب» لا «صفر».**
        const typed = numberOrNull(pick.unitPrice)
        const unitPrice = typed === null ? suggested : typed

        return {
          kind: 'lot',
          id: `${product.id}:${pick.lotId || `auto${index}`}`,
          productId: product.id,
          lotId: auto ? null : pick.lotId,
          auto,
          receivedAt: lot?.receivedAt ?? null,
          remaining: auto ? inStock : (lot?.remaining ?? 0),
          costIsEstimated: auto
            ? walk.slices.some((s) => s.costIsEstimated)
            : (lot?.costIsEstimated ?? false),
          packages: pick.packages ?? '',
          number: base,
          unit: product.base_unit,
          slices: walk.slices,
          suggestedPrice: suggested,
          // ما في الخانة نصًّا — الشاشةُ ترسمه كما هو، والمقترَحُ يظهر حين تفرغ.
          priceText: pick.unitPrice ?? '',
          unitPrice,
          // 🔴 **«تغيّر» تعني تغيّرًا عن الحقيقة، لا مجرّدَ كتابة.** إعادةُ كتابة
          // نفسِ الرقم ليست تعديلًا، **وتلوينُها يجعل المؤشّرَ يكذب فيُتجاهَل.**
          priceEdited: typed !== null && suggested !== null && typed !== suggested,
          // ⚠️ **المبلغُ من الثمن المعروض لا من الشرائح** — الشاشةُ تعرض ثمنًا
          // واحدًا للسطر، **فمبلغٌ من مصدرٍ ثانٍ يعطي رقمين لسؤالٍ واحد.**
          amount: amountOf(product, pick.packages, unitPrice),
          overRemaining: base !== null && walk.short > 0,
        }
      })

      const typedTotal = perLot.reduce((sum, r) => {
        const n = packagesOf(r.packages)
        return n === null ? sum : sum + n
      }, 0)
      const anyTyped = perLot.some((r) => packagesOf(r.packages) !== null)

      children.push({
        kind: 'product',
        id: product.id,
        name: product.name,
        folderId: folder.id,
        locked,
        inStock,
        inStockPackages: roundToPlaces(inStock / perPackage(product)),
        unit: product.base_unit,
        isConsignment: product.is_consignment === true,
        split: perLot.length > 1,
        packages: anyTyped ? roundToPlaces(typedTotal) : '',
        number: numberInBase(product, anyTyped ? roundToPlaces(typedTotal) : ''),
        amount: perLot.length === 1 ? perLot[0].amount : null,
        lots: available,
        picks: perLot,
      })
    }

    const summed = children.reduce((sum, row) => {
      const n = packagesOf(row.packages)
      return n === null ? sum : sum + n
    }, 0)
    const anyChildTyped = children.some((row) => packagesOf(row.packages) !== null)

    rows.push({
      kind: 'folder',
      id: folder.id,
      name: folder.name,
      depth: folder.depth,
      packages: anyChildTyped ? roundToPlaces(summed) : null,
      childCount: children.length,
    })

    for (const child of children) {
      rows.push(child)
      if (child.split) rows.push(...child.picks)
    }
  }

  return rows
}

// المجموعُ — **وصفوفُ المجلّدات والمنتجاتِ المنقسمةِ مستثناةٌ صراحةً**، وإلّا
// حُسب كلُّ مبلغٍ مرّتين.
export function returnTotal(rows) {
  let total = 0
  for (const row of rows || []) {
    if (row.kind === 'lot') { total += row.amount || 0; continue }
    if (row.kind === 'product' && !row.split) total += row.amount || 0
  }
  return roundToPlaces(total)
}

// هل في سطرٍ سترفضه القاعدة — **الصريحُ وحدَه**، كما في الشطب بعد ٠٩٧.
//
// ⚠️ **والعامُّ يبلغ القاعدةَ عمدًا:** المتبقّي يتحرّك تحته (تبويبٌ قديم، شخصٌ
// ثانٍ سحب بيننا)، **فالمنعُ هنا يَعِد بما لا يملك.**
//
// 🔴 **وبعد ١٠١ صار الإرجاعُ يرفض النقصَ كالشطب** — قرارُ صاحب النظام صريحًا،
// و`insufficient_stock` محصورٌ بـ`in ('write_off', 'return_to_supplier')`.
//
// ⚠️ **وهذا السطرُ كان يقول العكسَ ويثبّته باختبار** («الإرجاعُ يقدّر… فلا شارةَ
// على التلقائيّ») — **وكان قرارًا اتّخذتُه أنا قبل أن أطرحه**، فصار الكودُ يحمل
// أمرًا واقعًا بدل سؤالٍ معلَّق. **والسطرُ يُصحَّح مع السكربت لا بعده**، وإلّا
// بقي فحصٌ يثبّت سلوكًا أُلغي — وهو أسوأُ من غياب فحص.
export function returnBlocked(rows) {
  return (rows || []).some((row) => {
    // 🔴 **والتلقائيُّ يُمنَع الآن كذلك** — والفرقُ بينه وبين الصريح يبقى في
    // **الرسالة** لا في المنع: تجاوزُ دفعةٍ بعينها يُحلّ بتبديلها، **وتجاوزُ
    // الإجماليِّ لا يُحلّ إلّا بإنقاص الكمّيّة.**
    //
    // ⚠️ **والقاعدةُ تبقى الضمانَ النهائيّ** لما لا تعرفه الشاشة (تبويبٌ قديم ·
    // شخصٌ ثانٍ سحب بيننا) — والشاشةُ تمنع المعروفَ وحدَه.
    if (row.kind === 'lot') return row.overRemaining === true
    if (row.kind === 'product' && !row.split) return row.picks?.[0]?.overRemaining === true
    return false
  })
}

// 🔴 السطورُ المرسَلة — **وكلُّ سطرٍ يحمل ثمنَه المكتوب.**
//
// ⚠️ **والثمنُ يُحوَّل إلى وحدةِ الإدخال، وهذا أخطرُ سطرٍ في الملفّ:**
// `entered_unit_price` **ثمنُ الوحدة المُدخَلة (العبوة)**، والعمودُ المعروضُ
// **ثمنُ الوحدة الأساسيّة** (مقيسٌ من المرجع: ٢٫٠٠ للمل لا ١٠٠٫٠٠ للعبوة).
//
// **والعقدُ الذي يحفظه التحويل:** `entered_quantity × entered_unit_price` =
// المبلغُ نفسُه = `quantity_base × سعرُ الأساس`. وهو العقدُ الذي يعتمده التوريد
// أصلًا (`stockDocumentForm`), **فكسرُه هنا يجعل رقمين لمستندٍ واحد.**
//
// ⚠️ **وهذا هو معاملُ التعبئة الذي لدغ هذا المشروعَ مرّتين** — زرُّ «الكل»
// و`nominal_purchase_price`. **موضعُه واحدٌ هنا، ومحروسٌ باختبار.**
export function returnLinesFromGrid(rows, productsById) {
  const lines = []
  for (const row of rows || []) {
    const isLine = row.kind === 'lot' || (row.kind === 'product' && !row.split)
    if (!isLine) continue
    if (row.kind === 'product' && row.locked) continue

    const packages = packagesOf(row.packages)
    if (packages === null) continue

    const productId = row.kind === 'lot' ? row.productId : row.id
    const lotId = row.kind === 'lot' ? row.lotId : (row.picks?.[0]?.lotId ?? null)
    const price = row.kind === 'lot' ? row.unitPrice : (row.picks?.[0]?.unitPrice ?? null)
    const product = (productsById || {})[productId]

    const perBase = numberOrNull(price)

    lines.push({
      productId,
      lotId: lotId || null,
      quantityBase: -row.number,
      enteredQuantity: packages,
      enteredUom: 'package',
      // ⚠️ **العدمُ يبقى عدمًا ولا يصير صفرًا:** ثمنٌ مجهولٌ يُرسَل `null`
      // فيقرأ العمودُ «لم يُصرَّح»، **وصفرٌ يقرأ «مجّانًا» وهي مطالبةٌ بلا شيء.**
      enteredUnitPrice: perBase === null || !product
        ? null
        : roundToPlaces(perBase * perPackage(product)),
    })
  }
  return lines
}

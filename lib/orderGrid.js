import { folderTickRows } from './storageFolders'
import { roundToPlaces } from './decimalPlaces'

// جدولُ «طلب بضاعة» — صفوفُ المجلّدات وأبنائها، وحسابُ كلِّ عمود.
//
// الشكلُ من التطبيق المرجعيّ (design/reference-app-fidelity.md): صفُّ مجلّدٍ
// أصفرُ غيرُ قابلٍ للتعديل، وتحته صفوفُ منتجاتِه القابلةُ للتعديل بعمودٍ واحدٍ
// فقط — «الباكيج».
//
// 🔴 **ولا مستودعَ يُخزَّن على الطلبيّة — المستودعُ عدسةٌ لا عمود** (قرارُ
// المالك). فهو يقرّر شيئين لا ثالثَ لهما: **أيُّ مجلّداتٍ تُعرض**، و**ما الذي
// يقوله عمودُ «الرصيد الحاليّ»**. ولا يُكتب في أيِّ صفّ.
//
// ⚠️ وهذا يفسّر لماذا انضمّت `orders` إلى الشاشات التي تلزمها مستودعٌ حقيقيّ
// بينما `product_orders` بلا عمودِ مستودعٍ إطلاقًا: **سؤالان لا واحد** — هل
// يحتاج الصفُّ مستودعًا (لا)، وهل تحتاجه الشاشةُ لتفتح (نعم، وإلّا فالنافذةُ
// الأولى «مجلّداتُ أيِّ مستودع؟» بلا جواب).

// 🔴 من أيِّ عمودٍ يأتي سعرُ السطر — **سعرُ الشراء، بقرار المالك بعد قياسٍ على
// التطبيق المرجعيّ نفسِه:** «مجموع طلب البضاعة = الكمّيّة × سعر الشراء».
//
// وهو الصحيحُ معنًى: الطلبيّةُ مالٌ **ندفعه** للمورّد، و`package_price` يسمّيه
// المخطّطُ «Retail price» — ما نبيع به للزبونة.
//
// ⚠️ **والتطابقُ مقيسٌ لا مفترَض، وهذا ما طلبه المالك صراحةً:** شاشةُ الكتالوج
// عندنا ترسم عمودَي `columns.purchasePrice` = «سعر الشراء» و
// `columns.retailPrice` = «سعر البيع» (ProductsBrowser:676) وتملؤهما بـ
// `nominal_purchase_price` و`package_price` بالترتيب (:718). **فهما بعينهما
// عمودا «Purchase price» و«Retail price» في جدول المرجع.**
//
// 🔴 **أمّا الوحدةُ فكانت مجهولةً فعلًا — والقياسُ أعطى نتيجةً سلبيّةً حاسمة:**
//
//     packagePriceLabel   «سعر البيع للعبوة (₪)»      ⟵ الوحدةُ مسمّاة
//     purchasePriceLabel  «سعر الشراء الاسمي (₪)»     ⟵ 🔴 ولا وحدة
//
// أي أن **مَن كتب الرقمَ لم يُقَل له بأيِّ وحدةٍ يكتبه** — وهو بند ٣١ حرفيًّا،
// والسببُ الذي جعل شاشةَ التوريد **ترفض استعمالَ هذا العمود تلقائيًّا** وتعرضه
// تلميحًا بجانب الخانة (StockDocumentScreen:173).
//
// ⇒ **فلم يُكتفَ بتبديل الاسم.** الملصقُ صار يسمّي وحدتَه («سعر الشراء الاسمي
// للعبوة»)، فالضربُ هنا في `packages` صار معرَّفًا بدل أن يكون رهانًا على
// معاملِ التعبئة.
//
// ⚠️ **وتسميةُ الوحدة آمنةٌ اليوم وحدَه، ولن تكون كذلك بعد أوّل منتج:** ٠٨٩
// صفّر `products`، **فلا صفَّ قائمًا يُعاد تفسيرُه.** ملصقٌ يُغيَّر فوق بياناتٍ
// موجودة يكتب ادّعاءً عن أرقامٍ كتبها إنسانٌ تحت ملصقٍ آخر — وهو عينُ فخِّ
// البند ٨.
export const ORDER_PRICE_COLUMN = 'nominal_purchase_price'

// كم وحدةً أساسيّةً في العبوة. `units_per_package` هو `NOT NULL default 1`
// بـ`CHECK > 0`، فلا يغيب — والاحتياطُ هنا لصفٍّ اختباريٍّ ناقصٍ لا للقاعدة.
function perPackage(product) {
  const n = Number(product?.units_per_package)
  return Number.isFinite(n) && n > 0 ? n : 1
}

// نصُّ الباكيج المكتوب ⟵ رقمٌ أو عدم.
//
// ⚠️ **والفراغُ عدمٌ لا صفر.** `Number('') === 0` كلّف هذا المشروعَ مرّتين، وهنا
// تحديدًا يعني الفرقُ سطرًا يُطلب بكمّيّةٍ صفريّة مقابل سطرٍ لم يُطلب أصلًا.
export function packagesOf(raw) {
  const text = String(raw ?? '').trim()
  if (text === '') return null
  const n = Number(text)
  return Number.isFinite(n) && n > 0 ? n : null
}

// عمودُ «نمبر»: الكمّيّةُ بالوحدة الأساسيّة = الباكيج × ما في العبوة.
//
// ⚠️ **ويحمل وحدتَه معه** (`base_unit`) — قاعدةُ المخزون الأولى: «ما في رقمٌ
// بلا وحدته قدّام إنسان». والمرجعُ يطبع `pcs` ثابتةً مهما كانت وحدةُ المنتج،
// **وذلك خللُ تسميةٍ لا يُنسخ** (§٣ من وثيقة المطابقة).
export function numberInBase(product, rawPackages) {
  const packages = packagesOf(rawPackages)
  if (packages === null) return null
  return roundToPlaces(packages * perPackage(product))
}

// عمودُ «الأماونت» = الباكيج × سعرِ العبوة.
//
// ⚠️ **وسعرٌ غيرُ مذكورٍ يعطي عدمًا لا صفرًا** — «لا سعرَ متّفقٌ عليه» ليست
// «يساوي لا شيء»، و`product_order_lines.entered_unit_price` تقبل العدم لهذا
// السبب بالضبط: «an order may be a list of what is wanted with no price agreed
// yet».
export function amountOf(product, rawPackages) {
  const packages = packagesOf(rawPackages)
  if (packages === null) return null
  const price = product?.[ORDER_PRICE_COLUMN]
  if (price === null || price === undefined || price === '') return null
  const n = Number(price)
  if (!Number.isFinite(n)) return null
  return roundToPlaces(packages * n)
}

// الأرصدةُ الحاليّةُ في هذا المستودع وحدَه، مفهرسةً بالمنتج.
//
// ⚠️ **بهذا المستودع وحدَه، وهي حبّةُ الرقم.** قاعدةُ «كلُّ رقمٍ يُقتبس بحبّته»
// دُفع ثمنُها مرّتين هنا: رصيدُ مستودعٍ واحدٍ قُرئ رصيدَ منتج، وحدُّ نفادٍ حبّتُه
// المنتجُ قورن برصيد مستودع.
function balanceIndex(balances, storageId) {
  const index = new Map()
  for (const row of balances || []) {
    if (row.storage_id !== storageId) continue
    index.set(row.product_id, Number(row.balance_base) || 0)
  }
  return index
}

// 🔴 صفوفُ الجدول: مجلّدٌ ثمّ منتجاتُه، بترتيب الشجرة.
//
// ⚠️ **العضويّةُ مباشرةٌ لا وراثيّة**: صفُّ المجلّد يعرض المنتجاتِ التي
// `category_id` لها هو هذا المجلّدُ نفسُه، لا كلَّ ما تحته. والسببُ أن المنتجَ
// يعيش في مجلّدٍ واحد، فلو ورث الأبُ منتجاتِ أبنائه لظهر المنتجُ **مرّتين** حين
// يكون الأبُ والابنُ مؤشَّرَين معًا — سطران لنفس المنتج في طلبيّةٍ واحدة.
//
// ⚠️ **والمجلّدُ المؤشَّرُ الفارغُ يُعرض ولا يُسقَط.** قاعدةُ «ما لا بيانات خلفه
// يُحذف» تخصّ ما يرسمه النظامُ من عنده — وهذا اختارَه المستخدمُ بيده، فإسقاطُه
// يجعله يبحث عن مجلّدٍ أشّرَه ولا يجده. **صفٌّ يقول «فارغ» خبرٌ؛ واختفاؤه لغز.**
//
// ⚠️ **والمؤرشَفُ من المنتجات لا يُعرض** — لا يُطلب ما أُخرج من الخدمة. والمجلّدُ
// المؤرشَفُ بابُه النافذةُ الأولى، فلا يصل إلى هنا إلّا مؤشَّرًا.
export function orderGridRows({
  selectedFolderIds, categories, products, balances, storageId, packages,
} = {}) {
  const wanted = new Set(selectedFolderIds || [])
  if (wanted.size === 0) return []

  const stock = balanceIndex(balances, storageId)
  const typed = packages || {}
  const rows = []

  for (const folder of folderTickRows(categories)) {
    if (!wanted.has(folder.id)) continue

    const own = (products || [])
      .filter((p) => p.category_id === folder.id && p.is_active !== false)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'))

    const children = own.map((product) => ({
      kind: 'product',
      id: product.id,
      name: product.name,
      folderId: folder.id,
      packages: typed[product.id] ?? '',
      number: numberInBase(product, typed[product.id]),
      unit: product.base_unit,
      inStock: stock.get(product.id) ?? 0,
      amount: amountOf(product, typed[product.id]),
    }))

    // ⚠️ مجموعُ الأبناء، **للقراءة فقط** — قرارُ المالك، والمرجعُ عاجزٌ عن
    // إثباته أو نفيه: في كلّ لقطةٍ وصلتنا مجلّدٌ بمنتجٍ **واحد**، فالمجموعُ
    // يساوي ابنَه الوحيد ولا يفترق عن أيِّ تفسيرٍ آخر.
    const summed = children.reduce((sum, row) => {
      const n = packagesOf(row.packages)
      return n === null ? sum : sum + n
    }, 0)
    const anyTyped = children.some((row) => packagesOf(row.packages) !== null)

    rows.push({
      kind: 'folder',
      id: folder.id,
      name: folder.name,
      depth: folder.depth,
      packages: anyTyped ? roundToPlaces(summed) : null,
      childCount: children.length,
    })
    rows.push(...children)
  }

  return rows
}

// المجموعُ الكلّيّ — من صفوف المنتجات وحدَها.
//
// ⚠️ **وصفوفُ المجلّدات مستثناةٌ صراحةً**، وإلّا حُسب كلُّ مبلغٍ مرّتين. هذا هو
// نفسُ العطلِ الذي يمرّ من اختبارِ مكتبةٍ ويسقط في اختبارِ رسم.
export function orderGridTotal(rows) {
  let total = 0
  let priced = 0
  let lines = 0

  for (const row of rows || []) {
    if (row.kind !== 'product') continue
    if (packagesOf(row.packages) === null) continue
    lines += 1
    if (row.amount === null) continue
    priced += 1
    total += row.amount
  }

  // ⚠️ **ثلاثُ حالاتٍ لا رقمٌ واحد**، كما في شاشة الطلبيّات القائمة: «لا أسعارَ
  // متّفقٌ عليها» ليست «يساوي صفرًا»، وطلبيّةٌ نصفُها مسعَّرٌ عليها أن تقول أيُّ
  // نصف.
  return { total: lines === 0 || priced === 0 ? null : roundToPlaces(total), priced, lines }
}

// أيُّ سطورٍ تُكتب فعلًا — ما كُتب له باكيجٌ موجب، لا كلُّ ما عُرض.
//
// ⚠️ **و`entered_uom` هي `package` دائمًا هنا**، لأن العمودَ الوحيدَ القابلَ
// للتعديل في هذا الجدول هو «الباكيج». والقيمةُ من قائمة `UOM` نفسِها التي
// تتحقّق منها كلُّ كتابةٍ في الموديول — لا نصٌّ مكتوبٌ هنا من جديد.
export function orderLinesFromGrid(rows) {
  const lines = []
  for (const row of rows || []) {
    if (row.kind !== 'product') continue
    const packages = packagesOf(row.packages)
    if (packages === null) continue
    lines.push({
      productId: row.id,
      enteredQuantity: packages,
      enteredUom: 'package',
      sortOrder: lines.length,
    })
  }
  return lines
}

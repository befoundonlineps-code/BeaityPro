import { folderTickRows } from './storageFolders'
import { roundToPlaces, numberOrNull } from './decimalPlaces'
import { packagesOf, numberInBase, perPackage } from './orderGrid'
import { lotsForLine, availableForWriteOff, fifoSlices, slicesAmount } from './lotPicker'

// جدولُ «شطب بضاعة» — صفوفُ المجلّدات وأبنائها ودفعاتِها، وحسابُ كلِّ عمود.
//
// الشكلُ مقيسٌ من لقطات المرجع (`design/write-off-products-spec.md` قسم ب):
// المنتج · العبوات · العدد · المتوفّر · **الدفعة** · المبلغ.
//
// 🔴 **وعمودُ «الدفعة» إضافتُنا لا المرجع** — المرجعُ لا يعرف الدفعات إطلاقًا،
// فلا يُسأل عنه ولا يُقاس منه (قاعدةُ ٥ في وثيقة المطابقة).
//
// ⚠️ **ولا مورّدَ ولا خصمَ ولا نقلَ ولا دفع** — مقيسٌ من اللقطات الخمس: ولا واحدٌ
// منها فيها. **والشطبُ بلا طرفٍ مقابل**، و«المبلغ» فيه تقييمُ خسارةٍ لا ثمنٌ
// متفاوَضٌ عليه — ولهذا هو أبيضُ محسوبٌ لا خانةَ إدخال (`design/TOKENS.md`).

// 🔴 المبلغُ = **العددُ بالوحدة الأساسيّة × ثمنِ الدفعة**، لا العبواتُ × ثمنٍ.
//
// **ومشتقٌّ من اللقطة الخامسة بمنتجَين لا بواحد**، فلا يحتمل تفسيرًا ثانيًا:
//
//     InstaCalm Repair    ٢٠ عبوة ⟵ 20 pcs      ⟵ 4,000٫٠٠  ⇒ ٢٠٠٫٠٠ للقطعة
//     Medskin Lumenizer   ٢٠ عبوة ⟵ 1,000 ml    ⟵ 2,000٫٠٠  ⇒ ٢٫٠٠ للمل
//
// **ولو كان الحسابُ «العبوات × سعر»، لتساوى الاثنان في السعر ولم يتساويا في
// الوحدة** — والثاني وحدَه يفرّق. و`stock_lots.unit_cost` مخزَّنٌ **للوحدة
// الأساسيّة**، فهذا هو الضربُ المعرَّف.
//
// ⚠️ **ولا سعرَ من الكتالوج هنا إطلاقًا.** لوحُ المنتجات في نفس اللقطة يعرض
// `300.00` سعرًا للبيع **ولم يُستعمل** — الشطبُ يُسعَّر بثمن الدفعة التي جاء
// منها، وهي القاعدةُ (ج) التي وُجد محرّكُ الدفعات لأجلها.
export function amountOf(product, rawPackages, unitCost) {
  const base = numberInBase(product, rawPackages)
  if (base === null) return null

  // 🔴 **الغيابُ يُفحص قبل `Number()`، وهو ليس تشدّدًا:** `Number(null) === 0`
  // و`Number('') === 0` و`Number(undefined) === NaN` — **فثلاثةُ أشكالٍ للغياب
  // ولها ثلاثةُ أجوبةٍ مختلفة**، واثنان منها يمرّان كثمنٍ مشروع.
  //
  // ⚠️ **والفحصُ على القيمة وحدَها كان يحسب دفعةً بلا ثمنٍ مجّانيّةً** — أي
  // خسارةٌ بمبلغ صفر على مستندٍ ماليّ. **وهذه هي علّةُ التسميم التي دفع هذا
  // المشروعُ ثمنَها مرّتين** (`Number('')` بخانة سعر التوريد)، بلبوس `null`.
  //
  // ✅ **والصفرُ نفسُه يبقى مشروعًا**: الدرجةُ ٥ من سلّم التقدير تُنتج دفعةً
  // ثمنُها صفرٌ فعلًا، **و«لا أعرف» و«مجّانًا» يجب أن يفترقا هنا** كما افترقا
  // في القاعدة (`if not found` لا `if v_cost is null` — ٠٩٦).
  //
  // ⚠️ **والفحصُ مشتركٌ لا مكتوبٌ هنا:** أوّلُ إصلاحٍ نسخ الشرطَ في هذا الملفّ
  // وحدَه، **فوقع الصنفُ مرّةً رابعةً في `lotPicker` بعده بسطور.** ونسخةٌ رابعةٌ
  // من قاعدةٍ هي أربعُ فرصٍ لتتباعد.
  const price = numberOrNull(unitCost)
  if (price === null || price < 0) return null
  return roundToPlaces(base * price)
}

// اختياراتُ سطرٍ واحد: دفعةٌ وكمّيّةٌ لكلٍّ.
//
// ⚠️ **والافتراضُ اختيارٌ واحدٌ لا صفر:** غيابُ اختيارٍ يعني سطرًا بلا دفعة،
// وذلك ما ترفضه القاعدةُ بـ`write_off_needs_lot`. **فالشاشةُ لا تُنتج تلك
// الحالةَ أصلًا** بدل أن تنتجها ثمّ تُرفض.
// 🔴 **والافتراضُ «تلقائيّ» لا «الأقدم»** — تراجعٌ عن ٠٩٦ بقرار المالك.
//
// طلبَ **إمكانيّةَ** اختيار الدفعة لأن التالفةَ قد لا تكون الأقدم، **لا فرضَ
// الاختيار.** فالسطرُ يبدأ بلا دفعةٍ ويُوزَّع FIFO، **والاستهدافُ يبقى متاحًا
// لمن يريده.**
//
// ⚠️ **والفرقُ ليس تجميليًّا:** «الأقدمُ مختارةٌ سلفًا» يجعل كلَّ شطبٍ ادّعاءً
// بأن إنسانًا عيّن دفعةً، **و«تلقائيّ» تقول الحقيقة** — لم يُعيَّن شيء.
export function picksFor(picks, productId) {
  const stored = (picks || {})[productId]
  if (Array.isArray(stored) && stored.length > 0) return stored
  return [{ lotId: null, packages: '' }]
}

// 🔴 صفوفُ الجدول: مجلّدٌ ⟵ منتجٌ ⟵ **دفعاتٌ عند الانقسام وحدَه.**
//
// ⚠️ **والمستوى الثالثُ لا يظهر إلّا حين ينقسم السطر**، فالحالةُ الشائعة —
// دفعةٌ واحدة — تبقى سطرًا واحدًا كما في المرجع تمامًا. **وضجيجٌ في كلّ سطرٍ
// ثمنًا لحالةٍ نادرةٍ يجعل الشاشةَ تبدو غيرَ الشاشة.**
//
// ⚠️ **والعضويّةُ مباشرةٌ لا وراثيّة**، ولنفس سبب شاشة الطلب: المنتجُ يعيش في
// مجلّدٍ واحد، فوراثةُ الأبِ منتجاتِ أبنائه تعرضه مرّتين حين يكون الاثنان
// مؤشَّرَين — وهنا يعني ذلك شطبَه مرّتين.
export function writeOffGridRows({
  selectedFolderIds, categories, products, lots, movements, storageId, picks,
} = {}) {
  const wanted = new Set(selectedFolderIds || [])
  if (wanted.size === 0) return []

  const rows = []

  for (const folder of folderTickRows(categories)) {
    if (!wanted.has(folder.id)) continue

    const own = (products || [])
      .filter((p) => p.category_id === folder.id && p.is_active !== false)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'))

    const children = []

    for (const product of own) {
      const available = lotsForLine({ lots, movements, storageId, productId: product.id })
      const inStock = availableForWriteOff(available)
      const chosen = picksFor(picks, product.id)

      // 🔴 القاعدة (أ): لا دفعاتٍ ⟵ لا شيءَ يُشطب ⟵ **الخانةُ معطَّلة.**
      //
      // ⚠️ **والمنتجُ يُعرض ولا يُخفى** — مقيسٌ من اللقطة الثالثة: `Shmpoo`
      // بـ`0.0 pcs` ظاهرٌ وخانتُه رماديّة. **وإخفاؤه يجعل مَن يبحث عنه يظنّه
      // غيرَ موجودٍ بالكتالوج.**
      const locked = available.length === 0

      const perLot = chosen.map((pick, index) => {
        const base = numberInBase(product, pick.packages)
        const lot = pick.lotId ? (available.find((l) => l.id === pick.lotId) || null) : null

        // 🔴 **مساران، ودالّةُ شرائحَ واحدةٌ لكليهما.**
        //
        //   تلقائيّ  ⟵ سيرُ FIFO على كلّ المتاح، والمبلغُ مجموعُ شرائحَ
        //   صريح    ⟵ شريحةٌ واحدةٌ من تلك الدفعة
        //
        // ⚠️ **والصريحُ يمرّ بنفس الدالّة عمدًا** — لو حُسب بضربٍ مستقلٍّ لصار
        // طريقين لسؤالٍ واحد، وهو ما يُبطل فائدةَ توحيدها أصلًا.
        const auto = pick.lotId === null || pick.lotId === undefined || pick.lotId === ''
        const pool = auto ? available : (lot ? [lot] : [])
        const walk = base === null ? { slices: [], short: 0 } : fifoSlices(pool, base)

        return {
          kind: 'lot',
          id: `${product.id}:${pick.lotId || `auto${index}`}`,
          productId: product.id,
          lotId: auto ? null : pick.lotId,
          auto,
          receivedAt: lot?.receivedAt ?? null,
          remaining: auto ? inStock : (lot?.remaining ?? 0),
          unitCost: lot?.unitCost ?? null,
          costIsEstimated: auto
            ? walk.slices.some((s) => s.costIsEstimated)
            : (lot?.costIsEstimated ?? false),
          packages: pick.packages ?? '',
          number: base,
          unit: product.base_unit,
          slices: walk.slices,
          amount: base === null ? null : slicesAmount(walk.slices),
          // ⚠️ **يُحسب هنا لا عند الإرسال:** الشاشةُ تعرف السطرَ الذي سيُرفض قبل
          // أن يُرسَل — و`short > 0` هو حرفيًّا شرطُ `insufficient_stock` بالتلقائيّ
          // و`lot_insufficient` بالصريح. **رقمٌ واحدٌ يخدم الرفضين.**
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
        // ⚠️ **المتوفّرُ بالعبوة كذلك، لأن خانةَ الإدخال عبوات.** زرُّ «الكلّ»
        // يكتب فيها، **وكتابةُ المتوفّرِ الأساسيِّ فيها تضربه بمعامل التعبئة** —
        // فمنتجٌ عبوتُه ١٥ يطلب شطبَ خمسةَ عشرَ ضعفَ ما فيه.
        inStockPackages: roundToPlaces(inStock / perPackage(product)),
        unit: product.base_unit,
        split: perLot.length > 1,
        packages: anyTyped ? roundToPlaces(typedTotal) : '',
        // ⚠️ **يُحسب على صفّ المنتج كذلك، لا على صفوف الدفعات وحدَها.** أوّلُ
        // مسوّدةٍ أغفلته هنا فخرج `quantityBase: NaN` من `-row.number` — **رقمٌ
        // يمرّ من بناء الحمولة ويسقط عند القاعدة**، وهو الصنفُ الذي يظهر عند
        // المستخدم لا عند الكاتب. والاختبارُ أمسكه قبل أوّل رسم.
        number: numberInBase(product, anyTyped ? roundToPlaces(typedTotal) : ''),
        // ⚠️ عند الانقسام يصير صفُّ المنتج ملخَّصًا وتُقرأ التفاصيلُ من أبنائه،
        // **فلا يحمل دفعةً ولا مبلغًا** — رقمان لسؤالٍ واحدٍ هو ما يلاحقه هذا
        // المشروع.
        amount: perLot.length === 1 ? perLot[0].amount : null,
        lots: available,
        picks: perLot,
      })
    }

    // ⚠️ مجموعُ الأبناء للقراءة فقط — نفسُ قاعدة شاشة الطلب.
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
      // المستوى الثالثُ عند الانقسام وحدَه.
      if (child.split) rows.push(...child.picks)
    }
  }

  return rows
}

// المجموعُ الكلّيّ — من صفوف المنتجات غيرِ المنقسمة ومن صفوف الدفعات.
//
// ⚠️ **وصفوفُ المجلّدات والمنتجاتِ المنقسمةِ مستثناةٌ صراحةً**، وإلّا حُسب كلُّ
// مبلغٍ مرّتين. **وهذا بالضبط ما يمرّ من اختبار مكتبةٍ ويسقط في اختبار رسم.**
export function writeOffTotal(rows) {
  let total = 0
  for (const row of rows || []) {
    if (row.kind === 'lot') { total += row.amount || 0; continue }
    if (row.kind === 'product' && !row.split) total += row.amount || 0
  }
  return roundToPlaces(total)
}

// 🔴 هل في سطرٍ سترفضه القاعدة — **يُسأل قبل الإرسال لا بعده.**
//
// ⚠️ **والرفضُ في القاعدة يبقى الضمانَ النهائيّ** (`lot_insufficient`)، وهذا
// **لا يحلّ محلَّه**: تبويبٌ قديمٌ يحمل متبقّيًا قديمًا، وشخصٌ ثانٍ يسحب من نفس
// الدفعة بين الرسم والضغط. **فالشاشةُ تمنع المعروف، والقاعدةُ تمنع ما لا تعرفه
// الشاشة** — وهو تمييزُ «القيدُ يحرس المدى والشاشةُ تحرس المعنى» بعينه.
// 🔴 **ويمنع الصريحَ وحدَه بعد ٠٩٧، لا العامّ** — قرارُ المالك، وسببُه مقيس.
//
// المنعُ الشاملُ **حجب الحالةَ التي كنّا نشخّصها**: طُلب من المالك أن يرسل تجاوزًا
// ليكشف سطرُ `code · text`، **فمنعه الزرُّ من الإرسال فلم يظهر شيء.** ⇒ **حارسٌ
// وقائيٌّ حجب قياسَ حارسٍ آخر.**
//
// ⚠️ **والفرقُ بين الحالتين حقيقيٌّ لا تسويةٌ إداريّة:**
//
//   صريحٌ متجاوِز  ⟵ المستخدمُ **يرى متبقّيَ تلك الدفعة** في نفس السطر، فالمنعُ
//                    يقول ما تقوله الشاشةُ أصلًا
//   عامٌّ متجاوِز   ⟵ **المتبقّي يتحرّك تحته**: تبويبٌ قديم، أو شخصٌ ثانٍ سحب
//                    بيننا. **فالمنعُ هنا يَعِد بما لا يملك**، والقاعدةُ وحدَها
//                    تعرف الحقيقةَ لحظةَ الإرسال
//
// ⇒ **والعامُّ يبلغ القاعدةَ ويعود برسالة `insufficient_stock` مسمّاة** — وهو
// المسارُ الذي يجب أن يُرى يعمل، لا أن يُحجب.
export function writeOffBlocked(rows) {
  return (rows || []).some((row) => {
    if (row.kind === 'lot') return row.auto !== true && row.overRemaining === true
    if (row.kind === 'product' && !row.split) {
      const pick = row.picks?.[0]
      return pick?.auto !== true && pick?.overRemaining === true
    }
    return false
  })
}

// 🔴 السطورُ المرسَلة — **كلُّ سطرٍ يحمل دفعتَه، وكمّيّتُه سالبة.**
//
// ⚠️ **والسالبُ عقدٌ لا تنسيق:** `lot_pick_requires_issue` يرفض الموجب، وشطبٌ
// يصل موجبًا معناه إدخالُ بضاعةٍ لا إخراجُها.
//
// ⚠️ **وشطبٌ يعبر دفعتين يصل سطرين** — القاعدةُ لا تقسّم سطرًا صريحًا، والشاشةُ
// هي التي تعرضه شطبًا واحدًا وترسله سطرين.
export function writeOffLinesFromGrid(rows) {
  const lines = []
  for (const row of rows || []) {
    const isLine = row.kind === 'lot' || (row.kind === 'product' && !row.split)
    if (!isLine) continue
    if (row.kind === 'product' && row.locked) continue

    const packages = packagesOf(row.packages)
    if (packages === null) continue

    // ⚠️ **العدمُ يُرسَل عدمًا ولا يُسقط السطر.** كان هذا السطرُ يتخطّى ما لا
    // دفعةَ له، **وذلك كان صحيحًا حين كانت الدفعةُ إلزاميّة** — وبعد ٠٩٧ صار
    // الغيابُ **طلبَ توزيعٍ تلقائيّ**، فتخطّيه يبتلع سطرًا كتبه إنسان.
    const lotId = row.kind === 'lot' ? row.lotId : (row.picks?.[0]?.lotId ?? null)

    const productId = row.kind === 'lot' ? row.productId : row.id
    const base = row.number

    lines.push({
      productId,
      lotId: lotId || null,
      quantityBase: -base,
      enteredQuantity: packages,
      enteredUom: 'package',
    })
  }
  return lines
}

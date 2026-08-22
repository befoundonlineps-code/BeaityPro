import { numberOrNull, roundToPlaces } from './decimalPlaces'
import { perPackage } from './orderGrid'

// أعمدةُ المال في شاشة الجرد — **ولا رقمَ يُخترع فيها.**
//
// ⚠️ **والعدمُ يبقى عدمًا في كلّ دالّةٍ هنا:** تكلفةٌ غيرُ معروفةٍ تُرجع `null`
// فترسم الشاشةُ «—»، **ولا تُرجع صفرًا**. و«١٢ قطعة · التكلفة ٠ ₪» على شاشةٍ
// حيّة هو البندُ (أ) في `CLAUDE.md`، **وهو ما تمنعه هذه الملفّاتُ لا ما
// تعالجه بعد وقوعه.**

/**
 * حبّةُ التكلفة — **للوحدة الأساسيّة، لا للعبوة.**
 *
 * 🔴 **مقيسٌ من `054c`:** حركةُ الجرد تُكتب بـ`quantity_base` و`unit_cost`
 * معًا و`entered_quantity`/`entered_uom` **عدمان عمدًا** ⇒ **فسطرُ الجرد بلا
 * إطارِ عبوةٍ إطلاقًا**، والزوجُ الوحيدُ الذي نملكه معًا هو هذان.
 *
 * ⚠️ **والمصدرُ `product_balances.avg_cost`** — متوسّطٌ مرجَّحٌ لهذا المستودع،
 * وهو **الدرجةُ الأولى بعينها** في سلّم `post_stocktake_session`.
 *
 * ⚠️ **ويفترقان حين لا يكون رصيدٌ هنا:** السلّمُ ينزل إلى ثمن دفعةٍ أو حركةٍ
 * أو السعر الاسميّ، **وهو ما يوسمه `cost_is_estimated`.** فالمعروضُ «تكلفةُ
 * اليوم المعروفة»، والمختومُ وقتَ الترحيل قد يكون غيرَها — **والفرقُ يُقال
 * على الشاشة ولا يُخفى.**
 */
export function costPerBaseUnit(balanceRow) {
  return numberOrNull(balanceRow ? balanceRow.avg_cost : null)
}

/** قيمةُ المتوفّر بالتكلفة = الفعليُّ (بالوحدة الأساسيّة) × تكلفةِ الوحدة. */
export function remainingTotal({ factBase, cost } = {}) {
  const qty = numberOrNull(factBase)
  const unit = numberOrNull(cost)
  if (qty === null || unit === null) return null
  return roundToPlaces(qty * unit)
}

/**
 * الفرقُ بالوحدة الأساسيّة = الفعليُّ − النظريّ.
 *
 * ⚠️ **ولا فعليَّ ⟵ لا فرق، لا صفر.** خانةٌ لم تُملأ بعدُ ليست «طابق»؛
 * **والصفرُ هنا ادّعاءٌ بأن العدَّ جرى وأعطى المطابقة.**
 */
export function differenceBase({ factBase, planBase } = {}) {
  const fact = numberOrNull(factBase)
  if (fact === null) return null
  const plan = numberOrNull(planBase)
  if (plan === null) return null
  return roundToPlaces(fact - plan)
}

/** قيمةُ الفرق بالتكلفة = الفرقُ بالوحدة الأساسيّة × تكلفةِ الوحدة. */
export function differenceAtCost({ difference, cost } = {}) {
  const diff = numberOrNull(difference)
  const unit = numberOrNull(cost)
  if (diff === null || unit === null) return null
  return roundToPlaces(diff * unit)
}

/**
 * 🔴 **الفرقُ بالعبوات — وهو تحويلٌ صريحٌ لا نسخٌ عن المرجع.**
 *
 * سعرُ البيع عندنا **للعبوة** (`package_price`، وملصقُه «سعر البيع للعبوة»)،
 * والفرقُ **بالقطع**. ⇒ **فضربُ أحدهما في الآخر خطأٌ بمقدار معامل التعبئة
 * كاملًا** — لا كسرًا كـ`100.0005` بل ١٥ ضعفًا على منتجٍ عبوتُه ١٥.
 *
 * ⇒ **فيُحوَّل أوّلًا، والرقمُ الكسريُّ مقبولٌ بقرار المالك:** نقصُ ٢٠ قطعةً من
 * عبوةٍ فيها ١٥ هو **عبوةٌ وثلث**، وهي الحقيقةُ لا خطأُ عدّ.
 *
 * ⚠️ **و`perPackage` مستوردةٌ لا منسوخة** — هي التي تعرف أن
 * `units_per_package` هو `NOT NULL default 1` بـ`CHECK > 0`.
 */
export function differencePackages({ difference, product } = {}) {
  const diff = numberOrNull(difference)
  if (diff === null || !product) return null
  return roundToPlaces(diff / perPackage(product))
}

/**
 * قيمةُ الفرق بسعر البيع = الفرقُ **بالعبوات** × سعرِ بيع العبوة.
 *
 * ⚠️ **و`package_price` يقبل العدم** — منتجٌ بلا سعر بيعٍ يُرجع `null` فتُرسم
 * «—»، **لا صفرًا يُقرأ «لا قيمة لفقده».**
 */
export function differenceAtRetail({ difference, product } = {}) {
  const packages = differencePackages({ difference, product })
  const price = numberOrNull(product ? product.package_price : null)
  if (packages === null || price === null) return null
  return roundToPlaces(packages * price)
}

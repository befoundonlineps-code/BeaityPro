import { buildCategoryTree } from './categoryTree'
import { descendantIds } from './categoryVisibility'

// أيُّ مجلّداتٍ يحفظها هذا المستودع — لوحُ التأشير في نافذة المستودع.
//
// 🔴 القرار: المجلّدُ يقدر يكون بأكتر من مستودع، والعلاقةُ في
// `storage_categories` لا في عمودٍ على المجلّد. والسببُ ليس تفضيلًا: **قيدُ
// التشكيلة** — «هذا المستودع بيحفظ هالأصناف» — لا يمكن التعبير عنه أصلًا حين
// يكون للمجلّد مستودعٌ واحد، لأن «الوجهةُ لازم تحفظ هالمجلّد» تصير «الوجهةُ =
// مستودعُه الوحيد»، أي منعَ كلِّ نقل.
//
// ⚠️ ولا شيء هنا يعرف ما هو المستودع أو المجلّد بالمعنى التجاريّ — هذا الملفّ
// يجيب على سؤالين اثنين فقط: **أيُّ روابطَ مؤشَّرة، وأيُّها لا يُسمح بشيلها.**

// مفتاحُ الربط لـ`keyedLinkDiff`. المجلّدُ هو الهويّة، فالمفتاحُ معرِّفُه.
//
// ⚠️ ولا حالةَ «صفٍّ يتيم» هنا كما في `responsibleKey`: هناك يمكن أن يسمّي
// الصفُّ موظّفًا أو دورًا أو لا شيء، وهنا `category_id` عمودٌ `NOT NULL` بمفتاحٍ
// أجنبيٍّ مركّب — فالصفُّ الذي لا يسمّي مجلّدًا لا يمكن أن يوجد.
export const folderKey = (row) => String(row.category_id)

// روابطُ مستودعٍ واحد من كلّ روابط الصالون — الشكلُ الذي تصل به الشاشةَ.
export function folderLinksFor(links, storageId) {
  if (!storageId) return []
  return (links || []).filter((row) => row.storage_id === storageId)
}

// 🔴 أيُّ مجلّداتٍ لا يُسمح بشيلها من هذا المستودع، ومعها أسماءُ أصنافها.
//
// المُشغِّلُ `refuse_unlinking_stocked_folder` (٠٦٨أ) يرفض الحذف حين يبقى
// للمستودع رصيدٌ غيرُ صفريّ من منتجات المجلّد، **فالشاشةُ تقولها أوّلًا** —
// وهذا ليس تكرارًا بل سياسةُ المشروع: القاعدةُ ترفض على أيّ حال، والشاشةُ
// تعطي الجملةَ الأفضل قبل الضغط.
//
// ⚠️ **والأسماءُ هي المطلب، لا العدد — ومكتوبةٌ في ترويسة ٠٦٨أ منذ كُتب:**
// رمزُ الرفض `folder_still_stocked` له مفتاحٌ مسمّى، **والمفتاحُ يغلب الـ`hint`
// في `dbErrorSentence`** — فقائمةُ الأصناف التي يبنيها المُشغِّلُ داخل الـ`hint`
// **لا تصل المستخدمَ إطلاقًا**. تلك الترويسة سمّتها «مطلبًا على الشاشة» ولم
// يُبنَ؛ هذا هو.
//
// ⚠️ **والأبناءُ ليسوا اختياريًّا.** شيلُ المجلّد الأب بينما ابنُه مؤشَّر يترك
// الابنَ خارج الشجرة — `buildCategoryTree` ينزل من المجلّدات بلا أب، فابنٌ
// فقَدَ أباه ليس جذرًا وببساطة لا يُرسَم. رصيدُه في مكانه ولا شيء يعرضه. فالمنعُ
// يمشي على المجلّد **وكلِّ ما تحته**، بنفس المشية التي تستعملها الأرشفة.
//
// ⚠️ **ويُحسب محلّيًّا بلا استعلامٍ جديد**، لأن الصفحةَ محمَّلٌ عندها الكتالوجُ
// والأرصدةُ أصلًا. و٠٦٨ب_٣ يكتب نفسَ السؤال بـSQL — وهو للتشخيص من المحرّر،
// لا طريقًا ثانيًا للشاشة. **طريقان لسؤالٍ واحدٍ هما جوابان يتباعدان.**
export function stockedFolders({ storageId, categories, products, balances }) {
  const out = new Map()
  if (!storageId) return out

  // الأرصدةُ غيرُ الصفريّة في هذا المستودع وحدَه، مفهرسةً بالمنتج.
  const stockedProductIds = new Set(
    (balances || [])
      .filter((b) => b.storage_id === storageId && Number(b.balance_base) !== 0)
      .map((b) => b.product_id)
  )
  if (stockedProductIds.size === 0) return out

  for (const category of categories || []) {
    const ids = descendantIds(category, categories)
    const names = (products || [])
      .filter((p) => ids.has(p.category_id) && stockedProductIds.has(p.id))
      .map((p) => p.name)
      .sort((a, b) => String(a).localeCompare(String(b), 'ar'))

    if (names.length > 0) out.set(category.id, names)
  }

  return out
}

// 🔴 ما الذي يمنع الحفظَ الآن — الروابطُ المؤشَّرةُ سابقًا التي أُزيلت ولها رصيد.
//
// ⚠️ **المُزالُ وحدَه، لا كلُّ ما له رصيد.** مجلّدٌ فيه بضاعةٌ ويبقى مؤشَّرًا لا
// يمنع شيئًا — والحفظُ لا يمسّه أصلًا. والفرقُ ليس دقّةً زائدة: منعُ الحفظ
// لوجودِ رصيدٍ في مجلّدٍ **لم يُلمَس** يجعل نافذةَ مستودعٍ عامرٍ غيرَ قابلةٍ
// للحفظ إطلاقًا — فتصير القاعدةُ التي تحمي البضاعةَ هي التي تقفل الشاشة.
export function blockedUnticks({ existingKeys, selectedKeys, stocked }) {
  const wanted = new Set(selectedKeys || [])
  const blocked = []

  for (const key of existingKeys || []) {
    if (wanted.has(key)) continue
    const names = (stocked || new Map()).get(key)
    if (names && names.length > 0) blocked.push({ categoryId: key, products: names })
  }

  return blocked
}

// صفوفُ لوح التأشير بترتيب الشجرة وعمقِ كلِّ مجلّد.
//
// ⚠️ **بترتيب الشجرة لا بترتيب الجدول**، لأن قائمةً مسطّحةً تضع «شامبو» بعيدًا
// عن «شعر» الذي يعيش فيه تجعل التأشيرَ تخمينًا: من يؤشّر مجلّدًا أبًا يحتاج أن
// يرى ما تحته في نفس اللحظة — الرصيدُ الممنوعُ من الشيل قد يكون في ابنٍ لا في
// الأب نفسه.
//
// ⚠️ **والمؤرشَفةُ تظهر ولا تُخفى.** مستودعٌ يحفظ مجلّدًا أُرشف لاحقًا لا يزال
// يحفظه، وإخفاؤه من اللوح يجعل رابطًا قائمًا غيرَ مرئيّ — ثمّ يشيله أوّلُ حفظٍ
// بلا أن يطلب ذلك أحد، لأن `keyedLinkDiff` يحذف كلَّ ما ليس مؤشَّرًا. **مرشِّحُ
// عرضٍ يصير حذفًا.**
export function folderTickRows(categories) {
  const rows = []
  const walk = (nodes, depth) => {
    for (const node of nodes || []) {
      rows.push({ id: node.id, name: node.name, depth, archived: node.is_active === false })
      walk(node.children, depth + 1)
    }
  }
  walk(buildCategoryTree(categories), 0)
  return rows
}

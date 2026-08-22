import { orderFolderRows, allSelectableIds } from './orderFolderPick'

// 🔴 صفوفُ شاشة العرض — **سطورُ المستند مرجعًا، وكتالوجُ اليوم حشوًا.**
//
// ══════════════════════════════════════════════════════════════════
// الترتيبُ الذي أمر به المالك، وسببُ كونه ترتيبًا لا تفضيلًا
// ══════════════════════════════════════════════════════════════════
//
// ```
// ١. سطورُ المستند الحقيقيّة  ⟵ المرجعُ الأساسيّ، تُعرض كاملةً دائمًا بلا استثناء
// ٢. كتالوجُ اليوم            ⟵ بعدها، لملء الباقي — للحجم والشكل وحدَهما
// ```
//
// ⚠️ **والعكسُ يُضيّع بيانات، وهو ما حذّر منه المالك بلفظه:** «لو الفريق بنى
// الشاشة بمنطق «امشي على كتالوج اليوم وشوف مين منه بالمستند»، **هذا المنتج مش
// رح يظهر أصلاً بالحلقة** — يعني سطر حقيقي من المستند بيختفي بصمت».
//
// **والحالةُ ليست نظريّة:** منتجٌ شُطب من سنة ثمّ **أُرشِف** أو **حُذف** أو
// **فُكّ ربطُ مجلّده بهذا المستودع** — يخرج من كتالوج اليوم، **وسطرُه في المستند
// باقٍ في `stock_movements` إلى الأبد.**
//
// ⇒ **فالمشيةُ تبدأ من الكتالوج للحشو، ثمّ يُسأل: أيُّ سطرٍ لم يُرسم بعد؟**
// **وكلُّ ما لم يُرسم يُرسم**، تحت فئته الأصليّة إن حُلّت، وإلّا تحت مجموعةٍ
// احتياطيّةٍ مسمّاة.
//
// ⚠️ **وهذا يقلب قرارًا سابقًا للمالك، والقلبُ قرارُه هو:** «خيار ب مرفوض لأنه
// يوهم بوجود اختيار لم يُسجَّل» ⟵ ثمّ «القرار: خيار ب على الشاشات الأربع».
// **واعتراضُه الأوّلُ يعالجه أن صفوفَ الحشو تُوسَم وتُعرض أعمدتُها «—»** — فلا
// تُقرأ اختيارًا وقع.

// المجموعةُ الاحتياطيّةُ لسطرٍ لا يُحلّ مجلّدُه — **معرِّفٌ لا اسم**،
// والاسمُ مفتاحُ ترجمةٍ تختاره الشاشة.
export const ORPHAN_GROUP = '__orphan__'

// ⚠️ **الفرزُ نفسُه الذي تستعمله شاشةُ الإنشاء حرفيًّا** (`writeOffGrid.js:97`
// و`orderGrid.js:170`) — **ونسخةٌ ثانيةٌ منه ترتّب الشاشتين ترتيبين.**
const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'ar')

// يُبنى صفٌّ لكلّ سطرِ مستند، وصفٌّ لكلّ منتجٍ في الكتالوج بلا سطر.
//
// `lines`        سطورُ هذا المستند وحدَها، بترتيبها المحفوظ
// `productIdOf`  كيف يُقرأ معرِّفُ المنتج من السطر — يختلف بين الحركة وسطر الطلبيّة
//
// يُرجع مصفوفةً مرتّبةً من:
//   { kind: 'folder',  id, name, depth, childCount }
//   { kind: 'line',    line, product }        ← سطرُ مستندٍ حقيقيّ
//   { kind: 'filler',  product }              ← منتجٌ من كتالوج اليوم بلا سطر
export function documentViewRows({
  lines, productIdOf, products, categories, storageCategories, storageId,
} = {}) {
  const readId = productIdOf || ((line) => line.product_id)

  // ① المرجعُ الأساسيّ — سطورُ المستند، مفهرَسةً بمنتجها وبترتيبها.
  const byProduct = new Map()
  for (const line of lines || []) {
    const id = readId(line)
    if (!byProduct.has(id)) byProduct.set(id, [])
    byProduct.get(id).push(line)
  }

  const productsById = new Map((products || []).map((p) => [p.id, p]))
  const categoriesById = new Map((categories || []).map((c) => [c.id, c]))

  const rows = []
  const drawn = new Set()

  // ② كتالوجُ اليوم — **مجلّداتُ هذا المستودع، بترتيب الشجرة وعمقها**، وهي
  // حالةُ الفتح الافتراضيّةُ لشاشة الإنشاء (`allSelectableIds`).
  const folders = orderFolderRows({ categories, storageId, links: storageCategories })
  const selectable = new Set(allSelectableIds(folders))

  for (const folder of folders) {
    if (!selectable.has(folder.id)) continue

    // ⚠️ **`is_active !== false` كما في شاشة الإنشاء** — والمؤرشَفُ يخرج من
    // الحشو، **ويعود بسطره الحقيقيِّ في ③ إن كان في المستند.**
    const own = (products || [])
      .filter((p) => p && p.category_id === folder.id && p.is_active !== false)
      .sort(byName)

    const children = []
    for (const product of own) {
      const mine = byProduct.get(product.id)
      if (mine && mine.length > 0) {
        for (const line of mine) children.push({ kind: 'line', line, product })
        drawn.add(product.id)
      } else {
        children.push({ kind: 'filler', product })
      }
    }

    // **صفُّ المجلّد يُرسم دائمًا** — كما ترسمه شاشةُ الإنشاء، **وبلا مجموعِ
    // عبوات**: ذاك جمعٌ عبر السطور، محظورٌ بـد/١.
    rows.push({ kind: 'folder', id: folder.id, name: folder.name, depth: folder.depth, childCount: children.length })
    rows.push(...children)
  }

  // ③ 🔴 **ما لم يُرسم بعد** — وهو الشرطُ الذي يمنع ضياعَ سطرٍ حقيقيّ.
  //
  // **ولا يُسأل «لماذا غاب؟»** — أُرشِف، أو حُذف، أو فُكّ ربطُ مجلّده، أو صار
  // مجلّدُه عابرًا: **الأسبابُ كثيرةٌ والحكمُ واحد.** ⇒ **يُرسم.**
  const orphans = new Map()
  for (const [productId, mine] of byProduct) {
    if (drawn.has(productId)) continue
    const product = productsById.get(productId) || null
    // فئتُه الأصليّةُ إن كانت ما زالت معرَّفة، وإلّا المجموعةُ الاحتياطيّة.
    const category = product && categoriesById.get(product.category_id)
    const key = category ? category.id : ORPHAN_GROUP
    if (!orphans.has(key)) orphans.set(key, [])
    for (const line of mine) orphans.get(key).push({ kind: 'line', line, product })
  }

  // ⚠️ **الاحتياطيّةُ أخيرًا دائمًا** — فلا تتقدّم مجموعةٌ بلا اسمٍ على مجموعةٍ
  // مسمّاة، **والترتيبُ ثابتٌ لا يتبدّل بترتيب `Map`.**
  const named = [...orphans.keys()].filter((k) => k !== ORPHAN_GROUP)
    .sort((a, b) => byName(categoriesById.get(a), categoriesById.get(b)))

  for (const key of named) {
    const category = categoriesById.get(key)
    rows.push({ kind: 'folder', id: key, name: category.name, depth: 0, childCount: orphans.get(key).length })
    rows.push(...orphans.get(key))
  }

  if (orphans.has(ORPHAN_GROUP)) {
    rows.push({
      kind: 'folder', id: ORPHAN_GROUP, name: null, depth: 0,
      childCount: orphans.get(ORPHAN_GROUP).length,
    })
    rows.push(...orphans.get(ORPHAN_GROUP))
  }

  return rows
}

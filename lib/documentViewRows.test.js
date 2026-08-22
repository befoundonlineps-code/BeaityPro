import { documentViewRows, ORPHAN_GROUP } from './documentViewRows'

// 🔴 المرجعُ سطورُ المستند، والكتالوجُ حشو — **والحالةُ الحافّةُ مُختبَرةٌ صراحةً.**
//
// ⚠️ **الأشكالُ منسوخةٌ من صفوف القاعدة لا مخترَعة:** `product_categories`
// بـ`parent_id`، و`products` بـ`category_id` و`is_active`، وجدولُ الربط
// `storage_categories` بـ`storage_id` و`category_id`.
const ST = 'st-1'

const cat = (id, name, parent = null) => ({ id, name, parent_id: parent, is_active: true })
const prod = (id, name, categoryId, active = true) => ({
  id, name, category_id: categoryId, is_active: active, base_unit: 'pcs',
})
const link = (categoryId) => ({ storage_id: ST, category_id: categoryId })
const move = (id, productId) => ({ id, product_id: productId, quantity_base: -5 })

const base = {
  categories: [cat('c-1', 'شعر'), cat('c-2', 'مكياج')],
  products: [prod('p-1', 'شامبو', 'c-1'), prod('p-2', 'بلسم', 'c-1'), prod('p-3', 'أحمر', 'c-2')],
  storageCategories: [link('c-1'), link('c-2')],
  storageId: ST,
}

const kinds = (rows) => rows.map((r) => (r.kind === 'folder'
  ? `📁 ${r.name ?? '(احتياطيّة)'}`
  : `${r.kind === 'line' ? '📄' : '⬜'} ${r.product?.name ?? '(محذوف)'}`))

describe('documentViewRows — الكتالوجُ حشوٌ لا مرجع', () => {
  it('كلُّ منتجات الكتالوج تظهر، وما في المستند سطرٌ وما عداه حشو', () => {
    const rows = documentViewRows({ ...base, lines: [move('m-1', 'p-2')] })
    // ⚠️ **الفرزُ عربيٌّ داخل المجلّد** — «بلسم» قبل «شامبو»، كما في شاشة الإنشاء.
    expect(kinds(rows)).toEqual([
      '📁 شعر',
      '📄 بلسم',      // ← في المستند
      '⬜ شامبو',      // ← حشوٌ من كتالوج اليوم
      '📁 مكياج',
      '⬜ أحمر',
    ])
  })

  it('⚠️ ومجلّدٌ بلا منتجاتٍ يُرسم كما ترسمه شاشةُ الإنشاء', () => {
    const rows = documentViewRows({
      ...base,
      categories: [...base.categories, cat('c-3', 'عطور')],
      storageCategories: [...base.storageCategories, link('c-3')],
      lines: [],
    })
    const empty = rows.find((r) => r.kind === 'folder' && r.name === 'عطور')
    expect(`عطور ⟵ مرسومٌ بـ${empty?.childCount} منتجًا`).toBe('عطور ⟵ مرسومٌ بـ0 منتجًا')
  })
})

// ══════════════════════════════════════════════════════════════════
// 🔴 الحالةُ الحافّةُ التي طلب المالكُ اختبارَها بالاسم
// ══════════════════════════════════════════════════════════════════
//
// «منتج كان جزء من مستند قديم لكن **انحذف أو تغيّر اسمه** بكتالوج اليوم —
// **لازم يضل يظهر بسطره الحقيقي**، حتى لو مش موجود بحلقة كتالوج اليوم. لا يجوز
// إسقاطه لمجرد إنه مش بالقائمة الحالية.»
describe('🔴 سطرٌ حقيقيٌّ لمنتجٍ خارج كتالوج اليوم — لا يسقط أبدًا', () => {
  it('🔴 المنتجُ محذوفٌ من الكتالوج تمامًا ⟵ يظهر في المجموعة الاحتياطيّة', () => {
    // **لا صفَّ له في `products` إطلاقًا** — وهو الحذفُ الحقيقيّ.
    const rows = documentViewRows({ ...base, lines: [move('m-9', 'p-غائب')] })

    const line = rows.find((r) => r.kind === 'line' && r.line.id === 'm-9')
    expect(`سطرُ المحذوف ظهر ⟵ ${!!line}`).toBe('سطرُ المحذوف ظهر ⟵ true')
    expect(`ومنتجُه غيرُ محلول ⟵ ${line.product === null}`).toBe('ومنتجُه غيرُ محلول ⟵ true')

    // وتحت مجموعةٍ احتياطيّةٍ مسمّاةٍ بمعرِّفها، **آخرَ الصفوف.**
    const group = rows.filter((r) => r.kind === 'folder').at(-1)
    expect(`المجموعةُ الأخيرة ⟵ ${group.id}`).toBe(`المجموعةُ الأخيرة ⟵ ${ORPHAN_GROUP}`)
    expect(rows.indexOf(group)).toBeLessThan(rows.indexOf(line))
  })

  it('🔴 المنتجُ مؤرشَفٌ ⟵ يخرج من الحشو ويعود بسطره تحت فئته الأصليّة', () => {
    const rows = documentViewRows({
      ...base,
      products: [...base.products, prod('p-4', 'كريم قديم', 'c-2', false)],
      lines: [move('m-8', 'p-4')],
    })

    // ⚠️ **لا يظهر حشوًا** — الحشوُ يرشّح `is_active !== false` كشاشة الإنشاء.
    const filler = rows.find((r) => r.kind === 'filler' && r.product.id === 'p-4')
    expect(`المؤرشَفُ حشوًا ⟵ ${!!filler}`).toBe('المؤرشَفُ حشوًا ⟵ false')

    // **ويظهر سطرًا حقيقيًّا، تحت «مكياج» فئتِه الأصليّة.**
    const line = rows.find((r) => r.kind === 'line' && r.line.id === 'm-8')
    expect(`سطرُ المؤرشَف ظهر ⟵ ${!!line}`).toBe('سطرُ المؤرشَف ظهر ⟵ true')
    expect(`واسمُه محلولٌ ⟵ ${line.product?.name}`).toBe('واسمُه محلولٌ ⟵ كريم قديم')

    const groups = rows.filter((r) => r.kind === 'folder')
    const its = groups.filter((g) => g.name === 'مكياج')
    expect(`مجموعتُه مسمّاةٌ لا احتياطيّة ⟵ ${its.length > 0}`).toBe('مجموعتُه مسمّاةٌ لا احتياطيّة ⟵ true')
  })

  it('🔴 مجلّدُه فُكّ ربطُه بالمستودع ⟵ يعود بسطره تحت اسم مجلّده', () => {
    const rows = documentViewRows({
      ...base,
      // **«مكياج» لم يعد مربوطًا بهذا المستودع** — فلا يمشيه الحشو.
      storageCategories: [link('c-1')],
      lines: [move('m-7', 'p-3')],
    })

    const walked = rows.some((r) => r.kind === 'filler' && r.product.id === 'p-3')
    expect(`ظهر حشوًا ⟵ ${walked}`).toBe('ظهر حشوًا ⟵ false')

    const line = rows.find((r) => r.kind === 'line' && r.line.id === 'm-7')
    expect(`وسطرُه ظهر ⟵ ${!!line}`).toBe('وسطرُه ظهر ⟵ true')
    const group = rows.filter((r) => r.kind === 'folder').at(-1)
    expect(`تحت مجلّده المسمّى ⟵ ${group.name}`).toBe('تحت مجلّده المسمّى ⟵ مكياج')
  })

  it('🔴 ولا سطرَ واحدٌ يسقط — مقيسٌ بالعدّ لا بالنظر', () => {
    // ⚠️ **العدُّ وحدَه أعمى عن «رُسم مرّتين وسقط واحد»** — فمعه «كلُّ معرِّفٍ
    // مرّةً واحدة»، وهي بالضبط ما تنتجه حلقةٌ متداخلةٌ غلط.
    const lines = [move('m-1', 'p-1'), move('m-2', 'p-1'), move('m-3', 'p-3'),
      move('m-4', 'غائب-أ'), move('m-5', 'غائب-ب')]
    const rows = documentViewRows({ ...base, lines })

    const drawn = rows.filter((r) => r.kind === 'line').map((r) => r.line.id)
    expect(`عددُ السطور المرسومة ⟵ ${drawn.length}`).toBe(`عددُ السطور المرسومة ⟵ ${lines.length}`)
    expect(`بلا تكرار ⟵ ${new Set(drawn).size === lines.length}`).toBe('بلا تكرار ⟵ true')
    expect(drawn.sort()).toEqual(lines.map((l) => l.id).sort())
  })

  it('⚠️ ومنتجٌ بسطرين (دفعتان) يُرسم سطرين لا صفًّا واحدًا', () => {
    const rows = documentViewRows({ ...base, lines: [move('m-1', 'p-1'), move('m-2', 'p-1')] })
    const mine = rows.filter((r) => r.kind === 'line' && r.product?.id === 'p-1')
    expect(`سطورُ شامبو ⟵ ${mine.length}`).toBe('سطورُ شامبو ⟵ 2')
    // **ولا صفَّ حشوٍ له** — له سطورٌ فعلًا.
    expect(rows.some((r) => r.kind === 'filler' && r.product.id === 'p-1')).toBe(false)
  })

  it('✅ ومعرِّفُ المنتج يُقرأ بدالّةٍ — لسطور الطلبيّة شكلٌ آخر', () => {
    const rows = documentViewRows({
      ...base,
      lines: [{ id: 'ol-1', productId: 'p-3' }],
      productIdOf: (line) => line.productId,
    })
    const line = rows.find((r) => r.kind === 'line')
    expect(`سطرُ الطلبيّة حُلّ ⟵ ${line?.product?.name}`).toBe('سطرُ الطلبيّة حُلّ ⟵ أحمر')
  })
})

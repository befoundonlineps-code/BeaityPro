const {
  ORDER_PRICE_COLUMN, packagesOf, numberInBase, amountOf,
  orderGridRows, orderGridTotal, orderLinesFromGrid,
} = require('./orderGrid')

// شجرةٌ فيها تداخلٌ حقيقيّ — أبٌ وابنٌ **كلاهما يحمل منتجات**، لأن هذه هي
// الحالةُ الوحيدةُ التي تفرّق بين العضويّة المباشرة والوراثيّة. شجرةٌ مسطّحةٌ
// تمرّ من التفسيرين معًا، وهي بالضبط ما تعرضه لقطاتُ المرجع.
const categories = [
  { id: 'skin', name: 'العناية بالبشرة', parent_id: null },
  { id: 'peel', name: 'التقشير', parent_id: 'skin' },
  { id: 'empty', name: 'مجلّدٌ بلا منتجات', parent_id: null },
]

const products = [
  { id: 'p1', name: 'كريم', category_id: 'skin', units_per_package: 15, base_unit: 'ml', package_price: 200 },
  { id: 'p2', name: 'مقشّر', category_id: 'peel', units_per_package: 1, base_unit: 'pcs', package_price: 80 },
  { id: 'p3', name: 'بلا سعر', category_id: 'peel', units_per_package: 1, base_unit: 'pcs', package_price: null },
  { id: 'p4', name: 'مؤرشف', category_id: 'skin', units_per_package: 1, base_unit: 'pcs', package_price: 10, is_active: false },
]

const balances = [
  { storage_id: 's1', product_id: 'p1', balance_base: 30 },
  { storage_id: 's2', product_id: 'p1', balance_base: 999 },
]

const rowsFor = (packages, folders = ['skin', 'peel', 'empty']) => orderGridRows({
  selectedFolderIds: folders, categories, products, balances, storageId: 's1', packages,
})

describe('عمودا «نمبر» و«الأماونت»', () => {
  it('«نمبر» = الباكيج × ما في العبوة', () => {
    expect(numberInBase(products[0], '2')).toBe(30)
    expect(numberInBase(products[1], '7')).toBe(7)
  })

  it('الفراغُ يبقى فراغًا ولا يصير صفرًا — في العمودين معًا', () => {
    // ⚠️ الحارسُ الذي يمنع عودةَ `Number('') === 0`. صفرٌ هنا يعني سطرًا طُلب
    // بكمّيّةٍ صفريّة، والفراغُ يعني سطرًا لم يُطلب — ولا شيءَ في الشاشة يفرّق
    // بينهما بعد الحفظ.
    expect(packagesOf('')).toBeNull()
    expect(packagesOf('   ')).toBeNull()
    expect(numberInBase(products[0], '')).toBeNull()
    expect(amountOf(products[0], '')).toBeNull()
  })

  it('الباكيج غيرُ الموجب لا يُقرأ كميّة', () => {
    expect(packagesOf('0')).toBeNull()
    expect(packagesOf('-3')).toBeNull()
    expect(packagesOf('نص')).toBeNull()
  })

  it('«الأماونت» يعطي عدمًا حين لا سعرَ مذكور — لا صفرًا', () => {
    // «لا سعرَ متّفقٌ عليه» ليست «يساوي لا شيء». وصفرٌ هنا يدخل المجموعَ بلا أن
    // يظهر، فينزل المجموعُ بصمتٍ بمقدار سطرٍ كامل.
    expect(amountOf(products[2], '5')).toBeNull()
    expect(amountOf(products[0], '3')).toBe(600)
  })

  it('السعرُ يُقرأ من العمود المسمّى، لا من اسمٍ مكتوبٍ في مكانين', () => {
    // ⚠️ يسقط لحظةَ تغيير الثابتة بلا تغيير هذا الاختبار — وهو المقصود: تحويلُ
    // السعر إلى `nominal_purchase_price` قرارُ مالكٍ يستحقّ أن يوقف أحدًا مرّة،
    // لا تعديلًا صامتًا في سطر.
    expect(ORDER_PRICE_COLUMN).toBe('package_price')
    const product = { units_per_package: 1, [ORDER_PRICE_COLUMN]: 12.5 }
    expect(amountOf(product, '4')).toBe(50)
  })

  it('التقريبُ إلى خانتين، بنفس طريقة الرقم المكتوب', () => {
    const product = { units_per_package: 1, package_price: 1.005 }
    // `1.005 × 100` تساوي 100.49999999999999 بالثنائيّ — والضربُ يعطي 1.00
    expect(amountOf(product, '1')).toBe(1.01)
  })
})

describe('صفوفُ الجدول', () => {
  it('المنتجُ يظهر تحت مجلّده المباشر ولا يتكرّر حين يكون الأبُ والابنُ مؤشَّرَين', () => {
    // 🔴 الحارسُ الأهمّ هنا. العضويّةُ الوراثيّة تضع «مقشّر» تحت «التقشير»
    // وتحت «العناية بالبشرة» معًا — سطران لنفس المنتج في طلبيّةٍ واحدة،
    // ومبلغُه في المجموع مرّتين.
    const rows = rowsFor({ p2: '3' })
    const appearances = rows.filter((r) => r.kind === 'product' && r.id === 'p2')
    expect(appearances).toHaveLength(1)
    expect(appearances[0].folderId).toBe('peel')
  })

  it('المؤرشَفُ من المنتجات لا يُعرض', () => {
    const rows = rowsFor({})
    expect(rows.some((r) => r.id === 'p4')).toBe(false)
  })

  it('المجلّدُ المؤشَّرُ الفارغُ يُعرض ولا يُسقَط', () => {
    // اختارَه المستخدمُ بيده، فاختفاؤه يجعله يبحث عمّا أشّرَه ولا يجده.
    const rows = rowsFor({})
    const folder = rows.find((r) => r.kind === 'folder' && r.id === 'empty')
    expect(folder).toBeDefined()
    expect(folder.childCount).toBe(0)
  })

  it('«الرصيد الحاليّ» من هذا المستودع وحدَه', () => {
    // ⚠️ حبّةُ الرقم. الصفُّ نفسُه موجودٌ بـ999 في مستودعٍ آخر، وقراءتُه هنا
    // تجعل الشاشةَ تقول «عندك بضاعة» عن رفٍّ فارغ.
    const rows = rowsFor({})
    expect(rows.find((r) => r.id === 'p1').inStock).toBe(30)
    expect(rows.find((r) => r.id === 'p2').inStock).toBe(0)
  })

  it('كلُّ صفِّ منتجٍ يحمل وحدتَه، ولا تُطبع وحدةٌ ثابتة', () => {
    // ⚠️ خللُ المرجع الذي لا يُنسخ: `0.0 pcs (0 ml)` لمنتجٍ وحدتُه ml.
    const rows = rowsFor({})
    expect(rows.find((r) => r.id === 'p1').unit).toBe('ml')
    expect(rows.find((r) => r.id === 'p2').unit).toBe('pcs')
  })

  it('صفُّ المجلّد مجموعُ أبنائه، وعدمٌ قبل أن يُكتب شيء', () => {
    const before = rowsFor({})
    expect(before.find((r) => r.kind === 'folder' && r.id === 'peel').packages).toBeNull()

    const after = rowsFor({ p2: '3', p3: '4' })
    expect(after.find((r) => r.kind === 'folder' && r.id === 'peel').packages).toBe(7)
  })

  it('لا مجلّداتٍ مؤشَّرةً يعني لا صفوف', () => {
    expect(orderGridRows({ selectedFolderIds: [], categories, products })).toEqual([])
  })
})

describe('المجموعُ الكلّيّ', () => {
  it('يُحسب من صفوف المنتجات وحدَها ولا يعدّ صفَّ المجلّد', () => {
    // 🔴 صفُّ المجلّد يحمل مجموعَ الباكيجات؛ لو دخل الحسابَ لتضاعف كلُّ مبلغ.
    const rows = rowsFor({ p1: '2', p2: '3' })
    expect(orderGridTotal(rows).total).toBe(2 * 200 + 3 * 80)
  })

  it('يقول كم سطرًا مسعَّرًا من كم — لا رقمًا واحدًا', () => {
    const rows = rowsFor({ p2: '3', p3: '4' })
    const totals = orderGridTotal(rows)
    expect(totals).toEqual({ total: 240, priced: 1, lines: 2 })
  })

  it('«لا أسعارَ إطلاقًا» عدمٌ لا صفر', () => {
    const rows = rowsFor({ p3: '4' })
    expect(orderGridTotal(rows).total).toBeNull()
  })
})

describe('السطورُ التي تُكتب', () => {
  it('ما كُتب له باكيجٌ فقط، بإطار العبوة وترتيبٍ صريح', () => {
    const rows = rowsFor({ p1: '2', p3: '5' })
    expect(orderLinesFromGrid(rows)).toEqual([
      { productId: 'p1', enteredQuantity: 2, enteredUom: 'package', sortOrder: 0 },
      { productId: 'p3', enteredQuantity: 5, enteredUom: 'package', sortOrder: 1 },
    ])
  })

  it('لا سطرَ لصفٍّ عُرض ولم يُكتب فيه شيء', () => {
    expect(orderLinesFromGrid(rowsFor({}))).toEqual([])
  })

  it('الترتيبُ مكتوبٌ صراحةً ولا يُترك للافتراضيّ', () => {
    // ⚠️ `sort_order` افتراضُه 0، ووصفُ العمود في القاعدة يسمّيه فخًّا: كلُّ
    // الصفوف تقول 0 ⇒ `order by sort_order` يعيدها بلا ترتيبٍ معرَّف.
    const lines = orderLinesFromGrid(rowsFor({ p1: '1', p2: '1', p3: '1' }))
    expect(lines.map((l) => l.sortOrder)).toEqual([0, 1, 2])
  })
})

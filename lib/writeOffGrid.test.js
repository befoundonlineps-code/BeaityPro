import {
  remainingByLot, lotsForLine, defaultLotId, availableForWriteOff, canWriteOff,
} from './lotPicker'
import {
  amountOf, writeOffGridRows, writeOffTotal, writeOffLinesFromGrid,
} from './writeOffGrid'

// الأشكالُ منسوخةٌ من صفوف القاعدة لا مخترَعة: `stock_lots` بـ`received_at`
// و`created_at` نصَّي `timestamptz`، و`stock_movements` بـ`quantity_base` رقمًا.
const STORAGE = 'st-1'
const OTHER = 'st-2'

const lot = (id, received, cost, extra = {}) => ({
  id,
  salon_id: 'sa-1',
  storage_id: STORAGE,
  product_id: 'p-1',
  received_at: received,
  created_at: `${received}T00:00:00+00:00`,
  unit_cost: cost,
  cost_is_estimated: false,
  ...extra,
})

const move = (lotId, qty) => ({ lot_id: lotId, quantity_base: qty })

// معاملُ التعبئة ١ إلّا حيث يُذكر، فالعبوةُ والقطعةُ سواء ويقرأ الاختبارُ نفسَه.
const product = (id, name, per = 1, unit = 'pcs') => ({
  id, name, category_id: 'f-1', is_active: true,
  units_per_package: per, base_unit: unit,
})

const CATEGORIES = [{ id: 'f-1', name: 'مجلّد', parent_id: null, salon_id: 'sa-1' }]

describe('lotPicker — المتبقّي مشتقٌّ والترتيبُ تامّ', () => {
  it('يجمع الحركات على الدفعة: الداخلُ موجبٌ والخارجُ سالب', () => {
    const index = remainingByLot([move('a', 10), move('a', -3), move('b', 6)])
    expect(index.get('a')).toBe(7)
    expect(index.get('b')).toBe(6)
  })

  it('يطوي الدفعةَ المستنفَدة ولا يعرضها', () => {
    const rows = lotsForLine({
      lots: [lot('a', '2026-08-01', 5), lot('b', '2026-08-02', 8)],
      movements: [move('a', 10), move('a', -10), move('b', 6)],
      storageId: STORAGE,
      productId: 'p-1',
    })
    // ⚠️ الدفعةُ `a` صفرٌ فتُطوى — **وعرضُها يجعل المستخدمَ يختار ما سيُرفض.**
    expect(rows.map((r) => r.id)).toEqual(['b'])
  })

  it('لا يخلط مستودعًا بمستودع', () => {
    const rows = lotsForLine({
      lots: [lot('a', '2026-08-01', 5, { storage_id: OTHER })],
      movements: [move('a', 10)],
      storageId: STORAGE,
      productId: 'p-1',
    })
    expect(rows).toEqual([])
  })

  it('🔴 يفرز دفعتين وصلتا في نفس اليوم فرزًا ثابتًا — والترتيبُ تامّ', () => {
    // ⚠️ هذه هي الحالةُ التي يسقط فيها الترتيبُ الجزئيّ: `received_at` واحدٌ
    // للاثنتين، **فلولا `created_at` لأعطى الفرزُ قراءتين لنفس السؤال.**
    const a = lot('a', '2026-08-01', 5)
    const b = lot('b', '2026-08-01', 8)
    a.created_at = '2026-08-01T09:00:00+00:00'
    b.created_at = '2026-08-01T07:00:00+00:00'

    const rows = lotsForLine({
      lots: [a, b], movements: [move('a', 10), move('b', 6)],
      storageId: STORAGE, productId: 'p-1',
    })
    expect(rows.map((r) => r.id)).toEqual(['b', 'a'])
    expect(defaultLotId(rows)).toBe('b')
  })

  it('لو أُسقط created_at من الصفّ لانهار الفرزُ إلى جزئيّ — بيّنةٌ مضادّة', () => {
    // نسخةٌ لا الأصل: يُنزع الحقلُ من المُدخَل نفسِه فيصير الفرزُ بلا فاصلٍ ثانٍ.
    const a = { ...lot('a', '2026-08-01', 5), created_at: null }
    const b = { ...lot('b', '2026-08-01', 8), created_at: null }
    const rows = lotsForLine({
      lots: [b, a], movements: [move('a', 10), move('b', 6)],
      storageId: STORAGE, productId: 'p-1',
    })
    // يسقط الفصلُ إلى `id`، وهو ثابتٌ كذلك — **فالثباتُ محفوظٌ والأقدميّةُ لا.**
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('التوفّرُ مجموعُ المتبقّي، والقاعدةُ (أ) تُقرأ منه', () => {
    const rows = lotsForLine({
      lots: [lot('a', '2026-08-01', 5), lot('b', '2026-08-02', 8)],
      movements: [move('a', 10), move('a', -4), move('b', 6)],
      storageId: STORAGE, productId: 'p-1',
    })
    expect(availableForWriteOff(rows)).toBe(12)
    expect(canWriteOff(rows)).toBe(true)
    expect(canWriteOff([])).toBe(false)
  })
})

// ==========================================================================
// 🔴 حارسُ الصنف — `Number()` العارية ممنوعةٌ في مكتبتَي الشطب
//
// **الصنفُ وقع أربعَ مرّاتٍ الآن**: خانةُ سعر التوريد (`Number('')`) · قيمةُ
// الجرد · `amountOf` هنا (`Number(null)`) · **ثمّ `lotPicker` بعده بسطور، بعد
// إصلاح الأوّل بساعة.** ⇒ فالمراجعُ طلب مسحًا، **والمسحُ يغلق الماضيَ وحدَه.**
//
// ⚠️ **والحارسُ يصف الشكلَ لا يعدّ الأسماء**، فيفشل مغلقًا: أيُّ `Number(`
// جديدةٍ في هذين الملفّين تُسقط الحزمة، فيقف عليها إنسانٌ مرّةً ويقرّر —
// يستعمل `numberOrNull` أو يضيفها للمستثنى بسببها.
//
// ⚠️ **والمستثنى `Number.isFinite` وأخواتها** (توابعُ ساكنةٌ لا تحويلٌ)، **و
// `numberOrNull` نفسُها تعيش في `decimalPlaces` لا هنا** فلا تحتاج استثناءً.
// ==========================================================================
describe('حارسُ التحويل — لا Number() عاريةً في مسار المال', () => {
  const fs = require('fs')
  const path = require('path')

  const GUARDED = ['lotPicker.js', 'writeOffGrid.js']

  it.each(GUARDED)('%s لا يحوّل بلا فحصِ غياب', (name) => {
    const text = fs.readFileSync(path.join(__dirname, name), 'utf8')
    // التعليقاتُ تُنزع أوّلًا: هذا الملفُّ وأخوه يشرحان العلّةَ بذكر
    // `Number(null)` نصًّا، **وعدّادٌ يلتقط الشرحَ يجبرنا على حذف الشرح**
    // إرضاءً له — وهي العلّةُ المسجّلة في البند ٢ب حرفيًّا.
    const code = text.split(/\r?\n/).filter((line) => !line.trim().startsWith('//')).join('\n')
    const bare = code.match(/\bNumber\((?!\s*\))/g) || []
    expect(bare).toEqual([])
  })

  it('يعضّ على نصٍّ فيه تحويلٌ عارٍ — بيّنةٌ مضادّةٌ على نسخة', () => {
    const broken = 'const price = Number(lot.unit_cost)\n'
    expect(broken.match(/\bNumber\((?!\s*\))/g)).toHaveLength(1)
    // ولا يعضّ على التوابع الساكنة ولا على المُساعِد المشترك.
    expect('Number.isFinite(n)'.match(/\bNumber\((?!\s*\))/g)).toBeNull()
    expect('numberOrNull(v)'.match(/\bNumber\((?!\s*\))/g)).toBeNull()
  })
})

// ==========================================================================
// 🔴 رفوضُ الشطب الأربعةُ تصل الشاشةَ مترجَمة، لا «صار خطأ غير متوقّع»
//
// **بلاغُ المالك:** شُطب ١١ من دفعةٍ متبقّيها ١٠، **فرُفض بحقّ** — وعرضت الشاشةُ
// العامّةَ بدل جملة `lot_insufficient`.
//
// ⚠️ **والعامّةُ تُخفي التشخيصَ كما تُخفي السبب:** لا يُعرف من الشاشة أكان الرفضُ
// هو المتوقَّع أم خطأً آخر. **فهذا الفحصُ يقيس الخريطةَ نفسَها** قبل أن يُلام
// نقلٌ أو تبويبٌ قديم — وهو الفرقُ بين «قِسْت» و«خمّنت».
// ==========================================================================
describe('رفوضُ الشطب تصل مترجَمةً', () => {
  const { dbErrorKey } = require('./dbErrors')

  // شكلُ خطأ PostgREST عن `raise exception … using hint` — `P0001` والرمزُ
  // بالرسالة والجملةُ العربيّة بالتلميح.
  const raised = (message) => ({ code: 'P0001', message, hint: 'جملةٌ عربيّةٌ من القاعدة', details: null })

  it.each([
    ['lot_insufficient', 'products:stock.lotInsufficient'],
    ['lot_not_in_storage', 'products:stock.lotNotInStorage'],
    ['write_off_needs_lot', 'products:stock.writeOffNeedsLot'],
    ['lot_pick_requires_issue', 'products:stock.lotPickRequiresIssue'],
  ])('%s ⟵ %s', (code, key) => {
    expect(dbErrorKey(raised(code))).toBe(key)
  })

  it('والمجهولُ وحدَه يبقى عامًّا — بيّنةٌ مضادّة', () => {
    // ⚠️ بلا هذا السطر يمرّ الفحصُ على خريطةٍ ترجع نفسَ المفتاح لكلّ شيء.
    expect(dbErrorKey({ code: 'XX000', message: 'boom' })).toBe('common:dbError.unexpected')
  })
})

describe('writeOffGrid — المبلغُ بثمن الدفعة', () => {
  it('🔴 يضرب في العدد بالوحدة الأساسيّة لا في العبوات — ومقيسٌ بمنتجَين', () => {
    // اللقطةُ الخامسة: ٢٠ عبوة ⟵ 20 pcs ⟵ 4,000 · و٢٠ عبوة ⟵ 1,000 ml ⟵ 2,000.
    expect(amountOf(product('p', 'قطع', 1), '20', 200)).toBe(4000)
    expect(amountOf(product('p', 'مل', 50, 'ml'), '20', 2)).toBe(2000)
  })

  it('لا مبلغَ بلا كمّيّة، ولا بثمنٍ غيرِ صالح', () => {
    expect(amountOf(product('p', 'x'), '', 200)).toBeNull()
    expect(amountOf(product('p', 'x'), '20', null)).toBeNull()
    expect(amountOf(product('p', 'x'), '20', -1)).toBeNull()
  })
})

describe('writeOffGrid — الصفوفُ والقاعدةُ (أ) والانقسام', () => {
  const base = {
    selectedFolderIds: ['f-1'],
    categories: CATEGORIES,
    storageId: STORAGE,
  }

  it('🔴 منتجٌ بلا دفعاتٍ يُعرض ومعطَّلًا، لا يُخفى', () => {
    const rows = writeOffGridRows({
      ...base,
      products: [product('p-1', 'شامبو')],
      lots: [], movements: [], picks: {},
    })
    const line = rows.find((r) => r.kind === 'product')
    expect(line).toBeDefined()
    expect(line.locked).toBe(true)
    expect(line.inStock).toBe(0)
  })

  it('يختار الأقدمَ افتراضيًّا، ويحسب المبلغَ بثمنها هي', () => {
    const rows = writeOffGridRows({
      ...base,
      products: [product('p-1', 'شامبو')],
      lots: [lot('a', '2026-08-01', 5), lot('b', '2026-08-02', 8)],
      movements: [move('a', 10), move('b', 6)],
      picks: { 'p-1': [{ lotId: 'a', packages: '4' }] },
    })
    const line = rows.find((r) => r.kind === 'product')
    expect(line.locked).toBe(false)
    expect(line.split).toBe(false)
    // ⚠️ الأقدمُ ثمنُها ٥، **ولو قُرئ ثمنُ الأحدث لصار ٣٢.**
    expect(line.amount).toBe(20)
    expect(line.picks[0].lotId).toBe('a')
  })

  it('🔴 المستوى الثالثُ يظهر عند الانقسام وحدَه', () => {
    const single = writeOffGridRows({
      ...base,
      products: [product('p-1', 'شامبو')],
      lots: [lot('a', '2026-08-01', 5)],
      movements: [move('a', 10)],
      picks: { 'p-1': [{ lotId: 'a', packages: '2' }] },
    })
    expect(single.filter((r) => r.kind === 'lot')).toHaveLength(0)

    const split = writeOffGridRows({
      ...base,
      products: [product('p-1', 'شامبو')],
      lots: [lot('a', '2026-08-01', 5), lot('b', '2026-08-02', 8)],
      movements: [move('a', 10), move('b', 6)],
      picks: { 'p-1': [{ lotId: 'a', packages: '10' }, { lotId: 'b', packages: '3' }] },
    })
    const lotRows = split.filter((r) => r.kind === 'lot')
    expect(lotRows).toHaveLength(2)
    expect(lotRows.map((r) => r.amount)).toEqual([50, 24])
    // صفُّ المنتج ملخَّصٌ بلا مبلغ — رقمان لسؤالٍ واحدٍ ممنوعان.
    expect(split.find((r) => r.kind === 'product').amount).toBeNull()
  })

  it('🔴 المجموعُ لا يحسب المنقسمَ مرّتين', () => {
    const rows = writeOffGridRows({
      ...base,
      products: [product('p-1', 'شامبو')],
      lots: [lot('a', '2026-08-01', 5), lot('b', '2026-08-02', 8)],
      movements: [move('a', 10), move('b', 6)],
      picks: { 'p-1': [{ lotId: 'a', packages: '10' }, { lotId: 'b', packages: '3' }] },
    })
    // ٥٠ + ٢٤ = ٧٤ — **ولو حُسب صفُّ المنتج معهما لصار ١٤٨.**
    expect(writeOffTotal(rows)).toBe(74)
  })

  it('يوسم السطرَ الذي سيرفضه `lot_insufficient` قبل إرساله', () => {
    const rows = writeOffGridRows({
      ...base,
      products: [product('p-1', 'شامبو')],
      lots: [lot('a', '2026-08-01', 5)],
      movements: [move('a', 10), move('a', -8)],
      picks: { 'p-1': [{ lotId: 'a', packages: '5' }] },
    })
    const line = rows.find((r) => r.kind === 'product')
    expect(line.picks[0].remaining).toBe(2)
    expect(line.picks[0].overRemaining).toBe(true)
  })
})

// ==========================================================================
// 🔴 التوزيعُ التلقائيّ — **والنصفُ الآخر من هذا الفحص في `docs/sql/097b`**
//
// ⚠️ **التجهيزةُ والأرقامُ المتوقَّعةُ هنا وهناك زوجٌ واحد**، مكتوبٌ بيدٍ في
// موضعين لأن أحدَهما JS والآخرَ SQL. **مَن غيّر واحدًا يغيّر الآخر** — وبدون
// ذلك تصير النسخةُ الثانية من قاعدة FIFO عينَ صنفِ الانحراف الذي يلاحقه
// المشروع: شاشةٌ تعرض رقمًا والقاعدةُ تختم غيرَه.
//
//   ١٠@٥ (أقدم) · ٦@٨ (أحدث) · المطلوب ١٣  ⟵ ١٠@٥ + ٣@٨ = **٧٤**
//   تاريخان متساويان، `created_at` يفصل        ⟵ الأبكرُ كتابةً أوّلًا
// ==========================================================================
describe('التوزيعُ التلقائيُّ يطابق ما تختمه القاعدة', () => {
  const base = {
    selectedFolderIds: ['f-1'],
    categories: CATEGORIES,
    storageId: STORAGE,
    products: [product('p-1', 'شامبو')],
    lots: [lot('a', '2026-08-01', 5), lot('b', '2026-08-02', 8)],
    movements: [move('a', 10), move('b', 6)],
  }

  it('🔴 يبدأ «تلقائيًّا» بلا دفعةٍ مختارة — لا بالأقدم', () => {
    const rows = writeOffGridRows({ ...base, picks: {} })
    const line = rows.find((r) => r.kind === 'product')
    // ⚠️ «الأقدمُ مختارةٌ سلفًا» تجعل كلَّ شطبٍ ادّعاءً بأن إنسانًا عيّن دفعة.
    expect(line.picks[0].auto).toBe(true)
    expect(line.picks[0].lotId).toBeNull()
  })

  it('🔴 ١٣ من ١٠@٥ و٦@٨ ⟵ ٧٤ — نفسُ رقم ٠٩٧ب', () => {
    const rows = writeOffGridRows({ ...base, picks: { 'p-1': [{ lotId: null, packages: '13' }] } })
    const line = rows.find((r) => r.kind === 'product')
    expect(line.picks[0].slices.map((s) => [s.drawn, s.unitCost])).toEqual([[10, 5], [3, 8]])
    expect(line.amount).toBe(74)
    expect(line.picks[0].overRemaining).toBe(false)
  })

  it('🔴 تاريخان متساويان: `created_at` يفصل، ولا يُترك للصدفة', () => {
    const a = lot('a', '2026-08-01', 5)
    const b = lot('b', '2026-08-01', 8)
    a.created_at = '2026-08-01T09:00:00+00:00'
    b.created_at = '2026-08-01T07:00:00+00:00'

    const rows = writeOffGridRows({
      ...base, lots: [a, b], picks: { 'p-1': [{ lotId: null, packages: '13' }] },
    })
    const line = rows.find((r) => r.kind === 'product')
    // الأبكرُ كتابةً (`b`، ثمنُها ٨) أوّلًا ⟵ ٦×٨ + ٧×٥ = ٨٣ لا ٧٤.
    expect(line.picks[0].slices.map((s) => [s.drawn, s.unitCost])).toEqual([[6, 8], [7, 5]])
    expect(line.amount).toBe(83)
  })

  it('🔴 تجاوزُ الإجماليّ يُوسَم — وهو شرطُ `insufficient_stock` بعينه', () => {
    const rows = writeOffGridRows({ ...base, picks: { 'p-1': [{ lotId: null, packages: '17' }] } })
    const line = rows.find((r) => r.kind === 'product')
    expect(line.inStock).toBe(16)
    expect(line.picks[0].overRemaining).toBe(true)
    // ⚠️ **ولا يُعرض مبلغُ ١٦ عن كمّيّةِ ١٧:** الشرائحُ تغطّي المتاح، والمبلغُ
    // عنها — والرفضُ من القاعدة هو ما يمنع الإرسال.
    expect(line.amount).toBe(74 + 3 * 8)
  })

  it('والصريحُ يمرّ بنفس الدالّة — شريحةٌ واحدةٌ من تلك الدفعة', () => {
    const rows = writeOffGridRows({ ...base, picks: { 'p-1': [{ lotId: 'b', packages: '4' }] } })
    const line = rows.find((r) => r.kind === 'product')
    expect(line.picks[0].auto).toBe(false)
    expect(line.picks[0].slices).toEqual([
      { lotId: 'b', drawn: 4, unitCost: 8, costIsEstimated: false },
    ])
    expect(line.amount).toBe(32)
  })

  it('وثمنٌ مجهولٌ في شريحةٍ يُبطل المجموعَ ولا يُتجاهَل', () => {
    // ⚠️ مجموعٌ ناقصُ شريحةٍ رقمٌ أصغرُ من الحقيقة **متّسقٌ مع نفسه** — أخفى من
    // الصفر لأن الصفرَ يُرى بالسطر والانخفاضُ لا يُرى إطلاقًا.
    const rows = writeOffGridRows({
      ...base,
      lots: [lot('a', '2026-08-01', 5), lot('b', '2026-08-02', null)],
      picks: { 'p-1': [{ lotId: null, packages: '13' }] },
    })
    expect(rows.find((r) => r.kind === 'product').amount).toBeNull()
  })
})

describe('writeOffGrid — السطورُ المرسَلة', () => {
  const base = {
    selectedFolderIds: ['f-1'],
    categories: CATEGORIES,
    storageId: STORAGE,
    products: [product('p-1', 'شامبو')],
    lots: [lot('a', '2026-08-01', 5), lot('b', '2026-08-02', 8)],
    movements: [move('a', 10), move('b', 6)],
  }

  it('🔴 كلُّ سطرٍ يحمل دفعتَه، وكمّيّتُه سالبة', () => {
    const rows = writeOffGridRows({ ...base, picks: { 'p-1': [{ lotId: 'b', packages: '3' }] } })
    expect(writeOffLinesFromGrid(rows)).toEqual([
      { productId: 'p-1', lotId: 'b', quantityBase: -3, enteredQuantity: 3, enteredUom: 'package' },
    ])
  })

  it('الانقسامُ يصل سطرين، دفعةٌ لكلٍّ', () => {
    const rows = writeOffGridRows({
      ...base,
      picks: { 'p-1': [{ lotId: 'a', packages: '10' }, { lotId: 'b', packages: '3' }] },
    })
    const lines = writeOffLinesFromGrid(rows)
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.lotId)).toEqual(['a', 'b'])
    expect(lines.map((l) => l.quantityBase)).toEqual([-10, -3])
  })

  it('لا يرسل سطرًا بلا كمّيّة ولا سطرًا معطَّلًا', () => {
    const empty = writeOffGridRows({ ...base, picks: {} })
    expect(writeOffLinesFromGrid(empty)).toEqual([])

    const locked = writeOffGridRows({
      ...base, lots: [], movements: [], picks: { 'p-1': [{ lotId: null, packages: '3' }] },
    })
    expect(writeOffLinesFromGrid(locked)).toEqual([])
  })
})

/**
 * 🔴 **سطورُ لوح التأكيد — الموضع «ج» من `design/stocktake-anomaly-resistance.md`.**
 *
 * **والمقيسُ هنا ليس «هل القاعدةُ صحيحة» — ذاك محروسٌ في `stocktakeJumpHint`.**
 * المقيسُ **من أين تأتي السطور**: `counts` كلُّها، **لا الصفوفُ المرسومة.**
 *
 * ⚠️ **ولوحٌ يقول عددًا ثمّ يُرحَّل غيرُه هو العطلُ الذي كاد يُشحن في سؤال
 * الرمي** — وأمسكه المراجعُ حينها، **وهنا يقع في مكانٍ أخطر**: هناك كان يمحو
 * أكثرَ مما وعد، **وهنا يطمئن إلى أقلَّ مما سيُرحَّل.**
 */

const { stocktakeTableRows } = require('./stocktakeTableRows')
const { linesToConfirm, CONFIRM_LINE, dropsBelowRecord } = require('./stocktakeSheet')

const CARTON = { id: 'p1', name: 'مبرد ومهدئ ليزر', base_unit: 'pcs', units_per_package: 15, category_id: 'c1', is_active: true }
const CREAM = { id: 'p2', name: 'كريم', base_unit: 'pcs', units_per_package: 1, category_id: 'c1', is_active: true }
const OIL = { id: 'p3', name: 'زيت', base_unit: 'pcs', units_per_package: 1, category_id: 'c1', is_active: true }
const PRODUCTS = [CARTON, CREAM, OIL]

const DOCS = [{ id: 'd1', doc_type: 'supply', doc_date: '2026-08-01' }]
const MOVES = [
  { storage_id: 'st1', product_id: 'p1', document_id: 'd1', quantity_base: 150 },
  { storage_id: 'st1', product_id: 'p2', document_id: 'd1', quantity_base: 40 },
  { storage_id: 'st1', product_id: 'p3', document_id: 'd1', quantity_base: 5 },
]

// 🔴 **الصفوفُ تُبنى بالدالّة التي تبنيها في الشاشة، لا بيدٍ تقلّد شكلَها.**
// ⚠️ **و`plan` تحديدًا مشتقّةٌ من الحركات** — وصفٌّ مكتوبٌ بيدٍ يحمل `plan`
// مخترعةً **يجعل الاختبارَ يقيس تجهيزتَه هو.**
function sheetRowsFor(products = PRODUCTS) {
  const { rows } = stocktakeTableRows({
    categories: [{ id: 'c1', name: 'مجلّد', parent_id: null }],
    storageCategories: [{ category_id: 'c1', storage_id: 'st1' }],
    storageId: 'st1',
    products,
    balances: [
      { storage_id: 'st1', product_id: 'p1', balance_base: 150, avg_cost: 10 },
      { storage_id: 'st1', product_id: 'p2', balance_base: 40, avg_cost: 10 },
      { storage_id: 'st1', product_id: 'p3', balance_base: 5, avg_cost: 10 },
    ],
    movements: MOVES,
    documents: DOCS,
    since: null,
    counts: {},
    uoms: {},
  })
  return rows
}

const UNITS = { p1: 'unit', p2: 'unit', p3: 'unit' }

describe('① التجهيزةُ صادقةٌ قبل أن يُحكَم بها', () => {
  it('✅ المسجَّلُ يصل الصفوفَ ١٥٠ و٤٠ و٥ — لا أصفارًا', () => {
    const plans = sheetRowsFor()
      .filter((r) => r.kind === 'line')
      .map((r) => `${r.product.id}=${r.plan}`)
      .join(' ')
    // ⚠️ **بلا هذا السطر تصمت القاعدةُ لأن المسجَّلَ صفرٌ** — صمتٌ صحيحٌ
    // لسببٍ لا علاقةَ له بما يُقاس، **ويُقرأ نجاحًا.**
    // **والترتيبُ بالاسم العربيّ** (زيت · كريم · مبرد) لا بالمعرِّف — وهو
    // ترتيبُ المشية على الرفّ، **ويثبَّت هنا لأن `linesToConfirm` ترثه.**
    expect(plans).toBe('p3=5 p2=40 p1=150')
  })
})

describe('② السطورُ من `counts` كلِّها — وهذا هو الحارس', () => {
  it('🔴 الشواذُّ الثلاثةُ تظهر كلُّها، ولو رُسم صفٌّ واحد', () => {
    // **الحالةُ الحقيقيّة:** بحثٌ فعّالٌ يترك سطرًا واحدًا على الشاشة،
    // **والترحيلُ يمسّ الثلاثة.**
    const counts = { p1: '1950', p2: '900', p3: '50' }
    const lines = linesToConfirm({
      counts, uoms: UNITS, rows: sheetRowsFor(), products: PRODUCTS,
    })
    expect(lines.map((l) => `${l.productId}:${l.state}`).join(' '))
      .toBe('p3:flagged p2:flagged p1:flagged')
  })

  it('🔴 وعدٌّ لمنتجٍ غاب عن الصفوف ⟵ `UNJUDGED`، لا حذفًا', () => {
    // ⚠️ **رابطُ مجلّدٍ أُزيل أثناء الجلسة:** الصفُّ اختفى من الورقة،
    // **وصفُّ العدّ باقٍ في القاعدة وسيُرحَّل.**
    const lines = linesToConfirm({
      counts: { p1: '1950', p3: '50' },
      uoms: UNITS,
      rows: sheetRowsFor([CARTON, CREAM]), // p3 خارج الصفوف
      products: PRODUCTS,
    })
    expect(lines.map((l) => `${l.productId}:${l.state}`).join(' '))
      .toBe('p1:flagged p3:unjudged')
    // **والمجهولُ يحمل ما يُعرَض به** — الاسمُ والرقمُ كما كُتب.
    const unknown = lines.find((l) => l.productId === 'p3')
    expect(`${unknown.product.name} · كُتب ${unknown.entered} · مسجَّل ${unknown.recordedBase}`)
      .toBe('زيت · كُتب 50 · مسجَّل null')
  })

  it('✅ والسليمُ لا يظهر — وإلّا صار اللوحُ قائمةَ الجرد كلَّها', () => {
    const lines = linesToConfirm({
      counts: { p1: '160', p2: '38', p3: '0' },
      uoms: UNITS, rows: sheetRowsFor(), products: PRODUCTS,
    })
    expect(`سطور: ${lines.length}`).toBe('سطور: 0')
  })
})

describe('③ ثلاثُ الحالات كما هي — و`0` عدٌّ لا فراغ', () => {
  it('✅ خانةٌ فارغةٌ أو فراغٌ ⟵ لا سطر', () => {
    const lines = linesToConfirm({
      counts: { p1: '', p2: '   ', p3: null },
      uoms: UNITS, rows: sheetRowsFor(), products: PRODUCTS,
    })
    expect(`سطور: ${lines.length}`).toBe('سطور: 0')
  })

  it('🔴 و`0` تُنظَر فيها ولا تُبتلع — واليومَ تُجمَع، لأن الاتّجاهَ صار اثنين', () => {
    // 🔴 **هذا الاختبارُ تنبّأ بانقلابه في تعليقه هو، وانقلب.** كان يقول إنّ
    // «تُنظر فيها فتصمت» و«تُسقَط قبل النظر» تعطيان **نفسَ اللوح اليوم**،
    // **وتختلفان يومَ يُبنى الاتّجاهُ الهابط** — فبُني، فافترقتا.
    // ⇒ **والقيمةُ كانت في التمييز لا في الرقم:** لو أُسقطت `'0'` قبل
    // النظر لَما ظهر هذا السطرُ اليومَ، **ولَما سقط اختبارٌ يقول ذلك.**
    // ⚠️ **و`0` مقابل `40` أشدُّ الحالات لا أهونُها:** رفٌّ خاوٍ حيث يقول
    // السجلُّ أربعين، **وهو عجزٌ كاملٌ يكتب غرامة.**
    const lines = linesToConfirm({
      counts: { p2: '0' }, uoms: UNITS, rows: sheetRowsFor(), products: PRODUCTS,
    })
    expect(lines.map((l) => `${l.productId}:${l.state}`).join(' ')).toBe('p2:flagged')
  })

  it('🔴 ورقمٌ لا يُقرأ ⟵ `UNJUDGED` لا صمت', () => {
    const lines = linesToConfirm({
      counts: { p1: 'خمسة' }, uoms: UNITS, rows: sheetRowsFor(), products: PRODUCTS,
    })
    // `countState` تردُّ غيرَ الرقم إلى `UNTOUCHED`، فلا سطرَ — وهذا مقصود:
    // **الخانةُ لا تحمل نصًّا أصلًا** (`NumberField`)، والحالةُ نظريّة.
    expect(`سطور: ${lines.length}`).toBe('سطور: 0')
  })
})

describe('④ الترتيبُ ترتيبُ الورقة، والمجهولُ في الذيل', () => {
  it('✅ يمشي كما يُمشى على الرفّ لا كما وصلت المفاتيح', () => {
    // 🔴 **المفاتيحُ `p1` ثمّ `p3`، وترتيبُ الورقة `p3` ثمّ `p1`** — لأن
    // `stocktakeTableRows` ترتّب بالاسم العربيّ (زيت · كريم · مبرد).
    // ⚠️ **ولولا اختلافُهما لما قاس الصفُّ شيئًا:** ترتيبُ `Object.keys`
    // هو ترتيبُ الإدخال، **فمفتاحان بنفس ترتيب الورقة يمرّان بلا فرز.**
    const lines = linesToConfirm({
      counts: { p1: '1950', p3: '50' },
      uoms: UNITS, rows: sheetRowsFor(), products: PRODUCTS,
    })
    expect(lines.map((l) => l.productId).join(' ')).toBe('p3 p1')
  })

  it('✅ والمجهولُ بعد المعروف مهما كان موضعُ مفتاحه', () => {
    const lines = linesToConfirm({
      counts: { p3: '50', p1: '1950' },
      uoms: UNITS, rows: sheetRowsFor([CARTON, CREAM]), products: PRODUCTS,
    })
    expect(lines.map((l) => `${l.productId}:${l.state}`).join(' '))
      .toBe('p1:flagged p3:unjudged')
  })
})

describe('⑤ والسطرُ يحمل ما يُعرَض به — بإطارَيه معًا', () => {
  it('🔴 الرقمُ كما كُتب وإطارُه، والقراءةُ الأساسيّة، والمسجَّل', () => {
    // ⚠️ **قاعدةُ المخزون الأولى:** «لا رقمَ بلا وحدته»، **والإطاران معًا
    // وحدَهما يصدقان مع القارئ ومع الحساب.** فـ`130` عبوةً و`1950` قطعةً
    // **رقمٌ واحدٌ بوجهين**، وأحدُهما وحدَه يجعل العادَّةَ لا تعرف حركتَها.
    const [line] = linesToConfirm({
      counts: { p1: '130' },
      uoms: { p1: 'package' },
      rows: sheetRowsFor(),
      products: PRODUCTS,
    })
    expect(`كُتب ${line.entered} ${line.frame} · بالقطعة ${line.countedBase} · مسجَّل ${line.recordedBase}`)
      .toBe('كُتب 130 package · بالقطعة 1950 · مسجَّل 150')
  })

  it('✅ والحالتان مصدَّرتان باسمَيهما لا بنصٍّ منسوخ', () => {
    expect(`${CONFIRM_LINE.FLAGGED} · ${CONFIRM_LINE.UNJUDGED}`).toBe('flagged · unjudged')
  })
})

/**
 * 🔴 **الاتّجاهُ الهابط — والقسمُ كُتب نسخةً آليّةً من ② و③ و⑤ ثمّ شُغِّل قبل
 * أن يُكتب فيه اختبارٌ جديد.** ⇒ **وسقط منه ثلاثة، وكلُّ ساقطٍ خبر:**
 *
 * ```
 * ③ الأصلُ نفسُه   ⟵ تنبّأ بانقلابه في تعليقه، وانقلب  ⇒ صُحّح في موضعه
 * MIRROR ③        ⟵ نفسُه مكرَّرًا                      ⇒ حُذف
 * MIRROR ②        ⟵ **ثلاثةٌ صعودًا واثنان هبوطًا**      ⇒ وهذا هو الخبر
 * ```
 *
 * 🔴 **وافتراضُ الأصل غيرُ المختبَر الذي كشفه السقوط: الأرضيّةُ لم تكن في
 * الصورة صعودًا إطلاقًا.** الفروقُ الثلاثةُ الصاعدةُ كانت `1800 · 860 · 45`،
 * **فكلُّها فوق العشرين بلا أن يقصدها أحد.** ⚠️ **وهبوطًا الأرضيّةُ بنيويّةٌ
 * لا عارضة: أقصى ما يهبطه منتجٌ هو رصيدُه نفسُه** ⇒ **فكلُّ منتجٍ مسجَّلُه
 * دون العشرين خارجَ اللوح مهما خوي رفُّه.**
 */
describe('⑦ الهابطُ يُجمَع كما يُجمَع الصاعد — وفي `FLAGGED` نفسِها', () => {
  it('🔴 اثنان من ثلاثة — والثالثُ تحت الأرضيّة، لا سليم', () => {
    // `15/150` و`4/40` يعبران، **و`0/5` لا يعبر: الفرقُ ٥ والأرضيّةُ ٢٠.**
    const lines = linesToConfirm({
      counts: { p1: '15', p2: '4', p3: '0' },
      uoms: UNITS, rows: sheetRowsFor(), products: PRODUCTS,
    })
    expect(lines.map((l) => `${l.productId}:${l.state}`).join(' '))
      .toBe('p2:flagged p1:flagged')
  })

  it('🔴 والرفُّ الخاوي تحت الأرضيّة لا يُجمع — ولا يومض في الورقة أيضًا', () => {
    // ⚠️ **النفيُ يُقاس ولا يُترك ضمنيًّا**، **ويُقاس مع الورقة لا وحدَه:**
    // سطرٌ يظهر في اللوح ولا يومض في الورقة تناقضٌ بين شاشتين، **والحارسُ
    // هنا يقول إنّ المصدرَ واحدٌ فلا يفترقان.**
    const lines = linesToConfirm({
      counts: { p3: '0' }, uoms: UNITS, rows: sheetRowsFor(), products: PRODUCTS,
    })
    expect(`سطور: ${lines.length} · تومض: ${dropsBelowRecord(0, 5)}`)
      .toBe('سطور: 0 · تومض: false')
  })

  it('✅ والاتّجاهان في اللوح نفسِه، بلا حالةٍ ثالثة', () => {
    // 🔴 **`FLAGGED` واحدةٌ للاثنين** — فالعقدُ ثابتٌ وكلُّ قارئٍ للدالّة
    // كما كان. ⚠️ **والاتّجاهُ يُقرأ من الصفّ لا من الحالة**، ولذلك يحمل
    // السطرُ `countedBase` و`recordedBase` معًا — **وهما ما يرسمه الصفّ.**
    const lines = linesToConfirm({
      counts: { p1: '1950', p2: '4' },
      uoms: UNITS, rows: sheetRowsFor(), products: PRODUCTS,
    })
    const shown = (l) => `${l.productId}:${l.state}:${l.countedBase}>${l.recordedBase}`
    expect(lines.map(shown).join(' ')).toBe('p2:flagged:4>40 p1:flagged:1950>150')
  })

  it('✅ وهابطٌ لمنتجٍ غاب عن الصفوف يبقى `UNJUDGED` — لا يُحكم عليه', () => {
    const lines = linesToConfirm({
      counts: { p1: '15', p3: '0' },
      uoms: UNITS, rows: sheetRowsFor([CARTON, CREAM]), products: PRODUCTS,
    })
    expect(lines.map((l) => `${l.productId}:${l.state}`).join(' '))
      .toBe('p1:flagged p3:unjudged')
  })

  it('✅ والقريبُ من المسجَّل لا يظهر هبوطًا كما لا يظهر صعودًا', () => {
    const lines = linesToConfirm({
      counts: { p1: '140', p2: '38', p3: '4' },
      uoms: UNITS, rows: sheetRowsFor(), products: PRODUCTS,
    })
    expect(`سطور: ${lines.length}`).toBe('سطور: 0')
  })

  it('🔴 والهابطُ يحمل إطارَيه كالصاعد — عبوةٌ واحدةٌ حيث المسجَّلُ ١٥٠', () => {
    const [line] = linesToConfirm({
      counts: { p1: '1' }, uoms: { p1: 'package' }, rows: sheetRowsFor(), products: PRODUCTS,
    })
    const frames = `كُتب ${line.entered} ${line.frame} · بالقطعة ${line.countedBase}`
    expect(`${frames} · مسجَّل ${line.recordedBase} · ${line.state}`)
      .toBe('كُتب 1 package · بالقطعة 15 · مسجَّل 150 · flagged')
  })
})

describe('⑥ ولا ينفجر على مدخلاتٍ ناقصة', () => {
  it('✅ بلا وسائطَ إطلاقًا ⟵ لا سطور', () => {
    expect(linesToConfirm()).toEqual([])
    expect(linesToConfirm({})).toEqual([])
  })

  it('✅ وعدٌّ لمنتجٍ ليس في الكتالوج ولا في الصفوف ⟵ `UNJUDGED`', () => {
    const lines = linesToConfirm({
      counts: { 'p-ghost': '99' }, uoms: {}, rows: sheetRowsFor(), products: PRODUCTS,
    })
    expect(lines.map((l) => `${l.productId}:${l.state}:${l.product}`).join(''))
      .toBe('p-ghost:unjudged:null')
  })
})

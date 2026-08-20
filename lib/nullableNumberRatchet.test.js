const fs = require('fs')
const path = require('path')

// 🔴 `Number(حقلٍ يقبل العدم)` — سقّاطةٌ تنقص ولا تزيد.
//
// **العطلُ واحدٌ ومكتوبٌ في `CLAUDE.md` بندًا مؤجَّلًا (أ):** `Number(null)`
// تُرجع `0`، **فتكلفةٌ غيرُ معروفةٍ تُرسم «٠٫٠٠ ₪» على شاشةٍ حيّة** — رقمٌ
// مشروعُ الشكل مكانَ الجهل، وهو **وجهُ العرض لعلّة التسميم نفسِها.**
//
// ⚠️ **وهذا الملفُّ وُلد من سؤالٍ في المراجعة، لا من عطلٍ جديد:** «أين
// `documentMoney` في جدول الحرّاس؟» — وحارسُ المال كان سليمًا ومقصودًا،
// **والمكشوفُ كان جارَه.**
//
// ══════════════════════════════════════════════════════════════════
// لماذا لم يُوسَّع الحارسُ القائم باسمٍ ثالث
// ══════════════════════════════════════════════════════════════════
//
// `writeOffGrid.test.js` يحرس **قائمةً بيد**: `GUARDED = ['lotPicker.js',
// 'writeOffGrid.js']`. ⚠️ **وقائمةٌ مكتوبةٌ بيدٍ تفشل مفتوحةً دائمًا:** أيُّ
// ملفٍّ جديدٍ غيرُ محروسٍ **لا لأنه فُحص واستُثني بل لأن أحدًا لم يكتب اسمه.**
//
// **والقاعدةُ هنا مكتوبةٌ على الصفة لا على الموضع:** أيُّ `Number(` يقع على
// تعبيرٍ يذكر حقلًا **نعرف أنه يقبل العدم** — بأسماء القاعدة أو بأسمائه
// المشتقّة في الكود. **فملفٌّ يُكتب غدًا داخلٌ بحكم صفته لا بحكم قائمة.**
//
// ✅ **ومقيسٌ أنها كانت ستلتقط العطلَين التاريخيَّين** — الفحصُ أدناه يشغّلها
// على نصَّيهما حرفيًّا، **بلا لمس شجرة العمل** (كسرُ نسخةٍ لا الأصل).
//
// ══════════════════════════════════════════════════════════════════
// ولماذا سقّاطةٌ لا منعٌ مطلق
// ══════════════════════════════════════════════════════════════════
//
// **المسحُ وجد ٢٠ موضعًا قائمًا في ١١ ملفًّا** — فمنعٌ مطلقٌ اليوم يعني إمّا
// إصلاحَ عشرين موضعًا في جولةٍ لا تخصّها، **وإمّا عشرين استثناءً** — و«رقمٌ
// يكبر بلا أن يمنع شيئًا بيصير خلفيّة».
//
// ⇒ **فالخطُّ الأساسيُّ خريطةٌ لا مجموع**، بنفس شكل `hookDepsRatchet`:
// **زيادةٌ تُسقط، ونقصانٌ يُسقط أيضًا** — فيُخفَّض الرقمُ بنفس الإيداع الذي
// أصلح، ولا يُلغى الإصلاحُ بظهورٍ في مكانٍ آخر.
//
// ⚠️ **والخريطةُ ليست إقرارًا بأنها سليمة، ولا اتّهامًا بأنها معطوبة** — هي
// إقرارٌ بأنها **معروفةٌ ومعدودة.** والبندُ (أ) في `CLAUDE.md` يقول إن أربعًا
// منها على شاشاتٍ حيّة؛ **وهذا المسحُ يقول إن المواضعَ عشرون.**
//
// 🔴 **ومقيسٌ أن بعضَها سليمٌ فعلًا، فلا يُقرأ العددُ عددَ عللٍ:**
//
// ```
// lib/balanceView.js:162
//   row.avg_cost === null || row.avg_cost === undefined ? null : Number(row.avg_cost)
// ```
//
// **هذا `numberOrNull` مكتوبةً باليد** — يفحص العدمَ قبل التحويل، فيفعل الصوابَ
// تمامًا. **والصفةُ لا تفرّق**، ولا يُطلب منها ذلك: **السقّاطةُ تسأل «هل ظهر
// موضعٌ جديد؟» لا «هل هذا الموضعُ خطأ؟»** — والثاني حكمُ إنسانٍ يقرأ السطر.
//
// ⇒ **وتحويلُه إلى `numberOrNull` المشتركة يُنقص الخريطةَ بواحد**، وهو ما
// تُسقط السقّاطةُ عليه عمدًا **كي يُخفَّض الرقمُ بنفس الإيداع الذي أصلح.**

// الحقولُ التي تقبل العدم، بأسمائها في القاعدة وبأسمائها المشتقّة في الكود.
//
// ⚠️ **قائمةُ أعمدةٍ لا قائمةُ ملفّات، والفرقُ جوهريّ:** العمودُ يُضاف بحدثٍ
// مخطَّطيٍّ يراه الناس، **والملفُّ يُضاف في كلّ جولة.** فهذه تتقادم أبطأ بمراتب،
// **وتقادمُها يُصلحه أوّلُ من يقرأ مخطَّطًا** لا أوّلُ من ينسى.
const NULLABLE = [
  'unit_cost', 'unitCost',
  'entered_unit_price', 'enteredUnitPrice',
  'paid_amount', 'paidAmount',
  'quantity_base', 'quantityBase',
  'entered_quantity', 'enteredQuantity',
  'avg_cost', 'avgCost',
]

const NEEDLE = () => new RegExp(
  String.raw`\bNumber\(\s*[^)]*\b(${NULLABLE.join('|')})\b`, 'g'
)

// 🔴 الخطُّ الأساسيّ — **ما هو معروفٌ اليوم، لا ما هو مقبول.**
//
// ⚠️ **وهو بالتعبير لا بالعدد، وأوّلُ صياغةٍ كانت بالعدد فتركت ثغرةً سمّتها
// المراجعة:** خريطةٌ تعدّ `{ملفّ: ٣}` **تُبقي الرقمَ كما هو لو أصلح إيداعٌ
// موضعًا وأدخل آخرَ في نفس الملفّ** — فيدخل عطلٌ جديدٌ والحارسُ لا يرى شيئًا
// تغيّر.
//
// **والاحتمالُ ضئيل** (تزامنُ إصلاحٍ وعطلٍ في ملفٍّ واحدٍ بإيداعٍ واحد)، **لكنّ
// الكلفةَ أضألُ منه:** `match()` تُرجع النصوصَ المطابِقةَ أصلًا، **فحفظُها بدل
// عدّها لا يكلّف شيئًا ويجعل الخريطةَ تقول ما تعدّه لا كم تعدّ.**
//
// ⇒ **وهو نفسُ مبدأ «يطبع ما قاسه بجانب ما حكم به»** — القارئُ يرى التعبيرَ
// فيحكم عليه، بدل أن يرى رقمًا يثق به أو يشكّ فيه بلا سبيل.
const BASELINE = {
  'components/ProductFormDialog.js': ['Number(c.quantityBase', 'Number(c.quantityBase'],
  'components/ReturnToSupplierScreen.js': ['Number(paidAmount'],
  'components/StockDocumentScreen.js': ['Number(row.enteredQuantity'],
  // ⚠️ فحصُ عدمٍ مكتوبٌ باليد — سليمٌ تمامًا، ومعدودٌ لأن الصفةَ لا تفرّق.
  'lib/balanceView.js': ['Number(row.avg_cost'],
  'lib/productAdminIO.js': ['Number(c.quantityBase', 'Number(row.quantity_base'],
  'lib/productOrder.js': [
    'Number(enteredQuantity', 'Number(line.entered_quantity', 'Number(line.entered_unit_price',
  ],
  'lib/stockDocument.js': ['Number(enteredQuantity', 'Number(row.enteredQuantity', 'Number(unitCost'],
  'lib/stockDocumentForm.js': ['Number(row.enteredUnitPrice'],
  'lib/stockDocumentList.js': [
    'Number(m.quantity_base', 'Number(movement.entered_quantity', 'Number(movement.quantity_base',
  ],
  'lib/supplyFillFromOrder.js': ['Number(line.entered_quantity'],
  'lib/writeOffFromInvoice.js': ['Number(m.quantity_base', 'Number(m.quantity_base'],
}

const ROOT = path.join(__dirname, '..')
const ROOTS = ['lib', 'components']

const strip = (text) => text
  .split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.isFile() && e.name.endsWith('.js') && !e.name.includes('.test.')) out.push(full)
  }
  return out
}

function scan() {
  const files = ROOTS.flatMap((r) => walk(path.join(ROOT, r)))
  const found = {}
  for (const file of files) {
    const hits = strip(fs.readFileSync(file, 'utf8')).match(NEEDLE())
    // مرتَّبةٌ كي لا يُسقط الحارسَ نقلُ سطرٍ داخل الملفّ — **الموضعُ ليس
    // ادّعاءً، والتعبيرُ هو.**
    if (hits) found[path.relative(ROOT, file).split(path.sep).join('/')] = [...hits].sort()
  }
  return { files, found }
}

describe('🔴 `Number(` على حقلٍ يقبل العدم — سقّاطةٌ تنقص ولا تزيد', () => {
  it('⚠️ ومداها هو ما يُقاس أوّلًا — مشيةٌ لا تصل لا تجد مخالفةً أيضًا', () => {
    // 🔴 **النطاقُ يُثبَّت بحلقةٍ تسمّي ما سقط، لا بجملةٍ تصفه** — وهي القاعدةُ
    // التي دخلت `CLAUDE.md` بعد أن تكرّر الصنفُ أربع مرّات: نيّةٌ صحيحةٌ
    // ومدًى لا يطابقها. **وأوّلُ ضحاياها كان هذا الحارسَ نفسَه لو كُتب بقائمة.**
    const { files } = scan()
    expect(files.length).toBeGreaterThan(120)

    for (const [name, shape] of [
      ['lib', /[\\/]lib[\\/]/],
      ['components', /[\\/]components[\\/]/],
      ['مجلّدٌ فرعيّ', /components[\\/](ref|ui)[\\/]/],
    ]) {
      expect(`${name} ⟵ ${files.some((f) => shape.test(f))}`).toBe(`${name} ⟵ true`)
    }
  })

  it('🔴 لا موضعَ جديد، ولا موضعَ أُصلح بقي في الخريطة، ولا تبادلَ في مكانه', () => {
    const { found } = scan()
    const names = [...new Set([...Object.keys(BASELINE), ...Object.keys(found)])].sort()

    for (const name of names) {
      const was = [...(BASELINE[name] || [])].sort()
      const now = found[name] || []
      // ⚠️ **التعبيرُ الخامُّ بجانب الحكم** — فالقارئُ يستطيع أن يخالف الحارس،
      // ويرى **ما** عُدَّ لا **كم** عُدّ.
      expect(`${name} ⟵ ${now.join(' · ') || 'نظيف'}`)
        .toBe(`${name} ⟵ ${was.join(' · ') || 'نظيف'}`)
    }
  })

  it('✅ وكانت ستلتقط العطلَين التاريخيَّين — على نسخةٍ لا على الأصل', () => {
    // ⚠️ **البيّنةُ المضادّةُ على كتلةٍ نصّيّةٍ داخل الاختبار** — لا تلمس شجرةَ
    // العمل إطلاقًا، وهو البديلُ الأنظفُ المذكورُ في `CLAUDE.md` حين يكون ممكنًا.
    //
    // والنصّان منقولان من موضعَيهما: تعليقُ `lotPicker.js:68` يقول حرفيًّا «كان
    // `Number(lot.unit_cost)`»، و`writeOffGrid.js:51` صار `numberOrNull(unitCost)`
    // بعد أن كان تحويلًا عاريًا على **معامل** لا على عمود.
    for (const [label, code] of [
      ['lotPicker — تحويلٌ على عمود', 'unitCost: Number(lot.unit_cost),'],
      ['writeOffGrid — تحويلٌ على معاملٍ مشتقّ', 'const price = Number(unitCost)'],
      ['وطلبيّةٌ بلا سعر — عطلُ الدمج القادم', 'const p = Number(line.entered_unit_price)'],
    ]) {
      expect(`${label} ⟵ ${NEEDLE().test(code)}`).toBe(`${label} ⟵ true`)
    }
  })

  it('⚠️ ولا تعضّ السليم — وإلّا دفعت لتعديل كودٍ صحيحٍ إرضاءً لها', () => {
    // 🔴 **وهذا نصفُ القياس لا زينةٌ فيه:** حارسٌ يلتقط كلَّ شيءٍ يُسكَت بتخفيفه،
    // **وحارسان في هذه الجولة وحدَها عضّا كودًا سليمًا** لأن مداهما تجاوز جملتَهما.
    for (const [label, code] of [
      ['المسارُ الآمن', 'const c = numberOrNull(lot.unit_cost)'],
      ['فحصُ الإنهاء', 'if (!Number.isFinite(n)) return null'],
      ['حقلٌ لا يقبل العدم', 'const n = Number(row.sort_order)'],
      ['اسمٌ يشبه ولا يطابق', 'const n = Number(row.unit_costs_total)'],
    ]) {
      expect(`${label} ⟵ ${NEEDLE().test(code)}`).toBe(`${label} ⟵ false`)
    }
  })
})

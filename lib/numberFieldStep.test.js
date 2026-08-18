const fs = require('fs')
const path = require('path')

// 🔴 أسهمُ حقول المال تتحرّك بواحدٍ كامل، لا بقرش.
//
// طلبُ المالك: الوصولُ من صفرٍ إلى خمسين بضغطاتِ سهمٍ عند `step="0.01"` خمسةُ
// آلاف ضغطة. والمثالُ الذي سمّاه — «٣٠.٠٠٢» في حدّ التنبيه — **ليس عطلَ تنسيقٍ
// عشريّ**: الحقلُ كان `step="0.001"`، فضغطتا سهمٍ تكتبان ذلك بالحرف. **بندان
// في الطلب، وسببٌ واحد.**
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ والأثرُ الجانبيُّ مقيسٌ في محرّكٍ حقيقيّ، لا مقروءٌ من مواصفة
// ═══════════════════════════════════════════════════════════════════════════
//
// `step="1"` يجعل `12.50` غيرَ صالحٍ بمعيار HTML (`validity.stepMismatch`)،
// والسهمُ يقصّ الكسر (‏12.50 ↑ ⟵ 13 لا 13.5). قِيس في Chrome عبر CDP، **وبالطريقة
// التي يكتب بها React القيمة** (خاصّيّةً لا سمة — والفرقُ حاسم: قاعدةُ الخطوة
// تُؤخذ من سمة `value` إن وُجدت، فالقياسُ على صفحةٍ ساكنةٍ يعطي جوابًا آخر):
//
//   step="1"    min="0"   ⟶  valid: false · stepMismatch · 12.50 ↑ = 13
//   step="1"    بلا min   ⟶  valid: false · stepMismatch · 12.50 ↑ = 13
//   step="any"  min="0"   ⟶  valid: true  · **والسهمُ يرمي InvalidStateError**
//   step="0.01" min="0"   ⟶  valid: true  · 12.50 ↑ = 12.51   (ما كان)
//
// ⇒ فـ«أسهمٌ بواحدٍ مع كسورٍ صالحة» **غيرُ ممكنٍ بالسمات وحدَها**: الخياراتُ إمّا
// كسرٌ في الخطوة، أو أسهمٌ ميّتة، أو `stepMismatch`.
//
// ✅ **والثالثُ بلا أثرٍ في هذا التطبيق، مقيسًا لا مفترَضًا:** لا نداءَ
// `checkValidity` ولا `reportValidity` في المستودع كلِّه · ونموذجٌ `<form>`
// واحدٌ فقط (شاشةُ الدخول) وليس فيه حقلٌ رقميّ · ولا تنسيقَ على `:invalid`.
// والقيمةُ تُقرأ من `e.target.value` ويحكم عليها تحقّقُنا نحن وقيودُ القاعدة.
//
// ⚠️ **وهذا يجعله فخًّا نائمًا لا مسألةً مغلقة:** يومَ يُضاف `<form>` بتحقّقٍ
// أصليّ أو يُلوَّن `:invalid`، **يحمرّ كلُّ سعرٍ فيه قروش دفعةً واحدة** — ولن
// يكون في الشاشة ما يشير إلى هذا الملفّ. ولذلك المقياسُ مكتوبٌ هنا لا في رسالة
// إيداعٍ تُقرأ مرّة.
const ROOT = path.join(__dirname, '..')

// كلُّ ملفٍّ فيه حقلٌ رقميّ — يُمشى عليه، ولا يُكتب بالاسم.
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

// ⚠️ المسموحُ يُعدّ بأسبابه، لا الممنوع — فالقائمةُ تفشل **مغلقة**: أيُّ خطوةٍ
// كسريّةٍ جديدة تُسقط الحزمة، فينظر إليها إنسانٌ مرّةً ويضيفها أو يزيلها.
// (نفسُ اتجاه `arabicTatweel`.)
const FRACTIONAL_ALLOWED = [
  {
    file: 'ProductFormDialog.js', step: '0.01', count: 4,
    why: 'كمّياتُ التعبئة والتجزئة: «بالعبوة» و«ناتج التجزئة» و«حجم الجزء» ومكوّناتُ الطقم. منتجٌ بالمل أو الغرام كمّيّتُه كسريّةٌ بطبعها — والمسموحُ خانتان لا ثلاث، بقرار المالك.',
  },
  {
    file: 'ProductOrderScreen.js', step: '0.01', count: 1,
    why: 'كمّيّةُ سطر الطلبيّة — تُطلب بنفس وحدة المنتج، فمنتجُ المل يُطلب بكسرٍ إلى خانتين.',
  },
  {
    file: 'StockDocumentScreen.js', step: '0.01', count: 2,
    why: 'كمّيّةُ السطر والبونص في المستند — كسريّةٌ إلى خانتين لنفس سبب حقول المنتج.',
  },
]

describe('the arrows on a money field move by a whole unit', () => {
  const files = walk(path.join(ROOT, 'components')).concat(walk(path.join(ROOT, 'pages')))

  it('searched a real tree', () => {
    // مشيةٌ لا تجد شيئًا لا تجد مخالفةً أيضًا، وتمرّ بأعلى صوت.
    expect(files.length).toBeGreaterThan(30)
  })

  // ⚠️ **الفحصُ على الحقلِ بعينه، لا ببحثٍ عامٍّ عن `0.01`.**
  //
  // كانت الصياغةُ الأولى «ولا ملفَّ فيه `step="0.01"`» — وكانت صحيحةً ساعةً
  // واحدة: ثم صار `0.01` هو **خطوةَ الكمّيّات** بقرار المالك (خانتان لا ثلاث)،
  // **فانقلب الاختبارُ من حارسٍ إلى كاذب**. بحثٌ عن قيمةٍ يخلط الأدوار؛ والرابطُ
  // إلى المتغيّر يسمّي الدور.
  const fieldStep = (file, binding) => {
    const text = fs.readFileSync(path.join(ROOT, 'components', file), 'utf8')
    const at = text.indexOf(`value={${binding}}`)
    if (at === -1) return `⛔ ما لقيت الحقل: ${binding}`
    // ⚠️ أقربُ وسمٍ مفتوحٍ قبل الرابط، لا `<Input>` بالاسم: `ClientForm`
    // يستعمل `BField`، فبحثٌ عن اسمِ مكوّنٍ بعينه يعمي الحارسَ عن ملفّ.
    const tag = text.slice(text.lastIndexOf('<', at), at)
    return (/step="([^"]+)"/.exec(tag) || [null, '(بلا خطوة)'])[1]
  }

  it('steps every money field by a whole unit', () => {
    // 🔴 `0.01` كان على كلِّ حقلِ سعرٍ في النظام — والوصولُ من صفرٍ إلى خمسين
    // بضغطاتِ سهمٍ كان خمسةَ آلاف ضغطة.
    const money = [
      ['ProductFormDialog.js', 'packagePrice'],
      ['ProductFormDialog.js', 'portionPrice'],
      ['ProductFormDialog.js', 'purchasePrice'],
      ['ServiceFormDialog.js', 'price'],
      ['StorageFormDialog.js', 'finePercent'],
      ['StockDocumentScreen.js', 'row.enteredUnitPrice'],
      ['BalanceDialog.js', 'amount'],
      ['ClientForm.js', 'form.maxDebt'],
      // ⚠️ **حقلا شاشة الإرجاع، مضافان يومَ بُنيا لا بعده.** الأوّلُ سعرُ
      // الوحدة المطالَبُ به والثاني المبلغُ المستلَم — **وكلاهما مالٌ**، فأوّلُ
      // مسوّدةٍ كتبتهما `0.01` وأسقطها هذا الحارسُ نفسُه.
      ['ReturnToSupplierScreen.js', "row.picks[0]?.priceText ?? ''"],
      ['ReturnToSupplierScreen.js', 'paidAmount'],
    ]
    for (const [file, binding] of money) {
      expect(`${file}:${binding} = ${fieldStep(file, binding)}`).toBe(`${file}:${binding} = 1`)
    }
  })

  it('keeps the reorder threshold on a whole step — the field that showed 30.002', () => {
    expect(fieldStep('ProductFormDialog.js', 'lowSupplyUnits')).toBe('1')
  })

  it('lets a quantity carry two decimals, and no more', () => {
    // قرارُ المالك: الكمّيّةُ تُكتب بخانتين لا بثلاث. و`0.001` كانت هي التي
    // كتبت «٣٠.٠٠٢» بضغطتَي سهم.
    for (const [file, binding] of [
      ['ProductFormDialog.js', 'unitsPerPackage'],
      ['ProductFormDialog.js', 'portionOutput'],
      ['ProductFormDialog.js', 'unitsPerPortion'],
      ['StockDocumentScreen.js', 'row.enteredQuantity'],
      ['StockDocumentScreen.js', 'row.bonusQuantity'],
    ]) {
      expect(`${file}:${binding} = ${fieldStep(file, binding)}`).toBe(`${file}:${binding} = 0.01`)
    }
  })

  it('accounts for every fractional step that remains, with a reason', () => {
    // ⚠️ الكمّياتُ لم تُطلَب، فلم تُلمَس — **والفرقُ بين «تُركت بقرار» و«فاتتنا»
    // لا يُقرأ من الشيفرة**، فيُكتب هنا. وأيُّ خطوةٍ كسريّةٍ جديدةٍ خارج هذا
    // الجدول تُسقط الحزمة.
    const found = []
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      for (const step of ['0.001', '0.005', '0.01', '0.1', '0.5']) {
        const n = text.split(`step="${step}"`).length - 1
        if (n > 0) found.push({ file: path.basename(file), step, count: n })
      }
    }
    expect(found).toEqual(FRACTIONAL_ALLOWED.map(({ file, step, count }) => ({ file, step, count })))
  })

  it('gives every remaining fractional step a reason somebody wrote', () => {
    for (const entry of FRACTIONAL_ALLOWED) expect(entry.why.length).toBeGreaterThan(30)
  })

  // ── التقريبُ معلَنٌ لا صامت ────────────────────────────────────────────────

  // ⚠️ حقلٌ رقميٌّ **لا** يمرّ من `NumberField` يقرّب بصمتٍ أو لا يقرّب أصلًا —
  // والاثنان يخالفان القرار. والقائمةُ **مسموحٌ بأسبابه** فتفشل مغلقة.
  const RAW_NUMBER_INPUTS_ALLOWED = [
    {
      file: 'SetPricesDialog.js',
      // 🔴 **مُعلَّقٌ على «تنسيق الجدول» بالاسم — لا مؤجَّلٌ عمومًا.**
      //
      // قرارُ المالك بلفظه: «نأجله عمدًا، ومنربطه بتنسيق الجدول لما نوصله — مش
      // نحوله هلق مع قبول الاختلاف البصري المؤقت.»
      //
      // ⚠️ و«مؤجَّل» بلا شرطٍ هي الصيغةُ التي تتقادم بصمت: تُقرأ بعد شهرين
      // «قرارٌ اتُّخذ» لا «عملٌ ينتظر إشارة. فالشرطُ مكتوبٌ هنا **ومحروسٌ
      // بالاختبار التالي**، لأن المكتوبَ يُنسى والحارسَ ينطق.
      why: 'خليّةُ جدولٍ بـ`<input>` خامٍ وأصنافٍ خاصّة (`h-8 w-full bg-transparent text-center tabular-nums`). تحويلُها اليوم يُدخل أصنافَ `Input` القياسيّة — إطارًا وحوافَّ — **فيغيّر تنسيقَ الشبكة قبل أن يُقرَّر تنسيقُها.** ⇒ يُحوَّل **مع تنسيق الجدول** في نفس الجولة. وهو الحقلُ الوحيد بلا حمايةِ التقريب، فبقاؤه بلا شرطٍ مكتوبٍ يعني ضياعَ الحماية فيه وحدَه.',
      until: 'تنسيقُ الجدول — أي حين يُحسم التنسيقُ العامّ وتُنزع شارةُ «ألوانٌ مؤقّتة»',
    },
  ]

  it('sends every money and quantity field through the rounding field', () => {
    // 🔴 التقريبُ إلى خانتين **مع رسالة** — قرارُ المالك. و`NumberField` هو
    // الموضعُ الوحيد الذي يعرفه، فحقلٌ يتخطّاه يقرّب بصمتٍ أو لا يقرّب.
    const raw = []
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      // حقلٌ رقميٌّ بخطوة = مالٌ أو كمّيّة. وبلا خطوة (المدّة بالدقائق) خارجُ
      // القرار.
      const re = /<(?:input|Input)\s[^>]*type="number"[^>]*step="[^"]+"|<(?:input|Input)\s[^>]*step="[^"]+"[^>]*type="number"/g
      const n = (text.match(re) || []).length
      if (n > 0) raw.push({ file: path.basename(file), count: n })
    }
    expect(raw).toEqual(RAW_NUMBER_INPUTS_ALLOWED.map(({ file }) => ({ file, count: 1 })))
  })

  // 🔴 **الشرطُ صار حارسًا يَنطق، لا سطرًا يُنتظر أن يُقرأ.**
  //
  // «يُحوَّل مع تنسيق الجدول» جملةٌ صحيحةٌ اليوم **تتقادم بصمت** — يقرأها أحدٌ
  // بعد شهرين فيراها قرارًا لا عملًا معلَّقًا. والمشروع دفع ثمنَ هذا الصنف
  // أربعَ مرّاتٍ في يومٍ واحد (CLAUDE.md: «تعليقٌ يصف حالةً مؤقّتة يحمل شرطَ
  // إعادةِ قراءته معه»).
  //
  // ⇒ فالشرطُ مربوطٌ بالعلامة الآليّة الوحيدة الموجودة لتلك المرحلة:
  // `PROVISIONAL_PALETTE`. هي `true` ما دام التنسيقُ غيرَ محسوم، **وقلبُها إلى
  // `false` هو بالحرف لحظةُ الوصول إلى «تنسيق الجدول»** — فيسقط هذا الاختبار
  // عندها، برسالةٍ تسمّي الحقل وما يُفعل به.
  //
  // ⚠️ **وحدُّ الربط يُقال:** الشارةُ عن **الألوان**، وتنسيقُ الجدول قد يُحسم
  // منفصلًا عنها. فهي **أقربُ علامةٍ قائمة** لا مطابِقةٌ تمامًا — والبديلُ
  // (لا علامة إطلاقًا) هو النسيان الذي طُلب منعُه.
  it('re-opens this exception the moment the formatting is decided', () => {
    const badge = fs.readFileSync(
      path.join(ROOT, 'components', 'ref', 'ProvisionalPaletteBadge.js'), 'utf8'
    )
    const stillOpen = /export const PROVISIONAL_PALETTE = true/.test(badge)

    if (!stillOpen) {
      throw new Error(
        'انحسم التنسيقُ (PROVISIONAL_PALETTE = false) — فالشرطُ المعلَّق حان: '
        + RAW_NUMBER_INPUTS_ALLOWED.map((e) => `${e.file} (بانتظار: ${e.until})`).join(' · ')
        + ' ⟵ حوّله إلى NumberField ليأخذ حمايةَ التقريب، ثمّ احذف مدخلَه من '
        + 'RAW_NUMBER_INPUTS_ALLOWED ومن design/TOKENS.md (البند ١١).'
      )
    }
    expect(stillOpen).toBe(true)
  })

  it('names what each exception is waiting FOR, not just that it waits', () => {
    // «مؤجَّل» بلا شرطٍ لا يُستأنَف أبدًا: ما من لحظةٍ تقول إنه حان.
    for (const e of RAW_NUMBER_INPUTS_ALLOWED) {
      expect(typeof e.until).toBe('string')
      expect(e.until.length).toBeGreaterThan(20)
    }
    // والسببُ مذكورٌ في سجلّ القرارات المفتوحة أيضًا، حيث يقرأ من يقرّر التنسيق.
    const tokens = fs.readFileSync(path.join(ROOT, 'design', 'TOKENS.md'), 'utf8')
    expect(tokens).toContain('SetPricesDialog.js')
  })

  it('gives the one raw field left a reason, and the notice a sentence', () => {
    for (const e of RAW_NUMBER_INPUTS_ALLOWED) expect(e.why.length).toBeGreaterThan(60)

    // والرسالةُ تحمل الرقمين معًا: **بلا الأصل يعرف القارئُ أن شيئًا تغيّر ولا
    // يعرف ماذا فقد.**
    const common = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public', 'locales', 'ar', 'common.json'), 'utf8')
    )
    expect(common.roundedToPlaces).toContain('{{from}}')
    expect(common.roundedToPlaces).toContain('{{to}}')

    const field = fs.readFileSync(path.join(ROOT, 'components', 'ui', 'NumberField.js'), 'utf8')
    // ⚠️ عند المغادرة لا عند كلّ ضغطة: من يكتب «10.005» يمرّ بـ«10.0» و«10.00».
    expect(field).toContain('onBlur={handleBlur}')
    expect(field).toContain('roundTyped(event.target.value)')
    // وتختفي بأوّل تعديلٍ تالٍ — خبرٌ عن فعلٍ مضى لا حالةٌ قائمة.
    expect(field).toMatch(/if \(rounding\) setRounding\(null\)/)

    // 🔴 **والرسالةُ تُضبَط عند التقريب — وهذا ما كان ناقصًا، وكشفَته بيّنةٌ
    // مضادّة.** حقنةٌ حوّلت `setRounding({ from, to })` إلى `setRounding(null)`
    // — أي **التقريبَ الصامتَ الذي رفضه المالك بالنصّ** — **ومرّت الحزمةُ
    // خضراء**، لأن كلّ ما فوق كان لا يزال في الملفّ. وجودُ الرسالةِ ليس ضبطَها.
    const blur = field.slice(field.indexOf('function handleBlur'), field.indexOf('function handleChange'))
    expect(blur.length).toBeGreaterThan(80)
    expect(blur).toMatch(/setRounding\(\{[^}]*from:[^}]*to:[^}]*\}\)/)
    expect(blur).toMatch(/onChange\(\{ target: \{ value: [^}]+\} \}\)/)
  })
})

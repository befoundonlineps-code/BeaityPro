const fs = require('fs')
const path = require('path')

// 🔴 شاشاتُ العرض غيرُ تفاعليّةٍ **بالبناء** — لا بـ`disabled`.
//
// ⚠️ **والخطرُ ليس تعديلَ مستند، وهذا ما يجعله أسوأ:** ٠٩٤ج سحب `UPDATE` عن
// `stock_documents`، **فزرُّ إرسالٍ منسيٌّ لن يُرفَض كتعديل** — سيُدرج مستندًا
// **جديدًا بالكامل** عبر `post_stock_document`، وهي `INSERT` لا يمنعها سحبُ
// `UPDATE`. ⇒ **مستندٌ شبحيٌّ بحركاتٍ حقيقيّةٍ في المخزون.**
//
// **و`disabled` ليست دفاعًا:** خاصّيّةٌ واحدةٌ تُنسى على عنصرٍ واحدٍ تكفي،
// **والنسيانُ لا يترك أثرًا يُقرأ.** فالدفاعُ أن العنصرَ **غيرُ موجودٍ في
// الشجرة أصلًا** — عندها لا شيءَ يُنسى.
//
// ══════════════════════════════════════════════════════════════════
// المدى — مشتقٌّ من المجلّد، لا قائمةٌ بأسماء الشاشات
// ══════════════════════════════════════════════════════════════════
//
// 🔴 **قائمةُ أسماءٍ تفشل مفتوحةً**، وهذا مقيسٌ في هذا المشروع أربع مرّات
// (`screenPropsWired` قال عن نفسه إنه «مشتقّ» وكان يقرأ ثلاثةَ أسماءٍ مثبَّتة،
// فوُصلت الشاشةُ الرابعةُ ومرّ أخضرَ وهو لا يراها).
//
// ⇒ **فالمدى هو المجلّدُ كلُّه:** أيُّ ملفٍّ يُوضع في `components/documentView/`
// داخلٌ **يومَ يُكتب**، بلا أن يتذكّر أحدٌ إضافةَ اسمه.
//
// ⚠️ **ومشيةٌ لا تجد شيئًا لا تجد مخالفةً أيضًا** — فالحدُّ الأدنى مثبَّتٌ
// أدناه، **وحارسٌ على مجلّدٍ فارغٍ هو الشكلُ الذي اتّخذه كلُّ فحصٍ أجوفَ هنا.**
const ROOT = path.join(__dirname, '..')
const VIEW_DIR = path.join(ROOT, 'components', 'documentView')

const strip = (text) => text
  .split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

function screens() {
  if (!fs.existsSync(VIEW_DIR)) return []
  return fs.readdirSync(VIEW_DIR)
    .filter((f) => f.endsWith('.js') && !f.includes('.test.'))
    .map((f) => path.join(VIEW_DIR, f))
}

// كلُّ ما يقبل إدخالًا أو يرسل — **بالشكل لا بقائمة أسماء العناصر.**
//
// ⚠️ **و`write` منها:** `RefTd` عرضٌ افتراضًا ولا تصير قابلةَ للكتابة إلّا
// بتمريرها صراحةً، **فتمريرُها في شاشة عرضٍ هو الثغرةُ نفسُها بلبوس خاصّيّة.**
const FORBIDDEN = [
  ['<input', /<input\b/],
  ['<select', /<select\b/],
  ['<textarea', /<textarea\b/],
  ['<form', /<form\b/],
  ['<button', /<button\b/],
  ['NumberField', /\bNumberField\b/],
  ['خاصّيّة write', /\bwrite\b/],
  ['contentEditable', /contentEditable/],
  ['onSubmit', /\bonSubmit\b/],
  ['onChange', /\bonChange\b/],
  // 🔴 **ونداءُ الترحيل نفسُه** — الحدُّ الأخير: شاشةُ عرضٍ لا تستورد ما يكتب.
  ['نداءُ ترحيل', /postStockDocument|reverseStockDocument|postStocktake|transferStock|saveProductOrder/],
]

describe('🔴 شاشاتُ العرض غيرُ تفاعليّةٍ بالبناء', () => {
  it('⚠️ والمجلّدُ موجودٌ وفيه شاشةٌ واحدةٌ على الأقلّ — وإلّا كان الحارسُ أجوف', () => {
    // **هذا الشرطُ هو ما يمنع الحارسَ من المرور صامتًا قبل أن تُبنى الشاشات.**
    // وكان يسقط عمدًا حين كُتب، ثمّ صار يمرّ بأوّل شاشةٍ أُضيفت — **فلم يوجد
    // في أيّ لحظةٍ حارسٌ يحرس لا شيء.**
    expect(`المجلّدُ موجود ⟵ ${fs.existsSync(VIEW_DIR)}`).toBe('المجلّدُ موجود ⟵ true')
    expect(screens().length).toBeGreaterThan(0)
  })

  it('🔴 ولا عنصرَ إدخالٍ ولا نداءَ ترحيلٍ في أيٍّ منها', () => {
    for (const file of screens()) {
      const name = path.basename(file)
      const body = strip(fs.readFileSync(file, 'utf8'))
      for (const [label, shape] of FORBIDDEN) {
        // ⚠️ **الاسمُ في الرسالة** — ففشلٌ يقول «`SupplyView` فيها `<input`»
        // يُقرأ بلا فتح ملفّ، و«توقّعت ٠ ولقيت ١» لا يقول شيئًا.
        expect(`${name} ⟵ ${label}: ${shape.test(body)}`)
          .toBe(`${name} ⟵ ${label}: false`)
      }
    }
  })

  it('⚠️ ولا شاشةَ عرضٍ خارجَ المجلّد — وإلّا صار المدى قائمةً بلا أن يُعلَن', () => {
    // 🔴 **الثغرةُ التي يُغلقها هذا الشرط:** يُكتب `SupplyDocumentView.js` في
    // `components/` مباشرةً **فلا يراه المسحُ إطلاقًا**، والحارسُ يبقى أخضرَ
    // وهو لا ينظر إليه. **فاسمُ الملفّ يقرّر مكانَه، لا العكس.**
    const stray = fs.readdirSync(path.join(ROOT, 'components'))
      .filter((f) => /View\.js$/.test(f) && !f.includes('.test.'))
    expect(`شاشاتُ عرضٍ خارج المجلّد ⟵ ${stray.join(' · ') || 'لا شيء'}`)
      .toBe('شاشاتُ عرضٍ خارج المجلّد ⟵ لا شيء')
  })

  it('🔴 وشرطُ `write` محدودٌ بحدود الكلمة — لا بحثٌ نصّيٌّ ساذج', () => {
    // ⚠️ **سؤالٌ من المراجعة قبل بناء شاشة الشطب، ومحلُّه دقيق:** لو كان
    // الشرطُ `includes('write')` **لأسقط شاشةَ الشطب لمجرّد أنها تذكر اسمَ
    // نوعها** — `'write_off'` و`writeOffLines` و`WriteOffDocumentView` كلُّها
    // فيها هذه الحروف. **وحارسٌ يعضّ كودًا سليمًا يُخفَّف، وتخفيفُه يفتح الثغرةَ
    // التي وُضع لها.**
    //
    // ⇒ **فالحدُّ مثبَّتٌ هنا بالاتّجاهين، لا مقيسٌ مرّةً في تقرير.**
    const write = FORBIDDEN.find(([label]) => label.includes('write'))[1]

    for (const [label, code] of [
      ['قيمةُ النوع', "if (doc.doc_type === 'write_off') return null"],
      ['مفتاحُ ترجمة', "t('products:docs.write_off.title')"],
      ['اسمُ متغيّر', 'const writeOffLines = movementsOf(movements, doc.id)'],
      ['اسمٌ بأحرفٍ كبيرة', "import X from './WriteOffDocumentView'"],
      ['داخلَ كلمةٍ أطول', 'const rewritten = 2'],
    ]) {
      expect(`${label} ⟵ ${write.test(code)}`).toBe(`${label} ⟵ false`)
    }

    // وما يجب أن يُمسَك: الخاصّيّةُ التي تجعل `RefTd` قابلةً للكتابة، بصورها.
    for (const [label, code] of [
      ['مجرَّدة', '<RefTd write>{x}</RefTd>'],
      ['بقيمة', '<RefTd write={true}>{x}</RefTd>'],
      ['بشرط', '<RefTd write={canEdit}>{x}</RefTd>'],
    ]) {
      expect(`${label} ⟵ ${write.test(code)}`).toBe(`${label} ⟵ true`)
    }
  })

  it('✅ والحارسُ يعضّ — مقيسٌ على نصٍّ لا على شجرة العمل', () => {
    // **البيّنةُ المضادّةُ على كتلةٍ نصّيّة**، فلا تُلمس شجرةُ العمل إطلاقًا —
    // البديلُ الأنظفُ المذكورُ في `CLAUDE.md` حين يكون ممكنًا.
    const fake = `
      export default function FakeView({ doc }) {
        return <div><input value={doc.note} onChange={() => {}} /></div>
      }
    `
    const caught = FORBIDDEN.filter(([, shape]) => shape.test(fake)).map(([label]) => label)
    expect(caught).toContain('<input')
    expect(caught).toContain('onChange')

    // ولا تعضّ رسمًا ساكنًا.
    const inert = `
      export default function RealView({ doc }) {
        return <RefTd>{doc.note || '—'}</RefTd>
      }
    `
    expect(FORBIDDEN.filter(([, shape]) => shape.test(inert))).toEqual([])
  })
})

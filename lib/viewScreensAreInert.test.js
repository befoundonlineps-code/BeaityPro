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
const { INTERACTIVE, stripComments: strip, eventHandlersIn } = require('./interactiveShapes')

const ROOT = path.join(__dirname, '..')
const VIEW_DIR = path.join(ROOT, 'components', 'documentView')

function screens() {
  if (!fs.existsSync(VIEW_DIR)) return []
  return fs.readdirSync(VIEW_DIR)
    .filter((f) => f.endsWith('.js') && !f.includes('.test.'))
    .map((f) => path.join(VIEW_DIR, f))
}

// 🔴 **القائمةُ في `lib/interactiveShapes.js`، ونسخةٌ ثانيةٌ منها ممنوعة.**
//
// ⚠️ **وانتقلت إلى هناك بسببٍ لا بترتيب:** حارسُ المال في `returnFillRepro`
// يسأل «الشاشاتُ التي **يكتب** فيها إنسانٌ مبلغًا»، **ومداه كان كلَّ ملفٍّ يذكر
// `paidAmount`** — فعضّ أوّلَ شاشةِ عرضٍ تعرض المبلغَ المستلَم. **وتصويبُ مداه
// يحتاج نفسَ هذا السؤال بالضبط**، ونسخةٌ ثانيةٌ منه هي فرصةٌ ثانيةٌ لتتباعد.
const FORBIDDEN = INTERACTIVE

describe('🔴 شاشاتُ العرض غيرُ تفاعليّةٍ بالبناء', () => {
  it('⚠️ والمجلّدُ موجودٌ وفيه شاشةٌ واحدةٌ على الأقلّ — وإلّا كان الحارسُ أجوف', () => {
    // **هذا الشرطُ هو ما يمنع الحارسَ من المرور صامتًا قبل أن تُبنى الشاشات.**
    // وكان يسقط عمدًا حين كُتب، ثمّ صار يمرّ بأوّل شاشةٍ أُضيفت — **فلم يوجد
    // في أيّ لحظةٍ حارسٌ يحرس لا شيء.**
    expect(`المجلّدُ موجود ⟵ ${fs.existsSync(VIEW_DIR)}`).toBe('المجلّدُ موجود ⟵ true')
    expect(screens().length).toBeGreaterThan(0)
  })

  it('🔴 ولا معالِجَ حدثٍ واحدًا في أيٍّ منها — والمخرَجُ يسمّيه', () => {
    // ⚠️ **يُطبع ما قِيس بجانب ما حُكم به** (`CLAUDE.md`) — ففشلٌ يقول
    // «`onKeyDown`» يُصلَح بلا فتح ملفّ، **و«شكلٌ ممنوع» تبدأ جولةَ بحث.**
    for (const file of screens()) {
      const name = path.basename(file)
      const found = eventHandlersIn(fs.readFileSync(file, 'utf8'))
      expect(`${name} ⟵ معالِجات: ${found.join(' · ') || 'لا شيء'}`)
        .toBe(`${name} ⟵ معالِجات: لا شيء`)
    }
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

  it('🔴 و`components/ref/` كلُّه ممسوحٌ — إلّا ما يُعلَن مضيفًا للتفاعل بسببه', () => {
    // ⚠️ **ثقبٌ لا تراه الحلقةُ أعلاه:** شاشاتُ العرضِ تستورد شكلَها من
    // `components/ref/` — وهو **خارج** `components/documentView/`.
    // ⇒ **فـ`<button>` واحدٌ في بديلٍ ساكنٍ يصل الأربعَ دفعةً واحدة**، والحارسُ
    // أخضر. **وهي عينُ عائلة «قدرةٌ مركزيّةٌ ومستهلكٌ ما انربط فيها» معكوسةً.**
    //
    // 🔴 **والمدى المجلّدُ كلُّه لا اسمٌ واحد، وهذا هو الفرق:** اسمُ
    // `RefStatic.js` وحدَه **قائمةُ تضمينٍ تفشل مفتوحة** — بديلٌ ساكنٌ ثانٍ
    // يُكتب غدًا لا يراه أحد. **والمجلّدُ كلُّه يفشل مغلقًا:** الملفُّ الجديدُ
    // مَمسوحٌ يومَ يُكتب، **بلا أن يتذكّر أحدٌ إضافةَ اسمه.**
    //
    // ⚠️ **والاستثناءُ استبعادٌ لا تضمين** — فإضافةُ ملفٍّ لا تحتاج تعديلَ
    // قائمة، **وإخراجُ ملفٍّ من المسح وحدَه يحتاج قرارًا يكتبه إنسان.**
    const REF_DIR = path.join(ROOT, 'components', 'ref')

    // الأربعةُ التي تستضيف التفاعلَ بحقّ — **ولكلٍّ سببُه، لا مجرّدُ اسمه.**
    // ⚠️ **ولا واحدةٌ منها تستوردها شاشةُ عرض** — عدا `RefGrid`، وتمريرُ
    // `write` منها هو ما تمنعه الحلقةُ أعلاه، **لا تعريفُها هنا.**
    const HOSTS_INTERACTIVE = {
      'RefGrid.js': 'خاصّيّةُ `write` معرَّفةٌ هنا — الممنوعُ تمريرُها من شاشةِ عرض',
      'RefModal.js': 'قوقعةُ العمليّات: زرُّ الإرسال وزرُّ الإلغاء والـ× يعيشون هنا',
      'RefStorageBox.js': 'منسدلُ اختيار المستودع في شاشات الإدخال',
      'RefTwoPane.js': 'زرُّ الطيّ بين اللوحين',
    }

    // 🔴 **والاستبعادُ نفسُه يفشل مغلقًا:** اسمٌ لملفٍّ أُعيدت تسميتُه أو حُذف
    // **يترك استثناءً معلَّقًا يغطّي لا شيء**، ويُقرأ كأنه يغطّي شيئًا.
    const present = fs.readdirSync(REF_DIR).filter((f) => f.endsWith('.js') && !f.includes('.test.'))
    for (const name of Object.keys(HOSTS_INTERACTIVE)) {
      expect(`${name} ⟵ ما زال موجودًا: ${present.includes(name)}`)
        .toBe(`${name} ⟵ ما زال موجودًا: true`)
    }

    const scanned = present.filter((f) => !HOSTS_INTERACTIVE[f])
    // مشيةٌ لا تجد شيئًا لا تجد مخالفةً أيضًا.
    expect(scanned.length).toBeGreaterThan(0)

    for (const name of scanned) {
      const body = strip(fs.readFileSync(path.join(REF_DIR, name), 'utf8'))
      for (const [label, shape] of FORBIDDEN) {
        expect(`${name} ⟵ ${label}: ${shape.test(body)}`)
          .toBe(`${name} ⟵ ${label}: false`)
      }
    }

    // ⚠️ **وحارسٌ يحرس ملفًّا لا يستعمله أحدٌ حارسٌ فارغ** — فالربطُ مقيس.
    const users = screens().filter((f) => /RefStatic/.test(fs.readFileSync(f, 'utf8')))
    expect(`شاشاتٌ تستورد RefStatic ⟵ ${users.length > 0}`).toBe('شاشاتٌ تستورد RefStatic ⟵ true')
  })

  // ══════════════════════════════════════════════════════════════════
  // 🔴 وسومُ HTML — **قائمةُ المسموح، لا قائمةُ الممنوع**
  // ══════════════════════════════════════════════════════════════════
  //
  // ⚠️ **سؤالُ المراجعة الذي وُلد منه هذا الشرط، وهو صحيحٌ ومقيس:**
  // `<a href>` **ينتقل فعلًا** بلا `onClick` وبلا أن يكون `<button>`، و
  // `<div contentEditable>` **يصير محرّرَ نصٍّ كاملًا** بلا معالِجٍ إطلاقًا.
  //
  // **والقياسُ قبل الإصلاح:**
  //
  // ```
  // <div contentEditable>          ✅ يُمسَك (كان في القائمة أصلًا)
  // <a href="/x">                  🔴 يمرّ
  // <details><summary>             🔴 يمرّ   ← طيٌّ أصليٌّ بلا سطر JS
  // <iframe src="x" />             🔴 يمرّ
  // ```
  //
  // 🔴 **وتعدادُ الممنوع هو العطلُ نفسُه للمرّة الثالثة:** `onClick` فات،
  // ثمّ فاتت الأحداثُ كلُّها، **والآن `<a>` و`<details>` و`<iframe>`** —
  // **وما لم يخطر ببالي بعدها سيفوت أيضًا.**
  //
  // ⇒ **فالاتّجاه يُقلب: لا تُعدّ الوسومُ الخطرة، تُعلَن الوسومُ المسموحة.**
  // **والأربعُ تستعمل خمسةً فقط** (مقيسًا)، **وأيُّ وسمٍ سادسٍ يُسقط الحزمة
  // فينظر إنسانٌ مرّةً** — وهو نفسُ ما يقوله `CLAUDE.md`: «قائمةٌ بما هو
  // مستثنًى تفشل مغلقة».
  //
  // ⚠️ **والمكوّناتُ الكبيرةُ الحرفِ خارجَ المدى عمدًا** (`RefTd` · `StaticField`)
  // — **هي محروسةٌ بمصدرها** في `components/ref/`، والوسمُ الصغيرُ وحدَه هو ما
  // يُنشئ سلوكًا أصليًّا بلا كود.
  it('🔴 ولا وسمَ خارجَ المسموح — والقائمةُ مسموحٌ لا ممنوع', () => {
    // خمسةٌ، ولكلٍّ سببُه — **ولا واحدٌ منها يفعل شيئًا بلا كود.**
    const ALLOWED = {
      div: 'حاوية',
      span: 'حاويةٌ سطريّة',
      tr: 'صفُّ جدول',
      td: 'خليّةُ جدول',
      tbody: 'جسمُ الجدول',
    }

    for (const file of screens()) {
      const name = path.basename(file)
      const body = strip(fs.readFileSync(file, 'utf8'))
      const used = [...new Set((body.match(/<([a-z][a-z0-9]*)\b/g) || []).map((s) => s.slice(1)))].sort()

      // مشيةٌ لا تجد وسومًا لا تجد مخالفةً أيضًا.
      expect(`${name} ⟵ وسومٌ مقروءة: ${used.length > 0}`).toBe(`${name} ⟵ وسومٌ مقروءة: true`)

      const stray = used.filter((tag) => !ALLOWED[tag])
      expect(`${name} ⟵ وسومٌ خارج المسموح: ${stray.join(' · ') || 'لا شيء'}`)
        .toBe(`${name} ⟵ وسومٌ خارج المسموح: لا شيء`)
    }
  })

  it('✅ وقائمةُ المسموح تمسك الثلاثةَ التي كانت تمرّ — بيّنةً مضادّةً', () => {
    // **على كتلٍ نصّيّة، فلا تُلمس شجرةُ العمل.**
    const allowed = new Set(['div', 'span', 'tr', 'td', 'tbody'])
    const tagsOf = (code) => [...new Set((code.match(/<([a-z][a-z0-9]*)\b/g) || []).map((s) => s.slice(1)))]
    const caught = (code) => tagsOf(code).filter((t) => !allowed.has(t))

    for (const [label, code] of [
      ['رابطٌ ينتقل', '<a href="/products">اذهب</a>'],
      ['طيٌّ أصليّ', '<details><summary>افتح</summary><div>نصّ</div></details>'],
      ['إطارٌ مضمَّن', '<iframe src="https://x" />'],
      ['فيديو بضوابط', '<video controls src="x" />'],
      ['خريطةُ صورة', '<area href="/y" />'],
      ['نموذجٌ بفعل', '<form action="/post" />'],
    ]) {
      expect(`${label} ⟵ ${caught(code).length > 0}`).toBe(`${label} ⟵ true`)
    }

    // ولا تعضّ الرسمَ الساكن.
    expect(caught('<div><span>{x}</span></div>')).toEqual([])
    expect(caught('<tr><td>{x}</td></tr>')).toEqual([])
  })

  it('✅ و`contentEditable` ممسوكٌ أصلًا — مقيسٌ لا مفترَض', () => {
    // ⚠️ **وهو الأخطرُ في الصنف:** `<div contentEditable>` محرّرُ نصٍّ كاملٌ
    // **بلا وسمٍ ممنوعٍ وبلا معالِجٍ واحد** — يفلت من الشرطين معًا.
    // **وقائمةُ الوسوم لا تمسكه** لأن وسمَه `div` مشروع. ⇒ **فالشرطُ الثالثُ
    // لازمٌ، وهو قائمٌ منذ أوّل صياغة.**
    const editable = FORBIDDEN.find(([label]) => label === 'contentEditable')[1]
    for (const code of [
      '<div contentEditable>{x}</div>',
      '<div contentEditable={true}>{x}</div>',
      '<span contentEditable="true">{x}</span>',
    ]) {
      expect(`${code} ⟵ ${editable.test(code)}`).toBe(`${code} ⟵ true`)
    }
    expect(`رسمٌ ساكن ⟵ ${editable.test('<div>{x}</div>')}`).toBe('رسمٌ ساكن ⟵ false')
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
      // 🔴 **وهذه وحدَها هي التي تميّز الحدَّ من البحث الساذج، والأولى لم تكن.**
      // كُتبت `rewritten` أوّلًا **ولا تحوي `write` أصلًا** (w-r-i-t-**t**-e-n)،
      // فكانت ستمرّ بالمنطق الساذج نفسِه ⇒ **فحصٌ لا يفحص شيئًا.** والمراجعةُ
      // عدّتها. **و`rewriteCount` تحويها فعلًا** (`includes('write') = true`)
      // **ولا يطابقها الحدُّ** — فهي وحدَها تُسقط الحارسَ لو ضاق إلى `includes`.
      ['داخلَ كلمةٍ أطول', 'const rewriteCount = 2'],
      ['وباسمِ دالّة', 'function rewriteHandler() {}'],
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
    expect(caught).toContain('معالِجُ حدثٍ (on…=)')

    // ولا تعضّ رسمًا ساكنًا.
    const inert = `
      export default function RealView({ doc }) {
        return <RefTd>{doc.note || '—'}</RefTd>
      }
    `
    expect(FORBIDDEN.filter(([, shape]) => shape.test(inert))).toEqual([])
  })

  it('🔴 وكلُّ حدثٍ يُمسَك بالشكل — لا الثلاثةُ التي خطرت ببال كاتب الحارس', () => {
    // ⚠️ **هذا الاختبارُ وُلد من سؤال المالك:** «إذا `onClick` كان ناقص، ممكن
    // `onFocus` و`onBlur` و`onKeyDown` و`onMouseDown` وأمثالها تكون ناقصة
    // كمان. عدّدوا كلَّ أحداث React… مش بس يلي انكشف بالصدفة».
    //
    // **والجوابُ ليس تعدادًا** — تعدادُ ثلاثين يفوته الحادي والثلاثون، **وهو
    // العطلُ نفسُه مؤجَّلًا.** ⇒ **الشكلُ يمسك ما لم يُخترع بعد**، والعيّناتُ
    // أدناه شاهدُ صدقٍ على أن الشكلَ يبلغها فعلًا — لا تعريفٌ للمدى.
    const event = FORBIDDEN.find(([label]) => label.includes('on…='))[1]

    for (const handler of [
      'onClick', 'onDoubleClick', 'onMouseDown', 'onMouseUp', 'onMouseEnter',
      'onPointerDown', 'onPointerUp', 'onTouchStart', 'onTouchEnd',
      'onKeyDown', 'onKeyUp', 'onKeyPress', 'onFocus', 'onBlur',
      'onInput', 'onBeforeInput', 'onSelect', 'onReset', 'onInvalid',
      'onCopy', 'onCut', 'onPaste', 'onDragStart', 'onDrop', 'onWheel',
      'onScroll', 'onContextMenu', 'onToggle',
      // 🔴 **حدثٌ لا وجودَ له في React اليوم** — والشكلُ يمسكه، وهو المقصود.
      'onQuantumEntangle',
    ]) {
      expect(`${handler} ⟵ ${event.test(`<span ${handler}={() => {}}>`)}`)
        .toBe(`${handler} ⟵ true`)
    }

    // ⚠️ **ولا يعضّ ما ليس معالِجًا** — وإلّا خُفِّف يومًا فانفتحت الثغرة.
    for (const [label, code] of [
      ['خاصّيّةُ بيانات', '<RefRow data-view-line={line.id}>'],
      ['كلمةٌ تبدأ بـon', '<span className="online">'],
      ['ذكرٌ نصّيٌّ بلا تمرير', "const forbidden = ['onClick', 'onChange']"],
      ['اسمُ متغيّر', 'const onlyOne = rows[0]'],
    ]) {
      expect(`${label} ⟵ ${event.test(code)}`).toBe(`${label} ⟵ false`)
    }
  })

  it('🔴 والنشرُ ممنوعٌ لأنه يخبّئ ما لا يُقرأ', () => {
    // `{...rest}` قد يحمل `onClick` **بلا أن يظهر اسمُه في الملفّ إطلاقًا** —
    // فالشكلُ أعلاه يعميه. ⇒ **والنشرُ نفسُه ممنوع.**
    const spread = FORBIDDEN.find(([label]) => label.includes('{...x}'))[1]
    expect(`نشرٌ ⟵ ${spread.test('<RefTd {...rest}>{x}</RefTd>')}`).toBe('نشرٌ ⟵ true')
    expect(`نشرٌ بمسافات ⟵ ${spread.test('<RefTd { ...props }>')}`).toBe('نشرٌ بمسافات ⟵ true')

    // ⚠️ **ولا يعضّ نشرًا في كائنٍ عاديّ** — وهو ليس تمريرَ خصائص.
    expect(`كائنٌ عاديّ ⟵ ${spread.test('const next = { ...state, open: true }')}`)
      .toBe('كائنٌ عاديّ ⟵ false')
  })
})

/**
 * 🔴 **ثلاثةُ أعطالٍ انكشفت بمسبارٍ حيٍّ ثمّ مُحي — وهذا ما بقي منها.**
 *
 * كلُّها من صنفٍ واحد: **لا يراها اختبارُ وحدةٍ يقرأ منطقًا، ولا تظهر في لقطة**،
 * ولا يبقى منها أثرٌ في المستودع بعد أن يُغلَق المتصفّح. **ومسبارٌ لا يتكرّر
 * تلقائيًّا ليس حارسًا** — هو قياسٌ لمرّةٍ واحدة.
 *
 * ⇒ **فما كان قابلًا للتثبيت ساكنًا يُثبَّت هنا**، وما ليس كذلك يُقال إنه غيرُ
 * مثبَّت بدل أن يُترك مفهومًا ضمنًا.
 */

const fs = require('fs')
const path = require('path')
const { renderToStaticMarkup } = require('react-dom/server')
const React = require('react')

jest.mock('next-i18next', () => ({
  // ⚠️ **يُرجع المفتاحَ ومعه متغيّراتُه** — فمفتاحٌ يمرّ برقمٍ خطأ يبان،
  // ولو أرجع المفتاحَ وحدَه لصار الاختبارُ أعمى عن الرقم وهو موضوعُه.
  useTranslation: () => ({ t: (key, vars) => (vars ? `${key}${JSON.stringify(vars)}` : key) }),
}))

const ROOT = path.join(__dirname, '..')

describe('① عددُ سؤال الرمي — من الجلسة لا مما يُرسم', () => {
  const { countedInSession } = require('./stocktakeSheet')

  // 🔴 **الحالةُ التي كادت تُشحن:** ثلاثةٌ معدودة، والبحثُ يُظهر واحدًا.
  // **وقُيست حيًّا مرّةً** (`المنتجات المعدودة: 3` مع صفٍّ واحدٍ مرسوم)،
  // **وتُقاس هنا كلَّ مرّة.**
  it('🔴 لا يعرف البحثَ ولا الصفوفَ — يقبل الأعدادَ وحدَها', () => {
    const counts = { 'p-shampoo': '3', 'p-laser': '0', 'p-cooler': '5' }
    expect(`معدودٌ في الجلسة: ${countedInSession(counts)}`).toBe('معدودٌ في الجلسة: 3')

    // ⚠️ **والبرهانُ على المناعة أن التوقيع لا يقبل ما يُفلتَر أصلًا:**
    // لا صفوفَ ولا إبرةَ بحثٍ ولا تكلفة. **فلا يوجد ما يُنسى تمريرُه.**
    expect(`عددُ المعاملات: ${countedInSession.length}`).toBe('عددُ المعاملات: 1')
  })

  it('✅ والصفرُ عدٌّ، والفراغُ ليس عدًّا — وهو الفرقُ الذي يُفرغ رفًّا', () => {
    expect(countedInSession({ a: '0' })).toBe(1)
    expect(countedInSession({ a: '' })).toBe(0)
    expect(countedInSession({ a: '  ' })).toBe(0)
    expect(countedInSession({ a: '-2' })).toBe(0)
    expect(countedInSession({ a: 'خمسة' })).toBe(0)
    expect(countedInSession(undefined)).toBe(0)
  })

  // ⚠️ **وهذا ما يمنع الرجوعَ إلى العدّاد الخطأ:** الشاشةُ قد تعيد حسابَ الرقم
  // بيدها من `visible`/`counted` فيعود العطلُ بلا أن يسقط شيء.
  it('🔴 والشاشةُ تنادي المكتبةَ ولا تحسب بنفسها', () => {
    const sheet = fs.readFileSync(path.join(ROOT, 'components/StocktakingSheet.js'), 'utf8')
    const body = sheet.split(/\r?\n/).filter((line) => !line.trim().startsWith('//')).join('\n')

    expect(`تنادي المكتبة: ${/countedInSession\(counts\)/.test(body)}`).toBe('تنادي المكتبة: true')

    // والرقمُ الذاهبُ إلى نصّ السؤال هو ناتجُها، لا طولُ مصفوفةٍ مرسومة.
    const arg = /discardBody',\s*\{\s*count:\s*(\w+)\s*\}/.exec(body)
    expect(`الوسيطُ: ${arg ? arg[1] : '(لم يُعثَر)'}`).toBe('الوسيطُ: sessionCount')
    expect(`مصدرُه: ${/const sessionCount = countedInSession\(counts\)/.test(body)}`)
      .toBe('مصدرُه: true')
  })
})

describe('② RefCancelButton يمرّر ما يُعطى — ولا يبتلعه', () => {
  const { RefCancelButton } = require('../components/ref/RefModal')

  // 🔴 **العطلُ كما وقع:** المكوّنُ كان يقبل `children` و`onClick` وحدَهما،
  // **فـ`title` على زرّ «إلغاء» لم يصل الشاشةَ قطّ** — وهو النصُّ الذي حُسم به
  // قرارُ «الإغلاق لا الرمي». **ولا شيءَ يشتكي:** خاصّيّةٌ تُمرَّر إلى مكوّنٍ لا
  // يقرؤها تختفي كما لو لم تُكتب.
  it('🔴 title و data-* يصلان الوسمَ فعلًا', () => {
    const html = renderToStaticMarkup(
      React.createElement(RefCancelButton, { title: 'شرحٌ يجب أن يصل', 'data-x': 'y' }, 'إلغاء'),
    )
    expect(`فيه title: ${html.includes('title="شرحٌ يجب أن يصل"')}`).toBe('فيه title: true')
    expect(`فيه data-x: ${html.includes('data-x="y"')}`).toBe('فيه data-x: true')
  })

  // ⚠️ **والشكلُ لا يُمحى بتمرير `className`** — وإلّا صار كلُّ منادٍ يمرّرها
  // يفقد إطارَ الزرّ وحجمَه بلا أن ينتبه.
  it('✅ و className تُدمج ولا تستبدل', () => {
    const html = renderToStaticMarkup(
      React.createElement(RefCancelButton, { className: 'زائدة' }, 'إلغاء'),
    )
    expect(`الإطارُ باقٍ: ${html.includes('border-[var(--rule)]')}`).toBe('الإطارُ باقٍ: true')
    expect(`والزائدةُ وصلت: ${html.includes('زائدة')}`).toBe('والزائدةُ وصلت: true')
  })
})

describe('③ ولا زرَّ داخلَ زرّ — التعشيشُ يُسقط الترطيبَ كلَّه', () => {
  const ProductsSecondaryBar = require('../components/ProductsSecondaryBar').default

  // 🔴 **وقع فعلًا:** مشغّلُ القائمة يرسم `<button>`، ووُضع بداخله مدخلُ الشريط
  // وهو `<button>` آخر. **فسقط الترطيبُ والجذرُ تحوّل إلى عرضٍ بالعميل**
  // (`Hydration failed … the entire root will switch to client rendering`).
  //
  // ⚠️ **والسببُ الأقربُ أن `asChild` خاصّيّةٌ لا يقرأها Base UI** — تُبدَّل
  // مركّبتُه بـ`render` — **فمرّت مجهولةً بلا شكوى.**
  //
  // ⚠️ **ولا اختبارَ منطقٍ يراه، ولا لقطةَ شاشةٍ تُظهره:** الصفحةُ تبدو سليمةً
  // تمامًا بعد أن تُعاد بالعميل. **والمرسومُ وحدَه يقوله.**
  it('🔴 عمقُ الأزرار في الشريط لا يتجاوز واحدًا', () => {
    const html = renderToStaticMarkup(React.createElement(ProductsSecondaryBar, {
      op: null, onSelect: () => {}, lensStorageId: 'stor-1',
    }))

    // ⚠️ **المدى يُقاس قبل الحكم:** شريطٌ بلا أزرارٍ يمرّ خضراءَ ولا يفحص شيئًا.
    const opens = (html.match(/<button\b/g) || []).length
    expect(`أزرارٌ مرسومة ≥ 8: ${opens >= 8}`).toBe('أزرارٌ مرسومة ≥ 8: true')

    let depth = 0
    let deepest = 0
    for (const tag of html.match(/<\/?button\b/g) || []) {
      depth += tag === '</button' ? -1 : 1
      deepest = Math.max(deepest, depth)
    }
    expect(`أقصى عمقٍ للأزرار: ${deepest}`).toBe('أقصى عمقٍ للأزرار: 1')
  })
})

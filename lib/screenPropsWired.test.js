const fs = require('fs')
const path = require('path')

// ==========================================================================
// 🔴 كلُّ خاصّيّةٍ تقرأها شاشةٌ مرجعيّةٌ تُمرَّر لها فعلًا من الصفحة
//
// **وقع مرّتين، والثانيةُ وصلت شاشةَ المالك:** `documents` و`suppliers` لم
// تُمرَّرا لـ`WriteOffProductsScreen`، **فوصلتا `undefined`**. و
// `(undefined || []).filter(…)` تعطي `[]`، **فعرضت النافذةُ «ما في فواتير
// توريد محفوظة» عن مستودعٍ فيه ثلاثةُ سنداتِ توريدٍ حقيقيّة.**
//
// ⚠️ **وهذا أخبثُ من عطل قراءة:** لا خطأَ في الكونسول ولا شبكةَ فاشلة ولا سطرَ
// أحمر — **الشاشةُ تقول الحقيقةَ عن حالتها وتكذب عن القاعدة.** والتشخيصُ يذهب
// إلى الاستعلام والفلاتر، **وهي آخرُ مكانٍ فيه العطل.**
//
// 🔴 **والسببُ الأقربُ لا يقلّ أهمّيّةً: التعديلُ تمّ بـ`replace` معلَّقٍ على
// مسافاتٍ بيضاء، فلم يطابق شيئًا وطبع «تمّ».** وهذا مسجَّلٌ في `CLAUDE.md` تحت
// «الطفرة التي لم تُطبَّق» — **والمسجَّلُ وقع مرّةً أخرى، فلزم حارسٌ لا قاعدةٌ
// تُتذكَّر.**
//
// ---------------------------------------------------------------------------
// والحارسُ يصف الشكلَ ويفشل مغلقًا
//
// أسماءُ الخصائصِ **تُشتقّ من توقيع المكوّن نفسِه** لا من قائمةٍ تُكتب بيد،
// **وقائمةُ الشاشات كذلك** — فشاشةٌ رابعةٌ تُبنى غدًا تدخل الفحصَ يومَ تُوصَل.
//
// ⚠️ **والمستثنى صريحٌ بأسبابه:** `salonId` تُمرَّر من `AuthGate` لا من الصفحة
// في بعضها، و`onSaved`/`onPosted`/`onClose` تُكتب معالجاتٍ مضمَّنة. **فما لا
// يُمرَّر يُسمّى هنا أو يسقط الفحص** — والقائمةُ تفشل مغلقة.
// ==========================================================================

const ROOT = path.join(__dirname, '..')
const PAGE = fs.readFileSync(path.join(ROOT, 'pages', 'products', 'index.js'), 'utf8')

// 🔴 **مشتقّةٌ من الصفحة، ولم تكن.** كانت `['OrderProductsScreen', …]` مكتوبةً
// بيدٍ ومثبَّتةً على ثلاث، **والتعليقُ أعلاه كان يقول إنها مشتقّةٌ وإن شاشةً
// رابعةً «تدخل الفحصَ يومَ تُوصَل»** — فوُصلت `ReturnToSupplierScreen` ولم تدخل،
// **ومرّ الحارسُ أخضرَ وهو لا يراها.**
//
// ⚠️ **وهذا أسوأُ من غياب حارس:** حارسٌ غائبٌ يُعرَف غيابُه، **وحارسٌ يُعلن عن
// نفسه أنه يشتقُّ وهو يقرأ قائمةً يدويّةً يُبنى عليه** — وهو الصنفُ الذي سجّله
// هذا المشروعُ باسم «تعليقٌ يصف نيّةً كأنها واقع».
//
// **والاشتقاقُ من الصفحة لا من مجلّد المكوّنات:** السؤالُ «هل تصل الخصائصُ من
// الصفحة؟» فمجالُه ما تركّبه الصفحةُ فعلًا.
const SCREENS = [...new Set(
  Array.from(PAGE.matchAll(/<([A-Z][A-Za-z]*Screen)\b/g)).map((m) => m[1])
)].sort()

// الخصائصُ التي لا تُمرَّر بالاسم، ولكلٍّ سببُها.
const NOT_FROM_PAGE = new Set([
  // يمرّرها `AuthGate` عبر الدالّة الابنة لا الصفحةُ مباشرةً في كلّ شاشة.
  'salonId',
])

// أسماءُ الخصائص من توقيع المكوّن — `export default function X({ a, b, c })`.
function propsOf(name) {
  const text = fs.readFileSync(path.join(ROOT, 'components', `${name}.js`), 'utf8')
  const start = text.indexOf(`export default function ${name}({`)
  expect(start).toBeGreaterThan(-1)
  const open = text.indexOf('{', start)
  const close = text.indexOf('})', open)
  expect(close).toBeGreaterThan(open)

  return text.slice(open + 1, close)
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join(' ')
    .split(',')
    .map((piece) => piece.trim().split(/[:=\s]/)[0])
    .filter(Boolean)
}

// كتلةُ الـJSX التي تركّب المكوّن في الصفحة.
function usageOf(name) {
  const start = PAGE.indexOf(`<${name}`)
  expect(start).toBeGreaterThan(-1)
  const end = PAGE.indexOf('/>', start)
  expect(end).toBeGreaterThan(start)
  return PAGE.slice(start, end)
}

describe('كلُّ خاصّيّةٍ تقرأها الشاشةُ تصلها من الصفحة', () => {
  it('يقرأ كلَّ شاشةٍ تركّبها الصفحةُ لا صفرًا — وإلّا مرّ الفحصُ على لا شيء', () => {
    // ⚠️ البيّنةُ المضادّة التي يوجد هذا السطرُ لأجلها: مسحٌ يرجع فارغًا يُبلّغ
    // «لا مخالفة» بنفس نبرة النجاح.
    //
    // ⚠️ **وحدٌّ أدنى لا عددٌ مثبَّت:** التثبيتُ على رقمٍ كان يفشل عند إضافة
    // شاشةٍ **فيدفع إلى تحديث الرقم بدل النظر** — والحدُّ الأدنى يمسك «المشيةُ
    // لم تجد شيئًا» وهو ما يوجد السطرُ لأجله، **بلا صيانةٍ تُغري بالتزييف.**
    expect(SCREENS.length).toBeGreaterThanOrEqual(6)
    // والشاشاتُ التي وقع فيها العطلُ فعلًا مثبَّتةٌ بالاسم: اشتقاقٌ يتوقّف عن
    // العمل يعطي قائمةً أقصرَ بلا سطرٍ يشتكي.
    for (const pinned of ['WriteOffProductsScreen', 'ReturnToSupplierScreen']) {
      expect(SCREENS).toContain(pinned)
    }
    for (const name of SCREENS) expect(propsOf(name).length).toBeGreaterThan(5)
  })

  it.each(SCREENS)('%s — ولا خاصّيّةٌ تصل undefined', (name) => {
    const usage = usageOf(name)
    const missing = propsOf(name)
      .filter((prop) => !NOT_FROM_PAGE.has(prop))
      // `name={…}` أو `name`(مختصرة) — والصيغتان تُقبلان.
      .filter((prop) => !new RegExp(`(^|\\s)${prop}\\s*=\\s*\\{`).test(usage)
                     && !new RegExp(`(^|\\s)${prop}(\\s|$)`).test(usage))

    // الرسالةُ تحمل الأسماءَ، فمَن يقرأ الفشلَ لا يحتاج فتحَ ملفّ.
    expect(missing).toEqual([])
  })

  it('يعضّ على خاصّيّةٍ منزوعة — بيّنةٌ مضادّةٌ على نسخة', () => {
    // ⚠️ على نصٍّ لا على شجرة العمل. `documents` هي التي غابت فعلًا.
    const broken = usageOf('WriteOffProductsScreen').replace(/\n\s*documents=\{[^}]*\}/, '')
    expect(broken).not.toMatch(/(^|\s)documents\s*=\s*\{/)
    expect(usageOf('WriteOffProductsScreen')).toMatch(/(^|\s)documents\s*=\s*\{/)
  })
})

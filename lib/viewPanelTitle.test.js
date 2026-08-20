const fs = require('fs')
const path = require('path')

const { OPERATION_LABEL_KEY } = require('./productsOperations')

// 🔴 عنوانُ شريط لوح العرض = عنوانُ شريط شاشة الإنشاء — **بمصدرٍ واحد.**
//
// **قرارُ المالك:** «العنوان = نص شريط شاشة الإدخال الحقيقي بالضبط».
//
// ══════════════════════════════════════════════════════════════════
// ولماذا مصدرٌ واحدٌ لا مقارنةٌ بين اثنين
// ══════════════════════════════════════════════════════════════════
//
// أوّلُ صياغةٍ قرأت العنوانَ من `docs.<doc_type>.title` **فتطابق ثلاثةٌ
// وافترقت الطلبيّة**: «طلب بضاعة» مقابل «الطلبيّات». **وكُتب حينها حارسٌ يُعلن
// الافتراقَ ويحرسه** — والمالكُ ردّ بالجملة التي وُلد منها هذا الملفّ:
//
// > «اقلبوا اتجاه حارس التطابق… **هذا يُلغي الانحرافَ كلّيًّا بدل ما يعلنه
// > ويحافظ عليه**».
//
// ⇒ **فالعنوانان يقرآن اليومَ المفتاحَ نفسَه** —
// `secondaryItems.<OPERATION_LABEL_KEY[op]>` — **والافتراقُ صار غيرَ ممكنٍ لا
// ممنوعًا.**
//
// ⚠️ **وهذا يغيّر وظيفةَ الحارس ولا يلغيها:** لم يعد يقارن نصَّين (لا شيءَ
// يقارَن)، **بل يمنع الرجوعَ إلى مصدرين** — فيسقط يومَ يعود اللوحُ يقرأ
// `docs.<type>.title` لعنوان الشاشات الأربع.
//
// ⚠️ **و`docs.<type>.title` يبقى حيث هو صحيح** — مرشِّحُ النوع، وخليّةُ النوع
// في الصفّ، ونافذةُ تأكيد العكس: **هناك «طلب بضاعة» اسمُ ما يُقرأ، وهنا
// «الطلبيّات» اسمُ الشاشة التي تُنشئه.**
const ROOT = path.join(__dirname, '..')
const LOCALE = path.join(ROOT, 'public', 'locales', 'ar', 'products.json')
const PANEL = path.join(ROOT, 'components', 'StockDocumentsList.js')
const PAGE = path.join(ROOT, 'pages', 'products', 'index.js')

// العمليّاتُ الأربعُ التي لها شاشةُ عرضٍ خاصّة — **بأسماء العمليّات لا أنواع
// المستندات**، لأنها مفاتيحُ `OPERATION_LABEL_KEY`.
const DEDICATED = ['orders', 'supply', 'write_off', 'return_to_supplier']

describe('🔴 عنوانُ لوح العرض من مصدر شريط شاشة الإنشاء نفسِه', () => {
  const dict = JSON.parse(fs.readFileSync(LOCALE, 'utf8'))
  const panel = fs.readFileSync(PANEL, 'utf8')
  const page = fs.readFileSync(PAGE, 'utf8')

  it('⚠️ والأربعُ لها مفتاحٌ يحلّ إلى نصٍّ فعليّ — لا `undefined` يطابق `undefined`', () => {
    for (const op of DEDICATED) {
      const key = OPERATION_LABEL_KEY[op]
      expect(`${op} ⟵ له مفتاحُ تسمية: ${!!key}`).toBe(`${op} ⟵ له مفتاحُ تسمية: true`)
      const value = dict.secondaryItems?.[key]
      expect(`${op} ⟵ secondaryItems.${key} نصٌّ غيرُ فارغ: ${typeof value === 'string' && value.length > 0}`)
        .toBe(`${op} ⟵ secondaryItems.${key} نصٌّ غيرُ فارغ: true`)
    }
  })

  it('🔴 واللوحُ والصفحةُ يقرآن المفتاحَ نفسَه — فلا نصّان يتباعدان', () => {
    // **الصفحةُ**: عنوانُ شريط شاشة الإنشاء.
    expect(page).toMatch(/products:secondaryItems\.\$\{OPERATION_LABEL_KEY\[op\]\}/)

    // **واللوحُ**: عنوانُ شريط شاشة العرض، بنفس التركيب.
    expect(panel).toMatch(/products:secondaryItems\.\$\{OPERATION_LABEL_KEY\[dedicatedOperation\]\}/)

    // 🔴 **ولا نصَّ عنوانٍ مكتوبٌ بيدٍ في اللوح** — وإلّا عاد المصدران اثنين
    // بلبوسٍ ثالث.
    expect(`اللوحُ فيه عنوانٌ عربيٌّ مكتوبٌ بيد ⟵ ${/title=\{?["'][؀-ۿ]/.test(panel)}`)
      .toBe('اللوحُ فيه عنوانٌ عربيٌّ مكتوبٌ بيد ⟵ false')
  })

  it('🔴 وعنوانُ الشاشات الأربع لا يُقرأ من `docs.<type>.title` — بيّنةً مضادّةً', () => {
    // ⚠️ **الشرطُ على شريط العنوان وحدَه، بحدَّيه** — `docs.<type>.title`
    // مشروعٌ في اللوح لمواضعَ أخرى (مرشِّحُ النوع · خليّةُ الصفّ · تأكيدُ
    // العكس)، **فمسحُ الملفّ كلِّه كان سيعضّ كودًا سليمًا.**
    const start = panel.indexOf('<RefChromeBar')
    const end = panel.indexOf('/>', panel.indexOf('close={', start))
    expect(`للشريط حدّان ⟵ ${start > 0 && end > start}`).toBe('للشريط حدّان ⟵ true')

    const bar = panel.slice(start, end)
    expect(`الشريطُ يقرأ docs.<type>.title ⟵ ${/docs\.\$\{viewed\.doc_type\}\.title/.test(bar)}`)
      .toBe('الشريطُ يقرأ docs.<type>.title ⟵ false')
    expect(`الشريطُ يقرأ panelTitle ⟵ ${/\{panelTitle\}/.test(bar)}`)
      .toBe('الشريطُ يقرأ panelTitle ⟵ true')
  })

  it('✅ والشريطُ شكلٌ لا بنية — لا `Dialog` ولا `Portal`', () => {
    expect(panel).toMatch(/RefChromeBar/)
    expect(panel).not.toMatch(/<RefModal/)
    const bar = fs.readFileSync(path.join(ROOT, 'components', 'ref', 'RefChromeBar.js'), 'utf8')
    expect(`RefChromeBar فيه Dialog ⟵ ${/Dialog|Portal/.test(bar.replace(/\/\/.*$/gm, ''))}`)
      .toBe('RefChromeBar فيه Dialog ⟵ false')
  })
})

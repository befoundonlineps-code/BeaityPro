const fs = require('fs')
const path = require('path')

const { stripComments: strip } = require('./interactiveShapes')

// 🔴 شاشةُ العرض لا تستعير نصَّ خيارٍ من منسدلٍ يعرض «المتبقّي اليوم».
//
// ══════════════════════════════════════════════════════════════════
// الواقعةُ التي وُلد منها هذا الحارس
// ══════════════════════════════════════════════════════════════════
//
// أُسقط «متبقٍّ» من عمود الدفعة في شاشتَي العرض **بقرارٍ مُقرّ**، **وقيل في
// تقريرٍ إنه سقط.** ثمّ جاء أمرُ «أعيدوا البناء صورةً من شاشة الإنشاء»،
// **فنُسخ نصُّ خيار المنسدل حرفيًّا** (`writeOff.lotOption` ·
// `returnSupplier.lotOption`) — **فعاد «متبقٍّ» إلى الشاشتين معًا.**
//
// ⚠️ **والمالكُ رآه في لقطة، ولم يره أيُّ فحصٍ عندنا** — وهو الصنفُ الذي
// `CLAUDE.md` يسمّيه: «تمييزٌ كلّفنا جولةً لنرسيه ما بينترك بتعليق».
//
// ⚠️ **ولم يكن «دالّةً مشتركة»**، وهذا مقيسٌ لا مُخمَّن: **مفتاحان منفصلان
// بنصَّين متطابقين حرفيًّا**، ونداءان في ملفَّين. **فالمشتركُ أنني كتبتُ الخطأَ
// مرّتين، لا أنّ موضعًا واحدًا يخدمهما.** ⇒ **والحارسُ يمسك الشكلَ لا الاسم**،
// فأيُّ مفتاحٍ ثالثٍ بنفس المعنى يسقط يومَ يُستعمل.
//
// ══════════════════════════════════════════════════════════════════
// والإبرةُ **معنًى لا اسمُ مفتاح** — وهذا هو الفرق
// ══════════════════════════════════════════════════════════════════
//
// منعُ `lotOption` بالاسم **يفشل مفتوحًا**: مفتاحٌ جديدٌ بنفس النصّ يمرّ.
// **والمنعُ بقيمة المفتاح يفشل مغلقًا** — أيُّ نصٍّ يعرض «المتبقّي» يُمسَك،
// **مهما كان اسمُه ومهما كان مكانُه.**
//
// **ولماذا «متبقٍّ» تحديدًا:** هو **رقمُ لحظةِ اختيار** — متبقّي الدفعة
// **اليوم**، لا متبقّيها يومَ الترحيل. **وعرضُه على مستندٍ ماضٍ يقرأ سطرًا عن
// الحاضر كأنه عن الماضي**، وهو نفسُ سبب إسقاط «المتوفر» قبل أن يعيده المالك
// **صراحةً** بعمودٍ مستقلٍّ يقول ما يقوله.
const ROOT = path.join(__dirname, '..')
const VIEW_DIR = path.join(ROOT, 'components', 'documentView')
const LOCALE = path.join(ROOT, 'public', 'locales', 'ar', 'products.json')

// النصُّ الممنوعُ ظهورُه في شاشة عرض — **معنًى واحدٌ بحرفه.**
const FORBIDDEN_TEXT = 'متبقٍّ'

function screens() {
  if (!fs.existsSync(VIEW_DIR)) return []
  return fs.readdirSync(VIEW_DIR).filter((f) => f.endsWith('.js') && !f.includes('.test.'))
}

// المفاتيحُ الحرفيّةُ وحدَها — **والقوالبُ الديناميكيّة تُقال ولا تُبتلع.**
const LITERAL_KEY = /t\('products:([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)'/g

function valueAt(dict, dotted) {
  return dotted.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict)
}

describe('🔴 شاشاتُ العرض لا تعرض «المتبقّي اليوم»', () => {
  const dict = JSON.parse(fs.readFileSync(LOCALE, 'utf8'))

  it('⚠️ والمدى والإبرةُ مقيسان — لا مجلّدٌ فارغٌ ولا كلمةٌ لا وجودَ لها', () => {
    expect(screens().length).toBeGreaterThan(0)

    // 🔴 **شاهدُ صدقٍ داخل السؤال:** كلمةٌ غيرُ موجودةٍ في ملفّ اللغة أصلًا
    // **تجعل الحارسَ أخضرَ إلى الأبد** — «ما في» و«ما سألت» يتطابقان.
    const anywhere = JSON.stringify(dict).includes(FORBIDDEN_TEXT)
    expect(`«${FORBIDDEN_TEXT}» موجودةٌ في ملفّ اللغة ⟵ ${anywhere}`)
      .toBe(`«${FORBIDDEN_TEXT}» موجودةٌ في ملفّ اللغة ⟵ true`)
  })

  it('🔴 ولا مفتاحَ في شاشة عرضٍ قيمتُه تعرض المتبقّي — بالاسم عند السقوط', () => {
    for (const name of screens()) {
      const body = strip(fs.readFileSync(path.join(VIEW_DIR, name), 'utf8'))

      const keys = [...body.matchAll(LITERAL_KEY)].map((m) => m[1])
      // مشيةٌ لا تجد مفاتيحَ لا تجد مخالفةً أيضًا.
      expect(`${name} ⟵ مفاتيحُ مقروءة: ${keys.length > 0}`)
        .toBe(`${name} ⟵ مفاتيحُ مقروءة: true`)

      for (const key of keys) {
        const value = valueAt(dict, key)
        // ⚠️ **مفتاحٌ لا قيمةَ له مفتاحٌ خامٌّ على الشاشة** — و`translationKeys`
        // يمسكه، **فهذا الحارسُ لا يدّعي مسكَه ولا يبتلعه.**
        if (typeof value !== 'string') continue
        expect(`${name} ⟵ ${key} يعرض «${FORBIDDEN_TEXT}»: ${value.includes(FORBIDDEN_TEXT)}`)
          .toBe(`${name} ⟵ ${key} يعرض «${FORBIDDEN_TEXT}»: false`)
      }
    }
  })

  it('✅ والحارسُ يعضّ — على النصّ الذي عاد فعلًا، لا على مثالٍ مخترَع', () => {
    // **قيمةُ المفتاح كما هي في ملفّ اللغة اليوم** — فالبيّنةُ المضادّةُ هي
    // الحالةُ التي وقعت حرفيًّا، لا محاكاةٌ لها.
    for (const key of ['writeOff.lotOption', 'returnSupplier.lotOption']) {
      const value = valueAt(dict, key)
      expect(`${key} ⟵ نصُّ منسدلٍ يعرض المتبقّي: ${String(value).includes(FORBIDDEN_TEXT)}`)
        .toBe(`${key} ⟵ نصُّ منسدلٍ يعرض المتبقّي: true`)
    }

    // ⚠️ **ولا يعضّ بديلَي العرض** — وإلّا كان يمنع الإصلاحَ نفسَه.
    for (const key of ['documents.lotDateCost', 'documents.lotDate']) {
      const value = valueAt(dict, key)
      expect(`${key} ⟵ موجودٌ ونظيف: ${typeof value === 'string' && !value.includes(FORBIDDEN_TEXT)}`)
        .toBe(`${key} ⟵ موجودٌ ونظيف: true`)
    }
  })
})

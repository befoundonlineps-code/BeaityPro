const fs = require('fs')
const path = require('path')

const { stripComments: strip } = require('./interactiveShapes')

// 🔴 أعمدةُ شاشة العرض = أعمدةُ شاشة الإنشاء، بترتيبها وعروضها — إلّا ما يُعلَن.
//
// ══════════════════════════════════════════════════════════════════
// لماذا وُلد هذا الحارس
// ══════════════════════════════════════════════════════════════════
//
// **قرارُ المالك:** «شاشةُ العرض = نفسُ شاشة الإنشاء بصريًّا بالحرف — نفسُ
// الرأس، نفسُ الجدول، نفسُ الذيل، نفسُ الترتيب».
//
// ⚠️ **وقد انحرفت مرّةً بلا أن يشتكي شيء:** عمودُ «الدفعة» عاد يعرض «متبقٍّ»
// **بعد إسقاطه بقرارٍ مُقرّ**، ولم يره إلّا المالكُ في لقطة. **وذاك حُرس بنصّه**
// (`viewScreenEntryOnlyKeys`)، **وهذا يحرس البنيةَ نفسَها:** عمودٌ يسقط أو
// يُضاف أو يتبدّل ترتيبُه أو عرضُه.
//
// ⚠️ **والفرقُ بين الحارسين حقيقيّ:** الأوّلُ يسأل «ماذا يقول هذا العمود؟»،
// **وهذا يسأل «هل هو موجودٌ في مكانه؟»** — والانحرافُ الذي وقع كان الأوّل،
// **والانحرافُ القادمُ لا يلزم أن يكون من صنفه.**
//
// ══════════════════════════════════════════════════════════════════
// والاستثناءُ **يُعلَن بسببه، ويفشل مغلقًا**
// ══════════════════════════════════════════════════════════════════
//
// شاشةُ عرضٍ جديدةٌ بلا زوجٍ معلَنٍ **تُسقط الحزمة** — فلا تدخل صامتة.
const ROOT = path.join(__dirname, '..')
const VIEW_DIR = path.join(ROOT, 'components', 'documentView')

// ترويسةُ عمودٍ واحدة: المفتاحُ وعرضُه الصنفيّ، بترتيب الظهور.
const HEAD = /<RefTh(?:\s+className="([^"]*)")?[^>]*>\{t\('products:([A-Za-z0-9_.]+)'\)\}<\/RefTh>/g

function columnsOf(file) {
  return [...strip(fs.readFileSync(file, 'utf8')).matchAll(HEAD)]
    .map((m) => ({ key: m[2], width: m[1] || '' }))
}

// كلُّ شاشةِ عرضٍ وزوجُها من شاشات الإنشاء — **وما تفترق فيه، بسببه.**
const PAIRS = {
  'WriteOffDocumentView.js': {
    entry: 'components/WriteOffProductsScreen.js',
    drop: [],
    rename: {},
  },
  'SupplyDocumentView.js': {
    entry: 'components/SupplyProductsScreen.js',
    drop: [],
    rename: {},
  },
  'ReturnDocumentView.js': {
    entry: 'components/ReturnToSupplierScreen.js',
    drop: [],
    // 🔴 **خانةُ الإنشاء للوحدة الأساسيّة، والعمودُ المحفوظُ للعبوة**
    // (`returnGrid.js:260` تضرب في معامل التعبئة قبل الحفظ). **واستعادةُ إطار
    // الإنشاء تحتاج قسمةً هي `100.0005` بعينها** — ويحظرها قرارُ المالك «لا
    // حسابَ حيًّا لغير المخزَّن على نفس السطر». ⇒ **يُعرض المحفوظُ باسمه.**
    rename: { 'returnSupplier.unitPriceColumn': 'documents.returnPackagePrice' },
  },
  'OrderDocumentView.js': {
    entry: 'components/OrderProductsScreen.js',
    // 🔴 **`product_order_lines` بلا `quantity_base` ولا ما يكافئه**
    // (`053a:133`)، **والطلبيّةُ لا تولّد حركة.** واشتقاقُها من معامل التعبئة
    // **خطرُ `unit_cost` بعينه** — رقمٌ تاريخيٌّ يتغيّر بتغيّر إعدادات المنتج.
    // ⇒ **يسقط كلّيًّا بقرار المالك.**
    drop: ['orders.numberColumn'],
    rename: {},
  },
}

function screens() {
  if (!fs.existsSync(VIEW_DIR)) return []
  return fs.readdirSync(VIEW_DIR).filter((f) => f.endsWith('.js') && !f.includes('.test.'))
}

describe('🔴 أعمدةُ العرض تطابق أعمدةَ الإنشاء', () => {
  it('⚠️ وكلُّ شاشةِ عرضٍ لها زوجٌ معلَن — والغيابُ يُسقط', () => {
    expect(screens().length).toBeGreaterThan(0)
    for (const name of screens()) {
      expect(`${name} ⟵ له زوجٌ معلَن: ${!!PAIRS[name]}`).toBe(`${name} ⟵ له زوجٌ معلَن: true`)
    }
    for (const name of Object.keys(PAIRS)) {
      expect(`${name} ⟵ ما زال موجودًا: ${screens().includes(name)}`)
        .toBe(`${name} ⟵ ما زال موجودًا: true`)
      const entry = path.join(ROOT, PAIRS[name].entry)
      expect(`${PAIRS[name].entry} ⟵ موجود: ${fs.existsSync(entry)}`)
        .toBe(`${PAIRS[name].entry} ⟵ موجود: true`)
    }
  })

  it('🔴 والتسلسلُ نفسُه بعد تطبيق ما أُعلن — بالاسم عند السقوط', () => {
    for (const name of screens()) {
      const { entry, drop, rename } = PAIRS[name]
      const entryCols = columnsOf(path.join(ROOT, entry))
      // مشيةٌ لا تجد أعمدةً لا تجد اختلافًا أيضًا.
      expect(`${entry} ⟵ أعمدةٌ مقروءة: ${entryCols.length > 0}`)
        .toBe(`${entry} ⟵ أعمدةٌ مقروءة: true`)

      const expected = entryCols
        .filter((c) => !drop.includes(c.key))
        .map((c) => ({ key: rename[c.key] || c.key, width: c.width }))

      const actual = columnsOf(path.join(VIEW_DIR, name))

      expect(`${name} ⟵ ${actual.map((c) => c.key).join(' · ')}`)
        .toBe(`${name} ⟵ ${expected.map((c) => c.key).join(' · ')}`)
      expect(`${name} ⟵ عروضٌ: ${actual.map((c) => c.width || '(بلا)').join(' · ')}`)
        .toBe(`${name} ⟵ عروضٌ: ${expected.map((c) => c.width || '(بلا)').join(' · ')}`)
    }
  })

  it('✅ وكلُّ استثناءٍ معلَنٍ مقابلُه موجودٌ فعلًا — لا استثناءَ معلَّقٌ يغطّي لا شيء', () => {
    // ⚠️ **اسمٌ في `drop` أو `rename` لعمودٍ لم يعد في شاشة الإنشاء يترك
    // استثناءً يُقرأ كأنه يغطّي شيئًا** — وهو نفسُ صنف «قائمةٌ تفشل مفتوحة».
    for (const [name, { entry, drop, rename }] of Object.entries(PAIRS)) {
      const keys = columnsOf(path.join(ROOT, entry)).map((c) => c.key)
      for (const key of [...drop, ...Object.keys(rename)]) {
        expect(`${name} ⟵ استثناءُ «${key}» ما زال في شاشة الإنشاء: ${keys.includes(key)}`)
          .toBe(`${name} ⟵ استثناءُ «${key}» ما زال في شاشة الإنشاء: true`)
      }
    }
  })
})

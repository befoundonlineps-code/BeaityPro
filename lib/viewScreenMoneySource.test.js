const fs = require('fs')
const path = require('path')

// 🔴 مصدرُ رقمِ المال في كلّ شاشةِ عرض — **محروسٌ لأن التمييزَ كلّف جولة.**
//
// **قرارُ المالك (المواصفة د/٤)، وهو بندان لا واحد:**
//
// ```
// ١   عمودُ «المبلغ» يبقى **بشرط أن تعرضه شاشةُ الإدخال المقابلة**
// ٢   وفي التوريد والإرجاع يُبنى من `entered_unit_price` **لا من `unit_cost`**
// ```
//
// **والبندُ ٢ ليس تفضيلًا حسابيًّا — هو البندُ ١ مطبَّقًا، مقيسًا:**
//
// ```
// شاشةُ إدخال الشطب   writeOffGrid.js:32  ⟵ العددُ بالوحدة الأساسيّة × unit_cost
// شاشةُ إدخال التوريد  orderGrid.js:85     ⟵ العبواتُ × سعرِ العبوة
// ```
//
// ⇒ **فشاشةُ التوريد لا تضرب في `unit_cost` إطلاقًا**، و«تكلفة العبوة» هي
// `entered_unit_price` بعينها (`050b:18`: «per ENTERED unit — per package if
// that is the entered uom»).
//
// ⚠️ **والبديلُ كان سيكذب مرّتين، والفرقُ مقيسٌ لا مذوَّق** — منتجٌ بعبوةٍ من
// ١٥ وسعرِ عبوةٍ مكتوبٍ ١٠٠ يُخزَّن `unit_cost = 6.6667`:
//
// ```
//  عبوات   ١٠   entered ⟵  ١٠٠٠٫٠٠     unit_cost ⟵  ١٬٠٠٠٫٠١   ← الفرقُ يظهر
//  عبوات  ١٠٠   entered ⟵ ١٠٠٠٠٫٠٠     unit_cost ⟵ ١٠٬٠٠٠٫٠٥
// ```
//
// **وهو منبعُ `100.0005` نفسِه** الموصوفُ في `stockDocumentList.js:92-105`.
//
// ══════════════════════════════════════════════════════════════════
// 🔴 والخريطةُ تفشل **مغلقة** — شاشةٌ جديدةٌ بلا مدخلٍ تُسقط الحزمة
// ══════════════════════════════════════════════════════════════════
//
// ⚠️ **ولا اشتقاقَ ممكنٌ هنا، وهذا يُقال بدل أن يُدَّعى العكس:** المصدرُ الصحيح
// يتقرّر بما تعرضه **شاشةُ الإدخال** المقابلة، **وذلك ليس في الملفّ المفحوص.**
// فالخريطةُ يدويّةٌ بالضرورة — **والدفاعُ أن غيابَ الاسم يُسقط، لا أن وجودَه
// يمرّ.** (`screenPropsWired` ادّعى الاشتقاقَ وكان يقرأ ثلاثةَ أسماءٍ مثبَّتة،
// فمرّت الرابعةُ من تحته.)
const ROOT = path.join(__dirname, '..')
const VIEW_DIR = path.join(ROOT, 'components', 'documentView')

const strip = (text) => text
  .split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

// ⚠️ **التجريدُ ليس رفاهيّة:** تعليقُ `SupplyDocumentView` **يشرح لماذا لا
// يقرأ `unit_cost`** — فيذكرها بالاسم مرارًا. **وحارسٌ يقرأ التعليقَ يعضّ
// الشاشةَ لأنها وثّقت قرارَها**، ويدفع لحذف الشرح إرضاءً لعدّاد.
function screens() {
  if (!fs.existsSync(VIEW_DIR)) return []
  return fs.readdirSync(VIEW_DIR).filter((f) => f.endsWith('.js') && !f.includes('.test.'))
}

// `unit_cost` بكلّ صوره التي تصل الشاشة: العمودُ نفسُه، والدالّةُ التي تقرأه.
const COST_SHAPES = [
  ['العمود `unit_cost`', /\bunit_cost\b/],
  ['الدالّة `costFrames`', /\bcostFrames\b/],
]

const SOURCE = {
  // لا حركةَ للطلبيّة أصلًا، **فلا `unit_cost` لها** — السعرُ
  // `product_order_lines.entered_unit_price` عبر `orderViewLines`.
  'OrderDocumentView.js': 'entered_unit_price',
  // 🔴 **الاستثناءُ الوحيد، وبسببه:** شاشةُ إدخال الشطب تضرب في ثمن الدفعة
  // المختوم (`writeOffGrid.js:32`)، **فالعرضُ يطابقها.** والشرطُ ١ مستوفًى:
  // `WriteOffProductsScreen.js:276` ترويسةً و`:380` خانة.
  'WriteOffDocumentView.js': 'unit_cost',
  'SupplyDocumentView.js': 'entered_unit_price',
}

describe('🔴 مصدرُ رقمِ المال في شاشات العرض', () => {
  it('⚠️ والمدى مقيسٌ لا مفترَض — المجلّدُ ممشيٌّ وفيه شاشات', () => {
    expect(`المجلّدُ موجود ⟵ ${fs.existsSync(VIEW_DIR)}`).toBe('المجلّدُ موجود ⟵ true')
    expect(screens().length).toBeGreaterThan(0)
  })

  it('🔴 وكلُّ شاشةٍ في المجلّد لها مدخلٌ في الخريطة — والغيابُ يُسقط', () => {
    // **هذا هو ما يجعل القائمةَ اليدويّةَ تفشل مغلقة.** شاشةُ الإرجاعِ حين
    // تُبنى **تُسقط الحزمةَ باسمها** حتى يقرّر إنسانٌ مصدرَها مرّةً واحدة.
    for (const name of screens()) {
      expect(`${name} ⟵ ${SOURCE[name] || 'بلا مدخل'}`)
        .toBe(`${name} ⟵ ${SOURCE[name] || 'entered_unit_price أو unit_cost'}`)
    }
    // وبالاتّجاه الآخر: اسمٌ في الخريطة لملفٍّ محذوف يُقال أيضًا.
    for (const name of Object.keys(SOURCE)) {
      expect(`${name} ⟵ موجود: ${screens().includes(name)}`).toBe(`${name} ⟵ موجود: true`)
    }
  })

  it('🔴 ولا شاشةَ `entered_unit_price` تقرأ `unit_cost` — بالاسم عند السقوط', () => {
    for (const name of screens()) {
      if (SOURCE[name] !== 'entered_unit_price') continue
      const body = strip(fs.readFileSync(path.join(VIEW_DIR, name), 'utf8'))
      for (const [label, shape] of COST_SHAPES) {
        expect(`${name} ⟵ ${label}: ${shape.test(body)}`)
          .toBe(`${name} ⟵ ${label}: false`)
      }
    }
  })

  it('✅ وشاشةُ الشطب تقرؤه فعلًا — وإلّا كان الاستثناءُ اسمًا بلا مقابل', () => {
    // ⚠️ **بلا هذا الشرطِ تمرّ الخريطةُ لو صار المدخلُ خاطئًا بالاتّجاه الآخر:**
    // شاشةٌ مُعلَنٌ أنها تقرأ ثمنَ الدفعة **وقد توقّفت عن قراءته** تعرض شيئًا
    // آخرَ بلا أن يشتكي شيء.
    for (const name of screens()) {
      if (SOURCE[name] !== 'unit_cost') continue
      const body = strip(fs.readFileSync(path.join(VIEW_DIR, name), 'utf8'))
      const found = COST_SHAPES.filter(([, shape]) => shape.test(body)).map(([label]) => label)
      expect(`${name} ⟵ يقرأ ثمنَ الدفعة: ${found.length > 0}`)
        .toBe(`${name} ⟵ يقرأ ثمنَ الدفعة: true`)
    }
  })

  // ══════════════════════════════════════════════════════════════════
  // 🔴 شرطُ المالك ١ — عمودُ المبلغ يبقى **ما دامت شاشةُ الإدخال تعرضه**
  // ══════════════════════════════════════════════════════════════════
  //
  // ⚠️ **وهذا هو الشرطُ الأرجحُ أن ينكسر بصمت:** يُحذف العمودُ من شاشة
  // الإدخال يومًا لسببٍ وجيه، **وتبقى شاشةُ العرض تعرضه** — فتصير «نسخةَ
  // الإدخال» جملةً غيرَ صحيحةٍ ولا شيءَ يشتكي. **فالاقترانُ يُحرَس لا يُوصف.**
  //
  // ⚠️ **وشاشةُ الإدخال تُسمّى بالملفّ الذي ترسمه الصفحةُ فعلًا** — `pages/
  // products/index.js:251` ⟵ `OrderProductsScreen`، لا `ProductOrderScreen`
  // القديمة. **و«المسارُ يردّ 200» لا يقول أيَّ مكوّنٍ رُسم** (`CLAUDE.md:1744`).
  const ENTRY_OF = {
    'OrderDocumentView.js': ['components/OrderProductsScreen.js', /orders\.amountColumn/],
    'WriteOffDocumentView.js': ['components/WriteOffProductsScreen.js', /writeOff\.amountColumn/],
    'SupplyDocumentView.js': ['components/SupplyProductsScreen.js', /orders\.amountColumn/],
  }

  it('🔴 وكلُّ شاشةِ عرضٍ تعرض المبلغ ⟵ شاشةُ إدخالها تعرضه كذلك', () => {
    for (const name of screens()) {
      const pair = ENTRY_OF[name]
      expect(`${name} ⟵ شاشةُ إدخالٍ معلَنة: ${!!pair}`).toBe(`${name} ⟵ شاشةُ إدخالٍ معلَنة: true`)

      const [entry, column] = pair
      const view = strip(fs.readFileSync(path.join(VIEW_DIR, name), 'utf8'))
      const showsAmount = /amountColumn/.test(view)
      if (!showsAmount) continue

      const entryPath = path.join(ROOT, entry)
      expect(`${entry} ⟵ موجود: ${fs.existsSync(entryPath)}`).toBe(`${entry} ⟵ موجود: true`)
      const body = strip(fs.readFileSync(entryPath, 'utf8'))
      expect(`${name} ⟵ ${entry} يعرض المبلغ: ${column.test(body)}`)
        .toBe(`${name} ⟵ ${entry} يعرض المبلغ: true`)
    }
  })

  it('✅ والحارسُ يعضّ — مقيسٌ على نصٍّ لا على شجرة العمل', () => {
    const drifted = `
      const cost = costFrames(line, product)
      const amount = cost === null ? null : roundToPlaces(frames.base * cost.base)
    `
    expect(COST_SHAPES.filter(([, s]) => s.test(drifted)).map(([l]) => l))
      .toEqual(['الدالّة `costFrames`'])

    const column = 'const raw = movement.unit_cost'
    expect(COST_SHAPES.filter(([, s]) => s.test(column)).map(([l]) => l))
      .toEqual(['العمود `unit_cost`'])

    // ولا يعضّ الصيغةَ المطلوبةَ نفسَها — ولا مفتاحَ الترجمة `unitCost`
    // (بحدود الكلمة، فلا يُقرأ `unit_cost` داخل `documents.unitCost`).
    const wanted = `
      const price = numberOrNull(line.entered_unit_price)
      t('products:documents.unitCost', { price })
    `
    expect(COST_SHAPES.filter(([, s]) => s.test(wanted))).toEqual([])
  })
})

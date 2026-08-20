const fs = require('fs')
const path = require('path')

const { OPERATION_LABEL_KEY } = require('./productsOperations')

// 🔴 عنوانُ شريط لوح العرض = عنوانُ شريط شاشة الإنشاء المطابقة.
//
// **قرارُ المالك:** «العنوان = نفس نص شريط شاشة الإدخال المطابقة بالضبط».
//
// ⚠️ **والنصّان يعيشان في مفتاحين مختلفين، وهذا هو الخطر:**
//
// ```
// شريطُ الإنشاء   secondaryItems.<OPERATION_LABEL_KEY[op]>   ⟵ pages/products/index.js:231
// شريطُ العرض     docs.<doc_type>.title                       ⟵ StockDocumentsList
// ```
//
// **فهما اليومَ متطابقان حرفيًّا للثلاثة، ولا شيءَ يُبقيهما كذلك** — تعديلُ
// أحدهما وحدَه **يفصلهما بصمت**، والشاشتان تبدوان سليمتين كلٌّ على حدة.
//
// ⇒ **فالتطابقُ يُحرَس لا يُوصف** — «تمييزٌ كلّفنا جولةً ما بينترك بتعليق».
//
// ══════════════════════════════════════════════════════════════════
// ⚠️ والطلبيّةُ تفترق **بقرار المالك**، فتُعلَن ولا تُبتلع
// ══════════════════════════════════════════════════════════════════
//
// شريطُ شاشة إنشاء الطلبيّة يقول **«الطلبيّات»** — وهو اسمُ القسم لا اسمُ ما
// يُنشأ. **والمالكُ طلب «طلب بضاعة»** لشريط العرض، وهي `docs.order.title`.
//
// ⇒ **فالاستثناءُ واحدٌ، مسمًّى، وبسببه** — **ويفشل مغلقًا:** لو تطابقا يومًا
// سقط هذا الاختبارُ ليقرّر إنسانٌ إن كان الاستثناءُ ما زال مقصودًا.
const ROOT = path.join(__dirname, '..')
const LOCALE = path.join(ROOT, 'public', 'locales', 'ar', 'products.json')

// الأنواعُ التي لها شاشةُ إنشاءٍ مرجعيّةٌ وشاشةُ عرض — **والمصدرُ واحد.**
const PAIRED = ['write_off', 'supply', 'return_to_supplier']

// النوعُ الذي يفترق، وسببُه — **استثناءٌ لا سهو.**
const DELIBERATE = {
  order: 'شريطُ الإنشاء «الطلبيّات» اسمُ قسمٍ لا اسمُ ما يُنشأ — والمالكُ اختار «طلب بضاعة»',
}

describe('🔴 عنوانُ لوح العرض يطابق شريطَ شاشة الإنشاء', () => {
  const dict = JSON.parse(fs.readFileSync(LOCALE, 'utf8'))
  const entryTitle = (docType) => dict.secondaryItems?.[OPERATION_LABEL_KEY[docType]]
  const viewTitle = (docType) => dict.docs?.[docType]?.title

  it('⚠️ والمدى مقيسٌ — لكلّ نوعٍ مفتاحان موجودان فعلًا', () => {
    for (const docType of [...PAIRED, ...Object.keys(DELIBERATE)]) {
      // 🔴 **مفتاحٌ غائبٌ يجعل المقارنةَ `undefined === undefined` فتنجح** —
      // وهو «ما في» و«ما سألت» يتطابقان.
      expect(`${docType} ⟵ عنوانُ العرض نصٌّ: ${typeof viewTitle(docType) === 'string'}`)
        .toBe(`${docType} ⟵ عنوانُ العرض نصٌّ: true`)
    }
    for (const docType of PAIRED) {
      expect(`${docType} ⟵ عنوانُ الإنشاء نصٌّ: ${typeof entryTitle(docType) === 'string'}`)
        .toBe(`${docType} ⟵ عنوانُ الإنشاء نصٌّ: true`)
    }
  })

  it('🔴 والثلاثةُ متطابقةٌ حرفًا بحرف — بالاسم عند السقوط', () => {
    for (const docType of PAIRED) {
      expect(`${docType} ⟵ العرض «${viewTitle(docType)}»`)
        .toBe(`${docType} ⟵ العرض «${entryTitle(docType)}»`)
    }
  })

  it('⚠️ والطلبيّةُ تفترق عمدًا — ولو تطابقت سقط الاختبارُ ليُعاد النظر', () => {
    for (const [docType, why] of Object.entries(DELIBERATE)) {
      // ⚠️ `OPERATION_LABEL_KEY['order']` غيرُ موجود — المفتاحُ هناك `orders`.
      // **وهذا جزءٌ من الافتراق لا خطأٌ فيه**، فيُقرأ صراحةً.
      const entry = dict.secondaryItems?.orders
      expect(`${docType} ⟵ يفترق (${why}): ${viewTitle(docType) !== entry}`)
        .toBe(`${docType} ⟵ يفترق (${why}): true`)
    }
  })

  it('✅ واللوحُ يقرأ `docs.<type>.title` فعلًا — لا نصًّا مكتوبًا بيد', () => {
    const panel = fs.readFileSync(path.join(ROOT, 'components', 'StockDocumentsList.js'), 'utf8')
    expect(panel).toMatch(/products:docs\.\$\{viewed\.doc_type\}\.title/)

    // 🔴 **والشريطُ شكلٌ لا بنية** — بشرط المالك: لا `Dialog` ولا `Portal`.
    expect(panel).toMatch(/RefChromeBar/)
    expect(panel).not.toMatch(/<RefModal/)
    const bar = fs.readFileSync(path.join(ROOT, 'components', 'ref', 'RefChromeBar.js'), 'utf8')
    expect(`RefChromeBar فيه Dialog ⟵ ${/Dialog|Portal/.test(bar.replace(/\/\/.*$/gm, ''))}`)
      .toBe('RefChromeBar فيه Dialog ⟵ false')
  })
})

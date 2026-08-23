/**
 * 🔴 **«القطع ما بتتجزّأ» — قاعدةٌ واحدةٌ لبابين: تنبيهٌ يُرى، ورفضٌ يمنع.**
 *
 * الرفضُ قائمٌ من قبل في `stocktakeLine`، **والتنبيهُ جديدٌ في ورقة العدّ.**
 * ⚠️ **وأخطرُ ما قد يقع بينهما أن يفترقا:** شاشةٌ تسمح بما يرفضه الترحيل هي
 * بالضبط «الرفضُ المتأخّر» الذي وُضع الشرطُ الثالثُ في البوّابة لإنهائه.
 *
 * ⇒ **فالمقيسُ هنا شيئان: أن القاعدة واحدةٌ فعلًا، وأن الورقة ترسمها.**
 */

const fs = require('fs')
const path = require('path')
const { renderToStaticMarkup } = require('react-dom/server')
const React = require('react')

jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key, vars) => (vars ? `${key}${JSON.stringify(vars)}` : key) }),
}))

const ROOT = path.join(__dirname, '..')
const { splitsAPiece, stocktakeLine } = require('./stockDocument')
const StocktakingSheet = require('../components/StocktakingSheet').default

const CARTON = { id: 'p-carton', name: 'كرتونة', base_unit: 'pcs', units_per_package: 15, category_id: 'c1', is_active: true }
const LITRE = { id: 'p-litre', name: 'لتر', base_unit: 'ml', units_per_package: 1000, category_id: 'c1', is_active: true }

describe('① القاعدةُ نفسُها — والحكمُ على القراءة الأساسيّة لا على المكتوب', () => {
  it('🔴 نصفُ عبوةٍ من ١٥ يقسم قطعة، وخُمسُها لا يقسم', () => {
    // ⚠️ **الحالتان معًا، لأن إحداهما وحدَها تُقرأ «كلُّ كسرٍ ممنوع»** — وهو
    // ليس ما تقوله القاعدة: `0.2 × 15 = 3` قطعٌ صحيحةٌ تمامًا.
    expect(`0.5 × 15 = 7.5 ⟵ يقسم: ${splitsAPiece(CARTON, 0.5 * 15)}`)
      .toBe('0.5 × 15 = 7.5 ⟵ يقسم: true')
    expect(`0.2 × 15 = 3 ⟵ يقسم: ${splitsAPiece(CARTON, 0.2 * 15)}`)
      .toBe('0.2 × 15 = 3 ⟵ يقسم: false')
  })

  it('✅ والقاعدةُ على `pcs` وحدَها — والسائلُ يتجزّأ بطبيعته', () => {
    expect(splitsAPiece(LITRE, 7.5)).toBe(false)
    expect(splitsAPiece(null, 7.5)).toBe(false)
    expect(splitsAPiece(CARTON, null)).toBe(false)
    expect(splitsAPiece(CARTON, 'خمسة')).toBe(false)
  })

  // 🔴 **موضعٌ واحدٌ لا أربعة.** كانت مكتوبةً بأعينها في ثلاثة مواضع، **وورقةُ
  // العدّ كانت ستجعلها أربعة** — وهو الشكلُ الذي دفع هذا المشروعُ ثمنَه في
  // `numberOrNull` (البند ب).
  it('🔴 ولا نسخةَ حرّةٌ باقيةٌ في stockDocument.js', () => {
    const src = fs.readFileSync(path.join(ROOT, 'lib/stockDocument.js'), 'utf8')
    const free = (src.match(/base_unit === 'pcs' && \w+ !== Math\.round/g) || []).length
    expect(`نسخٌ حرّة: ${free}`).toBe('نسخٌ حرّة: 0')

    // ⚠️ **التعريفُ يُطرح من العدّ** — `export function splitsAPiece(product, base)`
    // يطابق نفسَ الإبرة، **فعدُّه نداءً يجعل «ثلاثة مواضع» تعني أربعة** وتمرّ
    // الحلقةُ على رقمٍ لا معنى له.
    const uses = (src.match(/(?<!function )splitsAPiece\(product,/g) || []).length
    expect(`مواضعُ تنادي القاعدة: ${uses}`).toBe('مواضعُ تنادي القاعدة: 3')
  })

  // ⚠️ **والسلوكُ الذي يهمّ لم يتغيّر بالتوحيد** — الرفضُ ما زال رفضًا.
  it('✅ والترحيلُ ما زال يرفض ما يقسم قطعة', () => {
    const bad = stocktakeLine({ product: CARTON, countedQuantity: '0.5', enteredUom: 'package' })
    expect(`٠٫٥ عبوة: ${bad.error || 'مقبول'}`).toBe('٠٫٥ عبوة: products:stock.wholePiecesOnly')
    const good = stocktakeLine({ product: CARTON, countedQuantity: '0.2', enteredUom: 'package' })
    expect(`٠٫٢ عبوة: ${good.error || 'مقبول'}`).toBe('٠٫٢ عبوة: مقبول')
  })
})

describe('② والورقةُ ترسم التنبيه — ولا ترفض شيئًا', () => {
  const sheet = (counts) => renderToStaticMarkup(React.createElement(StocktakingSheet, {
    products: [CARTON],
    categories: [{ id: 'c1', name: 'مجلّد', parent_id: null }],
    storageCategories: [{ category_id: 'c1', storage_id: 'st1' }],
    balances: [{ storage_id: 'st1', product_id: 'p-carton', balance_base: 20, avg_cost: 50 }],
    movements: [], documents: [],
    storageId: 'st1', storageName: 'مستودع', salonId: 's1', userId: 'u1',
    loading: false, error: null, onClose: () => {},
    stocktake: { session: { id: 's' }, counts, uoms: { 'p-carton': 'package' }, setCounts: () => {}, setUoms: () => {}, writeCount: () => {}, discard: () => {} },
  }))

  it('🔴 عدٌّ يقسم قطعةً ⟵ التنبيهُ مرسوم', () => {
    const html = sheet({ 'p-carton': '0.5' })
    expect(`التنبيهُ مرسوم: ${html.includes('data-whole-pieces-hint="p-carton"')}`)
      .toBe('التنبيهُ مرسوم: true')
    // والرقمُ الذي يراه القارئُ هو القراءةُ الأساسيّةُ لا ما كتبه.
    expect(`فيه ٧٫٥: ${html.includes('>7.5<')}`).toBe('فيه ٧٫٥: true')
  })

  it('✅ وعدٌّ لا يقسمها ⟵ لا تنبيه — وإلّا صار ضجيجًا دائمًا', () => {
    const html = sheet({ 'p-carton': '0.2' })
    expect(`التنبيهُ مرسوم: ${html.includes('data-whole-pieces-hint')}`)
      .toBe('التنبيهُ مرسوم: false')
  })

  it('✅ وخانةٌ فارغةٌ ⟵ لا تنبيه', () => {
    expect(sheet({}).includes('data-whole-pieces-hint')).toBe(false)
    expect(sheet({ 'p-carton': '' }).includes('data-whole-pieces-hint')).toBe(false)
  })

  // 🔴 **إعلامٌ لا منع** — والفرقُ يُثبَّت لأنه قرارُ المالك، لا تفصيلَ تنفيذ.
  it('🔴 ولا يمنع شيئًا: الخانةُ تبقى قابلةً للكتابة والعدُّ محفوظ', () => {
    const html = sheet({ 'p-carton': '0.5' })
    const cell = html.slice(html.indexOf('data-count-for="p-carton"'))
    const input = cell.slice(0, cell.indexOf('>') + 1)

    // 🔴 **`disabled=""` سمةً، لا `disabled` كلمةً.**
    //
    // ⚠️ **الإبرةُ الأولى كانت `/\bdisabled\b/` فأعطت إيجابيّةً كاذبة:** قائمةُ
    // أصناف Tailwind تحمل `disabled:cursor-not-allowed` و`disabled:opacity-50`،
    // **فالكلمةُ موجودةٌ في كلّ حقلٍ سليم.** وهي بعينها إحدى الثلاث المسجَّلة في
    // `CLAUDE.md` («`disabled:pointer-events-none` بقائمة الأصناف»).
    expect(`الخانةُ معطَّلة: ${/\sdisabled=""/.test(input)}`).toBe('الخانةُ معطَّلة: false')
    expect(`وقيمتُها كما كُتبت: ${input.includes('value="0.5"')}`).toBe('وقيمتُها كما كُتبت: true')
  })
})

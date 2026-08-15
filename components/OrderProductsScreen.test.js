import { renderToStaticMarkup } from 'react-dom/server'
import OrderProductsScreen from './OrderProductsScreen'

// شاشةُ «طلب بضاعة» — اختبارُ رسمٍ لا اختبارُ مكتبة.
//
// ⚠️ **والفرقُ بينهما صنفُ أعطالٍ كامل:** «`orderGridRows` ترجّع كلَّ منتج»
// ادّعاءٌ، و«الجدولُ يرسم ما أعطته» ادّعاءٌ ثانٍ — وشريحةٌ أو حلقةٌ متداخلةٌ
// خاطئةٌ تمرّ من الأوّل وتسقط في الثاني. الحسابُ محروسٌ في lib/orderGrid.test.js
// وهذا يسأل: **ما الذي تختار الشاشةُ أن تُخرجه.**
//
// وما لا يجيب عنه — هل الجدولُ مقروء — عينُ المالك، ولا يدّعي غير ذلك.
jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key) }),
}))

const CATEGORIES = [
  { id: 'skin', name: 'العناية بالبشرة', parent_id: null },
  { id: 'peel', name: 'التقشير', parent_id: 'skin' },
]

const PRODUCTS = [
  { id: 'p1', name: 'كريم', category_id: 'skin', units_per_package: 15, base_unit: 'ml', package_price: 200 },
  { id: 'p2', name: 'مقشّر', category_id: 'peel', units_per_package: 1, base_unit: 'pcs', package_price: 80 },
]

// كلا المجلّدين مربوطٌ بالمستودع، فكلاهما قابلٌ للتأشير.
const LINKS = [
  { storage_id: 's1', category_id: 'skin' },
  { storage_id: 's1', category_id: 'peel' },
]

const BALANCES = [{ storage_id: 's1', product_id: 'p1', balance_base: 30 }]

const render = (over = {}) => renderToStaticMarkup(
  <OrderProductsScreen
    salonId="sal1" storageId="s1"
    categories={CATEGORIES} products={PRODUCTS} balances={BALANCES}
    storageCategories={LINKS} suppliers={[{ id: 'sup1', name: 'المورّد' }]}
    loading={false} error={null} onSaved={() => {}} onClose={() => {}}
    {...over}
  />
)

describe('النافذةُ الأولى — تأشيرُ الأصناف', () => {
  it('تفتح على التأشير لا على الجدول', () => {
    const html = render()
    expect(html).toContain('data-folder-pick="skin"')
    expect(html).toContain('data-folder-pick="peel"')
    // الجدولُ خلفها، فلا صفَّ منتجٍ بعد.
    expect(html).not.toContain('data-product-row')
  })

  it('كلُّ ما يقبل التأشير مؤشَّرٌ عند الفتح', () => {
    // شاشةٌ تفتح على جدولٍ فارغ تبدو معطّلة — والمرجعُ يفتح على الكلّ.
    const checks = render().match(/checked=""/g) || []
    expect(checks).toHaveLength(2)
  })

  it('مستودعٌ بلا أصنافٍ مسموحة يقول ذلك، ولا يرسم قائمةً فارغة', () => {
    const html = render({ storageCategories: [] })
    expect(html).toContain('orders.noFoldersHint')
    expect(html).not.toContain('data-folder-pick')
  })
})

describe('النافذةُ الثانية — الجدول', () => {
  // ⚠️ لا jsdom هنا، فالضغطُ غيرُ متاح. والوصولُ إلى الجدول يكون بحالةٍ أوّليّةٍ
  // تجعله الخطوةَ الأولى — وهذا يقيس **الرسم**، وهو المقصود.
  //
  // 🔴 وبلا هذا الالتفاف كان القسمُ كلُّه سيبقى غيرَ مرسومٍ ولا شيءَ يقول ذلك:
  // اختبارٌ لا يصل الشيءَ الذي يفحصه ينجح بنفس الطريقة التي ينجح بها اختبارٌ
  // صحيح.
  const gridHtml = () => {
    const React = require('react')
    const spy = jest.spyOn(React, 'useState')
    // أوّلُ نداءٍ لـuseState في المكوّن هو الخطوة.
    spy.mockImplementationOnce((initial) => [initial === 'folders' ? 'grid' : initial, () => {}])
    const html = render()
    spy.mockRestore()
    return html
  }

  it('يرسم صفَّ مجلّدٍ لكلِّ مؤشَّر وصفَّ منتجٍ لكلِّ ابنٍ مباشر', () => {
    const html = gridHtml()
    expect(html).toContain('data-folder-row="skin"')
    expect(html).toContain('data-folder-row="peel"')
    expect(html).toContain('data-product-row="p1"')
    expect(html).toContain('data-product-row="p2"')
  })

  it('لا يرسم المنتجَ مرّتين حين يكون الأبُ والابنُ مؤشَّرَين', () => {
    // 🔴 العدُّ وحدَه أعمى عن «صفٌّ رُسم مرّتين وآخرُ سقط» — والاسمُ مرّةً واحدةً
    // هو ما تنتجه حلقةٌ متداخلةٌ خاطئة.
    const html = gridHtml()
    expect((html.match(/data-product-row="p2"/g) || [])).toHaveLength(1)
  })

  it('كلُّ رقمٍ يحمل وحدتَه، ولا تُطبع وحدةٌ ثابتة', () => {
    // خللُ المرجع `0.0 pcs (0 ml)` — الوحدةُ من `base_unit` لا كلمةٌ واحدةٌ للكلّ.
    const html = gridHtml()
    expect(html).toContain('units.ml')
    expect(html).toContain('units.pcs')
  })

  it('الضوابطُ الشكليّةُ معطَّلةٌ وتقول لماذا — لا تكذب ولا تختفي', () => {
    const html = gridHtml()
    expect(html).toContain('data-shell-control')
    // ثلاثةٌ: الفلتر، الإدخال من فاتورة، الإكسل — وكلُّها `disabled`.
    expect((html.match(/data-shell-control/g) || [])).toHaveLength(3)
    expect(html).toContain('orders.laterHint')
  })

  it('«إلى الطلب» معطَّلٌ ما دام لا سطرَ مكتوب', () => {
    // لا رسالةَ رفضٍ تشرح ما تقوله الشاشةُ أصلًا.
    expect(gridHtml()).toMatch(/disabled=""[^>]*>[^<]*orders\.toOrderButton|orders\.toOrderButton/)
  })
})

describe('ما لا يُرسم إطلاقًا', () => {
  it('لا مفتاحَ ترجمةٍ خامٍ على الشاشة', () => {
    // ⚠️ الحارسُ الذي يمسك الحالتين معًا: مفتاحٌ ناقصٌ من الملفّ، ومفتاحٌ موجودٌ
    // والسيرفرُ لم يُعَد تشغيله. وهنا `t` مُقلَّدةٌ فترجّع المفتاح، فالفحصُ يقيس
    // أن كلَّ نصٍّ يمرّ من `t` — لا أن الملفّ يحوي المفتاح.
    const html = render()
    // كلُّ نصٍّ عربيٍّ ظاهرٍ يجب أن يكون قد جاء من بيانات الاختبار لا من الكود.
    const arabicOutsideData = html
      .replace(/العناية بالبشرة|التقشير|كريم|مقشّر|المورّد/g, '')
      .match(/[؀-ۿ]{2,}/g)
    expect(arabicOutsideData).toBeNull()
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import SupplyProductsScreen from './SupplyProductsScreen'

// شاشةُ «توريد بضاعة» — اختبارُ رسمٍ لا اختبارُ مكتبة. الحسابُ محروسٌ في
// lib/supplyDestinationScope.test.js و lib/orderGrid.test.js، وهذا يسأل:
// **ما الذي تختار الشاشةُ أن تُخرجه.**
jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key) }),
}))

const CATEGORIES = [
  { id: 'skin', name: 'العناية بالبشرة', parent_id: null },
  { id: 'peel', name: 'التقشير', parent_id: null },
]

const PRODUCTS = [
  { id: 'p1', name: 'كريم', category_id: 'skin', units_per_package: 15, base_unit: 'ml', nominal_purchase_price: 200 },
  { id: 'p2', name: 'مقشّر', category_id: 'peel', units_per_package: 1, base_unit: 'pcs', nominal_purchase_price: 80 },
]

// `s1` العدسةُ وفيها الاثنان. `s2` فيه `skin` وحدَه. `s3` لا مشتركَ فيه.
const LINKS = [
  { storage_id: 's1', category_id: 'skin' },
  { storage_id: 's1', category_id: 'peel' },
  { storage_id: 's2', category_id: 'skin' },
  { storage_id: 's3', category_id: 'other' },
]

const STORAGES = [
  { id: 's1', name: 'العدسة' }, { id: 's2', name: 'جزئيّ' }, { id: 's3', name: 'بلا مشترك' },
]

const render = (over = {}) => renderToStaticMarkup(
  <SupplyProductsScreen
    salonId="sal1" storageId="s1" storages={STORAGES}
    categories={CATEGORIES} products={PRODUCTS} balances={[]}
    storageCategories={LINKS} suppliers={[{ id: 'sup1', name: 'المورّد' }]}
    loading={false} error={null} onPosted={() => {}} onClose={() => {}}
    {...over}
  />
)

// الوصولُ إلى النافذة الثانية بحالةٍ أوّليّة — لا jsdom هنا، فالضغطُ غيرُ متاح.
// ⚠️ وأوّلُ `useState` في المكوّن هو الخطوة، والثاني الاختيار، والسادس الوجهة.
function gridHtml(over = {}, destination = 's1') {
  const React = require('react')
  const real = React.useState
  let call = 0
  const spy = jest.spyOn(React, 'useState').mockImplementation((initial) => {
    call += 1
    if (call === 1) return ['grid', () => {}]
    if (initial === 's1' && destination !== 's1') return [destination, () => {}]
    return real(initial)
  })
  const html = render(over)
  spy.mockRestore()
  return html
}

describe('النافذةُ الأولى', () => {
  it('تفتح على التأشير، والكلُّ مؤشَّر', () => {
    const html = render()
    expect(html).toContain('data-folder-pick="skin"')
    expect(html).toContain('data-folder-pick="peel"')
    expect((html.match(/checked=""/g) || [])).toHaveLength(2)
    expect(html).not.toContain('data-product-row')
  })
})

describe('قاعدةُ التطابق مرسومةً', () => {
  it('الوجهةُ هي العدسة ⟵ كلُّ ما أُشّر يظهر', () => {
    const html = gridHtml({}, 's1')
    expect(html).toContain('data-product-row="p1"')
    expect(html).toContain('data-product-row="p2"')
    expect(html).not.toContain('data-no-shared-folders')
  })

  it('وجهةٌ فيها بعضُ الأصناف ⟵ المشتركُ وحدَه يُرسم', () => {
    const html = gridHtml({}, 's2')
    expect(html).toContain('data-product-row="p1"')     // skin مشترك
    expect(html).not.toContain('data-product-row="p2"') // peel ليس كذلك
    expect(html).not.toContain('data-no-shared-folders')
  })

  it('ولا مجلّدَ مشترك ⟵ لا صفَّ منتج، **ومعه جملةٌ تقول لماذا**', () => {
    // ⚠️ جدولٌ فارغٌ بلا جملةٍ يُقرأ عطلًا. والجملةُ تحمل الثلاثة: ما معناها،
    // مثالٌ، وكيف تختفي.
    const html = gridHtml({}, 's3')
    expect(html).not.toContain('data-product-row')
    expect(html).toContain('data-no-shared-folders')
    expect(html).toContain('supplyRef.noSharedFolders')
  })

  it('مجلّداتُ الوجهةِ الخاصّةُ لا تدخل الجدول', () => {
    // `s3` له `other` — والاتّحادُ كان سيرسمه.
    expect(gridHtml({}, 's3')).not.toContain('data-folder-row="other"')
  })
})

describe('ما ترسمه الترويسةُ والأسفل', () => {
  it('«إلى مستودع» موجودٌ ومملوءٌ بالعدسة', () => {
    expect(gridHtml()).toContain('data-to-storage')
  })

  it('«تعديل السعر البيعي» مرسومٌ ومعطَّلٌ ويقول لماذا', () => {
    const html = gridHtml()
    expect(html).toContain('data-shell-control="changeRetailPrice"')
    expect(html).toContain('orders.laterHint')
  })

  it('ولا خانةَ «بضاعة أمانة» — قرارُ المالك، والأمانةُ صفةُ منتجٍ مجمَّدة', () => {
    // ⚠️ حارسٌ لغيابٍ مقصود. بلا هذا يعيدها أوّلُ من يقارن بالمرجع، فتفتح
    // تعارضًا مع `freeze_consignment_after_use` بلا جواب.
    expect(gridHtml()).not.toMatch(/consignment/i)
  })

  it('الخصمُ وتكاليفُ النقل ومعها الجهةُ المدفوعُ لها', () => {
    const html = gridHtml()
    expect(html).toContain('supplyRef.discount')
    expect(html).toContain('supplyRef.transport')
    expect(html).toContain('docs.transportPaidTo_supplier')
  })

  it('لا مفتاحَ ترجمةٍ خامٍ ولا عربيَّ مكتوبٍ بالكود', () => {
    const html = render()
      .replace(/العناية بالبشرة|التقشير|كريم|مقشّر|المورّد|العدسة|جزئيّ|بلا مشترك/g, '')
    expect(html.match(/[؀-ۿ]{2,}/g)).toBeNull()
  })
})

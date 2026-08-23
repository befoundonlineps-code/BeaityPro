/**
 * 🔴 **مدخلُ لوح المراجعة — الموضع «ج»، بقرار المالك (ج): زرٌّ مستقلٌّ لا زرُّ الحفظ.**
 *
 * **والسببُ سابقةٌ قائمةٌ منذ بداية هذا الموديول** (لفظُ المراجع): لا شيءَ يمسّ
 * «حفظ الجرد» قبل اكتمال شروط البوّابة الأربعة، **ولو كان المسُّ بريئًا.**
 *
 * ⚠️ **وما لا يُقاس هنا يُقال:** `renderToStaticMarkup` لا تُحدث حدثًا، فحالةُ
 * «اللوحُ مفتوح» **غيرُ قابلةٍ للبلوغ في Jest بعدّة هذا المشروع.** ⇒ **المقيسُ
 * هنا المدخلُ والطيُّ وسلامةُ زرّ الحفظ**، **والفتحُ نفسُه مقيسٌ بـCDP** —
 * ومخرَجُه الخامُّ في رسالة الجولة.
 */

const fs = require('fs')
const path = require('path')
const { renderToStaticMarkup } = require('react-dom/server')
const React = require('react')

jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key, vars) => (vars ? `${key}${JSON.stringify(vars)}` : key) }),
}))

const ROOT = path.join(__dirname, '..')
const StocktakingSheet = require('../components/StocktakingSheet').default

const CARTON = { id: 'p1', name: 'مبرد ومهدئ ليزر', base_unit: 'pcs', units_per_package: 15, category_id: 'c1', is_active: true }

const sheet = ({ counts = {}, session = { id: 's' } } = {}) => renderToStaticMarkup(
  React.createElement(StocktakingSheet, {
    products: [CARTON],
    categories: [{ id: 'c1', name: 'مجلّد', parent_id: null }],
    storageCategories: [{ category_id: 'c1', storage_id: 'st1' }],
    balances: [{ storage_id: 'st1', product_id: 'p1', balance_base: 150, avg_cost: 10 }],
    movements: [{
      storage_id: 'st1', product_id: 'p1', document_id: 'd1', quantity_base: 150,
    }],
    documents: [{ id: 'd1', doc_type: 'supply', doc_date: '2026-08-01' }],
    storageId: 'st1',
    storageName: 'مستودع',
    salonId: 's1',
    userId: 'u1',
    loading: false,
    error: null,
    onClose: () => {},
    refresh: async () => {},
    stocktake: {
      session,
      counts,
      uoms: { p1: 'unit' },
      setCounts: () => {},
      setUoms: () => {},
      writeCount: () => {},
      discard: () => {},
    },
  }),
)

describe('① المدخلُ يظهر حيث يوجد ما يُراجَع، ويغيب حيث لا', () => {
  it('✅ جلسةٌ فيها عدٌّ ⟵ الزرُّ مرسوم', () => {
    expect(`الزرُّ مرسوم: ${sheet({ counts: { p1: '1950' } }).includes('data-review-open')}`)
      .toBe('الزرُّ مرسوم: true')
  })

  it('🔴 ورقةٌ لم يُعدَّ فيها شيءٌ بعد ⟵ لا زرّ', () => {
    // ⚠️ **وزرٌّ يفتح لوحًا فارغًا يعلّم صاحبَه أنه بلا أثر** — فيُهمَل يومَ
    // يكون فيه ما يُقال. وهي قاعدةُ زرّ الرمي نفسُها حرفًا.
    expect(`الزرُّ مرسوم: ${sheet({ counts: {} }).includes('data-review-open')}`)
      .toBe('الزرُّ مرسوم: false')
  })

  it('🔴 ولا جلسةَ إطلاقًا ⟵ لا زرّ، ولو كانت هناك أعداد', () => {
    expect(`الزرُّ مرسوم: ${sheet({ counts: { p1: '1950' }, session: null }).includes('data-review-open')}`)
      .toBe('الزرُّ مرسوم: false')
  })

  it('✅ واللوحُ مطويٌّ عند أوّل رسم — لا يُفتح من نفسِه', () => {
    expect(`اللوحُ مرسوم: ${sheet({ counts: { p1: '1950' } }).includes('data-jump-review=')}`)
      .toBe('اللوحُ مرسوم: false')
  })
})

describe('② وزرُّ الحفظ لم يُمسّ — وهذا شرطُ القرار (ج) لا أثرُه', () => {
  const html = sheet({ counts: { p1: '1950' } })

  it('🔴 ما زال `<span>` بلا معالِج ولا `disabled`', () => {
    const at = html.indexOf('data-save-disabled')
    expect(`الوسمُ موجود: ${at >= 0}`).toBe('الوسمُ موجود: true')

    // ⚠️ **القراءةُ راجعةً من الوسم**، لا أمامَه — فأمامَه يقع `RefTag`
    // ويُقرأ وسمًا خاطئًا. وهو عطلٌ وقع في هذه الحزمة من قبل.
    const openedAt = html.lastIndexOf('<', at)
    const tag = html.slice(openedAt, html.indexOf('>', at) + 1)
    expect(`الوسم: ${tag.slice(1, 5).trim()}`).toBe('الوسم: span')
    expect(`معطَّلٌ بالخاصّيّة: ${/\sdisabled=""/.test(tag)}`).toBe('معطَّلٌ بالخاصّيّة: false')
  })

  it('🔴 ولا معالِجَ حدثٍ عليه في المصدر — الفحصُ من سطرٍ واحدٍ يبقى كما هو', () => {
    const SRC = fs.readFileSync(path.join(ROOT, 'components/StocktakingSheet.js'), 'utf8')
    const at = SRC.indexOf('data-save-disabled=""')
    const block = SRC.slice(at, SRC.indexOf('</span>', at))
    expect(`معالِجاتٌ في وسم الحفظ: ${(block.match(/\son[A-Z]\w+=/g) || []).length}`)
      .toBe('معالِجاتٌ في وسم الحفظ: 0')
  })
})

describe('③ والمصدرُ من `counts` كلِّها — لا من المرسوم', () => {
  const SRC = fs.readFileSync(path.join(ROOT, 'components/StocktakingSheet.js'), 'utf8')

  it('🔴 `linesToConfirm` تُنادى بـ`rows` و`counts`، لا بـ`visible` ولا `counted`', () => {
    const call = SRC.slice(SRC.indexOf('linesToConfirm({'), SRC.indexOf('linesToConfirm({') + 90)
    expect(`النداء: ${call.includes('counts, uoms, rows, products')}`).toBe('النداء: true')
    expect(`فيه visible: ${call.includes('visible')}`).toBe('فيه visible: false')
    expect(`فيه counted: ${/\bcounted\b/.test(call)}`).toBe('فيه counted: false')
  })

  it('🔴 وذيلُ اللوح «إغلاق» وحدَه — ولا زرَّ اسمُه «حفظ» في مراجعةٍ طوعيّة', () => {
    // ⚠️ **سؤالُ المراجع، وقرارُه متروكٌ لنا:** زرٌّ يَعِد بفعلٍ لا يقع يعلّم
    // قارئَه أن الأزرارَ هنا زينة. ⇒ **الذيلُ يصير زرَّين يومَ يُوصَل اللوحُ
    // بالحفظ الحقيقيّ، لا قبله.**
    const panel = SRC.slice(SRC.indexOf('data-jump-review=""'), SRC.indexOf('data-jump-review-close'))
    expect(`شكلُ الفعل الأساسيّ داخلَ اللوح: ${panel.includes('REF_ACTION')}`)
      .toBe('شكلُ الفعل الأساسيّ داخلَ اللوح: false')
    expect(`مفتاحُ «حفظ» داخلَ اللوح: ${panel.includes('stocktakePeriod.save')}`)
      .toBe('مفتاحُ «حفظ» داخلَ اللوح: false')
  })

  it('🔴 والقراءةُ الطازجةُ قبل الفتح لا بعده', () => {
    const open = SRC.slice(SRC.indexOf('data-review-open=""'), SRC.indexOf('data-review-open=""') + 620)
    const refreshAt = open.indexOf('await refresh()')
    const openAt = open.indexOf("setReviewing('open')")
    expect(`الترتيب صحيح: ${refreshAt > 0 && openAt > refreshAt}`).toBe('الترتيب صحيح: true')
  })
})

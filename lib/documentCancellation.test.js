const fs = require('fs')
const path = require('path')
import { cancellationState, visibleDocuments } from './stockDocumentList'

// حرّاسُ «الإلغاء» في قائمة المستندات.
//
// 🔴 **والإلغاءُ هنا هو العكسُ القائم، لا علامةٌ على السطر** — واقتراحُ العلامة
// وحدَها فيه ثغرةٌ قِيست: المستندُ المرحَّلُ حرّك المخزونَ فعلًا، **فوسمُه
// «ملغى» بلا حركةٍ مضادّة يترك الرصيدَ ناقصًا ويجعل الشاشةَ تكذب على السجلّ.**

const ORIGINAL = 'doc-a'
const REVERSAL = 'doc-b'
const LIVE = 'doc-c'

const docs = [
  { id: ORIGINAL, doc_type: 'write_off', reverses_document_id: null },
  { id: REVERSAL, doc_type: 'reversal', reverses_document_id: ORIGINAL },
  { id: LIVE, doc_type: 'supply', reverses_document_id: null },
]

const strip = (text) => text
  .split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')

describe('🔴 الحالةُ مشتقّةٌ بالاتّجاهين', () => {
  it('الأصلُ يُقرأ ملغًى — والرابطُ ليس عليه بل على مَن يشير إليه', () => {
    expect(cancellationState(docs[0], docs)).toEqual({
      cancelled: true, kind: 'original', pairId: REVERSAL,
    })
  })

  it('والعاكسُ يُقرأ نصفًا ثانيًا لا عمليّةً مستقلّة', () => {
    expect(cancellationState(docs[1], docs)).toEqual({
      cancelled: true, kind: 'reversal', pairId: ORIGINAL,
    })
  })

  it('والحيُّ يبقى حيًّا', () => {
    expect(cancellationState(docs[2], docs)).toEqual({
      cancelled: false, kind: 'live', pairId: null,
    })
  })

  it('🔴 **واتّجاهٌ واحدٌ يُخفي نصفَ الزوج** — الأصلُ بلا عاكسِه يُقرأ حيًّا', () => {
    // ⚠️ **البيّنةُ المضادّةُ للاشتقاق نفسِه:** لو قُرئ `reverses_document_id`
    // وحدَه لكان الأصلُ «حيًّا» أبدًا — **وهو أخطرُ الاتّجاهين**، لأنه يُبقي
    // زرَّ الإلغاء مضيئًا على مستندٍ أُلغي.
    expect(cancellationState(docs[0], [docs[0]]).cancelled).toBe(false)
    expect(cancellationState(docs[0], docs).cancelled).toBe(true)
  })

  it('ولا ينهار على مجموعةٍ فارغةٍ أو مستندٍ معدوم', () => {
    expect(cancellationState(null, docs).kind).toBe('missing')
    expect(cancellationState(docs[2], null).cancelled).toBe(false)
  })
})

describe('🔴 الزوجُ يُخفى معًا أو يظهر معًا', () => {
  it('بالإخفاء ⟵ يبقى الحيُّ وحدَه', () => {
    expect(visibleDocuments(docs, docs, true).map((d) => d.id)).toEqual([LIVE])
  })

  it('بلا إخفاءٍ ⟵ الثلاثةُ كلُّها', () => {
    expect(visibleDocuments(docs, docs, false).map((d) => d.id)).toEqual([ORIGINAL, REVERSAL, LIVE])
  })

  it('🔴 **ولا نصفَ حدثٍ في أيّ حال** — الأصلُ والعاكسُ يتلازمان', () => {
    // ⚠️ **الاتّجاهان يكذبان بشكلين:** أصلٌ ظاهرٌ بلا عاكسه يبدو نافذًا،
    // **وعاكسٌ ظاهرٌ بلا أصله يبدو حركةً بلا سبب.**
    for (const hide of [true, false]) {
      const ids = visibleDocuments(docs, docs, hide).map((d) => d.id)
      expect(`hide=${hide} ⟵ ${ids.includes(ORIGINAL) === ids.includes(REVERSAL)}`)
        .toBe(`hide=${hide} ⟵ true`)
    }
  })

  it('⚠️ ويُجاب من المجموعة كلِّها لا من المعروض — عاكسٌ مرشَّحٌ خارجًا لا يُحيي أصلَه', () => {
    // الصفوفُ المعروضةُ فيها الأصلُ وحدَه (رشّح النوعُ العاكسَ خارجًا)،
    // **والمجموعةُ الكاملةُ ما زالت تعرف أنه أُلغي.**
    const shown = [docs[0], docs[2]]
    expect(visibleDocuments(shown, docs, true).map((d) => d.id)).toEqual([LIVE])
  })
})

describe('🔴 الشاشةُ ترسم القرارَ فعلًا — لا المكتبةُ وحدَها', () => {
  const screen = strip(read('components/StockDocumentsList.js'))

  it('تنادي الاشتقاقَ وتمرّر المجموعة الكاملة', () => {
    expect(screen).toMatch(/cancellationState\(doc, documents\)/)
    expect(screen).toMatch(/visibleDocuments\(matched, documents, hideCancelled\)/)
  })

  it('🔴 وزرُّ الإلغاء **يُخفى لا يُعطَّل** — قرارُ المالك', () => {
    // ⚠️ **والفرقُ حقيقيّ:** معطَّلٌ يقول «ممكنٌ لكن ليس الآن» فيُجرَّب مرارًا،
    // **وغائبٌ يقول «ليس من هنا»** — وللأنواع الثلاثة مسارُ تصحيحٍ آخر.
    expect(screen).toMatch(/\{state\.canReverse && \(/)
    // ولا يبقى الشرطُ القديمُ الذي كان يعطّل.
    expect(screen).not.toMatch(/disabled=\{!state\.canReverse/)
  })

  it('🔴 والسببُ إلزاميٌّ ويصل القاعدةَ في `p_note`', () => {
    expect(screen).toMatch(/note: reason\.trim\(\)/)
    // ⚠️ على المقصوص لا الخام — مسافةٌ ليست سببًا.
    expect(screen).toMatch(/disabled=\{busy \|\| reason\.trim\(\) === ''\}/)
  })

  it('⚠️ ويُفرَّغ عند الفتح والإغلاق — سببٌ باقٍ يُرسَل على مستندٍ آخر', () => {
    expect(screen).toMatch(/function openConfirm\([\s\S]{0,120}setReason\(''\)/)
    expect(screen).toMatch(/function closeConfirm\([\s\S]{0,120}setReason\(''\)/)
  })

  it('🔴 والملغى مميَّزٌ بصريًّا ومعلَّمٌ للقراءة الآليّة', () => {
    expect(screen).toMatch(/data-cancelled=\{cancel\.cancelled \? cancel\.kind : undefined\}/)
    expect(screen).toMatch(/line-through/)
  })

  it('⚠️ والمدفوعُ يُفحَص غيابُه قبل `toLocaleString`', () => {
    // نفسُ الصنف المؤجَّل على أربع شاشاتٍ أخرى: Number(null) ⟵ «٠٫٠٠ ₪».
    expect(screen).toMatch(/const paid = numberOrNull\(doc\.paid_amount\)/)
    expect(screen).toMatch(/if \(paid === null\) return null/)
  })

  it('⚠️ والخانةُ ليست مرشِّحًا — فلا يعيدها «امسح المرشِّحات»', () => {
    const filters = strip(read('lib/documentFilters.js'))
    expect(filters).not.toMatch(/hideCancelled/)
    expect(screen).toMatch(/useState\(true\)/)
  })

  it('🔴 وكلُّ مفتاحٍ جديدٍ له جملةٌ عربيّة', () => {
    const ar = JSON.parse(read('public/locales/ar/products.json'))
    for (const key of [
      'cancelledBadge', 'hideCancelled', 'hiddenCancelled',
      'numberLabel', 'paidBadge', 'reasonLabel', 'reasonRequired',
    ]) {
      expect(`documents.${key} = ${typeof ar.documents[key]}`)
        .toBe(`documents.${key} = string`)
    }
  })
})

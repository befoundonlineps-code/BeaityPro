/**
 * 🔴 **حارسُ المصالحة — السطرُ الذي يجمع أعمدتَه يصل إلى ما تحسبه القاعدة.**
 *
 * الشاشةُ المرجعيّة تعرض أربعةَ أعمدةٍ للحركة، و`post_stocktake_session` تحسب
 * النظريَّ من **كلّ** الحركات (`sum(quantity_base)`). ⇒ **فأيُّ نوعٍ بلا عمودٍ
 * يجعل الجدولَ يقول رقمًا وتقول الدالّةُ رقمًا آخر على نفس السطر — بصمت.**
 *
 * ⚠️ **والصمتُ هو العطل لا الفرق:** الموظّفةُ تجمع ما تراه فلا تصل إلى
 * «المتوقَّع»، **فتظنّ أن عدَّها خطأ** وتعيد العدّ.
 *
 * ⇒ **فهذا الملفُّ يفرض شيئين لا واحدًا:**
 *
 * ```
 * ① كلُّ نوعٍ يُرحَّل له مدخلٌ صريحٌ في الخريطة   ⟵ نوعٌ عاشرٌ يُسقط الحزمة
 * ② البداية + مجموعُ الأعمدة === مجموعُ الحركات   ⟵ على بياناتٍ فيها التسعةُ كلُّها
 * ```
 *
 * ⚠️ **والقائمةُ مشتقّةٌ لا مكتوبة** — من `RECEIPT_TYPES` و`ISSUE_TYPES` و
 * `OWN_FUNCTION` في `stockDocument.js`. **وقائمةٌ ثانيةٌ بالأسماء كانت
 * ستتباعد عن الأولى بصمت**، وهو الصنفُ المسجَّلُ بأربع نسخٍ في `CLAUDE.md`.
 */

const { RECEIPT_TYPES, ISSUE_TYPES, OWN_FUNCTION } = require('./stockDocument')
const {
  POSTED_DOC_TYPES, PERIOD_COLUMNS, columnOf, isMapped,
  previousStocktakeAt, periodMovement, planOf,
} = require('./stocktakePeriod')

const STORAGE = 'st-1'
const OTHER_STORAGE = 'st-2'
const PRODUCT = 'p-1'

// ⚠️ **حركةٌ لكلّ نوعٍ من التسعة، وبإشاراتٍ حقيقيّةٍ لا موجبةٍ كلِّها** —
// تجهيزةٌ كلُّ حركاتها موجبةٌ تمرّ على جمعٍ خاطئٍ بالمصادفة.
const SIGNS = {
  supply: +10, opening: +5, transfer: -3,
  write_off: -2, return_to_supplier: -4,
  sale: -1, service_consumption: -6, reversal: +7, stocktake: -8,
}

function fixture({ since } = {}) {
  const documents = []
  const movements = []
  let n = 0
  for (const type of POSTED_DOC_TYPES) {
    n += 1
    const id = `d-${n}`
    documents.push({ id, doc_type: type, storage_id: STORAGE, doc_date: `2026-08-1${n % 10}` })
    movements.push({
      document_id: id, storage_id: STORAGE, product_id: PRODUCT,
      quantity_base: SIGNS[type],
    })
  }
  // ⚠️ **حركتان لا تخصّان السؤال، عمدًا:** واحدةٌ في مستودعٍ آخر، وواحدةٌ
  // لمنتجٍ آخر. **مشيةٌ لا ترشّح تمرّ خضراءَ على تجهيزةٍ بلا دخيل.**
  documents.push({ id: 'd-x', doc_type: 'supply', storage_id: OTHER_STORAGE, doc_date: '2026-08-15' })
  movements.push({ document_id: 'd-x', storage_id: OTHER_STORAGE, product_id: PRODUCT, quantity_base: 999 })
  movements.push({ document_id: 'd-1', storage_id: STORAGE, product_id: 'p-2', quantity_base: 555 })
  return { documents, movements, since }
}

describe('حركةُ الفترة — والسطرُ يُصالِح', () => {
  // ① **القائمةُ مشتقّةٌ من مصادرها، لا مكتوبةٌ هنا.**
  it('🔴 الأنواعُ التسعةُ مشتقّةٌ من stockDocument — ولا order فيها', () => {
    const derived = [...RECEIPT_TYPES, ...ISSUE_TYPES, ...OWN_FUNCTION]
    expect(`العدد: ${POSTED_DOC_TYPES.length}`).toBe(`العدد: ${derived.length}`)
    expect(POSTED_DOC_TYPES.slice().sort()).toEqual(derived.slice().sort())
    expect(`تسعة: ${POSTED_DOC_TYPES.length === 9}`).toBe('تسعة: true')
    // 🔴 **والطلبيّةُ قالبٌ لا حركة** — دخولُها هنا يفتح بابَ عدّها حركة.
    expect(`order داخلها: ${POSTED_DOC_TYPES.includes('order')}`).toBe('order داخلها: false')
  })

  // ② **ولكلٍّ مدخلٌ صريح** — و«أخرى» قرارٌ مكتوبٌ لا سقوطٌ افتراضيّ.
  it('🔴 ولكلّ نوعٍ مدخلٌ صريحٌ في الخريطة — والناقصُ يُسمّى', () => {
    const missing = POSTED_DOC_TYPES.filter((type) => !isMapped(type))
    expect(`بلا مدخلٍ صريح: ${missing.join(' · ') || 'لا شيء'}`)
      .toBe('بلا مدخلٍ صريح: لا شيء')

    const strays = POSTED_DOC_TYPES.filter((type) => !PERIOD_COLUMNS.includes(columnOf(type)))
    expect(`عمودٌ خارج القائمة: ${strays.join(' · ') || 'لا شيء'}`)
      .toBe('عمودٌ خارج القائمة: لا شيء')
  })

  // ③ **والمصالحة** — وهي سببُ وجود الملفّ.
  it('🔴 البداية + مجموعُ الأعمدة === مجموعُ الحركات', () => {
    const { documents, movements } = fixture()
    const { rows, unknownTypes, orphanMovements } = periodMovement({
      movements, documents, storageId: STORAGE, since: '2026-08-14',
    })

    // مجموعٌ مستقلٌّ تمامًا — لا يمرّ بالتصنيف إطلاقًا.
    const independent = movements
      .filter((m) => m.storage_id === STORAGE && m.product_id === PRODUCT)
      .reduce((sum, m) => sum + m.quantity_base, 0)

    const row = rows.get(PRODUCT)
    expect(`النظريّ: ${planOf(row)} · المجموعُ المستقلّ: ${independent}`)
      .toBe(`النظريّ: ${independent} · المجموعُ المستقلّ: ${independent}`)
    expect(`أنواعٌ مجهولة: ${unknownTypes.join(' · ') || 'لا شيء'}`).toBe('أنواعٌ مجهولة: لا شيء')
    expect(`حركاتٌ بلا مستند: ${orphanMovements}`).toBe('حركاتٌ بلا مستند: 0')
  })

  // ⑧ 🔴 **وكمّيّةٌ لا تُقرأ لا تصير صفرًا** — البندُ (أ) في `CLAUDE.md`.
  //
  // ⚠️ **وهذا الفحصُ مكتوبٌ لأن حارسًا قائمًا عضّ هذا الملفَّ قبل دفعه:**
  // `nullableNumberRatchet` رفض `Number(move.quantity_base)`. **والفرقُ ليس
  // تجميليًّا:** `Number(null) === 0` كانت ستقول «حركةٌ بلا أثر» عن حركةٍ لا
  // نعرف مقدارَها، **فيقفل السطرُ حسابيًّا وهو ناقص.**
  it('🔴 وكمّيّةٌ لا تُقرأ تُحصى ولا تُعدّ صفرًا', () => {
    const documents = [{ id: 'a', doc_type: 'supply', storage_id: STORAGE, doc_date: '2026-08-20' }]
    const movements = [
      { document_id: 'a', storage_id: STORAGE, product_id: PRODUCT, quantity_base: 4 },
      { document_id: 'a', storage_id: STORAGE, product_id: PRODUCT, quantity_base: null },
      { document_id: 'a', storage_id: STORAGE, product_id: PRODUCT, quantity_base: '' },
    ]
    const { rows, unreadableQuantities } = periodMovement({
      movements, documents, storageId: STORAGE, since: null,
    })
    expect(`النظريّ: ${planOf(rows.get(PRODUCT))} · غيرُ مقروءة: ${unreadableQuantities}`)
      .toBe('النظريّ: 4 · غيرُ مقروءة: 2')
  })

  // ④ **ومدى المشية مقيسٌ منفصلًا عن حكمها** — ترشيحٌ لا يرشّح يمرّ أخضر.
  it('⚠️ والترشيحُ يبلغ ما يجب ويقف عمّا لا يخصّه', () => {
    const { documents, movements } = fixture()
    const { rows } = periodMovement({ movements, documents, storageId: STORAGE, since: null })

    expect([
      `منتجاتٌ مقروءة: ${rows.size}`,
      `المنتجُ الآخرُ داخل: ${rows.has('p-2')}`,
      `مستودعٌ آخرُ مستبعَد: ${planOf(rows.get(PRODUCT)) !== 999}`,
    ].join(' · ')).toBe([
      'منتجاتٌ مقروءة: 2',
      'المنتجُ الآخرُ داخل: true',
      'مستودعٌ آخرُ مستبعَد: true',
    ].join(' · '))
  })

  // ⑤ **حدُّ الفترة** — وما قبلها بدايةٌ لا عمود.
  it('⚠️ وما قبل بداية الفترة يذهب إلى «البداية» وحدَها', () => {
    const documents = [
      { id: 'a', doc_type: 'supply', storage_id: STORAGE, doc_date: '2026-08-01' },
      { id: 'b', doc_type: 'supply', storage_id: STORAGE, doc_date: '2026-08-20' },
    ]
    const movements = [
      { document_id: 'a', storage_id: STORAGE, product_id: PRODUCT, quantity_base: 100 },
      { document_id: 'b', storage_id: STORAGE, product_id: PRODUCT, quantity_base: 7 },
    ]
    const { rows } = periodMovement({ movements, documents, storageId: STORAGE, since: '2026-08-10' })
    const row = rows.get(PRODUCT)
    expect(`البداية: ${row.begin} · الوارد: ${row.incoming} · النظريّ: ${planOf(row)}`)
      .toBe('البداية: 100 · الوارد: 7 · النظريّ: 107')

    // ⚠️ **ولا جردَ سابقًا ⟵ لا بداية، وكلُّ شيءٍ داخل الفترة.**
    const wide = periodMovement({ movements, documents, storageId: STORAGE, since: null })
    const all = wide.rows.get(PRODUCT)
    expect(`البداية: ${all.begin} · الوارد: ${all.incoming}`).toBe('البداية: 0 · الوارد: 107')
  })

  // ⑥ **وبدايةُ الفترة من آخر جردٍ لهذا المستودع وحدَه.**
  it('⚠️ وآخرُ جردٍ يُقرأ لهذا المستودع لا لغيره', () => {
    const documents = [
      { id: '1', doc_type: 'stocktake', storage_id: STORAGE, doc_date: '2026-08-06' },
      { id: '2', doc_type: 'stocktake', storage_id: STORAGE, doc_date: '2026-08-19' },
      { id: '3', doc_type: 'stocktake', storage_id: OTHER_STORAGE, doc_date: '2026-08-31' },
      { id: '4', doc_type: 'supply', storage_id: STORAGE, doc_date: '2026-08-25' },
    ]
    expect(`الأحدث: ${previousStocktakeAt(documents, STORAGE)}`).toBe('الأحدث: 2026-08-19')
    expect(`بلا جرد: ${previousStocktakeAt([], STORAGE)}`).toBe('بلا جرد: null')
  })

  // ⑦ ✅ **والحارسُ يعضّ — بيّنةٌ مضادّةٌ داخل الملفّ، لا على شجرة العمل.**
  //
  // 🔴 **نوعٌ عاشرٌ مفتعَل:** يذهب إلى «أخرى» **فيبقى الحسابُ صحيحًا على شاشةٍ
  // حيّة**، ويُسجَّل في `unknownTypes` **فيسقط الفحص.** وهذا هو الفرقُ بين
  // «صحيحٌ على الشاشة» و«صاخبٌ في الحزمة».
  it('✅ ونوعٌ لا تعرفه الخريطةُ يُحسب ويُسمّى — لا يُبتلع', () => {
    const documents = [{ id: 'z', doc_type: 'donation', storage_id: STORAGE, doc_date: '2026-08-20' }]
    const movements = [{ document_id: 'z', storage_id: STORAGE, product_id: PRODUCT, quantity_base: -12 }]
    const { rows, unknownTypes } = periodMovement({ movements, documents, storageId: STORAGE, since: null })

    expect(`مدخلٌ صريح: ${isMapped('donation')}`).toBe('مدخلٌ صريح: false')
    expect(`العمود: ${columnOf('donation')}`).toBe('العمود: other')
    expect(`النظريّ: ${planOf(rows.get(PRODUCT))}`).toBe('النظريّ: -12')
    expect(`مسمًّى: ${unknownTypes.join(' · ')}`).toBe('مسمًّى: donation')
  })
})

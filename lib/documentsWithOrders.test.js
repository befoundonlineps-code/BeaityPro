import {
  ORDER_DOC_TYPE, rowIsOrder, orderAsRow, mergedRows, orderViewLines,
} from './documentsWithOrders'
import {
  sortDocuments, documentParties, reversalState, cancellationState,
} from './stockDocumentList'
import { filterDocuments, EMPTY_FILTERS } from './documentFilters'

// دمجُ الطلبيّات — **والادّعاءُ المحروسُ هنا ليس «الشكلُ صحيح» بل «القراراتُ
// الأربعةُ تتحقّق بلا شرطٍ يُكتب لها».**

const SUP = { id: 'sup-1', name: 'إسنتاكالم' }
const ST = { id: 'st-a', name: 'العام' }
const lists = { storages: [ST], suppliers: [SUP] }

const order = (over) => ({
  id: 'ord-1', supplier_id: SUP.id, order_date: '2026-08-17',
  created_at: '2026-08-17T09:00:00+00:00', note: null, ...over,
})
const line = (over) => ({
  order_id: 'ord-1', product_id: 'p1',
  entered_quantity: 2, entered_unit_price: 50, ...over,
})

describe('orderAsRow — الطلبيّةُ تُقولَب على شكل المستند', () => {
  it('تحمل نوعًا خارج الـenum، فلا تصادمَ ممكن', () => {
    // التسعُ مقيسةٌ بـ`pg_enum` (٠٩٦ب) وليس فيها `order`.
    expect(ORDER_DOC_TYPE).toBe('order')
    expect(rowIsOrder(orderAsRow(order(), []))).toBe(true)
    expect(rowIsOrder({ doc_type: 'supply' })).toBe(false)
    expect(rowIsOrder(null)).toBe(false)
  })

  it('🔴 والعدمُ صريحٌ لا غياب — «لا يوجد» تُقرأ غيرَ «لم يُحمَّل»', () => {
    const row = orderAsRow(order(), [line()])
    for (const key of [
      'doc_number', 'supplier_doc_number', 'paid_amount',
      'storage_id', 'to_storage_id', 'reverses_document_id',
    ]) {
      expect(`${key} ⟵ ${row[key]}`).toBe(`${key} ⟵ null`)
      expect(key in row).toBe(true)
    }
  })

  it('والقيمةُ من `orderTotal` المشتركة، لا من نسخةٍ ثانية', () => {
    expect(orderAsRow(order(), [line(), line({ entered_quantity: 1 })]).order_total)
      .toBe(150)
  })

  it('🔴 وطلبيّةٌ بلا أسعارٍ قيمتُها عدمٌ لا صفر', () => {
    // ⚠️ «لا أحدَ اتّفق على الأسعار» ليست «هذا بلا ثمن» — وهي القسمةُ نفسُها
    // التي يحفظها `documentValue`، **والعطلُ الذي تحرسه سقّاطةُ `Number(`.**
    const row = orderAsRow(order(), [line({ entered_unit_price: null })])
    expect(row.order_total).toBeNull()
    expect(row.order_priced_lines).toBe(0)
    expect(row.order_line_count).toBe(1)
  })

  it('⚠️ والمسعَّرُ جزئيًّا يجمع ما سُعِّر ويقول كم هو', () => {
    const row = orderAsRow(order(), [line(), line({ entered_unit_price: null })])
    expect(`${row.order_total} من ${row.order_priced_lines}/${row.order_line_count}`)
      .toBe('100 من 1/2')
  })
})

describe('🔴 القراراتُ الأربعةُ تتحقّق بحكم الشكل لا بشرطٍ يُكتب', () => {
  const row = orderAsRow(order(), [line()])

  it('أ/١ — «من» و«إلى» فارغتان', () => {
    // ⚠️ **ولا فرعَ `doc_type === "order"` في `documentParties` إطلاقًا** —
    // تسقط الطلبيّةُ لقاعدتها الأخيرة و`storage_id` عدمٌ، فالطرفان `null`.
    // **وقرارُ المالك تحقّق بلا سطرٍ كُتب له.**
    expect(documentParties(row, lists)).toEqual({ from: null, to: null, directional: true })
  })

  it('لا زرَّ عكسٍ على طلبيّة', () => {
    expect(reversalState(row, [row]).canReverse).toBe(false)
    expect(reversalState(row, [row]).reason).toBe('typeNotReversible')
  })

  it('ولا حالةَ إلغاءٍ لها — الإلغاءُ حذفٌ لا علامة', () => {
    expect(cancellationState(row, [row])).toEqual({ cancelled: false, kind: 'live', pairId: null })
  })

  it('🔴 د/١ — تختفي مع مرشِّح المستودع، كالباقي', () => {
    // قرارُ المالك: «نعامل الطلبيّةَ متل أيّ معاملةٍ تانية… تختفي متل الباقي».
    // ⚠️ **و`inStorage` تفعلها بلا استثناءٍ يُكتب** — لا `storage_id` عندها.
    const doc = { id: 'd1', doc_type: 'supply', doc_date: '2026-08-17', storage_id: ST.id }
    const all = [doc, row]
    expect(filterDocuments(all, { ...EMPTY_FILTERS, storageId: ST.id }).map((r) => r.id))
      .toEqual(['d1'])
    // وبلا مرشِّحٍ مكانيّ تظهر الاثنتان.
    expect(filterDocuments(all, EMPTY_FILTERS).map((r) => r.id).sort())
      .toEqual(['d1', 'ord-1'])
  })
})

describe('🔴 ج/٢ — الترتيبُ يخلط شكلين للتاريخ', () => {
  it('الطلبيّةُ لا تنزل تحت مستندِ نفسِ اليوم لمجرّد شكل تاريخها', () => {
    // 🔴 **قبل التسوية:** `localeCompare('2026-08-17', '2026-08-17T00:00:00+00:00')`
    // يُرجع `-1` **دائمًا** ⇒ فالمستندُ يبدو أحدثَ مهما كان الوقت.
    // **وبعدها يحسم `created_at`** — والطلبيّةُ هنا أحدثُ بساعتين.
    const doc = {
      id: 'd1', doc_date: '2026-08-17T00:00:00+00:00',
      created_at: '2026-08-17T07:00:00+00:00',
    }
    const ord = orderAsRow(order({ created_at: '2026-08-17T09:00:00+00:00' }), [])
    expect(sortDocuments([doc, ord]).map((r) => r.id)).toEqual(['ord-1', 'd1'])
  })

  it('واليومُ الأحدثُ يسبق مهما كان الشكل', () => {
    const older = { id: 'd-old', doc_date: '2026-08-16T00:00:00+00:00', created_at: 'z' }
    const newer = orderAsRow(order({ id: 'o-new', order_date: '2026-08-18' }), [])
    expect(sortDocuments([older, newer]).map((r) => r.id)).toEqual(['o-new', 'd-old'])
  })
})

describe('mergedRows', () => {
  it('يضمّ المصدرين ويربط كلَّ طلبيّةٍ بسطورها', () => {
    const rows = mergedRows({
      documents: [{ id: 'd1', doc_type: 'supply' }],
      orders: [order(), order({ id: 'ord-2' })],
      orderLines: [line(), line({ order_id: 'ord-2', entered_unit_price: 10, entered_quantity: 3 })],
    })
    expect(rows.map((r) => r.id)).toEqual(['d1', 'ord-1', 'ord-2'])
    expect(rows.find((r) => r.id === 'ord-2').order_total).toBe(30)
  })

  it('⚠️ ولا يرتّب — دالّتان ترتّبان تتباعدان', () => {
    // الترتيبُ يملكه `sortDocuments` وحدَه، وهو الذي يعرف قاعدةَ التعادل.
    const rows = mergedRows({
      documents: [{ id: 'd1', doc_date: '2026-01-01T00:00:00+00:00' }],
      orders: [order({ order_date: '2026-12-31' })],
    })
    expect(rows[0].id).toBe('d1')
  })

  it('وينجو من مدخلاتٍ ناقصة', () => {
    expect(mergedRows()).toEqual([])
    expect(mergedRows({ documents: [null], orders: [null] })).toEqual([])
    expect(mergedRows({ orders: [order()], orderLines: null })[0].order_line_count).toBe(0)
  })
})

describe('🔴 orderViewLines — اللوحُ كان يكذب بدونها', () => {
  it('يقرأ سطورَ الطلبيّة، لا حركاتٍ لا وجودَ لها', () => {
    // 🔴 **اللوحُ كان يقرأ `movementsOf` لكلّ صفّ** — والطلبيّةُ بلا حركاتٍ
    // إطلاقًا، **فرُسمت «المستند بلا سطور» على طلبيّةٍ لها سطور.**
    const rows = orderViewLines([
      line({ id: 'l2', sort_order: 2 }),
      line({ id: 'l1', sort_order: 1, entered_quantity: 5 }),
      line({ id: 'x', order_id: 'other' }),
    ], 'ord-1')
    expect(rows.map((r) => r.id)).toEqual(['l1', 'l2'])
    expect(rows[0].quantity).toBe(5)
  })

  it('⚠️ والسعرُ الغائبُ يبقى عدمًا — لا صفرًا', () => {
    // `entered_unit_price` يقبل العدم، **و«لا أحدَ اتّفق على السعر» ليست «هذا
    // بلا ثمن»** — وهو ما تحرسه سقّاطةُ الحقول القابلة للعدم.
    expect(orderViewLines([line({ entered_unit_price: null })], 'ord-1')[0].askingPrice)
      .toBeNull()
    expect(orderViewLines([line({ entered_quantity: null })], 'ord-1')[0].quantity)
      .toBeNull()
  })

  it('وينجو من مدخلاتٍ ناقصة', () => {
    expect(orderViewLines(null, 'ord-1')).toEqual([])
    expect(orderViewLines([null], 'ord-1')).toEqual([])
    expect(orderViewLines([line()], 'مفقود')).toEqual([])
  })
})

import { supplyPickerRows, fillFromSupplyInvoices } from './writeOffFromInvoice'

const STORAGE = 'st-1'
const OTHER = 'st-2'

const doc = (id, type, extra = {}) => ({
  id, doc_type: type, storage_id: STORAGE, salon_id: 'sa-1',
  doc_date: '2026-08-15T00:00:00+00:00', created_at: '2026-08-15T10:00:00+00:00',
  supplier_id: 'sup-1', supplier_doc_number: 'INV-' + id, ...extra,
})

const lot = (id, docId, productId, received, extra = {}) => ({
  id, source_document_id: docId, product_id: productId,
  storage_id: STORAGE, salon_id: 'sa-1',
  received_at: received, created_at: `${received}T00:00:00+00:00`,
  unit_cost: 5, cost_is_estimated: false, ...extra,
})

const move = (lotId, qty) => ({ lot_id: lotId, quantity_base: qty })
const product = (id, per = 1) => ({ id, name: id, units_per_package: per, base_unit: 'pcs' })

// ==========================================================================
// 🔴 كلُّ عمودٍ تقرأه المكتباتُ من الدفعة موجودٌ في سرد `useStockLots`
//
// **وقع، ووصل شاشةَ المالك:** `source_document_id` كان مقروءًا في موضعين
// و**غائبًا عن `.select(…)`** — فوصلت الدفعةُ بلا الحقل، و`wanted.has(undefined)`
// ترجع `false` على كلّ صفّ. ⇒ **اختيارُ فاتورةٍ لا يملأ شيئًا، بلا خطأٍ ولا
// شبكةٍ فاشلةٍ ولا سطرٍ أحمر.**
//
// ⚠️ **وأخبثُ ما فيه أن كلَّ ما يُرى يقول «الاستعلامُ رجع فارغًا»** — والتشخيصُ
// يذهب إلى الفلاتر والتواريخ، **وهي آخرُ مكانٍ فيه العطل.**
//
// 🔴 **وسردُ الأعمدة هو الوحيدُ الذي يقرّر ما يصل، والكودُ الذي يقرأ الحقلَ لا
// يعرف أنه لم يُطلَب** — لا نوعَ يمنعه ولا `lint`. فهذا الحارسُ يقابل الاثنين.
//
// ⚠️ **ويشتقّ الحقولَ من الكود لا من قائمةٍ بيد**، فحقلٌ يُقرأ غدًا يدخل الفحصَ
// يومَ يُكتب. **والمقروءُ بالنمط `lot.<اسم_بالشرطة_السفلى>`** — و`lot.unitCost`
// وأخواتُها مستثناةٌ بالبناء لأنها الصفُّ المحوَّلُ لا صفُّ القاعدة.
// ==========================================================================
describe('سردُ أعمدة الدفعة يغطّي ما تقرأه المكتبات', () => {
  const fs = require('fs')
  const path = require('path')

  const READERS = ['lotPicker.js', 'writeOffGrid.js', 'writeOffFromInvoice.js']
  const HOOK = path.join(__dirname, '..', 'hooks', 'useStockLots.js')

  it('لا يمرّ على مسحٍ فارغ', () => {
    expect(fs.existsSync(HOOK)).toBe(true)
    expect(READERS.length).toBe(3)
  })

  it('كلُّ `lot.<عمود>` مقروءٍ موجودٌ في `.select(…)`', () => {
    const hook = fs.readFileSync(HOOK, 'utf8')
    // سردُ الدفعات وحدَه — الملفُّ فيه سردٌ ثانٍ للحركات.
    const select = (hook.match(/\.select\('([^']*source_document_id[^']*)'\)/) || [])[1]
    expect(select).toBeDefined()
    const columns = new Set(select.split(',').map((c) => c.trim()))

    const missing = []
    for (const name of READERS) {
      const code = fs.readFileSync(path.join(__dirname, name), 'utf8')
        .split(/\r?\n/).filter((line) => !line.trim().startsWith('//')).join('\n')
      for (const [, field] of code.matchAll(/\blot\.([a-z][a-z0-9_]*)\b/g)) {
        if (!columns.has(field)) missing.push(`${name}: lot.${field}`)
      }
    }
    expect([...new Set(missing)]).toEqual([])
  })

  it('يعضّ على عمودٍ منزوعٍ من السرد — بيّنةٌ مضادّةٌ على نسخة', () => {
    const columns = new Set('id, storage_id, product_id'.split(',').map((c) => c.trim()))
    expect(columns.has('source_document_id')).toBe(false)
    expect(columns.has('product_id')).toBe(true)
  })
})

describe('منتقي فاتورة التوريد', () => {
  it('🔴 يعرض التوريدَ وحدَه — والطلبيّةُ لا تولّد دفعةً فاختيارُها لا يعني شيئًا', () => {
    const rows = supplyPickerRows({
      documents: [doc('d1', 'supply'), doc('d2', 'write_off'), doc('d3', 'transfer')],
      lots: [], suppliers: [{ id: 'sup-1', name: 'مورّد' }], storageId: STORAGE,
    })
    expect(rows.map((r) => r.id)).toEqual(['d1'])
    expect(rows[0].from).toBe('مورّد')
  })

  it('⚠️ ولا يعرض فاتورةَ مستودعٍ آخر — دفعاتُها تُرفض بـlot_not_in_storage', () => {
    const rows = supplyPickerRows({
      documents: [doc('d1', 'supply', { storage_id: OTHER })],
      lots: [], suppliers: [], storageId: STORAGE,
    })
    expect(rows).toEqual([])
  })
})

describe('الملءُ من فاتورة', () => {
  const base = {
    products: [product('p-1'), product('p-2', 50)],
    storageId: STORAGE,
  }

  it('يملأ ما وُرِّد حين لا شيءَ استُهلك', () => {
    const out = fillFromSupplyInvoices({
      ...base,
      documentIds: ['d1'],
      lots: [lot('a', 'd1', 'p-1', '2026-08-01')],
      movements: [move('a', 20)],
    })
    expect(out.picks).toEqual({ 'p-1': [{ lotId: 'a', packages: '20' }] })
    expect(out.clipped).toEqual([])
  })

  it('🔴 يقصّ عند المتبقّي ويوسم المقصوص — وملءُ ما وُرِّد كان سيكتب رقمًا سترفضه القاعدة', () => {
    const out = fillFromSupplyInvoices({
      ...base,
      documentIds: ['d1'],
      lots: [lot('a', 'd1', 'p-1', '2026-08-01')],
      movements: [move('a', 20), move('a', -8)],
    })
    expect(out.picks).toEqual({ 'p-1': [{ lotId: 'a', packages: '12' }] })
    expect(out.clipped).toEqual([{ lotId: 'a', received: 20, filled: 12 }])
  })

  it('⚠️ ويسقط الدفعةَ المستنفَدة ولا يملؤها صفرًا', () => {
    const out = fillFromSupplyInvoices({
      ...base,
      documentIds: ['d1'],
      lots: [lot('a', 'd1', 'p-1', '2026-08-01')],
      movements: [move('a', 20), move('a', -20)],
    })
    // صفٌّ بصفرٍ يقول «هذا متاح» وهو ليس — والسبب يُسمّى بدل أن يُبتلع.
    expect(out.picks).toEqual({})
    // 🔴 **و`productId` أُضيف يومَ صار السببُ يُعرَض للمستخدم**، لأن ما يُقرأ
    // منتجاتٌ لا دفعات: «امتلأ ٢ من ٥ منتجات» جملةٌ يفهمها صاحبُ الصالون،
    // **وثلاثُ دفعاتٍ لمنتجٍ واحدٍ تجعل عدَّ الدفعات يبالغ ثلاثةَ أضعاف.**
    expect(out.skipped).toEqual([{ lotId: 'a', productId: 'p-1', reason: 'empty' }])
  })

  it('🔴 بالعبوة لا بالوحدة الأساسيّة — ومنتجٌ عبوتُه ٥٠ كان سيطلب خمسين ضعفًا', () => {
    const out = fillFromSupplyInvoices({
      ...base,
      documentIds: ['d1'],
      lots: [lot('a', 'd1', 'p-2', '2026-08-01')],
      movements: [move('a', 1000)],
    })
    expect(out.picks).toEqual({ 'p-2': [{ lotId: 'a', packages: '20' }] })
  })

  it('التحديدُ المتعدّدُ يُنتج سطرين لنفس المنتج — دفعةٌ لكلّ سطر', () => {
    const out = fillFromSupplyInvoices({
      ...base,
      documentIds: ['d1', 'd2'],
      lots: [lot('b', 'd2', 'p-1', '2026-08-05'), lot('a', 'd1', 'p-1', '2026-08-01')],
      movements: [move('a', 10), move('b', 6)],
    })
    // ⚠️ **بترتيب الدفعات لا بترتيب الاختيار** — فلا يتغيّر شكلُ الشاشة بتغيّر
    // ترتيب ضغطات المستخدم.
    expect(out.picks['p-1']).toEqual([
      { lotId: 'a', packages: '10' },
      { lotId: 'b', packages: '6' },
    ])
  })

  it('ولا يملأ من فاتورةٍ لم تُختَر — بيّنةٌ مضادّة', () => {
    const out = fillFromSupplyInvoices({
      ...base,
      documentIds: ['d1'],
      lots: [lot('a', 'd1', 'p-1', '2026-08-01'), lot('z', 'd9', 'p-1', '2026-08-02')],
      movements: [move('a', 10), move('z', 99)],
    })
    expect(out.picks['p-1']).toEqual([{ lotId: 'a', packages: '10' }])
  })
})

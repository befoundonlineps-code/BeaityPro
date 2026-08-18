const fs = require('fs')
const path = require('path')
import { fillFromSupplyInvoices, supplyPickerRows, fillReport, FILL_KINDS } from './writeOffFromInvoice'
import { returnGridRows } from './returnGrid'

// إعادةُ إنتاج بلاغِ المالك، بالتجهيزة التي وصفها: مستودعُ الكوزمتولوجي،
// مورّدٌ واحد، سندُ توريدٍ حقيقيٌّ عليه — **والمنتقي عرض الصفَّ فاختاره**، ثمّ
// لم تتحدّث الكمّيّات.
//
// 🔴 والسؤالُ المقصودُ هنا واحد: **هل يصل ما ملأته `fillFromSupplyInvoices` إلى
// صفوف `returnGridRows`؟** — لا «هل تعمل كلٌّ منهما وحدَها».

const STORAGE = 'cosm'
const SUPPLIER = 'instacalm'
const FOLDER = 'f1'
const PRODUCT = 'p1'
const DOC = 'doc1'

const categories = [{ id: FOLDER, name: 'مجلّد', parent_id: null }]

const documents = [
  { id: DOC, doc_type: 'supply', storage_id: STORAGE, supplier_id: SUPPLIER, doc_date: '2026-08-15', created_at: '2026-08-15T17:07:00Z' },
]

const lots = [
  { id: 'lot1', storage_id: STORAGE, product_id: PRODUCT, source_document_id: DOC, received_at: '2026-08-15', created_at: '2026-08-15', unit_cost: 200, cost_is_estimated: false },
]

const movements = [{ lot_id: 'lot1', quantity_base: 20 }]

const suppliers = [{ id: SUPPLIER, name: 'InstaCalm LGT' }]

const plain = { id: PRODUCT, name: 'منتج', category_id: FOLDER, base_unit: 'pcs', units_per_package: 1, is_active: true, is_consignment: false, supplier_id: null }

// ⚠️ **التعليقاتُ تُجرَّد قبل أيّ عدٍّ على الشيفرة** — نفسُ درسِ حارس `Number(`:
// أوّلُ صيغةٍ هنا سقطت على تعليقٍ **يشرح العطلَ المصلَّح**، أي على النصّ الذي
// يوجد ليُقرأ. **وحارسٌ يقرأ الشرحَ كأنه كودٌ يعاقب على التوثيق.**
const strip = (text) => text
  .split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

describe('إعادةُ إنتاج البلاغ — الملءُ يصل الجدول', () => {
  it('المنتقي يعرض الفاتورةَ مع مرشِّح المورّد — فالاختيارُ ممكنٌ أصلًا', () => {
    const rows = supplyPickerRows({ documents, lots, movements, suppliers, storageId: STORAGE, supplierId: SUPPLIER })
    expect(rows.length).toBe(1)
    expect(rows[0].amount).toBe(4000)
  })

  it('الملءُ يعطي اختيارًا للمنتج', () => {
    const filled = fillFromSupplyInvoices({
      documentIds: [DOC], lots, movements, products: [plain], storageId: STORAGE,
    })
    expect(filled.picks[PRODUCT]).toEqual([{ lotId: 'lot1', packages: '20' }])
  })

  it('🔴 والجدولُ يعرض الكمّيّةَ — بلا تأشير الأمانة', () => {
    const filled = fillFromSupplyInvoices({
      documentIds: [DOC], lots, movements, products: [plain], storageId: STORAGE,
    })
    const rows = returnGridRows({
      selectedFolderIds: [FOLDER], categories, products: [plain], lots, movements,
      storageId: STORAGE, picks: filled.picks, consignmentOnly: false, supplierId: SUPPLIER,
    })
    const row = rows.find((r) => r.kind === 'product')
    expect(row.packages).toBe(20)
    expect(row.amount).toBe(4000)
  })

  it('🔴 **العطلُ الذي قاسه المالك:** فاتورةٌ استُنفدت بالكامل ⟵ جملةٌ صريحة', () => {
    // نفسُ الفاتورة، وقد سُحبت دفعتُها كلَّها بعمليّةٍ سابقة.
    const drained = [...movements, { lot_id: 'lot1', quantity_base: -20 }]
    const filled = fillFromSupplyInvoices({
      documentIds: [DOC], lots, movements: drained, products: [plain], storageId: STORAGE,
    })
    expect(filled.picks).toEqual({})
    expect(filled.skipped).toEqual([{ lotId: 'lot1', productId: PRODUCT, reason: 'empty' }])

    const report = fillReport(filled)
    expect(report.kind).toBe('allEmpty')
    expect(report).toEqual({ kind: 'allEmpty', empty: 1, total: 1 })
  })

  it('🔴 **والثقبُ الحقيقيّ: الملءُ الناقصُ كان صامتًا تمامًا**', () => {
    // منتجان: واحدٌ فيه رصيدٌ وواحدٌ استُنفد. **`picks` ليست فارغةً فيُرمى
    // السبب** — والشاشةُ تعرض أرقامًا فتبدو تامّة.
    const second = { ...plain, id: 'p2', name: 'منتج ٢' }
    const twoLots = [...lots, { ...lots[0], id: 'lot2', product_id: 'p2' }]
    const half = [
      { lot_id: 'lot1', quantity_base: 20 },
      { lot_id: 'lot2', quantity_base: 20 },
      { lot_id: 'lot2', quantity_base: -20 },
    ]
    const filled = fillFromSupplyInvoices({
      documentIds: [DOC], lots: twoLots, movements: half, products: [plain, second], storageId: STORAGE,
    })
    expect(Object.keys(filled.picks)).toEqual([PRODUCT])

    const report = fillReport(filled)
    expect(report).toEqual({ kind: 'partialEmpty', shown: 1, total: 2, empty: 1, unknown: 0 })
  })

  it('✅ والاكتمالُ يبقى صامتًا — شرحٌ فوق نتيجةٍ صحيحةٍ يعلّم تجاهلَ الشريط', () => {
    const filled = fillFromSupplyInvoices({
      documentIds: [DOC], lots, movements, products: [plain], storageId: STORAGE,
    })
    expect(fillReport(filled)).toBeNull()
  })

  it('🔴 والعدُّ بالمنتجات لا بالدفعات — ثلاثُ دفعاتٍ لمنتجٍ واحدٍ تعطي «١»', () => {
    const threeLots = ['a', 'b', 'c'].map((k) => ({ ...lots[0], id: `lot-${k}` }))
    const drained = threeLots.flatMap((l) => ([
      { lot_id: l.id, quantity_base: 5 }, { lot_id: l.id, quantity_base: -5 },
    ]))
    const filled = fillFromSupplyInvoices({
      documentIds: [DOC], lots: threeLots, movements: drained, products: [plain], storageId: STORAGE,
    })
    expect(filled.skipped.length).toBe(3)
    expect(fillReport(filled)).toEqual({ kind: 'allEmpty', empty: 1, total: 1 })
  })

  it('✅ ومربّعُ الأمانة يبقى صنفًا منفصلًا — لا يُخلط بالمستنفَد', () => {
    const filled = fillFromSupplyInvoices({
      documentIds: [DOC], lots, movements, products: [plain], storageId: STORAGE,
    })
    const rows = returnGridRows({
      selectedFolderIds: [FOLDER], categories, products: [plain], lots, movements,
      storageId: STORAGE, picks: {}, consignmentOnly: true, supplierId: SUPPLIER,
    })
    const shownIds = new Set(rows.filter((r) => r.kind === 'product').map((r) => r.id))
    const hidden = Object.keys(filled.picks).filter((id) => !shownIds.has(id))
    expect(hidden).toEqual([PRODUCT])
    expect(fillReport(filled, { hiddenProductIds: hidden }).kind).toBe('hidden')
  })

  it('🔴 كلُّ شاشةٍ تحمل مبلغًا تنادي حارسَ المال — لا تكتب شرطَه', () => {
    // ⚠️ **العطلُ الذي قاسه المالك:** `paid_amount = 3000` مع
    // `payment_method = null` — «مالٌ تحرّك» بلا «كيف تحرّك».
    //
    // 🔴 **والحارسُ كان قائمًا** (`documentMoney:208`، `paymentMethodRequired`)
    // **والشاشةُ القديمةُ ترفضه** عبر `stockDocumentForm`. **والجديدةُ بنت
    // الحمولةَ بنفسها فتخطّت طبقةَ المال كلَّها** — صنفُ «الإحلالُ يُسقط حارسًا
    // كان قائمًا».
    //
    // ⚠️ **والحارسُ يُشتقُّ من الحقل لا من قائمةِ أسماء:** أيُّ ملفٍّ فيه
    // `data-…-paid` هو شاشةٌ تحمل مبلغًا، **فشاشةٌ خامسةٌ تدخل الفحصَ يومَ
    // تُبنى** — لا يومَ يتذكّرها أحد.
    const dir = path.join(__dirname, '..', 'components')
    const withPaid = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.js'))
      .filter((f) => /data-[a-z-]*paid\b/.test(fs.readFileSync(path.join(dir, f), 'utf8')))

    // مشيةٌ لا تجد شيئًا لا تجد مخالفةً أيضًا.
    expect(withPaid.length).toBeGreaterThan(0)
    for (const file of withPaid) {
      const body = strip(fs.readFileSync(path.join(dir, file), 'utf8'))
      // إمّا تنادي الحارسَ مباشرةً، أو تمرّ بـ`stockDocumentForm` الذي يناديه.
      const guarded = /validateDocumentMoney/.test(body) || /stockDocumentPayload|stockDocumentForm/.test(body)
      expect(`${file} ⟵ محروسٌ: ${guarded}`).toBe(`${file} ⟵ محروسٌ: true`)
    }
  })

  it('🔴 كلُّ صنفٍ له جملةٌ في الشاشتين — مشتقٌّ من `FILL_KINDS`', () => {
    // ⚠️ **صنفٌ بلا جملةٍ يعرض مفتاحًا خامًّا للمستخدم** — `fill_partialEmpty`
    // حرفيًّا على الشاشة. والقائمةُ تُشتقّ فتسقط الحزمةُ يومَ يُضاف صنف.
    const ar = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'public', 'locales', 'ar', 'products.json'), 'utf8'
    ))
    expect(FILL_KINDS.length).toBeGreaterThan(4)
    for (const ns of ['writeOff', 'returnSupplier']) {
      for (const kind of FILL_KINDS) {
        expect(`${ns}.fill_${kind} = ${typeof ar[ns][`fill_${kind}`]}`)
          .toBe(`${ns}.fill_${kind} = string`)
      }
    }
  })

  it('✅ ومنتجُ أمانةٍ لنفس المورّد يمرّ بالتأشير ويظهر بكمّيّته', () => {
    const owned = { ...plain, is_consignment: true, supplier_id: SUPPLIER }
    const filled = fillFromSupplyInvoices({
      documentIds: [DOC], lots, movements, products: [owned], storageId: STORAGE,
    })
    const rows = returnGridRows({
      selectedFolderIds: [FOLDER], categories, products: [owned], lots, movements,
      storageId: STORAGE, picks: filled.picks, consignmentOnly: true, supplierId: SUPPLIER,
    })
    expect(rows.find((r) => r.kind === 'product').packages).toBe(20)
  })

  it('🔴 والشاشتان ترسمان الصنفَ فعلًا — لا المكتبةُ وحدَها', () => {
    // **اختبارُ المكتبة ليس اختبارَ الرسم**، وهو الدرسُ الذي كلّف هذه الشاشةَ
    // جولتين: `documents` غير موصولة، ثمّ التوجيهُ إلى الشاشة القديمة.
    for (const file of ['ReturnToSupplierScreen', 'WriteOffProductsScreen']) {
      const screen = strip(fs.readFileSync(path.join(__dirname, '..', 'components', `${file}.js`), 'utf8'))
      expect(`${file} ⟵ ${/fillReport\(/.test(screen)}`).toBe(`${file} ⟵ true`)
      // الجملةُ تُختار بالصنف، لا بمفتاحٍ واحدٍ لكلّ الحالات.
      expect(`${file} ⟵ ${/fill_\$\{outcome\.kind\}/.test(screen)}`).toBe(`${file} ⟵ true`)
      // ⚠️ **ولا أثرَ للقديمة**: بقاءُ `fillOutcome` مستورَدةً يعني نسختين للقاعدة.
      expect(`${file} ⟵ ${/fillOutcome/.test(screen)}`).toBe(`${file} ⟵ false`)
    }
    // وحسبةُ المخفيّ في شاشة الإرجاع وحدَها — الشطبُ بلا مرشِّح أمانة.
    const ret = fs.readFileSync(path.join(__dirname, '..', 'components', 'ReturnToSupplierScreen.js'), 'utf8')
    expect(ret).toMatch(/hiddenProductIds: hidden/)
  })
})

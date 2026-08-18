const fs = require('fs')
const path = require('path')
import {
  suggestedUnitPrice, picksFor, consignmentFilter,
  returnGridRows, returnTotal, returnBlocked, returnLinesFromGrid,
} from './returnGrid'
import { PAYMENT_CHOICES, ON_ACCOUNT, paymentChoiceOf, applyPaymentChoice } from './documentMoney'

// تجهيزةٌ واحدةٌ لكلّ الفحوص — مجلّدٌ ومنتجان مختلفا الوحدة، **لأن منتجًا واحدًا
// لا يفرّق بين «للعبوة» و«للوحدة الأساسيّة»** وهو الفرقُ الذي يقرّره هذا الملفّ.
const FOLDER = 'f1'
const P_PCS = 'p-pcs'
const P_ML = 'p-ml'
const STORAGE = 's1'
const SUPPLIER_A = 'sup-a'
const SUPPLIER_B = 'sup-b'

const categories = [{ id: FOLDER, name: 'مجلّد', parent_id: null, salon_id: 'x' }]

const products = [
  { id: P_PCS, name: 'قطعة', category_id: FOLDER, base_unit: 'pcs', units_per_package: 1, is_active: true },
  { id: P_ML, name: 'سائل', category_id: FOLDER, base_unit: 'ml', units_per_package: 50, is_active: true },
]

const lots = [
  { id: 'lot-1', storage_id: STORAGE, product_id: P_PCS, received_at: '2026-01-01', created_at: '2026-01-01', unit_cost: 200, cost_is_estimated: false },
  { id: 'lot-2', storage_id: STORAGE, product_id: P_PCS, received_at: '2026-02-01', created_at: '2026-02-01', unit_cost: 300, cost_is_estimated: false },
  { id: 'lot-3', storage_id: STORAGE, product_id: P_ML, received_at: '2026-01-01', created_at: '2026-01-01', unit_cost: 2, cost_is_estimated: false },
]

const movements = [
  { lot_id: 'lot-1', quantity_base: 10 },
  { lot_id: 'lot-2', quantity_base: 10 },
  { lot_id: 'lot-3', quantity_base: 1000 },
]

const build = (picks, extra = {}) => returnGridRows({
  selectedFolderIds: [FOLDER], categories, products, lots, movements, storageId: STORAGE, picks, ...extra,
})

const productRow = (rows, id) => rows.find((r) => r.kind === 'product' && r.id === id)
const productsById = Object.fromEntries(products.map((p) => [p.id, p]))

describe('الثمنُ المقترَحُ يبدأ من التكلفة الحقيقيّة', () => {
  it('دفعةٌ واحدةٌ ⟵ ثمنُها هو', () => {
    const rows = build({ [P_PCS]: [{ lotId: 'lot-1', packages: '5' }] })
    expect(productRow(rows, P_PCS).picks[0].suggestedPrice).toBe(200)
  })

  it('🔴 عبورُ دفعتين ⟵ **متوسّطٌ مرجَّحٌ لما سيُسحب فعلًا**، لا ثمنُ الأولى', () => {
    // ١٠ من ٢٠٠ + ٥ من ٣٠٠ = ٣٥٠٠ على ١٥ = ٢٣٣٫٣٣ (خانتان، قاعدةُ المال عندنا)
    const rows = build({ [P_PCS]: [{ lotId: null, packages: '15' }] })
    const pick = productRow(rows, P_PCS).picks[0]
    expect(pick.suggestedPrice).toBe(233.33)
  })

  it('⚠️ **وسعرٌ واحدٌ لسطرٍ يعبر دفعتين لا يعيد المجموعَ بالضبط — وهذا مقصود**', () => {
    // ٢٣٣٫٣٣ × ١٥ = ٣٤٩٩٫٩٥ لا ٣٥٠٠. **والفرقُ ليس عطلًا بل طبيعةَ السؤال:**
    // المرجعُ يعرض عمودَ سعرٍ واحدًا للسطر، **وتمثيلُ ثمنَين بثمنٍ واحدٍ يقرّب.**
    //
    // 🔴 **ولا يضيع شيء:** `unit_cost` تختمه القاعدةُ **شريحةً لكلّ دفعة** بثمنها
    // هي، **والتكلفةُ الحقيقيّةُ محفوظةٌ كاملةً بلا تقريب.** المقرَّبُ هو
    // **المطالبةُ** وحدَها — وهي رقمٌ يتفاوض عليه إنسانٌ أصلًا لا حسابُ تكلفة.
    //
    // ⚠️ **ومقيسٌ لا مفترَض، ومحروسٌ هنا كي لا يُقرأ يومًا عطلَ حساب.**
    const rows = build({ [P_PCS]: [{ lotId: null, packages: '15' }] })
    const pick = productRow(rows, P_PCS).picks[0]
    expect(pick.amount).toBe(3499.95)
    expect(Math.abs(pick.amount - 3500)).toBeLessThan(0.5)
  })

  it('⚠️ ثمنٌ مجهولٌ في شريحةٍ **يُبطل المقترَحَ كلَّه** ولا يعطي رقمًا أصغر', () => {
    const blind = [...lots.slice(0, 2).map((l) => ({ ...l })), lots[2]]
    blind[1] = { ...blind[1], unit_cost: null }
    const rows = returnGridRows({
      selectedFolderIds: [FOLDER], categories, products, lots: blind, movements,
      storageId: STORAGE, picks: { [P_PCS]: [{ lotId: null, packages: '15' }] },
    })
    expect(productRow(rows, P_PCS).picks[0].suggestedPrice).toBeNull()
  })

  it('لا كمّيّةَ ⟵ لا مقترَح، ولا يُقسَم على صفر', () => {
    expect(suggestedUnitPrice([{ drawn: 5, unitCost: 10 }], 0)).toBeNull()
    expect(suggestedUnitPrice([], null)).toBeNull()
  })
})

describe('المكتوبُ يغلب المقترَح — و«معدَّل» تعني اختلافًا لا كتابة', () => {
  it('الفراغُ ⟵ المقترَحُ يُستعمل، ولا شارةَ تعديل', () => {
    const rows = build({ [P_PCS]: [{ lotId: 'lot-1', packages: '5', unitPrice: '' }] })
    const pick = productRow(rows, P_PCS).picks[0]
    expect(pick.unitPrice).toBe(200)
    expect(pick.priceEdited).toBe(false)
    expect(pick.amount).toBe(1000)
  })

  it('🔴 المكتوبُ يُستعمل ويغيّر المبلغ — **وهذا الفرقُ الجوهريُّ عن الشطب**', () => {
    const rows = build({ [P_PCS]: [{ lotId: 'lot-1', packages: '5', unitPrice: '150' }] })
    const pick = productRow(rows, P_PCS).picks[0]
    expect(pick.unitPrice).toBe(150)
    expect(pick.priceEdited).toBe(true)
    expect(pick.amount).toBe(750)
  })

  it('⚠️ إعادةُ كتابة نفسِ الرقم **ليست تعديلًا** — ومؤشّرٌ يكذب يُتجاهَل', () => {
    const rows = build({ [P_PCS]: [{ lotId: 'lot-1', packages: '5', unitPrice: '200' }] })
    expect(productRow(rows, P_PCS).picks[0].priceEdited).toBe(false)
  })

  it('🔴 الصفرُ المكتوبُ صفرٌ مقصود، لا «لم يُكتب»', () => {
    const rows = build({ [P_PCS]: [{ lotId: 'lot-1', packages: '5', unitPrice: '0' }] })
    const pick = productRow(rows, P_PCS).picks[0]
    expect(pick.unitPrice).toBe(0)
    expect(pick.amount).toBe(0)
    expect(pick.priceEdited).toBe(true)
  })

  it('الافتراضُ يحمل الحقولَ الثلاثةَ فلا يضيع أحدُها بتغيير الآخر', () => {
    expect(picksFor({}, P_PCS)).toEqual([{ lotId: null, packages: '', unitPrice: '' }])
  })
})

describe('🔴 وحدةُ السعر — العقدُ الذي يكسره معاملُ التعبئة', () => {
  it('المبلغُ = العددُ بالوحدة الأساسيّة × السعر، مقيسًا بمنتجَين مختلفَي الوحدة', () => {
    const rows = build({
      [P_PCS]: [{ lotId: 'lot-1', packages: '5' }],
      [P_ML]: [{ lotId: 'lot-3', packages: '4' }],
    })
    // ٥ عبوات × ١ = ٥ قطع × ٢٠٠
    expect(productRow(rows, P_PCS).amount).toBe(1000)
    // ٤ عبوات × ٥٠ = ٢٠٠ مل × ٢
    expect(productRow(rows, P_ML).amount).toBe(400)
  })

  it('🔴 `entered_unit_price` **للعبوة** بينما المعروضُ للوحدة الأساسيّة', () => {
    const rows = build({ [P_ML]: [{ lotId: 'lot-3', packages: '4', unitPrice: '3' }] })
    const [line] = returnLinesFromGrid(rows, productsById)
    // المعروضُ ٣ للمل، والعبوةُ ٥٠ مل ⟵ ١٥٠ للعبوة
    expect(line.enteredUnitPrice).toBe(150)
    // **والعقدُ الذي يحفظه:** الكمّيّةُ المُدخَلة × ثمنُها = المبلغُ نفسُه
    expect(line.enteredQuantity * line.enteredUnitPrice).toBe(productRow(rows, P_ML).amount)
  })

  it('⚠️ ومعاملُ ١ لا يخفي العطل — المنتجُ الآخرُ يكشفه', () => {
    const rows = build({ [P_PCS]: [{ lotId: 'lot-1', packages: '5', unitPrice: '150' }] })
    const [line] = returnLinesFromGrid(rows, productsById)
    expect(line.enteredUnitPrice).toBe(150)
  })

  it('ثمنٌ مجهولٌ يصل عدمًا لا صفرًا — «لا أعرف» و«مجّانًا» يفترقان', () => {
    const blind = lots.map((l) => (l.id === 'lot-1' ? { ...l, unit_cost: null } : l))
    const rows = returnGridRows({
      selectedFolderIds: [FOLDER], categories, products, lots: blind, movements,
      storageId: STORAGE, picks: { [P_PCS]: [{ lotId: 'lot-1', packages: '5' }] },
    })
    const [line] = returnLinesFromGrid(rows, productsById)
    expect(line.enteredUnitPrice).toBeNull()
  })

  it('الكمّيّةُ سالبةٌ — الإرجاعُ إخراج', () => {
    const rows = build({ [P_PCS]: [{ lotId: 'lot-1', packages: '5' }] })
    expect(returnLinesFromGrid(rows, productsById)[0].quantityBase).toBe(-5)
  })
})

describe('مربّعُ الأمانة يرشّح بالمورّد', () => {
  const mixed = [
    { ...products[0], is_consignment: true, supplier_id: SUPPLIER_A },
    { ...products[1], is_consignment: false, supplier_id: null },
  ]

  it('بلا تأشيرٍ ⟵ الكلُّ يُعرض', () => {
    expect(consignmentFilter(mixed, { consignmentOnly: false }).length).toBe(2)
  })

  it('🔴 بتأشيرٍ ⟵ الأمانةُ **لهذا المورّد وحدَه**', () => {
    const kept = consignmentFilter(mixed, { consignmentOnly: true, supplierId: SUPPLIER_A })
    expect(kept.map((p) => p.id)).toEqual([P_PCS])
  })

  it('⚠️ أمانةُ موردٍ آخرَ تُستبعَد — البضاعةُ ملكُه لا ملكُ هذا', () => {
    expect(consignmentFilter(mixed, { consignmentOnly: true, supplierId: SUPPLIER_B })).toEqual([])
  })

  it('🔴 بلا مورّدٍ مختارٍ ⟵ لا شيء، لا «كلُّ الأمانات»', () => {
    expect(consignmentFilter(mixed, { consignmentOnly: true, supplierId: '' })).toEqual([])
  })

  it('والترشيحُ يصل الجدولَ فعلًا لا المكتبةَ وحدَها', () => {
    const rows = returnGridRows({
      selectedFolderIds: [FOLDER], categories, products: mixed, lots, movements,
      storageId: STORAGE, picks: {}, consignmentOnly: true, supplierId: SUPPLIER_A,
    })
    expect(rows.filter((r) => r.kind === 'product').map((r) => r.id)).toEqual([P_PCS])
  })
})

describe('المجموعُ والمنعُ', () => {
  it('المجموعُ لا يحسب صفَّ المجلّد ولا المنقسمَ مرّتين', () => {
    const rows = build({
      [P_PCS]: [{ lotId: 'lot-1', packages: '5' }],
      [P_ML]: [{ lotId: 'lot-3', packages: '4' }],
    })
    expect(returnTotal(rows)).toBe(1400)
  })

  it('🔴 المنعُ للصريحِ المتجاوزِ وحدَه', () => {
    const rows = build({ [P_PCS]: [{ lotId: 'lot-1', packages: '99' }] })
    expect(returnBlocked(rows)).toBe(true)
  })

  it('🔴 **والتلقائيُّ المتجاوزُ يُمنَع كذلك بعد ١٠١** — عكسُ ما كان يثبّته هذا الفحص', () => {
    // ⚠️ **هذا الفحصُ كان يقول `false`** — أي «الإرجاعُ يقدّر ولا يرفض» —
    // **وكان يثبّت قرارًا اتّخذتُه أنا قبل أن أطرحه على صاحب النظام.**
    // وقرارُه جاء بالعكس: «تُرفض تلقائيًا، بالضبط متل الشطب».
    //
    // 🔴 **وفحصٌ يثبّت سلوكًا أُلغي أسوأُ من غياب فحص:** يقرأ حجّةً لقرارٍ
    // انقلب، **فيدفع مَن يقرؤه إلى إعادة العطل باسم الاتّساق.**
    const rows = build({ [P_PCS]: [{ lotId: null, packages: '999' }] })
    expect(returnBlocked(rows)).toBe(true)
  })

  it('⚠️ والشاشةُ تمنع المعروفَ وحدَه — كمّيّةٌ داخلَ المتاح تمرّ', () => {
    // شاهدُ صدقٍ للمنع أعلاه: منعٌ شاملٌ يقرأ ✓ عليه ويكون الزرُّ ميّتًا دائمًا.
    const rows = build({ [P_PCS]: [{ lotId: null, packages: '15' }] })
    expect(returnBlocked(rows)).toBe(false)
  })

  it('منتجٌ بلا دفعاتٍ مقفولٌ ولا يُرسَل سطرًا', () => {
    const rows = returnGridRows({
      selectedFolderIds: [FOLDER], categories, products, lots: [], movements: [],
      storageId: STORAGE, picks: { [P_PCS]: [{ lotId: null, packages: '5' }] },
    })
    expect(productRow(rows, P_PCS).locked).toBe(true)
    expect(returnLinesFromGrid(rows, productsById)).toEqual([])
  })
})

describe('🔴 الخيارُ الرابعُ حالةٌ لا قيمة', () => {
  it('القائمةُ أربعةٌ والعمودُ ثلاثة', () => {
    expect(PAYMENT_CHOICES).toEqual(['cash', 'cheque', 'bank_transfer', ON_ACCOUNT])
  })

  it('بلا مبلغٍ ⟵ «على الحساب» مختارٌ مشتقًّا', () => {
    expect(paymentChoiceOf({ paidAmount: '', paymentMethod: '' })).toBe(ON_ACCOUNT)
    expect(paymentChoiceOf({ paidAmount: '0', paymentMethod: 'cash' })).toBe(ON_ACCOUNT)
  })

  it('⚠️ مبلغٌ موجبٌ بلا طريقةٍ **ليس «على الحساب»** — حالةٌ ناقصةٌ تُعرض ولا تُبتلع', () => {
    expect(paymentChoiceOf({ paidAmount: '500', paymentMethod: '' })).toBe('')
  })

  it('مبلغٌ وطريقةٌ ⟵ الطريقةُ نفسُها', () => {
    expect(paymentChoiceOf({ paidAmount: '500', paymentMethod: 'cash' })).toBe('cash')
  })

  it('🔴 اختيارُ «على الحساب» يصفّر المبلغَ ويترك الطريقةَ عدمًا', () => {
    expect(applyPaymentChoice(ON_ACCOUNT)).toEqual({ paidAmount: '', paymentMethod: '' })
  })

  it('واختيارُ طريقةٍ لا يمسّ المبلغ', () => {
    expect(applyPaymentChoice('cash')).toEqual({ paymentMethod: 'cash' })
  })
})

// ══════════════════════════════════════════════════════════════════════════
// حرّاسٌ على الشكل — يفشلون مغلقين
// ══════════════════════════════════════════════════════════════════════════

describe('حرّاسُ الشكل', () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')
  const stripComments = (text) => text
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')

  it('🔴 ولا `Number(` عاريةٍ في مكتبة الإرجاع — الغيابُ يُفحص قبلها', () => {
    // نفسُ الحارس الذي أمسك الرابعةَ في `lotPicker`. `Number(null) === 0`.
    const body = stripComments(read('lib/returnGrid.js'))
    expect(body.match(/\bNumber\(/g)).toBeNull()
  })

  it('🔴 الشاشةُ ترسل `entered_unit_price` فعلًا — لا يكفي أن تحسبه', () => {
    // ⚠️ اختبارُ المكتبة ليس اختبارَ الرسم: `returnLinesFromGrid` قد تعطي الحقلَ
    // ولا تضعه الشاشةُ في الحمولة، **وهو بالضبط ما وقع مع `documents`.**
    const screen = read('components/ReturnToSupplierScreen.js')
    expect(screen).toMatch(/entered_unit_price:\s*line\.enteredUnitPrice/)
    expect(screen).toMatch(/docType:\s*'return_to_supplier'/)
    expect(screen).toMatch(/supplierId/)
  })

  it('🔴 و`ON_ACCOUNT` لا يصل القاعدةَ أبدًا — القيدُ يقصر العمودَ على ثلاثة', () => {
    const screen = read('components/ReturnToSupplierScreen.js')
    // الحمولةُ تحمل شرطًا صريحًا يحوّله عدمًا.
    expect(screen).toMatch(/paymentMethod:\s*paymentChoice === ON_ACCOUNT \? null/)
  })

  it('🔴 قائمةُ الدفع مرسومةٌ بلا شرطِ مبلغٍ موجب — وإلّا محا الخيارُ نفسَه', () => {
    // ⚠️ **العطلُ الذي أُصلح:** `{Number(paidAmount) > 0 && (<label…select…` —
    // فاختيارُ «على الحساب» يصفّر المبلغَ فتختفي القائمةُ لحظةَ الاختيار.
    for (const file of ['components/StockDocumentScreen.js', 'components/ReturnToSupplierScreen.js']) {
      const body = stripComments(read(file))
      expect(body).not.toMatch(/Number\(paidAmount\)\s*>\s*0\s*&&\s*\(\s*<label/)
      expect(body).toMatch(/PAYMENT_CHOICES/)
    }
  })

  it('⚠️ ولا نسخةَ ثانيةٍ لقاعدة الخيار الرابع — موضعٌ واحدٌ يُستورَد', () => {
    for (const file of ['components/StockDocumentScreen.js', 'components/ReturnToSupplierScreen.js']) {
      const body = stripComments(read(file))
      // القاعدةُ تُستورَد ولا تُكتب: لا تعريفَ محلّيًّا لأيٍّ من الاثنين.
      expect(body).not.toMatch(/(function|const)\s+paymentChoiceOf/)
      expect(body).not.toMatch(/(function|const)\s+applyPaymentChoice/)
      expect(body).toMatch(/paymentChoiceOf/)
    }
  })

  it('🔴 منتقي الفاتورة مقصورٌ على مورّد الشاشة — لا فواتيرَ مورّدٍ آخر', () => {
    const screen = read('components/ReturnToSupplierScreen.js')
    const at = screen.indexOf('supplyPickerRows(')
    expect(at).toBeGreaterThan(-1)
    expect(screen.slice(at, at + 200)).toMatch(/supplierId/)
    // والمكتبةُ تحترمه فعلًا لا اسمًا.
    const lib = stripComments(read('lib/writeOffFromInvoice.js'))
    expect(lib).toMatch(/!supplierId \|\| doc\.supplier_id === supplierId/)
  })

  it('⚠️ وكلُّ عمودٍ تقرؤه المكتبةُ من الدفعة مطلوبٌ في `useStockLots`', () => {
    // نفسُ حارس `writeOffFromInvoice`، موسَّعًا على الملفّ الجديد.
    const lib = stripComments(read('lib/returnGrid.js'))
    const select = read('hooks/useStockLots.js')
    const columns = new Set(Array.from(lib.matchAll(/\blot\.([a-z_]+)\b/g)).map((m) => m[1]))
    for (const column of columns) expect(select).toMatch(new RegExp(`\\b${column}\\b`))
  })
})

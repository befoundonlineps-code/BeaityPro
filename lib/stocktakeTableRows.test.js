/**
 * صفوفُ جدول الجرد — **والكتالوجُ هو المرجع، لا مستندٌ ماضٍ.**
 *
 * ⚠️ **وأهمُّ ما فيه حالاتُ التكلفة الثلاث:** «تقديريّ» تعني جرى حسابٌ
 * واستُعمل بديل، و«لم يتحرّك قطّ» تعني **لا معلومةَ إطلاقًا** — ووسمٌ واحدٌ
 * عليهما يقول لصاحب المحلّ إن حسابًا جرى حيث لم يجرِ شيء.
 */

const { stocktakeTableRows, costStateOf, COST_STATE } = require('./stocktakeTableRows')

const STORAGE = 's1'
const CATEGORIES = [
  { id: 'c1', name: 'بعد الليزر', parent_id: null, sort_order: 1 },
  { id: 'c2', name: 'الترطيب', parent_id: null, sort_order: 2 },
]
const LINKS = [
  { storage_id: STORAGE, category_id: 'c1' },
  { storage_id: STORAGE, category_id: 'c2' },
]
const PRODUCTS = [
  { id: 'p1', name: 'إنستاكالم بير', category_id: 'c1', units_per_package: 15, package_price: 80 },
  { id: 'p2', name: 'إنستاكالم ترطيب', category_id: 'c2', units_per_package: 1, package_price: 200 },
  { id: 'p3', name: 'منتجٌ لم يتحرّك', category_id: 'c2', units_per_package: 1, package_price: 50 },
]

function build(extra = {}) {
  return stocktakeTableRows({
    categories: CATEGORIES, storageCategories: LINKS, storageId: STORAGE, products: PRODUCTS,
    balances: [
      { storage_id: STORAGE, product_id: 'p1', balance_base: 20, avg_cost: 38, cost_has_estimate: false },
      { storage_id: STORAGE, product_id: 'p2', balance_base: 0, avg_cost: null, cost_has_estimate: false },
    ],
    documents: [{ id: 'd1', doc_type: 'supply', storage_id: STORAGE, doc_date: '2026-08-20' }],
    movements: [{ document_id: 'd1', storage_id: STORAGE, product_id: 'p1', quantity_base: 20 }],
    since: null,
    ...extra,
  })
}

describe('صفوفُ جدول الجرد', () => {
  it('⚠️ مجلّدٌ ثمّ منتجاتُه — والمشيةُ تبلغ المجلّدَين', () => {
    const { rows } = build()
    const folders = rows.filter((r) => r.kind === 'folder').map((r) => r.name)
    const lines = rows.filter((r) => r.kind === 'line').map((r) => r.product.id)
    expect(`مجلّدات: ${folders.join(' · ')}`).toBe('مجلّدات: بعد الليزر · الترطيب')
    expect(`سطور: ${lines.join(' · ')}`).toBe('سطور: p1 · p2 · p3')
  })

  // 🔴 **ثلاثُ حالاتٍ لا اثنتان** — والتمييزُ هو ما يمنع الإيهام.
  it('🔴 وحالاتُ التكلفة ثلاثٌ، ولكلٍّ معناها', () => {
    const { rows } = build()
    const state = (id) => rows.find((r) => r.kind === 'line' && r.product.id === id).costState
    expect([
      `p1 ⟵ ${state('p1')}`,
      `p2 ⟵ ${state('p2')}`,
      `p3 ⟵ ${state('p3')}`,
    ].join(' · ')).toBe([
      `p1 ⟵ ${COST_STATE.KNOWN}`,
      `p2 ⟵ ${COST_STATE.NO_BALANCE_HERE}`,
      `p3 ⟵ ${COST_STATE.NEVER_MOVED}`,
    ].join(' · '))
  })

  it('⚠️ و«تقديريّ» تُقرأ من العمود الحيّ لا تُفترض', () => {
    expect(costStateOf({ balance_base: 20, avg_cost: 38, cost_has_estimate: true }))
      .toBe(COST_STATE.ESTIMATED)
    expect(costStateOf({ balance_base: 20, avg_cost: 38, cost_has_estimate: false }))
      .toBe(COST_STATE.KNOWN)
    // ⚠️ صفٌّ بلا العمود إطلاقًا لا يُخترع له تقدير.
    expect(costStateOf({ balance_base: 20, avg_cost: 38 })).toBe(COST_STATE.KNOWN)
    expect(costStateOf(null)).toBe(COST_STATE.NEVER_MOVED)
  })

  it('🔴 والمؤرشَفُ يُعرض إن كان له رصيدٌ هنا، ويسقط إن لم يكن', () => {
    const archived = [...PRODUCTS, { id: 'p4', name: 'مؤرشَفٌ فارغ', category_id: 'c1', is_active: false }]
    const withStock = [...PRODUCTS, { id: 'p5', name: 'مؤرشَفٌ بمخزون', category_id: 'c1', is_active: false }]

    const gone = stocktakeTableRows({
      categories: CATEGORIES, storageCategories: LINKS, storageId: STORAGE,
      products: archived, balances: [], documents: [], movements: [], since: null,
    })
    expect(`p4 معروض: ${gone.rows.some((r) => r.kind === 'line' && r.product.id === 'p4')}`)
      .toBe('p4 معروض: false')

    const kept = stocktakeTableRows({
      categories: CATEGORIES, storageCategories: LINKS, storageId: STORAGE,
      products: withStock,
      balances: [{ storage_id: STORAGE, product_id: 'p5', balance_base: 3, avg_cost: 9 }],
      documents: [], movements: [], since: null,
    })
    expect(`p5 معروض: ${kept.rows.some((r) => r.kind === 'line' && r.product.id === 'p5')}`)
      .toBe('p5 معروض: true')
  })

  // 🔴 **الخانةُ نصٌّ لا رقم** — وإلّا صارت «لم تُملأ» و«صفرٌ معدود» واحدة.
  it('🔴 وخانةُ الفعليّ نصٌّ، والفراغُ ليس صفرًا', () => {
    const { rows } = build({ counts: { p1: '0', p2: '' } })
    const fact = (id) => rows.find((r) => r.kind === 'line' && r.product.id === id).fact
    expect(`p1: ${JSON.stringify(fact('p1'))} · p2: ${JSON.stringify(fact('p2'))} · p3: ${JSON.stringify(fact('p3'))}`)
      .toBe('p1: "0" · p2: "" · p3: ""')
  })

  it('⚠️ والنظريُّ يصل السطرَ محسوبًا من الحركات', () => {
    const { rows } = build()
    const line = rows.find((r) => r.kind === 'line' && r.product.id === 'p1')
    expect(`النظريّ: ${line.plan} · التكلفة: ${line.cost}`).toBe('النظريّ: 20 · التكلفة: 38')
  })

  it('⚠️ وتقريرُ المكتبة يمرّ كما هو — لا يُبتلع في الرسم', () => {
    const { unknownTypes, unreadableQuantities } = stocktakeTableRows({
      categories: CATEGORIES, storageCategories: LINKS, storageId: STORAGE, products: PRODUCTS,
      balances: [],
      documents: [{ id: 'z', doc_type: 'donation', storage_id: STORAGE, doc_date: '2026-08-20' }],
      movements: [
        { document_id: 'z', storage_id: STORAGE, product_id: 'p1', quantity_base: 5 },
        { document_id: 'z', storage_id: STORAGE, product_id: 'p1', quantity_base: null },
      ],
      since: null,
    })
    expect(`مجهولة: ${unknownTypes.join(' · ')} · غيرُ مقروءة: ${unreadableQuantities}`)
      .toBe('مجهولة: donation · غيرُ مقروءة: 1')
  })
})

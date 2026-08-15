const {
  fillPackagesFromOrder, gridHoldsWork, skippedByReason,
} = require('./supplyFillFromOrder')

const rows = [
  { kind: 'folder', id: 'f1' },
  { kind: 'product', id: 'p1', name: 'كريم' },
  { kind: 'product', id: 'p2', name: 'مقشّر' },
]

const products = [
  { id: 'p1', name: 'كريم' }, { id: 'p2', name: 'مقشّر' }, { id: 'p9', name: 'برّا التأشير' },
]

describe('ما يُملأ', () => {
  it('سطورُ العبوة تصل خانةَ العبوات', () => {
    const answer = fillPackagesFromOrder({
      orderLines: [
        { product_id: 'p1', entered_uom: 'package', entered_quantity: 3 },
        { product_id: 'p2', entered_uom: 'package', entered_quantity: 7 },
      ],
      rows,
    })
    expect(answer.packages).toEqual({ p1: '3', p2: '7' })
    expect(answer.skipped).toEqual([])
  })

  it('المنتجُ المتكرّرُ يُجمع ولا يُستبدَل', () => {
    // ⚠️ سطران لنفس المنتج حالةٌ لا يمنعها شيءٌ في القاعدة، والاستبدالُ يبتلع
    // أحدهما بصمت.
    const answer = fillPackagesFromOrder({
      orderLines: [
        { product_id: 'p1', entered_uom: 'package', entered_quantity: 2 },
        { product_id: 'p1', entered_uom: 'package', entered_quantity: 5 },
      ],
      rows,
    })
    expect(answer.packages).toEqual({ p1: '7' })
  })
})

describe('ما لا يُملأ — ويُقال', () => {
  it('السطرُ بإطارٍ غير العبوة لا يُوضع في خانة العبوات', () => {
    // 🔴 كمّيّتُه صالحةٌ تمامًا **وهي رقمٌ عن شيءٍ آخر** — ووضعُها هنا يضربها
    // في معامل التعبئة مرّةً ثانية.
    const answer = fillPackagesFromOrder({
      orderLines: [{ product_id: 'p1', entered_uom: 'unit', entered_quantity: 30 }],
      rows,
    })
    expect(answer.packages).toEqual({})
    expect(answer.skipped).toEqual([{ productId: 'p1', reason: 'uom' }])
  })

  it('المنتجُ غيرُ المعروضِ في الجدول يُذكر بسببه هو', () => {
    const answer = fillPackagesFromOrder({
      orderLines: [{ product_id: 'p9', entered_uom: 'package', entered_quantity: 4 }],
      rows,
    })
    expect(answer.skipped).toEqual([{ productId: 'p9', reason: 'notShown' }])
  })

  it('🔴 التعبئةُ الجزئيّةُ لا تمرّ صامتة', () => {
    // خمسةٌ تصير اثنين — والحارسُ هو أن الثلاثةَ الباقيةَ مسمّاةٌ بأسبابها.
    const answer = fillPackagesFromOrder({
      orderLines: [
        { product_id: 'p1', entered_uom: 'package', entered_quantity: 1 },
        { product_id: 'p2', entered_uom: 'package', entered_quantity: 2 },
        { product_id: 'p1', entered_uom: 'portion', entered_quantity: 9 },
        { product_id: 'p9', entered_uom: 'package', entered_quantity: 4 },
        { product_id: 'p2', entered_uom: 'package', entered_quantity: 0 },
      ],
      rows,
    })
    expect(answer.packages).toEqual({ p1: '1', p2: '2' })
    expect(answer.skipped).toHaveLength(3)
  })

  it('السببان لا يُجمعان في جملةٍ واحدة', () => {
    // ⚠️ لكلٍّ فعلٌ مختلفٌ يزيله: الإطارُ يحتاج إدخالًا يدويًّا، وغيرُ المعروض
    // يحتاج تأشيرَ مجلّدِه. ورسالةٌ واحدةٌ لهما تشرح الحالةَ الخطأ لأحدهما.
    const groups = skippedByReason(
      [{ productId: 'p1', reason: 'uom' }, { productId: 'p9', reason: 'notShown' }],
      products
    )
    expect(groups).toEqual({ uom: ['كريم'], notShown: ['برّا التأشير'] })
  })

  it('المنتجُ الذي لا يعرفه الكتالوجُ يُذكر بمعرِّفه ولا يُسقَط', () => {
    // إسقاطُه يجعل العدَّ يكذب — نفسُ الفرق بين «صفر» و«شرطة».
    const groups = skippedByReason([{ productId: 'مجهول', reason: 'uom' }], products)
    expect(groups.uom).toEqual(['مجهول'])
  })
})

describe('متى يُسأل عن الاستبدال', () => {
  it('جدولٌ فارغٌ يُملأ بلا سؤال', () => {
    expect(gridHoldsWork({})).toBe(false)
    expect(gridHoldsWork({ p1: '', p2: '   ' })).toBe(false)
  })

  it('وأيُّ رقمٍ مكتوبٍ يجعل السؤالَ واجبًا', () => {
    expect(gridHoldsWork({ p1: '3' })).toBe(true)
  })
})

describe('الحدود', () => {
  it('لا سطورَ ولا صفوفَ ⟵ لا انهيار', () => {
    expect(fillPackagesFromOrder({})).toEqual({ packages: {}, skipped: [] })
    expect(skippedByReason(null, null)).toEqual({})
  })
})

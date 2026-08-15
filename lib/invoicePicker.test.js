const {
  PICKER_PERIODS, periodRange, pickerRows, filterPickerRows, toggleSelection,
} = require('./invoicePicker')
const { weekStartISO } = require('./calendarWeek')

describe('الفترة ⟵ مدًى', () => {
  it('تحمل الفتراتِ السبعَ التي يعرضها المرجع', () => {
    expect(PICKER_PERIODS).toEqual(['all', 'year', 'quarter', 'month', 'week', 'day', 'custom'])
  })

  it('يوم', () => {
    expect(periodRange('day', '2026-08-15')).toEqual({ from: '2026-08-15', to: '2026-08-15' })
  })

  it('أسبوعٌ يبدأ الأحدَ — ومشتقٌّ من calendarWeek لا محسوبٌ هنا', () => {
    // ⚠️ الحارسُ الذي يمنع جوابًا ثانيًا لبداية الأسبوع. `2026-08-15` سبت،
    // فأسبوعُه يبدأ الأحدَ قبله — والقيمةُ تُقارَن بالمصدر لا برقمٍ مكتوب.
    const answer = periodRange('week', '2026-08-15')
    expect(answer.from).toBe(weekStartISO('2026-08-15'))
    expect(answer.to).toBe('2026-08-15')
  })

  it('شهرٌ ينتهي بآخر يومٍ فيه، وشباطُ ليس استثناءً يُكتب بيد', () => {
    expect(periodRange('month', '2026-08-15')).toEqual({ from: '2026-08-01', to: '2026-08-31' })
    // 🔴 الحالةُ التي يخطئ فيها جدولُ أطوالِ الشهور المكتوبُ بيد.
    expect(periodRange('month', '2026-02-10').to).toBe('2026-02-28')
    expect(periodRange('month', '2028-02-10').to).toBe('2028-02-29')   // كبيسة
  })

  it('ربعٌ يبدأ من أوّل شهرٍ في ربعه', () => {
    expect(periodRange('quarter', '2026-08-15')).toEqual({ from: '2026-07-01', to: '2026-09-30' })
    expect(periodRange('quarter', '2026-01-05')).toEqual({ from: '2026-01-01', to: '2026-03-31' })
  })

  it('سنة', () => {
    expect(periodRange('year', '2026-08-15')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('«الكلّ» و«فترةٌ أخرى» بلا مدًى — وهما مختلفان في المعنى لا في النتيجة', () => {
    expect(periodRange('all', '2026-08-15')).toEqual({ from: '', to: '' })
    // «Other period» حدودُها يكتبها إنسان، فلا تُحسب هنا.
    expect(periodRange('custom', '2026-08-15')).toEqual({ from: '', to: '' })
  })

  it('تاريخٌ غيرُ مقروءٍ لا ينهار', () => {
    expect(periodRange('month', 'بلا معنى')).toEqual({ from: '', to: '' })
  })
})

const orders = [
  { id: 'o1', invoice_no: 'INV-77', order_date: '2026-08-15', created_at: '2026-08-15T13:23:00Z', supplier_id: 'sup1' },
  { id: 'o2', invoice_no: null, order_date: '2026-07-02', created_at: '2026-07-02T09:00:00Z', supplier_id: 'sup2' },
]
const orderLines = [
  { order_id: 'o1', product_id: 'p1', entered_quantity: 2, entered_uom: 'package', entered_unit_price: 100 },
  { order_id: 'o1', product_id: 'p2', entered_quantity: 1, entered_uom: 'package', entered_unit_price: 50 },
  { order_id: 'o2', product_id: 'p1', entered_quantity: 5, entered_uom: 'package', entered_unit_price: null },
]
const suppliers = [{ id: 'sup1', name: 'المورّد الأوّل' }, { id: 'sup2', name: 'التاني' }]

describe('صفوفُ الجدول', () => {
  it('تحمل الأعمدةَ التي يعرضها المرجع', () => {
    const rows = pickerRows({ orders, orderLines, suppliers })
    expect(rows[0]).toMatchObject({
      id: 'o1', kind: 'order', invoiceNo: 'INV-77', date: '2026-08-15',
      from: 'المورّد الأوّل', amount: 250, lineCount: 2,
    })
  })

  it('عمودُ «إلى» فارغٌ للطلبيّة — صحيحٌ لا ناقص', () => {
    // `product_orders` بلا عمود مستودعٍ بقرارٍ مقيس، والمرجعُ يتركه فارغًا أيضًا.
    expect(pickerRows({ orders, orderLines, suppliers }).every((r) => r.to === '')).toBe(true)
  })

  it('طلبيّةٌ بلا رقمِ فاتورةٍ تعطي نصًّا فارغًا لا «null»', () => {
    expect(pickerRows({ orders, orderLines, suppliers })[1].invoiceNo).toBe('')
  })

  it('الوقتُ من created_at لا من order_date', () => {
    // ⚠️ الأوّلُ لحظةٌ والثاني يوم — وقراءةُ يومٍ كأنه لحظةٌ تطبع منتصفَ الليل
    // لكلّ صفّ.
    expect(pickerRows({ orders, orderLines, suppliers })[0].createdAt).toBe('2026-08-15T13:23:00Z')
  })
})

describe('الترشيح', () => {
  const rows = pickerRows({ orders, orderLines, suppliers })

  it('بالمدى، ومقارنةً نصّيّةً لا زمنيّة', () => {
    // ⚠️ `new Date(...)` تحوّل اليومَ إلى لحظةٍ محلّيّة، فيقع صفٌّ خارجَ يومِه
    // عند الحدّ. والمقارنةُ على ISO تصحّ حرفًا بحرف.
    expect(filterPickerRows(rows, { from: '2026-08-15', to: '2026-08-15' }).map((r) => r.id)).toEqual(['o1'])
    expect(filterPickerRows(rows, { from: '2026-01-01', to: '2026-12-31' })).toHaveLength(2)
  })

  it('برقم الفاتورة، جزئيًّا لا مطابقةً تامّة', () => {
    // من يتذكّر آخرَ رقمين يبحث بهما — والمطابقةُ التامّةُ تجعل الحقلَ بلا فائدة.
    expect(filterPickerRows(rows, { invoiceNo: '77' }).map((r) => r.id)).toEqual(['o1'])
    expect(filterPickerRows(rows, { invoiceNo: 'inv' }).map((r) => r.id)).toEqual(['o1'])
  })

  it('بالمورّد', () => {
    expect(filterPickerRows(rows, { supplierId: 'sup2', suppliers }).map((r) => r.id)).toEqual(['o2'])
  })

  it('بلا فلاترَ ⟵ الكلّ', () => {
    expect(filterPickerRows(rows, {})).toHaveLength(2)
  })
})

describe('الاختيارُ المتعدّد', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('ضغطةٌ عاديّةٌ تبدأ اختيارًا جديدًا', () => {
    expect(toggleSelection(['a', 'b'], rows, 'd')).toEqual(['d'])
  })

  it('Ctrl يضيف ويشيل مفردًا', () => {
    expect(toggleSelection(['a'], rows, 'c', { ctrl: true })).toEqual(['a', 'c'])
    expect(toggleSelection(['a', 'c'], rows, 'a', { ctrl: true })).toEqual(['c'])
  })

  it('Shift يأخذ المدى، بالاتّجاهين', () => {
    // ⚠️ بلا المدى يصير اختيارُ عشرين فاتورةً عشرين ضغطة.
    expect(toggleSelection(['a'], rows, 'c', { shift: true, anchorId: 'a' })).toEqual(['a', 'b', 'c'])
    expect(toggleSelection(['d'], rows, 'b', { shift: true, anchorId: 'd' })).toEqual(['b', 'c', 'd'])
  })

  it('والنتيجةُ بترتيب الصفوف لا بترتيب الضغط', () => {
    // ترتيبٌ مستقرٌّ يجعل التعبئةَ بعدها قابلةً للتوقّع.
    expect(toggleSelection(['c'], rows, 'a', { ctrl: true })).toEqual(['a', 'c'])
  })

  it('Shift بلا مرساةٍ صالحةٍ يتصرّف كضغطةٍ عاديّة', () => {
    expect(toggleSelection(['a'], rows, 'c', { shift: true, anchorId: null })).toEqual(['c'])
  })
})

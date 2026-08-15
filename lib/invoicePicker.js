import { weekStartISO } from './calendarWeek'
import { orderTotal } from './productOrder'

// نافذةُ «اختيار الفاتورة» — الفلاترُ والصفوف.
//
// الشكلُ من التطبيق المرجعيّ: فترة · نوع · رقمُ فاتورة · مورّد، وجدولٌ أعمدتُه
// النوعُ والرقمُ والتاريخُ والوقتُ ومِن وإلى والمبلغ، **واختيارٌ متعدّدٌ بـShift
// أو Ctrl**.
//
// ⚠️ **ولا تُبنى فلترةٌ ثانيةٌ للمستندات هنا.** `documentFilters.js` يملك ذلك
// السؤال، وهذه النافذةُ تعرض **الطلبيّاتِ وحدَها** بقرار المالك — فالمشتركُ
// بينهما شكلٌ لا منطق، ودمجُهما اليوم يبني تجريدًا فوق حالةٍ واحدة.

// الفتراتُ كما يعرضها المرجع.
//
// ⚠️ `custom` هي «Other period» — تُترك للمدى اليدويّ، ولا تُحسب هنا لأن
// حدودَها يكتبها إنسان.
export const PICKER_PERIODS = ['all', 'year', 'quarter', 'month', 'week', 'day', 'custom']

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 🔴 الفترةُ ⟵ مدًى شاملُ الطرفين.
//
// ⚠️ **والأسبوعُ يبدأ الأحدَ من `calendarWeek.js`، لا من حسابٍ يُكتب هنا.**
// ذلك الملفُّ يقول لماذا: `employee_schedules` تخزّن `day_of_week` بـ0 = الأحد،
// **فأسبوعٌ يبدأ غيرَه يحتاج ترجمةً في كلّ قراءة**. وجوابان لبداية الأسبوع في
// مشروعٍ واحدٍ هما جوابان يتباعدان.
export function periodRange(period, anchorISO) {
  if (period === 'all' || period === 'custom') return { from: '', to: '' }

  const anchor = new Date(`${anchorISO}T00:00:00`)
  if (Number.isNaN(anchor.getTime())) return { from: '', to: '' }

  const y = anchor.getFullYear()
  const m = anchor.getMonth()

  if (period === 'day') return { from: anchorISO, to: anchorISO }

  if (period === 'week') {
    const start = weekStartISO(anchorISO)
    const end = new Date(`${start}T00:00:00`)
    end.setDate(end.getDate() + 6)
    return { from: start, to: toISO(end) }
  }

  if (period === 'month') {
    // ⚠️ اليومُ صفرٌ من الشهر التالي = آخرُ يومٍ في هذا الشهر. تُترك القسمةُ
    // للمنصّة بدل جدولِ أطوالِ شهورٍ يُكتب بيدٍ ويُخطئ في شباط.
    return { from: toISO(new Date(y, m, 1)), to: toISO(new Date(y, m + 1, 0)) }
  }

  if (period === 'quarter') {
    const first = Math.floor(m / 3) * 3
    return { from: toISO(new Date(y, first, 1)), to: toISO(new Date(y, first + 3, 0)) }
  }

  if (period === 'year') {
    return { from: toISO(new Date(y, 0, 1)), to: toISO(new Date(y, 11, 31)) }
  }

  return { from: '', to: '' }
}

// صفوفُ الجدول من الطلبيّات.
//
// ⚠️ **وعمودُ «إلى» يبقى فارغًا للطلبيّة، وهذا صحيحٌ لا ناقص:** الطلبيّةُ لا
// تحمل مستودعًا إطلاقًا — `product_orders` بلا عمودِ مستودعٍ بقرارٍ مقيس.
// **والمرجعُ يتركه فارغًا أيضًا في لقطاته**، فالشكلُ والحقيقةُ يتّفقان هنا.
export function pickerRows({ orders, orderLines, suppliers }) {
  const supplierName = new Map((suppliers || []).map((s) => [s.id, s.name]))
  const linesByOrder = new Map()
  for (const line of orderLines || []) {
    if (!linesByOrder.has(line.order_id)) linesByOrder.set(line.order_id, [])
    linesByOrder.get(line.order_id).push(line)
  }

  return (orders || []).map((order) => {
    const own = linesByOrder.get(order.id) || []
    const totals = orderTotal(own)
    return {
      id: order.id,
      kind: 'order',
      invoiceNo: order.invoice_no || '',
      date: order.order_date || '',
      // ⚠️ الوقتُ من `created_at` لا من `order_date`: الأوّلُ لحظةٌ والثاني يوم.
      // وقراءةُ يومٍ كأنه لحظةٌ تطبع منتصفَ الليل لكلّ صفّ.
      createdAt: order.created_at || '',
      from: supplierName.get(order.supplier_id) || '',
      to: '',
      amount: totals.total,
      lineCount: totals.lineCount,
    }
  })
}

// الترشيحُ بالفلاتر الأربعة.
//
// ⚠️ **والمقارنةُ نصّيّةٌ على تواريخِ ISO عمدًا.** `'2026-08-15' >= '2026-08-01'`
// صحيحةٌ حرفًا بحرف، **ولا تمرّ بمنطقةٍ زمنيّة** — بينما `new Date(...)` تحوّل
// اليومَ إلى لحظةٍ محلّيّة، فيقع صفٌّ خارجَ يومِه عند الحدّ.
export function filterPickerRows(rows, { from, to, invoiceNo, supplierId, suppliers } = {}) {
  const needle = String(invoiceNo ?? '').trim().toLowerCase()
  const wantedSupplier = String(supplierId ?? '').trim()
  const supplierName = new Map((suppliers || []).map((s) => [s.id, s.name]))
  const wantedName = wantedSupplier ? supplierName.get(wantedSupplier) : ''

  return (rows || []).filter((row) => {
    if (from && row.date < from) return false
    if (to && row.date > to) return false
    // ⚠️ `includes` لا `===`: المرجعُ يكتب جزءًا من الرقم ويبحث به، ومطابقةٌ
    // تامّةٌ تجعل الحقلَ عديمَ الفائدة لمن يتذكّر آخرَ ثلاثة أرقام.
    if (needle && !String(row.invoiceNo).toLowerCase().includes(needle)) return false
    if (wantedSupplier && row.from !== wantedName) return false
    return true
  })
}

// 🔴 الاختيارُ المتعدّد — «Use Shift or Ctrl to select multiple invoices».
//
// ⚠️ **وSHIFT مدًى وCTRL إضافةٌ مفردة، والفرقُ ليس تفصيلًا:** بلا المدى يصير
// اختيارُ عشرين فاتورةً عشرين ضغطةً، وبلا المفردة لا يمكن تخطّي واحدة.
export function toggleSelection(selected, rows, id, { shift = false, ctrl = false, anchorId = null } = {}) {
  const ids = (rows || []).map((r) => r.id)
  const current = new Set(selected || [])

  if (shift && anchorId && ids.includes(anchorId)) {
    const a = ids.indexOf(anchorId)
    const b = ids.indexOf(id)
    if (b === -1) return [...current]
    const [lo, hi] = a <= b ? [a, b] : [b, a]
    for (let i = lo; i <= hi; i += 1) current.add(ids[i])
    return ids.filter((x) => current.has(x))
  }

  if (ctrl) {
    if (current.has(id)) current.delete(id)
    else current.add(id)
    return ids.filter((x) => current.has(x))
  }

  // ضغطةٌ عاديّةٌ تبدأ اختيارًا جديدًا — وهي الحالةُ الشائعة.
  return [id]
}

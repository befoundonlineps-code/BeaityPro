import { useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import {
  PICKER_PERIODS, periodRange, pickerRows, filterPickerRows, toggleSelection,
} from '../lib/invoicePicker'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefFillerRow } from './ref/RefGrid'
import { RefActionButton, RefCancelButton } from './ref/RefModal'
import { Input } from '@/components/ui/input'
import { today } from '../lib/documentDate'

// نافذةُ «اختيار الفاتورة» — تُفتح فوق شاشة التوريد، كما في المرجع.
//
// ⚠️ **وهي لوحٌ مطلقُ الموضع لا `Dialog` ثانية.** نافذةُ العمليّة نفسُها
// `RefModal`، وتعشيشُ حوارٍ داخل حوارٍ يتنازع على بؤرة اللوحة — **وهذا مقيسٌ
// في هذا المشروع**: تركيزُ النافذة على اللوح لا على زرّ الإغلاق كلّف جولةً
// كاملةً مرّةً، وتعليقٌ ادّعى إصلاحًا لم يقع.
//
// 🔴 **والنوعُ الثاني معطَّلٌ لا محذوف.** المرجعُ يعرض «Order products» و
// «Products supply»، والتعبئةُ من توريدٍ سابقٍ مؤجَّلةٌ بقرار المالك — **فيُرسم
// ويقول لماذا**، لأن قائمةً تكشف بندًا واحدًا هي قائمةٌ تكذب بشأن وجود خيار،
// وحذفَه يجعل النافذةَ تبدو ناقصةً بلا سبب.

const FIELD = 'h-7 rounded-none border border-[var(--rule)] bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring'

// الوقتُ من الطابع الزمنيّ، بلا تاريخ.
//
// ⚠️ **ولا يُبنى مدًى بشرطةٍ مكتوبةٍ بالإيد في أيِّ خليّة.** التاريخُ والوقتُ
// عمودان منفصلان في المرجع، وهذا يوافق قاعدةَ الاتّجاه عندنا بدل أن يصادمها.
function timeOf(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function InvoicePickerDialog({
  orders, orderLines, suppliers, onCancel, onSelect,
}) {
  const { t } = useTranslation(['products', 'common'])

  const [period, setPeriod] = useState('day')
  const [anchorDate, setAnchorDate] = useState(today())
  const [invoiceNo, setInvoiceNo] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [selected, setSelected] = useState([])
  const [anchorId, setAnchorId] = useState(null)

  const all = useMemo(
    () => pickerRows({ orders, orderLines, suppliers }),
    [orders, orderLines, suppliers]
  )

  const rows = useMemo(() => {
    const { from, to } = periodRange(period, anchorDate)
    return filterPickerRows(all, { from, to, invoiceNo, supplierId, suppliers })
  }, [all, period, anchorDate, invoiceNo, supplierId, suppliers])

  const COLUMNS = 7

  return (
    <div
      data-invoice-picker
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 p-4"
    >
      <div className="flex max-h-full w-full max-w-[900px] flex-col gap-2 border border-[var(--rule)] bg-background p-3 shadow-lg">
        <p className="text-sm font-semibold">{t('products:invoicePicker.title')}</p>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            {t('products:invoicePicker.period')}
            <select className={FIELD} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PICKER_PERIODS.map((p) => (
                <option key={p} value={p}>{t(`products:invoicePicker.period_${p}`)}</option>
              ))}
            </select>
            {/* ⚠️ يُخفى عند «الكلّ» لأنه لا يعني شيئًا هناك — حقلٌ ظاهرٌ لا أثرَ
                له يعلّم صاحبَه أن الشاشةَ لا تستجيب. */}
            {period !== 'all' && period !== 'custom' && (
              <Input type="date" className={FIELD} value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)} />
            )}
          </label>

          <label className="flex items-center gap-1.5">
            {t('products:invoicePicker.type')}
            <select className={FIELD} defaultValue="order">
              <option value="all">{t('products:invoicePicker.type_all')}</option>
              <option value="order">{t('products:invoicePicker.type_order')}</option>
              {/* 🔴 مرسومٌ ومعطَّلٌ ويقول لماذا — مؤجَّلٌ بقرار المالك لأنه ينسخ
                  أسعارًا دُفعت فعلًا. */}
              <option value="supply" disabled>{t('products:invoicePicker.type_supply')}</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5">
            {t('products:invoicePicker.invoiceNo')}
            <Input className={`${FIELD} w-28`} value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)} />
          </label>

          <label className="flex items-center gap-1.5">
            {t('products:invoicePicker.supplier')}
            <select className={FIELD} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">{t('products:invoicePicker.supplier_all')}</option>
              {(suppliers || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="min-h-[220px] flex-1 overflow-auto border border-[var(--rule)]">
          <RefTable>
            <RefHead>
              <tr>
                <RefTh>{t('products:invoicePicker.colType')}</RefTh>
                <RefTh>{t('products:invoicePicker.colInvoiceNo')}</RefTh>
                <RefTh>{t('products:invoicePicker.colDate')}</RefTh>
                <RefTh>{t('products:invoicePicker.colTime')}</RefTh>
                <RefTh>{t('products:invoicePicker.colFrom')}</RefTh>
                <RefTh>{t('products:invoicePicker.colTo')}</RefTh>
                <RefTh>{t('products:invoicePicker.colAmount')}</RefTh>
              </tr>
            </RefHead>
            <tbody>
              {rows.map((row) => (
                <RefRow
                  key={row.id}
                  data-invoice-row={row.id}
                  selected={selected.includes(row.id)}
                  onClick={(e) => {
                    setSelected(toggleSelection(selected, rows, row.id, {
                      shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, anchorId,
                    }))
                    if (!e.shiftKey) setAnchorId(row.id)
                  }}
                >
                  <RefTd>{t('products:invoicePicker.type_order')}</RefTd>
                  <RefTd>{row.invoiceNo || '—'}</RefTd>
                  <RefTd>{row.date}</RefTd>
                  <RefTd>{timeOf(row.createdAt)}</RefTd>
                  <RefTd>{row.from || '—'}</RefTd>
                  {/* الطلبيّةُ بلا مستودع — فارغٌ صحيحٌ لا ناقص. */}
                  <RefTd>—</RefTd>
                  <RefTd>{row.amount === null ? t('products:orders.totalUnpriced') : row.amount}</RefTd>
                </RefRow>
              ))}
              <RefFillerRow columns={COLUMNS} />
            </tbody>
          </RefTable>
        </div>

        {rows.length === 0 && (
          <p data-picker-empty className="text-xs text-muted-foreground">
            {all.length === 0
              ? t('products:invoicePicker.noOrders')
              : t('products:invoicePicker.noMatches')}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t('products:invoicePicker.multiHint')}</p>
          <div className="flex gap-2">
            <RefCancelButton onClick={onCancel}>{t('products:orders.cancelButton')}</RefCancelButton>
            <RefActionButton disabled={selected.length === 0} onClick={() => onSelect(selected)}>
              {t('products:orders.selectButton')}
            </RefActionButton>
          </div>
        </div>
      </div>
    </div>
  )
}

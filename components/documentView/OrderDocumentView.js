import { Fragment } from 'react'
import { useTranslation } from 'next-i18next'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow } from '../ref/RefGrid'
import { orderViewLines } from '../../lib/documentsWithOrders'

// طلبيّةٌ مرحَّلةٌ تُقرأ بشكل شاشتها — **رسمٌ ساكنٌ بالبناء، لا شاشةُ إدخالٍ
// معطَّلة.**
//
// 🔴 **والفرقُ ليس أسلوبًا:** ٠٩٤ج سحب `UPDATE` عن `stock_documents`، **فزرُّ
// إرسالٍ منسيٌّ لا يُرفَض كتعديل** — يُدرج مستندًا جديدًا بالكامل عبر
// `INSERT`. ⇒ **مستندٌ شبحيٌّ بحركاتٍ حقيقيّة.** و`disabled` خاصّيّةٌ تُنسى؛
// **والعنصرُ غيرُ الموجودِ لا يُنسى.**
//
// ⚠️ **ولا زرَّ هنا إطلاقًا** — الإغلاقُ يملكه اللوحُ الحاوي، **وحارسُ
// `viewScreensAreInert` يُسقط الحزمةَ على أوّل `<button>` أو `<input>` أو
// `onChange` أو نداءِ ترحيلٍ يدخل هذا المجلّد.**
//
// ══════════════════════════════════════════════════════════════════
// 🔴 ولا رقمَ لم يُكتب — قرارُ المالك (د/١)
// ══════════════════════════════════════════════════════════════════
//
// **لا مجموعَ ولا صافيَ ولا إجماليَّ سطر.** المعروضُ ما كُتب وقتَ التسجيل
// وحدَه: الكمّيّةُ بوحدتها، **والسعرُ المطلوبُ كما أُدخل.**
//
// ⚠️ **والحدُّ الدقيق:** تسميةُ محفوظٍ عرضٌ (وحدةٌ · صيغةٌ)، **وجمعُ محفوظَين
// حساب.** والسؤالُ الفاصل: **هل يظهر رقمٌ ليس له عمودٌ في القاعدة؟**
//
// ✅ **وهذا يُلغي خطرَ الانحراف لا يديره:** بلا حسابٍ لا يمكن أن يعرض مستندٌ
// قديمٌ رقمًا يخالف ما رآه من رحّله يومَ يتغيّر منطقُ الحساب.
//
// ══════════════════════════════════════════════════════════════════
//
// ⚠️ **والمجلّداتُ المختارةُ لا تُحفظ** (المواصفة ج/٢) — المستندُ يسجّل سطورَه
// لا أيَّ مجلّدٍ اختير. **فالتجميعُ هنا تحت تصنيفاتِ السطور الموجودة، ومجلّدٌ
// بلا سطرٍ لا يظهر.** ⇒ **فالشاشتان لن تتطابقا بصريًّا، وهذا صوابٌ لا نقص:**
// «أيّ شي ما وراه بيانات بينحذف مش بينرسم فاضي».
const COLUMNS = 3

export default function OrderDocumentView({ order, orderLines, products, categories, suppliers }) {
  const { t } = useTranslation(['products', 'common'])
  if (!order) return null

  const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
  // ⚠️ **يُحلّ هنا من `supplier_id`** — الصفُّ المدموجُ يحمل المعرِّفَ لا الاسم،
  // **وقراءةُ `order.supplier_name` كانت سترسم «—» على كلّ طلبيّةٍ أبدًا.**
  const supplierName = (suppliers || []).find((s) => s && s.id === order.supplier_id)?.name || null
  const categoryName = (id) => (categories || []).find((c) => c && c.id === id)?.name || null

  // تجميعٌ تحت التصنيف، بترتيب السطور كما حُفظت — **ولا فرزَ يُخترع.**
  // `products.category_id` غيرُ قابلٍ للعدم (مقيسٌ بالمخطّط)، فلا فئةَ يتيمة
  // إلّا حين يغيب المنتجُ نفسُه عن الحمولة.
  const groups = []
  for (const line of orderViewLines(orderLines, order.id)) {
    const product = productsById[line.productId]
    const key = product ? product.category_id : null
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.lines.push({ line, product })
    else groups.push({ key, lines: [{ line, product }] })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* الرأسُ — محفوظاتٌ تُقرأ، بلا حقلٍ واحدٍ يُكتب. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>
          <span className="text-muted-foreground">{t('products:orders.supplierLabel')}: </span>
          {supplierName || '—'}
        </span>
        <span>
          <span className="text-muted-foreground">{t('products:docs.dateLabel')}: </span>
          {String(order.doc_date || '').slice(0, 10) || '—'}
        </span>
        {order.note && (
          <span>
            <span className="text-muted-foreground">{t('products:docs.noteLabel')}: </span>
            {order.note}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto border border-[var(--rule)]">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh>{t('products:orders.productColumn')}</RefTh>
              <RefTh>{t('products:orders.quantityColumn')}</RefTh>
              {/* 🔴 «سعرٌ مطلوب» لا «كلفة» — لا شراءَ وقع ولا دفعةَ وُلدت. */}
              <RefTh>{t('products:documents.valueOrder')}</RefTh>
            </tr>
          </RefHead>
          <tbody>
            {groups.map((group, gi) => (
              <Fragment key={`${group.key}-${gi}`}>
                {categoryName(group.key) && (
                  <RefGroupRow columns={COLUMNS}>{categoryName(group.key)}</RefGroupRow>
                )}
                {group.lines.map(({ line, product }) => (
                  <RefRow key={line.id} data-view-line={line.id}>
                    <RefTd>{product?.name || '—'}</RefTd>
                    <RefTd>
                      {line.quantity === null ? '—' : t('products:documents.inEntered', {
                        uom: t(`products:docs.uom_${line.uom || 'unit'}`), n: line.quantity,
                      })}
                    </RefTd>
                    <RefTd>
                      {/* ⚠️ **والعدمُ يبقى عدمًا** — `entered_unit_price` يقبله،
                          و«لا أحدَ اتّفق على السعر» ليست «هذا بلا ثمن». */}
                      {line.askingPrice === null ? '—' : t('products:documents.money', {
                        total: line.askingPrice.toLocaleString('ar', { maximumFractionDigits: 2 }),
                      })}
                    </RefTd>
                  </RefRow>
                ))}
              </Fragment>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={COLUMNS} className="py-3 text-center text-xs text-muted-foreground">
                  {t('products:documents.noLines')}
                </td>
              </tr>
            )}
            <RefFillerRow columns={COLUMNS} />
          </tbody>
        </RefTable>
      </div>
    </div>
  )
}

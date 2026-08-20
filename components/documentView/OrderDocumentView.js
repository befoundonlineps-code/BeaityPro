import { Fragment } from 'react'
import { useTranslation } from 'next-i18next'
import { Search, FileSpreadsheet, FileInput, Filter } from 'lucide-react'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow } from '../ref/RefGrid'
import {
  StaticField, StaticSelect, StaticArea,
  StaticActionButton, StaticCancelButton, StaticShellButton,
} from '../ref/RefStatic'
import { orderViewLines } from '../../lib/documentsWithOrders'
import { balanceIndex } from '../../lib/orderGrid'
import { roundToPlaces } from '../../lib/decimalPlaces'

// «طلب بضاعة» — **مشاهدةً.** صورةُ شاشة الإنشاء نفسِها، منزوعةَ الوظيفة.
//
// **المعيارُ الموحَّد بلفظ المالك:** «شاشةُ العرض = نفسُ شاشة الإنشاء بصريًّا
// بالحرف»، **وكلُّ الأزرار ديكورٌ بلا `onClick` بتاتًا، بلا استثناء.**
//
// ⚠️ **والطلبيّةُ تُعدَّل وتُحذَف فعلًا** (بخلاف المستند المرحَّل)، **فالخطرُ
// هنا أقربُ لا أبعد:** زرٌّ يعمل في شاشةِ عرضٍ يكتب على طلبيّةٍ قائمة.
//
// ══════════════════════════════════════════════════════════════════
// 🔴 عمودُ «الكمّيّة» بالقطعة يسقط كلّيًّا — قرارُ المالك، ومقيسٌ لماذا
// ══════════════════════════════════════════════════════════════════
//
// **`product_order_lines` ليس فيها `quantity_base` ولا ما يكافئه** — مقيسًا من
// تعريف الجدول (`053a:133`): `entered_quantity` · `entered_uom` ·
// `entered_unit_price` · `sort_order` **وحدَها.** **والطلبيّةُ لا تولّد حركةً**
// فلا `stock_movements` لها.
//
// ⚠️ **واشتقاقُها حيًّا (`entered_quantity × units_per_package`) هو خطرُ
// `unit_cost` بعينه بلبوسٍ جديد، بلفظ المالك:** «الكمّيّةُ حقيقةٌ أساسيّةٌ من
// صلب المستند… إن كانت تُحسب حيًّا من معامل تعبئةٍ قابلٍ للتغيّر بإعدادات
// المنتج، فهي نفسُ خطر `unit_cost` — رقمٌ تاريخيٌّ قد يتغيّر بصمتٍ بعد شهور».
//
// ⇒ **`entered_quantity` + `entered_uom` فقط، بلا أيّ حسابٍ حيّ.**
//
// ══════════════════════════════════════════════════════════════════
// 🔴 و«المبلغ» يبقى موضعًا وتسميةً، وقيمتُه «—» على كلّ طلبيّةٍ من هذه الشاشة
// ══════════════════════════════════════════════════════════════════
//
// **مقيسٌ ومفاجئ:** `orderGrid.js:240 orderLinesFromGrid` **لا تحفظ سعرًا
// إطلاقًا** — تحفظ `productId · enteredQuantity · enteredUom · sortOrder`.
// ⇒ **`entered_unit_price` عدمٌ على كلّ سطرٍ أنشأته شاشةُ الطلب.**
//
// **وشاشةُ الإنشاء تعرض المبلغَ مع ذلك**، لأنها تضربه في **سعر الكتالوج
// اليوم** (`effectivePrice` حين لا سعرَ مكتوب) — **وذلك بالضبط ما تحظره قاعدةُ
// المالك:** «لا حسابَ حيًّا لأيّ كمّيّةٍ أو مبلغٍ غير مخزَّنٍ على نفس السطر».
//
// ⇒ **فالضربُ هنا على المحفوظ وحدَه** (`entered_quantity × entered_unit_price`)،
// **و«—» حين لا سعرَ محفوظًا** — وهي حالةُ كلّ طلبيّةٍ اليوم. **يُقال ولا
// يُبتلع، ويُصلَح بحفظ السعر في شاشة الإنشاء إن أراد المالك.**
//
// ══════════════════════════════════════════════════════════════════
// الأعمدةُ — أربعةٌ من خمسة
// ══════════════════════════════════════════════════════════════════
//
// ```
// الإنشاء   المنتج · العبوات(w-24) · الكمّيّة(w-28) · الرصيد الحاليّ(w-32) · المبلغ(w-28)
// العرض     المنتج · العبوات(w-24) ·      —        · الرصيد الحاليّ(w-32) · المبلغ(w-28)
// ```
//
// ⚠️ **و«الرصيد الحاليّ» من مستودع العدسة، كما في شاشة الإنشاء** — **والطلبيّةُ
// بلا مستودعٍ أصلًا** (`storage_id` عدمٌ في الصفّ المدموج)، فلا مستودعَ آخرَ
// يُقرأ منه. **وبنفس `balanceIndex`** فلا يفترق الرقمان.
//
// 🔴 **و«المجموع» موضعُه وتسميتُه دائمًا، وقيمتُه «—» دائمًا** — موحَّدًا على
// الأربع، **و«ثلاثُ جملٍ لا رقمٌ واحد» في شاشة الإنشاء كلُّها مجموعُ سطور.**
const COLUMNS = 4

export default function OrderDocumentView({
  order, orderLines, products, categories, suppliers, balances, storageId,
}) {
  const { t } = useTranslation(['products', 'common'])
  if (!order) return null

  const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
  const categoriesById = Object.fromEntries((categories || []).map((c) => [c.id, c]))
  // ⚠️ **يُحلّ من `supplier_id`** — الصفُّ المدموجُ يحمل المعرِّفَ لا الاسم،
  // **وقراءةُ `order.supplier_name` كانت سترسم «—» على كلّ طلبيّةٍ أبدًا.**
  const supplierName = (suppliers || []).find((s) => s && s.id === order.supplier_id)?.name || null

  const stock = balanceIndex(balances, storageId)

  const chainOf = (categoryId) => {
    const chain = []
    let node = categoriesById[categoryId]
    // ⚠️ حدٌّ أعلى للحلقة — دورةٌ في `parent_id` تعلّق الصفحةَ بلا رسالة.
    let guard = 0
    while (node && guard < 32) { chain.unshift(node); node = categoriesById[node.parent_id]; guard += 1 }
    return chain
  }

  // 🔴 **سطورُ الطلبيّة وحدَها** — قرارُ المالك، **والمجلّداتُ المؤشَّرةُ لم
  // تُحفظ قطّ**، فصفوفُ شاشة الإنشاء غيرُ قابلةٍ للاسترجاع أصلًا.
  const lines = orderViewLines(orderLines, order.id)

  const groups = []
  for (const line of lines) {
    const product = productsById[line.productId]
    const key = product ? product.category_id : null
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.lines.push({ line, product })
    else groups.push({ key, lines: [{ line, product }] })
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* ══ الرأسُ — نفسُ ترتيب شاشة الإنشاء وحقولها الثلاثة ══ */}
      <div className="flex flex-wrap items-end gap-3">
        <span className="flex items-center gap-1.5 text-xs">
          {t('products:orders.invoiceLabel')}
          <StaticField>{order.supplier_doc_number || ''}</StaticField>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          {t('products:orders.fromLabel')}
          <StaticField className="w-[9.5rem]">
            {String(order.doc_date || '').slice(0, 10)}
          </StaticField>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          {t('products:orders.supplierLabel')}
          <StaticSelect className="w-48">{supplierName || ''}</StaticSelect>
        </span>
      </div>

      {/* ══ الجدولُ — نفسُ العروض والارتفاع الأدنى ══ */}
      <div className="min-h-[240px] flex-1 overflow-auto border border-[var(--rule)]">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh>{t('products:orders.productColumn')}</RefTh>
              <RefTh className="w-24">{t('products:orders.packagesColumn')}</RefTh>
              <RefTh className="w-32">{t('products:orders.inStockColumn')}</RefTh>
              <RefTh className="w-28">{t('products:orders.amountColumn')}</RefTh>
            </tr>
          </RefHead>
          <tbody>
            {groups.map((group, gi) => (
              <Fragment key={`${group.key}-${gi}`}>
                {/* ⚠️ **بلا شارةِ «مجموع العبوات»** — مجموعُ سطورٍ، محظورٌ بـد/١.
                    **وبلا «مجلد بلا أصناف»** — لا مجلّدَ بلا سطرٍ هنا أصلًا. */}
                {chainOf(group.key).map((folder) => (
                  <RefGroupRow key={`${gi}-${folder.id}`} columns={COLUMNS}>{folder.name}</RefGroupRow>
                ))}
                {group.lines.map(({ line, product }) => {
                  // 🔴 **ضربٌ على المحفوظ وحدَه** — و«—» حين لا سعرَ محفوظًا.
                  const amount = line.askingPrice === null || line.quantity === null
                    ? null
                    : roundToPlaces(line.quantity * line.askingPrice)
                  return (
                    <RefRow key={line.id} data-view-line={line.id}>
                      <RefTd>{product?.name || '—'}</RefTd>

                      {/* ⚠️ **الوحدةُ قبل الرقم، والإطارُ الذي كُتب فيه.** */}
                      <RefTd>
                        <StaticField>
                          {line.quantity === null ? '' : t('products:documents.inEntered', {
                            uom: t(`products:docs.uom_${line.uom || 'unit'}`), n: line.quantity,
                          })}
                        </StaticField>
                      </RefTd>

                      <RefTd>
                        {t('products:orders.qtyWithUnit', {
                          n: stock.get(line.productId) ?? 0,
                          unit: t(`products:units.${product?.base_unit || 'pcs'}`),
                        })}
                      </RefTd>
                      <RefTd>
                        {amount === null ? '—' : amount.toLocaleString('ar', { maximumFractionDigits: 2 })}
                      </RefTd>
                    </RefRow>
                  )
                })}
              </Fragment>
            ))}
            {lines.length === 0 && (
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

      {/* ══ صفُّ البحث والضوابط الثلاثة ══ */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5">
          <Search className="size-3.5 text-muted-foreground" />
          <StaticField className="w-56 text-muted-foreground">
            {t('products:orders.searchPlaceholder')}
          </StaticField>
        </span>
        <StaticShellButton icon={Filter}>{t('products:orders.filterLabel')}</StaticShellButton>
        <StaticShellButton icon={FileInput}>{t('products:orders.enterLabel')}</StaticShellButton>
        <StaticShellButton icon={FileSpreadsheet}>{t('products:orders.excelLabel')}</StaticShellButton>
      </div>

      {/* ══ المجموعُ — موضعٌ وتسميةٌ دائمًا، وقيمةٌ «—» دائمًا ══ */}
      <div className="flex items-center gap-2 text-sm font-semibold">
        {t('products:orders.totalLabel')}
        <span data-view-total>—</span>
      </div>

      {/* ══ الملاحظةُ — صندوقٌ ساكنٌ بارتفاع سطرين ══ */}
      <span className="flex flex-col gap-1 text-xs">
        {t('products:orders.noteLabel')}
        <StaticArea>{order.note || ''}</StaticArea>
      </span>

      {/* ══ الأزرارُ الثلاثة — ديكورٌ بلا وظيفة، بنفس الترتيب ══ */}
      <div className="flex justify-end gap-2">
        <StaticCancelButton>{t('products:orders.backToFolders')}</StaticCancelButton>
        <StaticCancelButton>{t('products:orders.cancelButton')}</StaticCancelButton>
        <StaticActionButton>{t('products:orders.toOrderButton')}</StaticActionButton>
      </div>
    </div>
  )
}

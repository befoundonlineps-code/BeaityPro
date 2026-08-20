import { Fragment } from 'react'
import { useTranslation } from 'next-i18next'
import { Search, FileSpreadsheet, FileInput } from 'lucide-react'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from '../ref/RefGrid'
import {
  StaticField, StaticSelect, StaticArea, StaticCheckbox,
  StaticActionButton, StaticCancelButton, StaticShellButton,
} from '../ref/RefStatic'
import { movementsOf, movementFrames } from '../../lib/stockDocumentList'
import { lotsForLine, availableForWriteOff } from '../../lib/lotPicker'
import { paymentChoiceOf, ON_ACCOUNT } from '../../lib/documentMoney'
import { numberOrNull, roundToPlaces } from '../../lib/decimalPlaces'

// «إرجاع إلى مورّد» — **مشاهدةً.** صورةُ شاشة الإنشاء نفسِها، منزوعةَ الوظيفة.
//
// **المعيارُ الموحَّد بلفظ المالك:** «شاشةُ العرض = نفسُ شاشة الإنشاء بصريًّا
// بالحرف»، **وكلُّ الأزرار ديكورٌ بلا `onClick` بتاتًا، بلا استثناء.**
//
// 🔴 **وزرُّ «إرجاع» `<span>` لا `<button>` بالمطلق** — ٠٩٤ج سحب `UPDATE` عن
// `stock_documents`، **فزرُّ إرسالٍ منسيٌّ يُدرج مستندًا شبحيًّا بالكامل.**
//
// ══════════════════════════════════════════════════════════════════
// 🔴 المبلغُ من `entered_unit_price` — قرارُ المالك (د/٤)
// ══════════════════════════════════════════════════════════════════
//
// **والمحفوظُ للعبوة لا للوحدة الأساسيّة، وهذا مقيسٌ لا مفترَض:**
//
//     returnGrid.js:260   enteredUnitPrice: roundToPlaces(perBase * perPackage(product))
//
// ⇒ **فالضربُ في `entered_quantity` (عبوات) يعطي مبلغَ السطر مباشرةً** —
// عمودان محفوظان على نفس السطر، بلا تحويلِ وحدات.
//
// ══════════════════════════════════════════════════════════════════
// 🔴 و«سعر الوحدة» صار «سعر العبوة» — الانحرافُ الوحيدُ المعلَن، بإقرار المالك
// ══════════════════════════════════════════════════════════════════
//
// **خانةُ شاشة الإنشاء تحمل سعرًا للوحدة الأساسيّة**
// (`returnSupplier.priceHint`: «السعر بالوحدة الأساسية»)، **والعمودُ المحفوظُ
// يحمله للعبوة** — رقمان مختلفان لنفس الشيء.
//
// ⚠️ **وإعادةُ بنائه هي `100.0005` بعينها، مقيسةً:**
//
//     perBase المكتوب     6.6667
//     entered_unit_price  100.00        ⟵ roundToPlaces(6.6667 × 15) بمنزلتين
//     100.00 ÷ 15      =  6.666666…     ⟵ **لا يساوي 6.6667**
//
// ⇒ **والقسمةُ محظورةٌ بقاعدة المالك نفسِها** («لا حسابَ حيًّا لأيّ كمّيّةٍ أو
// مبلغٍ غير مخزَّنٍ على نفس السطر») — **فيُعرض المحفوظُ في إطاره ويُسمّى باسمه.**
// **والاسمُ تغيّر لأن الرقمَ تغيّر إطارُه، لا لأن الشكلَ لم يعجب.**
//
// ══════════════════════════════════════════════════════════════════
// الأعمدةُ السبعة — **بنفس الترتيب وبنفس العروض**
// ══════════════════════════════════════════════════════════════════
//
// ```
// المنتج · العبوات(w-24) · العدد(w-28) · المتوفر(w-32) · الدفعة(w-64) · سعر العبوة(w-32) · المبلغ(w-28)
// ```
//
// ✅ **و«المتوفر» رصيدُ اليوم** — بقرار المالك، **وبنفس دالّة شاشة الإنشاء**
//    (`lotsForLine` ⟵ `availableForWriteOff`، `returnGrid.js:88`).
//
// ⚠️ **وشارتا «تكلفة مقدَّرة» و«سعر معدَّل» لا تظهران:** الأولى صفةُ دفعةٍ
//    (`cost_is_estimated`) **وتظهر**، والثانيةُ مقارنةٌ بين `entered_unit_price`
//    و`unit_cost × units_per_package` — **ضربٌ عبر جدولين، وهو المحظور.**
//
// 🔴 **و«المجموع» موضعُه وتسميتُه دائمًا، وقيمتُه «—» دائمًا** — موحَّدًا على
//    الأربع: «نفسُ الذيل» تطلب موضعَه، **و د/١ تحظر مجموعَ السطور.**
const COLUMNS = 7

export default function ReturnDocumentView({
  document: doc, movements, products, categories, lots, suppliers,
}) {
  const { t } = useTranslation(['products', 'common'])
  if (!doc) return null

  const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
  const lotsById = Object.fromEntries((lots || []).map((l) => [l.id, l]))
  const categoriesById = Object.fromEntries((categories || []).map((c) => [c.id, c]))
  const supplierName = (suppliers || []).find((s) => s && s.id === doc.supplier_id)?.name || null

  const chainOf = (categoryId) => {
    const chain = []
    let node = categoriesById[categoryId]
    // ⚠️ حدٌّ أعلى للحلقة — دورةٌ في `parent_id` تعلّق الصفحةَ بلا رسالة.
    let guard = 0
    while (node && guard < 32) { chain.unshift(node); node = categoriesById[node.parent_id]; guard += 1 }
    return chain
  }

  // 🔴 **سطورُ المستند وحدَها** — قرارُ المالك، **والمجلّداتُ المؤشَّرةُ لم تُحفظ
  // قطّ** فصفوفُ شاشة الإنشاء غيرُ قابلةٍ للاسترجاع أصلًا.
  const returnLines = movementsOf(movements, doc.id)

  // ⚠️ **يُحسب مرّةً لكلّ منتجٍ لا مرّةً لكلّ سطر** — بعد ٠٩٥ ينقسم المنتجُ
  // الواحدُ إلى حركةٍ لكلّ دفعة، و`lotsForLine` تمشي كلَّ الحركات في كلّ نداء.
  const lotRowsCache = new Map()
  const lotRowsFor = (productId) => {
    if (!lotRowsCache.has(productId)) {
      lotRowsCache.set(productId, lotsForLine({
        lots, movements, storageId: doc.storage_id, productId,
      }))
    }
    return lotRowsCache.get(productId)
  }

  const groups = []
  for (const line of returnLines) {
    const product = productsById[line.product_id]
    const key = product ? product.category_id : null
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.lines.push({ line, product })
    else groups.push({ key, lines: [{ line, product }] })
  }

  // 🔴 **حالةُ الدفع مشتقّةٌ لا محفوظة** — `ON_ACCOUNT` لا يصل القاعدةَ أبدًا
  // (`documentMoney.js:34`)، **والحالةُ تُقرأ من `paid_amount`.** والدالّةُ
  // المقرَّرةُ تُستدعى كما هي، بلا صياغةٍ ثانيةٍ تتباعد عنها.
  const paid = numberOrNull(doc.paid_amount)
  const choice = paymentChoiceOf({ paidAmount: doc.paid_amount, paymentMethod: doc.payment_method })

  return (
    <div className="flex h-full flex-col gap-2">
      {/* ══ الرأسُ — نفسُ ترتيب شاشة الإنشاء وحقولها الأربعة ══ */}
      <div className="flex flex-wrap items-end gap-3">
        <span className="flex items-center gap-1.5 text-xs">
          {t('products:returnSupplier.supplierLabel')}
          <StaticSelect className="w-48">{supplierName || ''}</StaticSelect>
        </span>

        <span className="flex items-center gap-1.5 text-xs">
          {t('products:returnSupplier.docNumberLabel')}
          <StaticField>{doc.doc_number || ''}</StaticField>
        </span>

        <span className="flex items-center gap-1.5 text-xs">
          {t('products:returnSupplier.fromLabel')}
          <StaticField className="w-[9.5rem]">
            {String(doc.doc_date || '').slice(0, 10)}
          </StaticField>
        </span>

        {/* ⚠️ **مربّعُ الأمانة مرشِّحُ عرضٍ لا يُخزَّن** (`save()` لا يحمله) —
            **ويُرسم لأن الشكلَ هو المطلوب**، غيرَ مؤشَّرٍ لأن لا حالةَ محفوظةً
            تُقرأ منها. */}
        <span className="flex items-center gap-1.5 text-xs">
          <StaticCheckbox />
          {t('products:returnSupplier.consignmentLabel')}
        </span>
      </div>

      {/* ══ الجدولُ — سبعةُ أعمدةٍ بعروضها، وارتفاعٌ أدنى كما في الإنشاء ══ */}
      <div className="min-h-[240px] flex-1 overflow-auto border border-[var(--rule)]">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh>{t('products:returnSupplier.productColumn')}</RefTh>
              <RefTh className="w-24">{t('products:returnSupplier.packagesColumn')}</RefTh>
              <RefTh className="w-28">{t('products:returnSupplier.numberColumn')}</RefTh>
              <RefTh className="w-32">{t('products:returnSupplier.inStockColumn')}</RefTh>
              <RefTh className="w-64">{t('products:returnSupplier.lotColumn')}</RefTh>
              {/* 🔴 «سعر العبوة» لا «سعر الوحدة» — الإطارُ المحفوظُ عبوة. */}
              <RefTh className="w-32">{t('products:documents.returnPackagePrice')}</RefTh>
              <RefTh className="w-28">{t('products:returnSupplier.amountColumn')}</RefTh>
            </tr>
          </RefHead>
          <tbody>
            {groups.map((group, gi) => (
              <Fragment key={`${group.key}-${gi}`}>
                {chainOf(group.key).map((folder) => (
                  <RefGroupRow key={`${gi}-${folder.id}`} columns={COLUMNS}>{folder.name}</RefGroupRow>
                ))}
                {group.lines.map(({ line, product }) => {
                  const frames = movementFrames(line, product)
                  const lot = lotsById[line.lot_id]
                  const lotRows = lotRowsFor(line.product_id)
                  const inStock = availableForWriteOff(lotRows)
                  const remaining = lotRows.find((r) => r.id === line.lot_id)?.remaining ?? 0
                  // ⚠️ **العدمُ يبقى عدمًا:** «ثمنٌ لم يُصرَّح» ليست «بلا مطالبة»
                  // — وهو نصُّ `returnGrid.js:258` حرفيًّا.
                  const price = numberOrNull(line.entered_unit_price)
                  const amount = price === null || frames.entered === null
                    ? null
                    : roundToPlaces(frames.entered * price)
                  return (
                    <RefRow key={line.id} data-view-line={line.id}>
                      <RefTd>
                        <span className="flex items-center gap-2">
                          {product?.name || '—'}
                          {/* ⚠️ **تُقرأ من `products.is_consignment` اليوم**، لا
                              من المستند — **وهذا يُقال لأنه ادّعاءٌ عن الحاضر
                              على سطرٍ ماضٍ.** ونفسُ ما تفعله شاشةُ الإنشاء
                              (`returnGrid.js:152`). */}
                          {product?.is_consignment === true && (
                            <RefTag>{t('products:returnSupplier.consignmentTag')}</RefTag>
                          )}
                        </span>
                      </RefTd>

                      {/* العبوات — خانةٌ ساكنةٌ وزرُّ «الكل» بجانبها. */}
                      <RefTd>
                        <span className="flex items-center gap-1">
                          <StaticField className="w-12">
                            {frames.entered === null ? '' : frames.entered}
                          </StaticField>
                          <StaticShellButton className="shrink-0 px-1.5 text-[11px]">
                            {t('products:returnSupplier.fillAll')}
                          </StaticShellButton>
                        </span>
                      </RefTd>

                      <RefTd>
                        {t('products:orders.qtyWithUnit', {
                          n: frames.base, unit: t(`products:units.${frames.baseUnit || 'pcs'}`),
                        })}
                      </RefTd>
                      <RefTd>
                        {t('products:orders.qtyWithUnit', {
                          n: inStock, unit: t(`products:units.${frames.baseUnit || 'pcs'}`),
                        })}
                      </RefTd>

                      {/* الدفعةُ — منسدلٌ ساكنٌ يحمل نصَّ الخيار المختار نفسَه. */}
                      <RefTd>
                        <span className="flex items-center gap-1.5">
                          <StaticSelect>
                            {lot
                              ? t('products:returnSupplier.lotOption', {
                                date: String(lot.received_at || '').slice(0, 10),
                                remaining,
                                cost: lotRows.find((r) => r.id === line.lot_id)?.unitCost ?? '—',
                              })
                              : t('products:returnSupplier.lotAuto')}
                          </StaticSelect>
                          {lot?.cost_is_estimated === true && (
                            <RefTag title={t('products:returnSupplier.estimatedHelp')}>
                              {t('products:returnSupplier.estimatedTag')}
                            </RefTag>
                          )}
                        </span>
                      </RefTd>

                      <RefTd>
                        <StaticField>{price === null ? '' : price}</StaticField>
                      </RefTd>
                      <RefTd>
                        {amount === null ? '—' : amount.toLocaleString('ar', { maximumFractionDigits: 2 })}
                      </RefTd>
                    </RefRow>
                  )
                })}
              </Fragment>
            ))}
            {returnLines.length === 0 && (
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

      {/* ══ صفُّ البحث والضابطان ══ */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5">
          <Search className="size-3.5 text-muted-foreground" />
          <StaticField className="w-56 text-muted-foreground">
            {t('products:returnSupplier.searchPlaceholder')}
          </StaticField>
        </span>
        <StaticShellButton icon={FileInput}>{t('products:returnSupplier.enterLabel')}</StaticShellButton>
        <StaticShellButton icon={FileSpreadsheet}>{t('products:returnSupplier.excelLabel')}</StaticShellButton>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          المجموعُ وكتلةُ الدفع — نفسُ الصفّ ونفسُ الترتيب

          🔴 **وألفاظُها ألفاظُ شاشة الإرجاع لا شاشةِ التوريد**، لأن المال هنا
          **يُستلَم لا يُدفَع** — `stockDocumentForm.js:322` بالنصّ: «On a return
          this is money RECEIVED, not paid… and the screen flips the label».

          ⚠️ **وثلاثُ حالاتٍ لا اثنتان:** `paymentChoiceOf` تُرجع `''` لمبلغٍ
          موجبٍ بلا طريقةٍ صالحة، **وقراءتُها «على حساب المورّد» تجعل الشاشةَ
          تدّعي اختيارًا لم يقع** (`documentMoney.js:47-49`). **والقيدُ يسمح بها
          مخزَّنةً** (`paid_amount > 0` مع `payment_method = null`). */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          {t('products:returnSupplier.totalLabel')}
          <span data-view-total>—</span>
        </span>

        <span className="flex items-center gap-1.5 text-xs font-normal">
          {t('products:returnSupplier.paidLabel')}
          <StaticField className="w-28">
            {choice === ON_ACCOUNT || paid === null ? '' : paid}
          </StaticField>
        </span>

        <span className="flex items-center gap-1.5 text-xs font-normal">
          {t('products:returnSupplier.paymentLabel')}
          <StaticSelect className="w-40">
            {choice === ON_ACCOUNT
              ? t('products:returnSupplier.payment_on_account')
              : choice === ''
                ? t('products:returnSupplier.paymentPlaceholder')
                : t(`products:docs.paymentMethod_${choice}`)}
          </StaticSelect>
        </span>
      </div>

      {/* ══ الملاحظاتُ — صندوقٌ ساكنٌ بارتفاع سطرين ══ */}
      <span className="flex flex-col gap-1 text-xs">
        {t('products:returnSupplier.noteLabel')}
        <StaticArea>{doc.note || ''}</StaticArea>
      </span>

      {/* ══ الأزرارُ الثلاثة — ديكورٌ بلا وظيفة، بنفس الترتيب ══ */}
      <div className="flex items-center justify-end gap-2">
        <StaticCancelButton>{t('products:returnSupplier.backToFolders')}</StaticCancelButton>
        <StaticCancelButton>{t('products:returnSupplier.cancelButton')}</StaticCancelButton>
        <StaticActionButton>{t('products:returnSupplier.returnButton')}</StaticActionButton>
      </div>
    </div>
  )
}

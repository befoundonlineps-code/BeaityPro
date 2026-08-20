import { Fragment } from 'react'
import { useTranslation } from 'next-i18next'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from '../ref/RefGrid'
import { movementsOf, movementFrames } from '../../lib/stockDocumentList'
import { paymentChoiceOf, ON_ACCOUNT } from '../../lib/documentMoney'
import { numberOrNull, roundToPlaces } from '../../lib/decimalPlaces'

// مستندُ إرجاعٍ إلى مورّدٍ مرحَّلٌ يُقرأ **بشكل شاشته هي**، للقراءة فقط.
//
// 🔴 **رسمٌ ساكنٌ بالبناء، لا شاشةُ إدخالٍ معطَّلة:** ٠٩٤ج سحب `UPDATE` عن
// `stock_documents`، **فزرُّ إرسالٍ منسيٌّ لا يُرفَض كتعديل** — يُدرج مستندًا
// جديدًا بالكامل عبر `INSERT`. ⇒ **مستندٌ شبحيٌّ بحركاتٍ حقيقيّة.**
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
// 🔴 و«سعر الوحدة» صار «سعر العبوة» — انحرافٌ واحدٌ عن «حرفًا بحرف»، بسببه
// ══════════════════════════════════════════════════════════════════
//
// **خانةُ شاشة الإدخال تحمل سعرًا للوحدة الأساسيّة**
// (`returnSupplier.priceHint`: «السعر بالوحدة الأساسية»)، **والعمودُ المحفوظُ
// يحمله للعبوة** — رقمان مختلفان لنفس الشيء.
//
// ⚠️ **وإعادةُ بنائه هي `100.0005` بعينها، مقيسةً:**
//
//     perBase المكتوب     6.6667
//     entered_unit_price  100.00        ⟵ roundToPlaces(6.6667 × 15) بمنزلتين
//     100.00 ÷ 15      =  6.666666…     ⟵ **لا يساوي 6.6667**
//
// ⇒ **فيُعرض المحفوظُ في إطاره ويُسمّى باسمه** — «الوحدةُ تُسمّى، ولا شيءَ
// يُخترع» (`stockDocumentList.js:103`). **والاسمُ يتغيّر لأن الرقمَ تغيّر
// إطارُه، لا لأن الشكلَ لم يعجبنا.**
//
// ══════════════════════════════════════════════════════════════════
// الأعمدةُ — ستّةٌ من سبعة
// ══════════════════════════════════════════════════════════════════
//
// ```
// الإدخال   المنتج · العبوات · العدد · المتوفر · الدفعة · سعر الوحدة · المبلغ
// العرض     المنتج · العبوات · العدد ·   —    · الدفعة · سعر العبوة · المبلغ
// ```
//
// ❌ **«المتوفر» يسقط** — مفهومُ لحظةِ إدخال، **وقراءتُه اليومَ تعطي رصيدَ
//    اليوم لا رصيدَ الترحيل.**
//
// ✅ **و«الدفعة» نصٌّ ثابتٌ بدل قائمة** — و`lot_id` محفوظٌ على الحركة.
//    ⚠️ **ومنسدلُ الإدخال يعرض ثلاثةً** («استلام · متبقٍّ · سعر الوحدة»)
//    **ويبقى منها الأوّلُ وحدَه**، لسببين منفصلين:
//    ❌ «متبقٍّ» مفهومُ لحظةِ اختيار — متبقّي اليومَ لا متبقّي الترحيل.
//    ❌ **و«سعر الوحدة» في المنسدل ثمنُ الدفعة، وفي العمود المطالبة** —
//       رقمان يفترقان فعلًا («سعر معدَّل»)، **وعرضُهما باسمٍ واحدٍ على سطرٍ
//       واحدٍ يجعل القارئَ يقرأ أحدَهما مكان الآخر.**
//
// 🔴 **ولا «المجموع» في الذيل** — جمعٌ عبر السطور، وهو محظورُ د/١.
const COLUMNS = 6

export default function ReturnDocumentView({
  document: doc, movements, products, categories, lots, suppliers,
}) {
  const { t } = useTranslation(['products', 'common'])
  if (!doc) return null

  const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
  const lotsById = Object.fromEntries((lots || []).map((l) => [l.id, l]))
  const supplierName = (suppliers || []).find((s) => s && s.id === doc.supplier_id)?.name || null
  const categoryName = (id) => (categories || []).find((c) => c && c.id === id)?.name || null

  const returnLines = movementsOf(movements, doc.id)

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
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* الرأسُ — محفوظاتٌ تُقرأ، بلا حقلٍ واحدٍ يُكتب.
          ⚠️ **ومربّعُ «منتجات الأمانة» لا يظهر** — مرشِّحُ عرضٍ في شاشة
          الإدخال **لا يُرسَل ولا يُخزَّن** (`save()` لا تحمله)، **ولا شيءَ
          يُرشَّح في شاشةٍ سطورُها محسومة.** */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>
          <span className="text-muted-foreground">{t('products:returnSupplier.supplierLabel')}: </span>
          {supplierName || '—'}
        </span>
        {doc.doc_number && (
          <span>
            <span className="text-muted-foreground">{t('products:returnSupplier.docNumberLabel')}: </span>
            {doc.doc_number}
          </span>
        )}
        <span>
          <span className="text-muted-foreground">{t('products:returnSupplier.fromLabel')}: </span>
          {String(doc.doc_date || '').slice(0, 10) || '—'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto border border-[var(--rule)]">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh>{t('products:returnSupplier.productColumn')}</RefTh>
              <RefTh>{t('products:returnSupplier.packagesColumn')}</RefTh>
              <RefTh>{t('products:returnSupplier.numberColumn')}</RefTh>
              <RefTh>{t('products:returnSupplier.lotColumn')}</RefTh>
              {/* 🔴 «سعر العبوة» لا «سعر الوحدة» — الإطارُ المحفوظُ عبوة. */}
              <RefTh>{t('products:documents.returnPackagePrice')}</RefTh>
              <RefTh>{t('products:returnSupplier.amountColumn')}</RefTh>
            </tr>
          </RefHead>
          <tbody>
            {groups.map((group, gi) => (
              <Fragment key={`${group.key}-${gi}`}>
                {categoryName(group.key) && (
                  <RefGroupRow columns={COLUMNS}>{categoryName(group.key)}</RefGroupRow>
                )}
                {group.lines.map(({ line, product }) => {
                  const frames = movementFrames(line, product)
                  const lot = lotsById[line.lot_id]
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
                              على سطرٍ ماضٍ.** ونفسُ ما تفعله شاشةُ الإدخال
                              (`returnGrid.js:152`). */}
                          {product?.is_consignment === true && (
                            <RefTag>{t('products:returnSupplier.consignmentTag')}</RefTag>
                          )}
                        </span>
                      </RefTd>

                      {/* ⚠️ **الوحدةُ قبل الرقم، والإطارُ الذي كُتب فيه** —
                          مَن أدخل «٥ عبوات» لا يتعرّف على «٧٥». */}
                      <RefTd>
                        {frames.entered === null ? '—' : t('products:documents.inEntered', {
                          uom: t(`products:docs.uom_${frames.uom || 'unit'}`), n: frames.entered,
                        })}
                      </RefTd>
                      <RefTd>
                        {t('products:documents.inBase', {
                          unit: t(`products:units.${frames.baseUnit || 'pcs'}`), n: frames.base,
                        })}
                      </RefTd>

                      {/* 🔴 **تاريخُ الاستلام وحدَه** — وهو ما يعرّف الدفعة.
                          ولا «متبقٍّ» ولا ثمنُ الدفعة، بالسببين أعلاه. */}
                      <RefTd>
                        {lot ? <RefTag>{String(lot.received_at || '').slice(0, 10)}</RefTag> : '—'}
                      </RefTd>

                      <RefTd>
                        {price === null ? '—' : t('products:documents.money', {
                          total: price.toLocaleString('ar', { maximumFractionDigits: 2 }),
                        })}
                      </RefTd>
                      <RefTd>
                        {amount === null ? '—' : t('products:documents.money', {
                          total: amount.toLocaleString('ar', { maximumFractionDigits: 2 }),
                        })}
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

      {/* ══════════════════════════════════════════════════════════════
          🔴 كتلةُ الدفع — وألفاظُها ألفاظُ شاشة الإدخال لا شاشةِ التوريد
          ══════════════════════════════════════════════════════════════

          **«المبلغ المستلَم» و«طريقة الاستلام» و«على حساب المورّد»** — لأن
          المال هنا **يُستلَم لا يُدفَع**، وهو نصُّ `stockDocumentForm.js:322`
          حرفيًّا: «On a return this is money RECEIVED, not paid… and the
          screen flips the label».

          ⚠️ **وثلاثُ حالاتٍ لا اثنتان:** `paymentChoiceOf` تُرجع `''` لمبلغٍ
          موجبٍ بلا طريقةٍ صالحة، **وقراءتُها «على الحساب» تجعل الشاشةَ تدّعي
          اختيارًا لم يقع** (`documentMoney.js:47-49`). والقيدُ يسمح بها
          مخزَّنةً (`paid_amount > 0` مع `payment_method = null`). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {choice === ON_ACCOUNT ? (
          <span>{t('products:returnSupplier.payment_on_account')}</span>
        ) : (
          <>
            <span>
              <span className="text-muted-foreground">{t('products:returnSupplier.paidLabel')}: </span>
              {t('products:documents.money', {
                total: paid.toLocaleString('ar', { maximumFractionDigits: 2 }),
              })}
            </span>
            <span>
              <span className="text-muted-foreground">{t('products:returnSupplier.paymentLabel')}: </span>
              {choice === '' ? '—' : t(`products:docs.paymentMethod_${choice}`)}
            </span>
          </>
        )}
        {doc.note && (
          <span>
            <span className="text-muted-foreground">{t('products:returnSupplier.noteLabel')}: </span>
            {doc.note}
          </span>
        )}
      </div>
    </div>
  )
}

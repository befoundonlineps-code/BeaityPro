import { Fragment } from 'react'
import { useTranslation } from 'next-i18next'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow } from '../ref/RefGrid'
import { movementsOf, movementFrames } from '../../lib/stockDocumentList'
import { numberOrNull, roundToPlaces } from '../../lib/decimalPlaces'

// مستندُ توريدٍ مرحَّلٌ يُقرأ **بشكل شاشته هي**، للقراءة فقط.
//
// 🔴 **رسمٌ ساكنٌ بالبناء، لا شاشةُ إدخالٍ معطَّلة:** ٠٩٤ج سحب `UPDATE` عن
// `stock_documents`، **فزرُّ إرسالٍ منسيٌّ لا يُرفَض كتعديل** — يُدرج مستندًا
// جديدًا بالكامل عبر `INSERT`. ⇒ **مستندٌ شبحيٌّ بحركاتٍ حقيقيّة.**
// **و`disabled` خاصّيّةٌ تُنسى؛ والعنصرُ غيرُ الموجودِ لا يُنسى.**
//
// ══════════════════════════════════════════════════════════════════
// 🔴 عمودُ المبلغ من `entered_unit_price` — قرارُ المالك (د/٤)، ومقيسٌ لماذا
// ══════════════════════════════════════════════════════════════════
//
// **شاشةُ إدخال التوريد لا تضرب في `unit_cost` إطلاقًا:**
//
//     orderGrid.js:85  amountOf  ⟵  العبواتُ × سعرِ العبوة
//
// و«تكلفة العبوة» هي `entered_unit_price` بعينها — `050b:18` بالنصّ: «per
// ENTERED unit — per package if that is the entered uom». ⇒ **فهذا الضربُ
// وحدَه يجعل العرضَ نسخةَ الإدخال، وهو شرطُ المالك.**
//
// ⚠️ **والبديلُ كان سيكذب مرّتين:** `unit_cost` على حركة التوريد **مشتقٌّ من**
// `entered_unit_price ÷ units_per_package` بأربع منازل — **وهو منبعُ
// `100.0005` نفسِه** (`stockDocumentList.js:92-105`). فضربُه في `quantity_base`
// **يخالف رقمَ شاشة الإدخال ويحمل البقيّةَ معه.**
//
// ✅ **وهذا الضربُ بلا بقيّةٍ أصلًا:** الطرفان مكتوبان بيدِ إنسانٍ بدقّتهما
// الكاملة، **ولا تحويلَ وحداتٍ بينهما.**
//
// ══════════════════════════════════════════════════════════════════
// 🔴 ولا كتلةَ دفعٍ هنا — والغيابُ مقيسٌ لا منسيّ
// ══════════════════════════════════════════════════════════════════
//
//     REFERENCE_FORM_VIEWS = [orders, supply, write_off, return_to_supplier]
//                                                     (productsView.js:35)
//     ⇒ التوريدُ يرسم SupplyProductsScreen اليومَ لا StockDocumentScreen
//     ⇒ و`post()` فيها يرسل عشرةَ حقولٍ ليس فيها paidAmount ولا paymentMethod
//
// ⇒ **شاشةُ الإدخال بلا حقلِ دفعٍ إطلاقًا، فشاشةُ العرض بلا كتلةِ دفع** —
// بحكم شرط المالك حرفيًّا: «إن كانت شاشةُ الإدخال لا تعرضه فيُحذف من العرض».
//
// ⚠️ **والعمودان `paid_amount` و`payment_method` موجودان في القاعدة وقد يحملان
// قيمًا على مستنداتٍ قديمة** رُحّلت يومَ كان التوريدُ على الشاشة المشتركة.
// **وعرضُها كان سيُظهر رقمًا لا تعرضه أيُّ شاشةِ إدخالٍ اليوم.**
// **والإرجاعُ يفترق** — `ReturnToSupplierScreen:70` يملك الحقلين فعلًا.
//
// ══════════════════════════════════════════════════════════════════
// الأعمدةُ — خمسةٌ من ستّة
// ══════════════════════════════════════════════════════════════════
//
// ```
// الإدخال   المنتج · العبوات · الكمّيّة · الرصيد الحاليّ · تكلفة العبوة · المبلغ
// العرض     المنتج · العبوات · الكمّيّة ·       —        · تكلفة العبوة · المبلغ
// ```
//
// ❌ **«الرصيد الحاليّ» يسقط** — نفسُ سببِ سقوطه في الشطب: مفهومُ لحظةِ إدخال،
//    **وقراءتُه اليومَ تعطي رصيدَ اليوم لا رصيدَ الترحيل.**
//
// 🔴 **ولا «المجموع» في الذيل** — `orderGridTotal` جمعٌ عبر السطور، **وهو
// المحظورُ بعينه في د/١.** والخصمُ والنقلُ والملاحظةُ تبقى **كما كُتبت، بلا
// سلّمٍ محسوب.**
const COLUMNS = 5

export default function SupplyDocumentView({
  document: doc, movements, products, categories, storages, suppliers,
}) {
  const { t } = useTranslation(['products', 'common'])
  if (!doc) return null

  const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
  const nameIn = (list, id) => (id ? (list || []).find((x) => x && x.id === id)?.name || null : null)
  const supplierName = nameIn(suppliers, doc.supplier_id)
  // 🔴 **`storage_id` لا `to_storage_id`** — `supply` عندها `twoStorages: false`،
  // والحقلُ يُسمّى «إلى مستودع» في شاشة الإدخال ويُرسَل `storageId`.
  const storageName = nameIn(storages, doc.storage_id)
  const categoryName = (id) => (categories || []).find((c) => c && c.id === id)?.name || null

  // ⚠️ **والمجلّداتُ المختارةُ لا تُحفظ** (المواصفة ج/٢) — المستندُ يسجّل سطورَه
  // لا أيَّ مجلّدٍ اختير. **فالتجميعُ تحت تصنيفاتِ السطور الموجودة، ومجلّدٌ بلا
  // سطرٍ لا يظهر.**
  const supplyLines = movementsOf(movements, doc.id)

  const groups = []
  for (const line of supplyLines) {
    const product = productsById[line.product_id]
    const key = product ? product.category_id : null
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.lines.push({ line, product })
    else groups.push({ key, lines: [{ line, product }] })
  }

  const discount = numberOrNull(doc.discount_value)
  const transport = numberOrNull(doc.transport_amount)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* الرأسُ — محفوظاتٌ تُقرأ، بلا حقلٍ واحدٍ يُكتب. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>
          <span className="text-muted-foreground">{t('products:orders.supplierLabel')}: </span>
          {supplierName || '—'}
        </span>
        <span>
          <span className="text-muted-foreground">{t('products:supplyRef.toStorage')}: </span>
          {storageName || '—'}
        </span>
        {/* ⚠️ **`supplier_doc_number` لا `doc_number`** — «رقم الفاتورة» في شاشة
            الإدخال هو رقمُ ورقةِ المورّد، **ورقمُ المستند الداخليُّ يعرضه اللوحُ
            الحاوي أصلًا** فلا يُكرَّر. */}
        {doc.supplier_doc_number && (
          <span>
            <span className="text-muted-foreground">{t('products:orders.invoiceLabel')}: </span>
            {doc.supplier_doc_number}
          </span>
        )}
        <span>
          <span className="text-muted-foreground">{t('products:docs.dateLabel')}: </span>
          {String(doc.doc_date || '').slice(0, 10) || '—'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto border border-[var(--rule)]">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh>{t('products:orders.productColumn')}</RefTh>
              <RefTh>{t('products:orders.packagesColumn')}</RefTh>
              <RefTh>{t('products:orders.numberColumn')}</RefTh>
              <RefTh>{t('products:supplyRef.unitCostColumn')}</RefTh>
              <RefTh>{t('products:orders.amountColumn')}</RefTh>
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
                  // 🔴 **السعرُ المحفوظُ حرفيًّا** — `entered_unit_price` للعبوة.
                  // ⚠️ **والعدمُ يبقى عدمًا:** `numberOrNull` تفصل الغيابَ عن
                  // الصفر، **و`Number(null) === 0` كانت ستقول «وصلت مجّانًا».**
                  const price = numberOrNull(line.entered_unit_price)
                  // 🔴 **حسابٌ على نفس السطر — عمودان محفوظان** (الخيار ١)،
                  // **وهو بعينه ضربُ شاشة الإدخال** (`orderGrid.js:85`).
                  const amount = price === null || frames.entered === null
                    ? null
                    : roundToPlaces(frames.entered * price)
                  return (
                    <RefRow key={line.id} data-view-line={line.id}>
                      <RefTd>{product?.name || '—'}</RefTd>

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

                      <RefTd>
                        {price === null ? '—' : t('products:documents.money', {
                          total: price.toLocaleString('ar', { maximumFractionDigits: 4 }),
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
            {supplyLines.length === 0 && (
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

      {/* 🔴 **الذيلُ كما في شاشة الإدخال، ناقصًا «المجموع» وحدَه** — ذاك جمعٌ
          عبر السطور، وهو المحظورُ في د/١. **والباقي محفوظٌ يُسمّى لا يُحسَب.**
          ⚠️ **وما لم يُكتب لا يُرسَم**: خصمٌ غائبٌ ليس «خصمًا صفرًا». */}
      {(discount !== null || transport !== null || doc.note) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {discount !== null && (
            <span>
              <span className="text-muted-foreground">{t('products:supplyRef.discount')}: </span>
              {discount.toLocaleString('ar', { maximumFractionDigits: 2 })}
              {' '}
              {t(`products:docs.discountKind_${doc.discount_kind || 'amount'}`)}
            </span>
          )}
          {transport !== null && (
            <span>
              <span className="text-muted-foreground">{t('products:supplyRef.transport')}: </span>
              {t('products:documents.money', {
                total: transport.toLocaleString('ar', { maximumFractionDigits: 2 }),
              })}
              {doc.transport_paid_to && (
                <span className="text-muted-foreground">
                  {' · '}
                  {t(`products:docs.transportPaidTo_${doc.transport_paid_to}`)}
                </span>
              )}
            </span>
          )}
          {doc.note && (
            <span>
              <span className="text-muted-foreground">{t('products:docs.noteLabel')}: </span>
              {doc.note}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

import { Fragment } from 'react'
import { useTranslation } from 'next-i18next'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from '../ref/RefGrid'
import { movementsOf, movementFrames, costFrames } from '../../lib/stockDocumentList'
import { roundToPlaces } from '../../lib/decimalPlaces'

// مستندُ شطبٍ مرحَّلٌ يُقرأ **بشكل شاشته هي**، للقراءة فقط.
//
// 🔴 **رسمٌ ساكنٌ بالبناء، لا شاشةُ إدخالٍ معطَّلة:** ٠٩٤ج سحب `UPDATE` عن
// `stock_documents`، **فزرُّ إرسالٍ منسيٌّ لا يُرفَض كتعديل** — يُدرج مستندًا
// جديدًا بالكامل عبر `INSERT`. ⇒ **مستندٌ شبحيٌّ بحركاتٍ حقيقيّة.**
// **و`disabled` خاصّيّةٌ تُنسى؛ والعنصرُ غيرُ الموجودِ لا يُنسى.**
//
// ══════════════════════════════════════════════════════════════════
// الأعمدةُ — مطابقةٌ لشاشة الإدخال، بثلاثة فوارقَ كلٌّ منها بسبب
// ══════════════════════════════════════════════════════════════════
//
// ```
// الإدخال   المنتج · العبوات · العدد · المتوفر · الدفعة · المبلغ
// العرض     المنتج · العبوات · العدد ·   —    · الدفعة · المبلغ
// ```
//
// ❌ **«المتوفر» يسقط** — مفهومُ لحظةِ إدخالٍ («كم باقٍ الآن»)، **ومستندٌ
//    مرحَّلٌ لا يحمله**، وقراءتُه اليومَ تعطي رصيدَ اليوم لا رصيدَ الترحيل.
// ✅ **«الدفعة» نصٌّ ثابتٌ بدل قائمة** — و`lot_id` محفوظٌ على الحركة.
//    ⚠️ **وتكلفةُ الوحدة تجلس معها** لأنها هي ما تشرحها: دفعتان لمنتجٍ واحدٍ
//    بسعرين مختلفين، **وهو سببُ وجود الدفعات أصلًا** (د/٣).
// ✅ **«المبلغ» يُحسب** — `quantity_base × unit_cost`، **عمودان محفوظان على
//    نفس السطر** (الخيار ١). ⚠️ **ولا مجموعَ ولا خصمَ ولا صافيَ على مستوى
//    المستند** — تلك تحتاج جمعًا عبر السطور، وهي الممنوعة.
const COLUMNS = 5

export default function WriteOffDocumentView({ document: doc, movements, products, categories, lots }) {
  const { t } = useTranslation(['products', 'common'])
  if (!doc) return null

  const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
  const lotsById = Object.fromEntries((lots || []).map((l) => [l.id, l]))
  const categoryName = (id) => (categories || []).find((c) => c && c.id === id)?.name || null

  // حركةٌ لكلّ دفعة بعد ٠٩٥ — **مجموعةً تحت تصنيف منتجها.**
  // ⚠️ **والمجلّداتُ المختارةُ لا تُحفظ** (المواصفة ج/٢)، فالتجميعُ تحت
  // تصنيفاتِ السطور الموجودة، **ومجلّدٌ بلا سطرٍ لا يظهر.**
  const writeOffLines = movementsOf(movements, doc.id)

  const groups = []
  for (const line of writeOffLines) {
    const product = productsById[line.product_id]
    const key = product ? product.category_id : null
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.lines.push({ line, product })
    else groups.push({ key, lines: [{ line, product }] })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* الرأسُ — محفوظاتٌ تُقرأ، بلا حقلٍ واحدٍ يُكتب. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {doc.doc_number && (
          <span>
            <span className="text-muted-foreground">{t('products:writeOff.docNumberLabel')}: </span>
            {doc.doc_number}
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
              <RefTh>{t('products:writeOff.productColumn')}</RefTh>
              <RefTh>{t('products:writeOff.packagesColumn')}</RefTh>
              <RefTh>{t('products:writeOff.numberColumn')}</RefTh>
              <RefTh>{t('products:writeOff.lotColumn')}</RefTh>
              <RefTh>{t('products:writeOff.amountColumn')}</RefTh>
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
                  const cost = costFrames(line, product)
                  const lot = lotsById[line.lot_id]
                  // 🔴 **حسابٌ على نفس السطر — عمودان محفوظان** (الخيار ١).
                  // ⚠️ **و`costFrames` تُرجع عدمًا حين لا سعرَ مختوم**، فيبقى
                  // المبلغُ عدمًا ولا يصير صفرًا.
                  const amount = cost === null ? null : roundToPlaces(frames.base * cost.base)
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

                      {/* 🔴 **الدفعةُ وسعرُها معًا** — وهي ما تشرح `unit_cost`
                          المختوم: سطران لمنتجٍ واحدٍ بسعرين، والدفعةُ وحدَها
                          تفرّقهما (د/٣).
                          ⚠️ **وصفرٌ مختومٌ رقمٌ حقيقيٌّ لا فراغ** — وهو ما حمله
                          المستندان المعطوبان. */}
                      <RefTd>
                        <span className="flex flex-wrap items-center gap-1">
                          {lot ? <RefTag>{String(lot.received_at || '').slice(0, 10)}</RefTag> : '—'}
                          {cost !== null && (
                            <span className="text-muted-foreground">
                              {t('products:documents.unitCost', {
                                unit: t(`products:units.${cost.baseUnit || 'pcs'}`),
                                price: cost.base.toLocaleString('ar', { maximumFractionDigits: 4 }),
                              })}
                            </span>
                          )}
                        </span>
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
            {writeOffLines.length === 0 && (
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

      {/* ⚠️ **والملاحظةُ أسفل الجدول كما في شاشة الإدخال.** */}
      {doc.note && (
        <p className="text-xs">
          <span className="text-muted-foreground">{t('products:docs.noteLabel')}: </span>
          {doc.note}
        </p>
      )}
    </div>
  )
}

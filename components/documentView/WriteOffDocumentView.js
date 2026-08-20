import { Fragment } from 'react'
import { useTranslation } from 'next-i18next'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from '../ref/RefGrid'
import { movementsOf, movementFrames, costFrames } from '../../lib/stockDocumentList'

// مستندُ شطبٍ مرحَّلٌ يُقرأ بشكل شاشته — **رسمٌ ساكنٌ بالبناء.**
//
// 🔴 **والدفعاتُ مفصَّلةٌ بقرار المالك (د/٣):** الشطبُ يُقسَّم حركةً لكلّ دفعة
// بعد ٠٩٥، و`lot_id` محفوظٌ على الحركة. **وهي ما تشرح `unit_cost` المختوم** —
// وطيُّها يعيد السؤالَ «من وين إجا هالسعر؟» الذي بُنيت الدفعاتُ للإجابة عنه.
//
// ⚠️ **ولا رقمَ لم يُكتب (د/١):** لا مجموعَ سطورٍ ولا إجماليَّ مستند —
// `unit_cost` و`quantity_base` محفوظان ويُعرضان، **وحاصلُ ضربهما لا.**
const COLUMNS = 4

export default function WriteOffDocumentView({ document: doc, movements, products, categories, lots }) {
  const { t } = useTranslation(['products', 'common'])
  if (!doc) return null

  const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
  const lotsById = Object.fromEntries((lots || []).map((l) => [l.id, l]))
  const categoryName = (id) => (categories || []).find((c) => c && c.id === id)?.name || null

  // سطورُ الشطب — حركةٌ لكلّ دفعة، مجموعةً تحت تصنيف منتجها.
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>
          <span className="text-muted-foreground">{t('products:docs.dateLabel')}: </span>
          {String(doc.doc_date || '').slice(0, 10) || '—'}
        </span>
        {doc.doc_number && (
          <span>
            <span className="text-muted-foreground">{t('products:documents.colNumber')}: </span>
            {doc.doc_number}
          </span>
        )}
        {doc.note && (
          <span>
            <span className="text-muted-foreground">{t('products:docs.noteLabel')}: </span>
            {doc.note}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto border border-[var(--rule)]">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh>{t('products:orders.productColumn')}</RefTh>
              <RefTh>{t('products:documents.colDate')}</RefTh>
              <RefTh>{t('products:orders.quantityColumn')}</RefTh>
              <RefTh>{t('products:docs.unitCostLabel')}</RefTh>
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
                  return (
                    <RefRow key={line.id} data-view-line={line.id}>
                      <RefTd>
                        {product?.name || '—'}
                        {/* 🔴 **الدفعةُ مسمّاةٌ بتاريخ استلامها** — وهي ما يفرّق
                            سطرين لنفس المنتج بسعرين مختلفين. */}
                        {lot && <RefTag>{String(lot.received_at || '').slice(0, 10)}</RefTag>}
                      </RefTd>
                      <RefTd>{String(lot?.received_at || '').slice(0, 10) || '—'}</RefTd>
                      <RefTd>
                        {t('products:documents.inBase', {
                          unit: t(`products:units.${frames.baseUnit || 'pcs'}`), n: frames.base,
                        })}
                      </RefTd>
                      <RefTd>
                        {/* ⚠️ **صفرٌ مختومٌ رقمٌ حقيقيٌّ هنا لا فراغ** — وهو ما
                            حمله المستندان المعطوبان. */}
                        {cost === null ? '—' : t('products:documents.money', {
                          total: cost.base.toLocaleString('ar', { maximumFractionDigits: 4 }),
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
    </div>
  )
}

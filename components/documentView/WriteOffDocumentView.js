import { Fragment } from 'react'
import { useTranslation } from 'next-i18next'
import { Search, FileSpreadsheet, FileInput } from 'lucide-react'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from '../ref/RefGrid'
import {
  StaticField, StaticSelect, StaticArea,
  StaticActionButton, StaticCancelButton, StaticShellButton,
} from '../ref/RefStatic'
import { movementsOf, movementFrames, costFrames } from '../../lib/stockDocumentList'
import { lotsForLine, availableForWriteOff } from '../../lib/lotPicker'
import { roundToPlaces } from '../../lib/decimalPlaces'

// «شطب بضاعة» — **مشاهدةً.** صورةُ شاشة الإنشاء نفسِها، منزوعةَ الوظيفة.
//
// ══════════════════════════════════════════════════════════════════
// 🔴 المعيار، بلفظ المالك — ولا يقبل تفسيرًا ثانيًا
// ══════════════════════════════════════════════════════════════════
//
// «شاشةُ العرض = نفسُ شاشة الإنشاء بصريًّا بالحرف — نفسُ الرأس، نفسُ الجدول،
// نفسُ الذيل، نفسُ الترتيب — **وكلُّ عنصرٍ تفاعليٍّ يُستبدل بنصٍّ ثابت**.»
//
// ⚠️ **وهذا هدمٌ لما قبله لا زيادةٌ عليه:** النسخةُ السابقةُ أسقطت «المتوفر»
// و«المجموع» وصفَّ البحثِ والأزرارَ **لأنها مفاهيمُ لحظةِ إدخال** — **وذلك
// صحيحٌ عن المعنى وخاطئٌ عن الطلب.** المطلوبُ صورةٌ، **والصورةُ تشمل ما لا
// يعني شيئًا للمستند.**
//
// ══════════════════════════════════════════════════════════════════
// 🔴 ولا زرَّ واحدًا يعمل — «ديكورٌ بلا `onClick` بتاتًا، بلا استثناء»
// ══════════════════════════════════════════════════════════════════
//
// **وزرُّ «شطب» `<span>` لا `<button>` بالمطلق** — ٠٩٤ج سحب `UPDATE` عن
// `stock_documents`، **فزرُّ إرسالٍ منسيٌّ لا يُرفَض كتعديل**: يُدرج مستندًا
// جديدًا بالكامل عبر `INSERT`. ⇒ **مستندٌ شبحيٌّ بحركاتٍ حقيقيّة.**
//
// **والبدائلُ الساكنةُ في `components/ref/RefStatic.js`** — موضعٌ واحدٌ تقرؤه
// الأربع، **ومحروسٌ بالاسم** في `viewScreensAreInert` لأنه خارجُ مجلّد الشاشات
// وهنّ يستوردنه.
//
// ══════════════════════════════════════════════════════════════════
// الأعمدةُ الستّة — **بنفس الترتيب وبنفس العروض**
// ══════════════════════════════════════════════════════════════════
//
// ```
// المنتج · العبوات(w-24) · العدد(w-28) · المتوفر(w-32) · الدفعة(w-64) · المبلغ(w-28)
// ```
//
// ✅ **و«المتوفر» رصيدُ اليوم** — بقرار المالك صراحةً: «كما في شاشة الإنشاء».
//    ⚠️ **وهو ادّعاءٌ عن الحاضر على سطرٍ ماضٍ**، مقروءٌ من الدفعات لا من
//    المستند، **ويُقال هنا لأنه لا يُقرأ من الشاشة.**
//
// ✅ **و«المبلغ» من `unit_cost` المختوم** — لأن شاشةَ الإنشاء تضرب في ثمن
//    الدفعة (`writeOffGrid.js:32`)، **وشرطُ المالك أن يطابقها.**
//
// 🔴 **و«المجموع» هو الموضعُ الوحيدُ الذي يصطدم فيه أمران أقرّهما المالك:**
//    «نفسُ الذيل» تطلبه، **و د/١ تحظر «أيَّ رقمٍ لم يُكتب حرفيًّا: إجماليٌّ ·
//    مجموعُ سطور».** ⇒ **يُرسَم موضعُه وتسميتُه، وقيمتُه «—»** — فلا يختلّ
//    التخطيطُ ولا يُحسَب محظور. **والقرارُ يُعرض ولا يُبتلع.**
const COLUMNS = 6

export default function WriteOffDocumentView({
  document: doc, movements, products, categories, lots,
}) {
  const { t } = useTranslation(['products', 'common'])
  if (!doc) return null

  const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
  const lotsById = Object.fromEntries((lots || []).map((l) => [l.id, l]))
  const categoriesById = Object.fromEntries((categories || []).map((c) => [c.id, c]))

  // 🔴 **سطورُ المستند وحدَها** — قرارُ المالك، ورفضُ البديل بلفظه: عرضُ كلّ
  // منتجات المستودع «يوهم بوجود اختيارٍ لم يُسجَّل».
  //
  // ⚠️ **وهو ليس تفضيلًا: المجلّداتُ المؤشَّرةُ لم تُحفظ قطّ** — `stock_documents`
  // بلا عمودِ مجلّدات (مقيسٌ في ١٠٢)، و`writeOffGrid.js:85` يبني الصفوفَ من
  // حالةِ الشاشة. ⇒ **«نفسُ الصفوف» غيرُ قابلٍ للاسترجاع أصلًا.**
  const writeOffLines = movementsOf(movements, doc.id)

  // سلسلةُ المجلّدات من الجذر إلى مجلّد المنتج — **كما ترسمها شاشةُ الإنشاء
  // مستوًى فوق مستوى**، لا سطرًا واحدًا.
  const chainOf = (categoryId) => {
    const chain = []
    let node = categoriesById[categoryId]
    // ⚠️ **حدٌّ أعلى للحلقة** — دورةٌ في `parent_id` تعلّق الصفحةَ بلا رسالة،
    // **وتعليقٌ متزامنٌ يُقرأ جهازًا بطيئًا لا عطلًا** (`CLAUDE.md`).
    let guard = 0
    while (node && guard < 32) { chain.unshift(node); node = categoriesById[node.parent_id]; guard += 1 }
    return chain
  }

  // ⚠️ **يُحسب مرّةً لكلّ منتجٍ لا مرّةً لكلّ سطر:** بعد ٠٩٥ ينقسم المنتجُ
  // الواحدُ إلى حركةٍ لكلّ دفعة، **و`lotsForLine` تمشي كلَّ الحركات في كلّ
  // نداء** — فمنتجٌ بثلاث دفعاتٍ يمشيها ثلاثًا بلا سبب.
  const lotRowsCache = new Map()
  const lotRowsFor = (productId) => {
    if (!lotRowsCache.has(productId)) {
      lotRowsCache.set(productId, lotsForLine({
        lots, movements, storageId: doc.storage_id, productId,
      }))
    }
    return lotRowsCache.get(productId)
  }

  // تجميعٌ بترتيب السطور كما حُفظت، بلا فرزٍ يُخترع.
  const groups = []
  for (const line of writeOffLines) {
    const product = productsById[line.product_id]
    const key = product ? product.category_id : null
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.lines.push({ line, product })
    else groups.push({ key, lines: [{ line, product }] })
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* ══ الرأسُ — نفسُ ترتيب شاشة الإنشاء وحقلاها ══ */}
      <div className="flex flex-wrap items-end gap-3">
        <span className="flex items-center gap-1.5 text-xs">
          {t('products:writeOff.docNumberLabel')}
          <StaticField>{doc.doc_number || ''}</StaticField>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          {t('products:writeOff.fromLabel')}
          {/* ⚠️ **بعرض منتقي التاريخ لا بعرض النصّ** — صندوقٌ ينكمش إلى
              «2026-08-20» يزحزح ما بعده، والرأسُ أوّلُ ما يُقارَن بالعين. */}
          <StaticField className="w-[9.5rem]">
            {String(doc.doc_date || '').slice(0, 10)}
          </StaticField>
        </span>
      </div>

      {/* ══ الجدولُ — نفسُ الأعمدة والعروض والارتفاع الأدنى ══ */}
      <div className="min-h-[240px] flex-1 overflow-auto border border-[var(--rule)]">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh>{t('products:writeOff.productColumn')}</RefTh>
              <RefTh className="w-24">{t('products:writeOff.packagesColumn')}</RefTh>
              <RefTh className="w-28">{t('products:writeOff.numberColumn')}</RefTh>
              <RefTh className="w-32">{t('products:writeOff.inStockColumn')}</RefTh>
              <RefTh className="w-64">{t('products:writeOff.lotColumn')}</RefTh>
              <RefTh className="w-28">{t('products:writeOff.amountColumn')}</RefTh>
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
                  const cost = costFrames(line, product)
                  const lot = lotsById[line.lot_id]
                  // «المتوفر» — رصيدُ اليوم من الدفعات، **بنفس دالّة شاشة
                  // الإنشاء** فلا يفترق الرقمان.
                  const lotRows = lotRowsFor(line.product_id)
                  const inStock = availableForWriteOff(lotRows)
                  const amount = cost === null ? null : roundToPlaces(frames.base * cost.base)
                  return (
                    <RefRow key={line.id} data-view-line={line.id}>
                      <RefTd>{product?.name || '—'}</RefTd>

                      {/* العبوات — خانةٌ ساكنةٌ وزرُّ «الكل» بجانبها، كما في الإنشاء. */}
                      <RefTd>
                        <span className="flex items-center gap-1">
                          <StaticField className="w-12">
                            {frames.entered === null ? '' : frames.entered}
                          </StaticField>
                          <StaticShellButton className="shrink-0 px-1.5 text-[11px]">
                            {t('products:writeOff.fillAll')}
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

                      {/* ══════════════════════════════════════════════════
                          🔴 الدفعةُ — **استلامٌ وسعرُ وحدة، بلا «متبقٍّ»**
                          ══════════════════════════════════════════════════

                          ⚠️ **ومفتاحٌ خاصٌّ بالعرض، لا مفتاحُ المنسدل.** كان
                          `writeOff.lotOption` — نصُّ خيارِ القائمة بأجزائه
                          الثلاثة — **فعاد «متبقٍّ» بعد أن أُسقط، ومرّ في تقريرٍ
                          قال إنه سقط.** والسببُ أن إعادةَ البناء «صورةً من شاشة
                          الإنشاء» نسخت نصَّ الخيار حرفيًّا، **وأعادت قرارًا كان
                          قد حُسم بلا أن يُقال.**

                          ❌ **و«متبقٍّ» مفهومُ لحظةِ اختيار** — متبقّي اليومَ لا
                             متبقّي الترحيل، **وهو لم يكن في تصميم الشطب أصلًا.**
                          ✅ **وسعرُ الوحدة يبقى** لأنه ما يشرح عمودَ المبلغ:
                             دفعتان لمنتجٍ واحدٍ بسعرين، والدفعةُ وحدَها تفرّقهما.

                          ⚠️ **والمفتاحُ في `documents` لا في `writeOff`** —
                          مفتاحُ المنسدل يخصّ شاشةَ الإنشاء ويبقى لها كما هو. */}
                      <RefTd>
                        <span className="flex items-center gap-1.5">
                          <StaticSelect>
                            {lot
                              ? t('products:documents.lotDateCost', {
                                date: String(lot.received_at || '').slice(0, 10),
                                cost: cost === null ? '—' : cost.base,
                              })
                              : t('products:writeOff.lotAuto')}
                          </StaticSelect>
                          {lot?.cost_is_estimated === true && (
                            <RefTag title={t('products:writeOff.estimatedHelp')}>
                              {t('products:writeOff.estimatedTag')}
                            </RefTag>
                          )}
                        </span>
                      </RefTd>

                      <RefTd>
                        {amount === null ? '—' : amount.toLocaleString('ar', { maximumFractionDigits: 2 })}
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

      {/* ══ صفُّ البحث والضابطان — نفسُ المواضع، بلا وظيفة ══ */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5">
          <Search className="size-3.5 text-muted-foreground" />
          <StaticField className="w-56 text-muted-foreground">
            {t('products:writeOff.searchPlaceholder')}
          </StaticField>
        </span>
        <StaticShellButton icon={FileInput}>{t('products:writeOff.enterLabel')}</StaticShellButton>
        <StaticShellButton icon={FileSpreadsheet}>{t('products:writeOff.excelLabel')}</StaticShellButton>
      </div>

      {/* ══ المجموعُ — موضعُه وتسميتُه، وقيمتُه «—» (اصطدامُ «نفسِ الذيل» بـد/١) ══ */}
      <div className="flex items-center gap-2 text-sm font-semibold">
        {t('products:writeOff.totalLabel')}
        <span data-view-total>—</span>
      </div>

      {/* ══ الملاحظاتُ — صندوقٌ ساكنٌ بارتفاع سطرين ══ */}
      <span className="flex flex-col gap-1 text-xs">
        {t('products:writeOff.noteLabel')}
        <StaticArea>{doc.note || ''}</StaticArea>
      </span>

      {/* ══ الأزرارُ الثلاثة — ديكورٌ بلا وظيفة، بنفس الترتيب ══ */}
      <div className="flex justify-end gap-2">
        <StaticCancelButton>{t('products:writeOff.backToFolders')}</StaticCancelButton>
        <StaticCancelButton>{t('products:writeOff.cancelButton')}</StaticCancelButton>
        <StaticActionButton>{t('products:writeOff.writeOffButton')}</StaticActionButton>
      </div>
    </div>
  )
}

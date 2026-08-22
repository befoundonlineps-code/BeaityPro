import { useTranslation } from 'next-i18next'
import { Search, FileSpreadsheet, FileInput } from 'lucide-react'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from '../ref/RefGrid'
import {
  StaticField, StaticSelect, StaticArea,
  StaticActionButton, StaticCancelButton, StaticShellButton,
} from '../ref/RefStatic'
import { movementsOf, movementFrames, costFrames } from '../../lib/stockDocumentList'
import { lotsForLine, availableForWriteOff } from '../../lib/lotPicker'
// 🔴 **سطورُ المستند مرجعًا وكتالوجُ اليوم حشوًا** — والحالةُ الحافّةُ فيه مختبَرة.
import { documentViewRows } from '../../lib/documentViewRows'
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
  document: doc, movements, products, categories, storageCategories, lots,
}) {
  const { t } = useTranslation(['products', 'common'])
  if (!doc) return null

  const lotsById = Object.fromEntries((lots || []).map((l) => [l.id, l]))

  // ══════════════════════════════════════════════════════════════════
  // 🔴 سطورُ المستند مرجعًا، وكتالوجُ اليوم حشوًا — **بهذا الترتيب**
  // ══════════════════════════════════════════════════════════════════
  //
  // **قرارُ المالك:** الشاشةُ تعرض كلَّ منتجات الكتالوج الحاليّ (نفسُ فئات
  // وحجم شاشة الإنشاء)، **والتي ليست في المستند تظهر صفوفًا خاملة.**
  //
  // ⚠️ **والبناءُ كلُّه في `documentViewRows`، ومعه اختبارُ الحالة الحافّة:**
  // منتجٌ شُطب من سنةٍ ثمّ أُرشِف أو حُذف أو فُكّ ربطُ مجلّده — **يخرج من
  // كتالوج اليوم وسطرُه باقٍ في `stock_movements` إلى الأبد.** ⇒ **يُرسم
  // تحت فئته الأصليّة إن حُلّت، وإلّا تحت مجموعةٍ احتياطيّةٍ مسمّاة.**
  const viewRows = documentViewRows({
    lines: movementsOf(movements, doc.id),
    products,
    categories,
    storageCategories,
    storageId: doc.storage_id,
  })

  // ⚠️ **يُحسب مرّةً لكلّ منتجٍ لا مرّةً لكلّ سطر:** بعد ٠٩٥ ينقسم المنتجُ
  // الواحدُ إلى حركةٍ لكلّ دفعة، **و`lotsForLine` تمشي كلَّ الحركات في كلّ
  // نداء** — فمنتجٌ بثلاث دفعاتٍ يمشيها ثلاثًا بلا سبب. **وصفوفُ الحشو تضاعف
  // العددَ الآن**، فالحسابُ مرّةً صار ألزم.
  const lotRowsCache = new Map()
  const lotRowsFor = (productId) => {
    if (!lotRowsCache.has(productId)) {
      lotRowsCache.set(productId, lotsForLine({
        lots, movements, storageId: doc.storage_id, productId,
      }))
    }
    return lotRowsCache.get(productId)
  }

  // وحدةُ المنتج الأساسيّة — تُقرأ للحشو كما تُقرأ للسطر.
  const unitOf = (product) => t(`products:units.${product?.base_unit || 'pcs'}`)

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
            {viewRows.map((row, ri) => {
              // ── صفُّ المجلّد ─────────────────────────────────────────
              if (row.kind === 'folder') {
                return (
                  <RefGroupRow key={`f-${row.id}-${ri}`} columns={COLUMNS} data-folder-row={row.id}>
                    <span className="flex items-center gap-2">
                      {/* 🔴 **مجموعةُ السطور الخارجةِ عن كتالوج اليوم** — اسمُها
                          مفتاحُ ترجمةٍ لا اسمُ مجلّد، لأنها ليست مجلّدًا.
                          ⚠️ **ولا يُخترع لها نمطٌ جديد** — صفُّ مجموعةٍ كغيره. */}
                      {row.name ?? t('products:documents.orphanFolder')}
                      {/* ⚠️ **«مجلد بلا أصناف» ادّعاءٌ عن الكتالوج لا عن المستند**،
                          فهو صادقٌ هنا كما هو صادقٌ في شاشة الإنشاء.
                          🔴 **و«مجموع العبوات» لا يُرسم** — جمعٌ عبر السطور،
                          محظورٌ بـد/١. */}
                      {row.childCount === 0 && (
                        <RefTag>{t('products:writeOff.folderEmpty')}</RefTag>
                      )}
                    </span>
                  </RefGroupRow>
                )
              }

              // ── صفُّ الحشو: منتجٌ من كتالوج اليوم ليس في هذا المستند ──
              //
              // 🔴 **كلُّ رقمٍ من المستند «—» لا «٠»**، بلفظ المالك: «"٠" توحي
              // إنه المنتج كان جزء من القرار بقيمة صفر، وهذا غير صحيح؛ "—" تعني
              // "مش جزء من هالمستند إطلاقاً"».
              //
              // ⚠️ **و«المتوفر» يبقى رقمًا حقيقيًّا وليس «—»، وهذا قراءةٌ تُعرض
              // لا تُبتلع:** هو رصيدُ اليوم من الدفعات — **حقيقةٌ عن المخزون لا
              // عن المستند** — **وشاشةُ الإنشاء ترسمه لكلّ صفّ** بما فيها ما لم
              // يُدخَل. **و«—» فيه تُخفي معلومةً صادقةً وتكسر تطابقَ الشكل.**
              if (row.kind === 'filler') {
                const rows2 = lotRowsFor(row.product.id)
                return (
                  <RefRow key={`x-${row.product.id}`} data-view-filler={row.product.id}>
                    <RefTd>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {row.product.name}
                        {/* ⚠️ **الوسمُ يقول الصادقَ لا «بلا رصيد»** — تلك جملةٌ
                            عن المخزون، **وقد يكون للمنتج رصيدٌ وافرٌ اليوم**؛
                            الصادقُ أنه ليس في هذا المستند. **والنمطُ نفسُه
                            (`RefTag`) لا نمطٌ جديد.** */}
                        <RefTag>{t('products:documents.notInDocument')}</RefTag>
                      </span>
                    </RefTd>
                    <RefTd>
                      <span className="flex items-center gap-1">
                        <StaticField className="w-12" />
                        <StaticShellButton className="shrink-0 px-1.5 text-[11px]">
                          {t('products:writeOff.fillAll')}
                        </StaticShellButton>
                      </span>
                    </RefTd>
                    <RefTd>—</RefTd>
                    <RefTd>
                      {t('products:orders.qtyWithUnit', {
                        n: availableForWriteOff(rows2), unit: unitOf(row.product),
                      })}
                    </RefTd>
                    <RefTd>—</RefTd>
                    <RefTd>—</RefTd>
                  </RefRow>
                )
              }

              // ── صفُّ المستند الحقيقيّ ───────────────────────────────
              const { line, product } = row
              const frames = movementFrames(line, product)
              const cost = costFrames(line, product)
              const lot = lotsById[line.lot_id]
              // «المتوفر» — رصيدُ اليوم من الدفعات، **بنفس دالّة شاشة الإنشاء**
              // فلا يفترق الرقمان.
              const inStock = availableForWriteOff(lotRowsFor(line.product_id))
              const amount = cost === null ? null : roundToPlaces(frames.base * cost.base)
              return (
                <RefRow key={line.id} data-view-line={line.id}>
                  {/* ⚠️ **الاسمُ قد يكون غيرَ محلولٍ** — منتجٌ حُذف من الكتالوج
                      وسطرُه باقٍ. **والشرطةُ هنا تعني «الاسمُ غيرُ معروف» لا
                      «لا منتج»**، والسطرُ نفسُه محفوظٌ بكلّ أرقامه. */}
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
                      `writeOff.lotOption` بأجزائه الثلاثة، **فعاد «متبقٍّ» بعد
                      أن أُسقط، ومرّ في تقريرٍ قال إنه سقط.**

                      ❌ **و«متبقٍّ» مفهومُ لحظةِ اختيار** — متبقّي اليومَ لا
                         متبقّي الترحيل، **ولم يكن في تصميم الشطب أصلًا.**
                      ✅ **وسعرُ الوحدة يبقى** لأنه ما يشرح عمودَ المبلغ. */}
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
            {viewRows.length === 0 && (
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

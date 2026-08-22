import { useMemo, useState } from 'react'
import { useTranslation } from 'next-i18next'
import { Search } from 'lucide-react'
import { stocktakeTableRows, COST_STATE } from '../lib/stocktakeTableRows'
import { previousStocktakeAt, PERIOD_COLUMNS } from '../lib/stocktakePeriod'
import {
  remainingTotal, differenceBase, differenceAtCost,
  differencePackages, differenceAtRetail,
} from '../lib/stocktakeMoney'
import { numberOrNull, roundToPlaces } from '../lib/decimalPlaces'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefTag } from './ref/RefGrid'
import { RefCancelButton } from './ref/RefModal'
import NumberField from '@/components/ui/NumberField'
import { Input } from '@/components/ui/input'
import LtrNumber from './LtrNumber'

// جدولُ حركة الفترة — شكلُ الشاشة المرجعيّة بألوان ثيمنا.
//
// **وهذا الملفُّ يرسم ولا يحسب:** الحركةُ في `lib/stocktakePeriod.js`،
// والمالُ في `lib/stocktakeMoney.js`، والصفوفُ في `lib/stocktakeTableRows.js`.
//
// 🔴 **وعمودُ «أخرى» ليس في المرجع، وهو انحرافٌ مقصودٌ مُعلَن:** أنواعُ حركاتنا
// تسعٌ وأعمدةُ المرجع تغطّي أربعًا، و`post_stocktake_session` تحسب النظريَّ من
// **كلّ** الحركات. **فبدونه يقول الجدولُ رقمًا وتقول الدالّةُ رقمًا آخر على
// نفس السطر، بصمت** — والموظّفةُ تجمع ما تراه فلا تصل إلى «المتوقَّع» فتظنّ
// عدَّها خطأ. ⇒ **المطابقةُ الشكليّةُ بدونه كذبٌ حسابيّ.**

const FIELD = 'h-7 rounded-none border border-[var(--rule)] bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring'
// ستّةَ عشرَ عمودًا: خمسةَ عشرَ من المرجع، و«أخرى» انحرافُنا المُعلَن.
//
// 🔴 **والمرجعُ يسمّي عمودَين `Price per unit`** — أحدهما ٣٨ (تكلفة) والآخرُ
// ٨٠ (بيع). **وعندنا اسمان مختلفان، ولكلٍّ حبّتُه:** «تكلفة {{الوحدة}}» للقطعة،
// و«سعر البيع للعبوة» للعبوة. **ولا يجوز أن يحملا اسمًا واحدًا** — قاعدةُ
// المخزون الأولى.
const COLUMNS = 16
const NONE = '—'

const cash = (n) => (n === null ? NONE : n.toLocaleString('ar', { maximumFractionDigits: 2 }))


// ⚠️ **الوحدةُ قبل الرقم** — «١ عبوة» و«٢ عبوتان» و«٥ عبوات» فرعٌ نحويٌّ
// رفضناه، فالرقمُ يأتي بعد نقطتين ولا يحكمه إعراب.
function packagesLabel(t, value) {
  if (value === null) return NONE
  return `${t('products:stocktakePeriod.packagesTag')}: ${value.toLocaleString('ar', { maximumFractionDigits: 2 })}`
}

export default function StocktakingSheet({
  products, categories, storageCategories, balances, movements, documents,
  storageId, storageName, loading, error, onClose,
}) {
  const { t } = useTranslation(['products', 'common'])
  const [counts, setCounts] = useState({})
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')

  const since = useMemo(
    () => previousStocktakeAt(documents, storageId),
    [documents, storageId],
  )

  const { rows } = useMemo(() => stocktakeTableRows({
    categories, storageCategories, storageId, products, balances, movements, documents, since, counts,
  }), [categories, storageCategories, storageId, products, balances, movements, documents, since, counts])

  // ⚠️ **البحثُ يخفي السطورَ ولا يخفي مجلّداتِها** — مجلّدٌ يختفي بصمتٍ يجعل
  // العادَّةَ تبحث عن رفٍّ لا تجده، **وصفٌّ يقول «فارغ» خبرٌ واختفاؤه لغز.**
  const needle = search.trim().toLowerCase()
  const visible = needle === ''
    ? rows
    : rows.filter((row) => row.kind === 'folder'
      || String(row.product.name || '').toLowerCase().includes(needle))

  // مجموعُ قيمة المتوفّر — **جمعُ ما رُسم، لا حسابٌ ثانٍ.**
  //
  // 🔴 **ولا سطرَ معدودًا ⟵ «—» لا صفر.** أوّلُ لقطةٍ رسمت «المجموع: ٠» على
  // شاشةٍ **لم يُعدَّ فيها شيءٌ بعد** — وهي جملةٌ عن مالٍ لا نعرفه، لا عن
  // مالٍ يساوي صفرًا. **وهو البندُ (أ) في `CLAUDE.md` بلبوس مجموع.**
  const counted = visible.filter((row) => row.kind === 'line'
    && remainingTotal({ factBase: row.fact, cost: row.cost }) !== null)
  const total = counted.length === 0 ? null : roundToPlaces(counted.reduce(
    (sum, row) => sum + remainingTotal({ factBase: row.fact, cost: row.cost }), 0,
  ))

  if (loading) return <p className="p-4 text-sm text-muted-foreground">{t('common:loading')}</p>
  if (error) {
    return (
      <div className="m-4 border border-destructive/40 bg-destructive/10 p-3 text-sm">
        {String(error.message || error)}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2" data-stocktaking-sheet={storageId}>
      {/* ── الترويسة ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--rule)] pb-2">
        <h2 className="text-sm font-medium">
          {t('products:stocktakePeriod.title', { storage: storageName || '' })}
        </h2>
        {/* 🔴 **ولا جردَ سابقًا يُقال نصًّا** — ترويسةٌ فارغةٌ تُقرأ عطلًا. */}
        <span className="text-xs text-muted-foreground">
          {since
            ? <>{t('products:stocktakePeriod.sincePrevious', { date: '' })}<LtrNumber>{String(since).slice(0, 10)}</LtrNumber></>
            : t('products:stocktakePeriod.sinceNone')}
        </span>
        <span className="relative ms-auto">
          <Search className="pointer-events-none absolute inset-y-0 my-auto size-3.5 text-muted-foreground" style={{ insetInlineStart: '0.5rem' }} />
          <Input
            className="h-7 w-64 rounded-none ps-7 text-xs"
            placeholder={t('products:stocktakePeriod.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </span>
      </div>

      {/* ── الجدول ───────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh className="w-24">{t('products:stocktakePeriod.colAbbrev')}</RefTh>
              <RefTh>{t('products:stocktakePeriod.colProduct')}</RefTh>
              <RefTh className="w-24">{t('products:stocktakePeriod.colBegin')}</RefTh>
              <RefTh className="w-20">{t('products:stocktakePeriod.colIncoming')}</RefTh>
              <RefTh className="w-20">{t('products:stocktakePeriod.colMove')}</RefTh>
              <RefTh className="w-20">{t('products:stocktakePeriod.colWriteOff')}</RefTh>
              <RefTh className="w-24">{t('products:stocktakePeriod.colReturn')}</RefTh>
              <RefTh className="w-20">{t('products:stocktakePeriod.colOther')}</RefTh>
              <RefTh className="w-24">{t('products:stocktakePeriod.colExpensePlan')}</RefTh>
              <RefTh className="w-28">{t('products:stocktakePeriod.colFact')}</RefTh>
              <RefTh className="w-28">{t('products:stocktakePeriod.colRemaining')}</RefTh>
              <RefTh className="w-28">{t('products:stocktakePeriod.colDifference')}</RefTh>
              <RefTh className="w-28">{t('products:stocktakePeriod.colDiffAtCost')}</RefTh>
              {/* ⚠️ **الترويسةُ تسمّي الحبّةَ ولا تسمّي وحدةَ منتجٍ بعينه** —
                  الجدولُ متعدّدُ المنتجات، ووحداتُها تختلف. **والوحدةُ لكلّ
                  سطرٍ مطبوعةٌ في عمود الفرق** (`القطعة: -2`)، فلا رقمَ بلا
                  وحدته أمام إنسان. */}
              <RefTh className="w-32">{t('products:stocktakePeriod.colCostPerUnit')}</RefTh>
              <RefTh className="w-32">{t('products:stocktakePeriod.colDiffAtRetail')}</RefTh>
              <RefTh className="w-28">{t('products:stocktakePeriod.colRetailPrice')}</RefTh>
            </tr>
          </RefHead>
          <tbody>
            {visible.map((row) => {
              if (row.kind === 'folder') {
                return (
                  <RefGroupRow key={`f-${row.id}`} columns={COLUMNS} data-folder-row={row.id}>
                    {row.name}
                  </RefGroupRow>
                )
              }

              const { product, movement, plan, cost, costState, fact } = row
              const unit = t(`products:units.${product.base_unit || 'pcs'}`)
              const difference = differenceBase({ factBase: fact, planBase: plan })
              const packages = differencePackages({ difference, product })

              return (
                <RefRow key={product.id} data-stocktake-line={product.id}>
                  <RefTd>{product.abbreviation || NONE}</RefTd>
                  <RefTd>{product.name}</RefTd>

                  {/* الحركةُ — والصفرُ هنا مقيسٌ لا مجهول، فيُرسم رقمًا. */}
                  <RefTd><LtrNumber>{movement ? movement.begin : 0}</LtrNumber></RefTd>
                  {PERIOD_COLUMNS.map((key) => (
                    <RefTd key={key}>
                      <span className="flex items-center gap-1">
                        <LtrNumber>{movement ? movement[key] : 0}</LtrNumber>
                        {key === 'other' && movement && movement.other !== 0 && (
                          <RefTag title={t('products:stocktakePeriod.otherHelp')}>
                            {t('products:stocktakePeriod.otherTag')}
                          </RefTag>
                        )}
                      </span>
                    </RefTd>
                  ))}

                  {/* ⏸ **«المنصرف (خطة)» — مصدرُه غيرُ مقيس، فلا رقمَ فيه.**
                      **والوسمُ يقول ذلك**، ولا يُترك فراغًا يُقرأ صفرًا. */}
                  <RefTd>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      {NONE}
                      <RefTag title={t('products:stocktakePeriod.expensePlanHelp')}>
                        {t('products:stocktakePeriod.expensePlanTag')}
                      </RefTag>
                    </span>
                  </RefTd>

                  {/* الفعليُّ — الخانةُ الوحيدةُ التي يكتبها إنسان. */}
                  <RefTd write>
                    <NumberField
                      min="0"
                      step="1"
                      className={FIELD}
                      data-count-for={product.id}
                      value={fact}
                      onChange={(e) => setCounts((prev) => ({ ...prev, [product.id]: e.target.value }))}
                    />
                  </RefTd>

                  <RefTd><LtrNumber>{cash(remainingTotal({ factBase: fact, cost }))}</LtrNumber></RefTd>
                  <RefTd>
                    {difference === null ? NONE : <>{unit}: <LtrNumber>{difference}</LtrNumber></>}
                  </RefTd>
                  <RefTd><LtrNumber>{cash(differenceAtCost({ difference, cost }))}</LtrNumber></RefTd>

                  {/* ══════════════════════════════════════════════════
                      تكلفةُ الوحدة — **للقطعة**، وحالاتُها ثلاثٌ لا اثنتان
                      ══════════════════════════════════════════════════

                      🔴 **و«تقديريّ» و«ما تحرّك قطّ» ليستا واحدة:** الأولى تعني
                      **جرى حسابٌ واستُعمل بديل**، والثانية **لا معلومةَ
                      إطلاقًا** — ووسمٌ واحدٌ عليهما يقول لصاحب المحلّ إن حسابًا
                      جرى حيث لم يجرِ شيء. */}
                  <RefTd>
                    <span className="flex items-center gap-1">
                      <LtrNumber>{cash(cost)}</LtrNumber>
                      {costState === COST_STATE.ESTIMATED && (
                        <RefTag title={t('products:stocktakePeriod.costEstimatedHelp')}>
                          {t('products:stocktakePeriod.costEstimatedTag')}
                        </RefTag>
                      )}
                      {costState === COST_STATE.NO_BALANCE_HERE && (
                        <RefTag title={t('products:stocktakePeriod.costNoBalanceHelp')}>
                          {t('products:stocktakePeriod.costNoBalanceTag')}
                        </RefTag>
                      )}
                      {costState === COST_STATE.NEVER_MOVED && (
                        <RefTag title={t('products:stocktakePeriod.costNeverMovedHelp')}>
                          {t('products:stocktakePeriod.costNeverMovedTag')}
                        </RefTag>
                      )}
                    </span>
                  </RefTd>

                  {/* 🔴 **الفرقُ يمرّ بالعبوات قبل سعر البيع** — والرقمُ الكسريُّ
                      مقبولٌ بقرار المالك، **والشرحُ يُفتح عند الطلب.** */}
                  <RefTd>
                    <span className="flex items-center gap-1">
                      <LtrNumber>{cash(differenceAtRetail({ difference, product }))}</LtrNumber>
                      {packages !== null && packages !== 0 && (
                        <RefTag title={t('products:stocktakePeriod.packagesHelp')}>
                          {packagesLabel(t, packages)}
                        </RefTag>
                      )}
                    </span>
                  </RefTd>

                  {/* ⚠️ **سعرُ البيع للعبوة** — حبّةٌ أخرى، فاسمٌ آخر. */}
                  <RefTd><LtrNumber>{cash(numberOrNull(product.package_price))}</LtrNumber></RefTd>
                </RefRow>
              )
            })}

            {visible.filter((row) => row.kind === 'line').length === 0 && (
              <tr>
                <td colSpan={COLUMNS} className="py-3 text-center text-xs text-muted-foreground">
                  {t('products:stocktakePeriod.noProducts')}
                </td>
              </tr>
            )}

            {/* ══════════════════════════════════════════════════════
                صفُّ المجموع — Σ، **والرقمُ تحت عموده لا بجانب اسمه**
                ══════════════════════════════════════════════════════

                🔴 **مقيسٌ من لقطة المرجع:** `8,760.00` يقع تحت عمود
                `Remaining total` بعينه. **وكان عندي في صفٍّ ممتدٍّ بجوار
                كلمة «المجموع»** — فيصير رقمًا بلا عمود، **والقارئُ يبحث عمّا
                يجمعه.** والعمودُ هو ما يقول أيَّ شيءٍ جُمع. */}
            <tr style={{ background: 'var(--group)' }} data-total-row="">
              <td
                colSpan={10}
                className="px-1.5 py-[1px] font-semibold"
                style={{ borderBottom: '1px solid var(--rule)' }}
              >
                <span className="flex items-center gap-3">
                  <span>Σ</span>
                  <span>{t('products:stocktakePeriod.totalRow')}</span>
                </span>
              </td>
              <td
                className="px-1.5 py-[1px] font-semibold"
                style={{ borderBottom: '1px solid var(--rule)' }}
                data-total-value=""
              >
                <LtrNumber>{cash(total)}</LtrNumber>
              </td>
              <td
                colSpan={COLUMNS - 11}
                className="px-1.5 py-[1px]"
                style={{ borderBottom: '1px solid var(--rule)' }}
              />
            </tr>
          </tbody>
        </RefTable>
      </div>

      {/* ── الذيل ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--rule)] pt-2">
        <label className="flex flex-1 items-center gap-2 text-xs">
          {t('products:stocktakePeriod.notesLabel')}
          <Input
            className="h-7 flex-1 rounded-none text-xs"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <RefCancelButton onClick={onClose}>
          {t('products:stocktakePeriod.cancel')}
        </RefCancelButton>

        {/* ══════════════════════════════════════════════════════════
            🔴 «حفظ الجرد» — **معطَّلٌ بالبنية لا بالسلوك**
            ══════════════════════════════════════════════════════════

            **`<span>` بلا معالِج حدثٍ إطلاقًا، لا `<button disabled>`.**
            وشرطٌ يُنسى يُعيد زرًّا مُعطَّلًا إلى الحياة؛ **ووسمٌ لا معالِجَ له
            لا يُنسى إلى الحياة.** وهو نفسُ أسلوب شاشات العرض.

            ⚠️ **والسببُ تشغيليٌّ لا تقنيّ:** ترحيلُ الجرد يكتب حركةَ تسويةٍ
            دائمة (`post_stocktake_session`)، **وقد يكتب غرامةً على موظّفة**
            (٠٥٦ج أدخل كتلةَ الغرامة داخل الدالّة) — **ولا يُستدرَك إلّا بعكس
            المستند.** والتفعيلُ قرارٌ منفصلٌ يُرفع للمالك. */}
        <span
          data-save-disabled=""
          className="inline-flex h-7 cursor-not-allowed items-center gap-2 border border-[var(--rule)] bg-[var(--group)] px-3 text-xs text-muted-foreground opacity-70"
          title={t('products:stocktakePeriod.saveDisabledHelp')}
        >
          {t('products:stocktakePeriod.save')}
          <RefTag>{t('products:stocktakePeriod.saveDisabledTag')}</RefTag>
        </span>
      </div>
    </div>
  )
}

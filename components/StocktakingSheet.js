import { useMemo, useState } from 'react'
import { useTranslation } from 'next-i18next'
import { Search, FileSpreadsheet } from 'lucide-react'
import { stocktakeTableRows, COST_STATE } from '../lib/stocktakeTableRows'
import { countUoms, countedInSession } from '../lib/stocktakeSheet'
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
  storageId, storageName, salonId, userId, loading, error, onClose, stocktake,
}) {
  const { t } = useTranslation(['products', 'common'])
  // 🔴 **العدُّ يعيش في الجلسة لا في هذه الشاشة** — والكائنُ يصل كاملًا
  // (الأرقامُ والأُطُرُ ودوالُّ كتابتها معًا)، **فلا يقدر منادٍ أن يعطي نصفَه.**
  const {
    counts = {}, uoms = {}, setCounts, setUoms, writeCount, discard,
    startedBy, startedAt, writeError,
  } = stocktake || {}
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  // ⚠️ **سؤالُ الرمي حالةٌ في الشاشة لا في الجلسة** — فإغلاقُ الورقة وفتحُها
  // من جديدٍ يعيده مغلقًا، وهو الصواب: نيّةُ الرمي لا تُستأنَف.
  const [discarding, setDiscarding] = useState(false)

  const since = useMemo(
    () => previousStocktakeAt(documents, storageId),
    [documents, storageId],
  )

  const { rows } = useMemo(() => stocktakeTableRows({
    categories, storageCategories, storageId, products, balances, movements, documents, since, counts, uoms,
  }), [categories, storageCategories, storageId, products, balances, movements, documents, since, counts, uoms])

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
    && remainingTotal({ factBase: row.factBase, cost: row.cost }) !== null)
  const total = counted.length === 0 ? null : roundToPlaces(counted.reduce(
    (sum, row) => sum + remainingTotal({ factBase: row.factBase, cost: row.cost }), 0,
  ))

  const lineCount = visible.filter((row) => row.kind === 'line').length

  // 🔴 **عددُ ما سيُرمى — من `counts` كلِّها، لا من `counted` أعلاه.**
  //
  // ⚠️ **والفرقُ ليس تفصيلًا، وهو خطأٌ كِدتُ أشحنه:** `counted` مبنيٌّ على
  // `visible` **فيتقلّص مع البحث**، ومشروطٌ بـ`remainingTotal !== null`
  // **فيُسقط كلَّ منتجٍ عُدّ وتكلفتُه غيرُ معروفة.** والرميُ يمحو الجلسةَ
  // كاملةً بلا نظرٍ إلى بحثٍ ولا إلى تكلفة.
  //
  // ⇒ **فسؤالٌ يقول «المعدود: ٢» ثمّ يمحو تسعةً هو أسوأُ من سؤالٍ بلا رقم** —
  // الرقمُ يطمئن، والطمأنينةُ هي ما يجعل الإصبعَ يضغط.
  //
  // ✅ **والقاعدةُ مكتبةٌ لا سطرٌ هنا** (`countedInSession`) — فهي مُختبَرةٌ
  // بلا رسمٍ ولا حالةِ مكوّن، **وحالةُ «بحثٌ يُخفي معدودًا» مثبَّتةٌ اختبارًا
  // دائمًا** بدل مسبارٍ يدويٍّ يُمحى بعد جولته.
  const sessionCount = countedInSession(counts)

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

        {/* ══════════════════════════════════════════════════════════
            ⏸ **«تصدير إلى إكسل» — معطَّلٌ بالبنية، بموضع المرجع**
            ══════════════════════════════════════════════════════════

            **`<span>` بلا معالِج حدثٍ إطلاقًا**، كطريقَي الباركود والإكسل
            وزرِّ الحفظ. ⚠️ **ولا `<button disabled>`:** شرطٌ يُنسى أو خاصّيّةٌ
            تُحذف تعيد زرًّا معطَّلًا إلى الحياة، **ووسمٌ بلا معالِجٍ لا يُنسى
            إليها.**

            🔴 **والسببُ مكتوبٌ ويُفتح عند الطلب** — لأن زرًّا لا يفعل شيئًا
            بلا سببٍ ظاهرٍ **يجعل الشاشةَ تكذب**، وخيارًا معطَّلًا بسببٍ ظاهر
            **غيابٌ مُعلَن.** */}
        <span
          data-export-disabled=""
          title={t('products:stocktakePeriod.exportDisabledHelp')}
          className="inline-flex h-7 cursor-not-allowed items-center gap-2 border border-[var(--rule)] bg-[var(--group)] px-2 text-xs text-muted-foreground opacity-70"
        >
          <FileSpreadsheet className="size-3.5" />
          {t('products:stocktakePeriod.exportExcel')}
          <RefTag>{t('products:stocktakePeriod.methodDisabledTag')}</RefTag>
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          شريطُ الجلسة — **مَن يعدّ ومنذ متى**
          ══════════════════════════════════════════════════════════════

          🔴 **وحالتان لا واحدة:** «جردُك أنت انقطع» و«جردٌ بدأه غيرُك»
          موقفان مختلفان، **وأحدُهما وحدَه مفاجأة.** والنصّان قائمان في
          `stocktake.*` **ويُعاد استعمالُهما لا يُكتب مثلُهما** — فنصّان
          بنفس المعنى يتباعدان.

          ⚠️ **ولا يظهر إلّا بعد أوّل عدّ** — لأن الجلسةَ لا تُفتح قبله:
          فاتحُ الشاشة لينظر لا يُعلن مستودعَه «قيد الجرد». */}
      {stocktake && stocktake.session && (
        <div className="border border-[var(--rule)] bg-[var(--group)] px-2 py-1 text-xs" data-session-banner="">
          {t(startedBy && startedBy === userId
            ? 'products:stocktake.resumeYours'
            : 'products:stocktake.resumeOther',
          { when: startedAt ? String(startedAt).slice(0, 10) : '' })}
        </div>
      )}

      {/* 🔴 **وتعذُّرُ الكتابة يُقال، ولا يُبتلع** — الرقمُ على الشاشة
          والقاعدةُ لا تحمله، **وهي أخطرُ حالةٍ في هذه الشاشة:** العادَّةُ
          تظنّ عدَّها محفوظًا وتُغلق. */}
      {writeError && (
        <div className="border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs" data-write-error="">
          {t('products:stocktake.writeFailed')}
        </div>
      )}

      {/* 🔴 **سؤالُ الرمي — والرقمُ فيه لا في الزرّ.**
          **وموضعُه أعلى الورقة لا عند الزرّ:** الجدولُ يمرّر، **فسؤالٌ عند
          أسفلِ صفحةٍ طويلةٍ يُجاب وصاحبُه لا يرى ما سيفقده.** */}
      {discarding && (
        <div className="border border-destructive/40 bg-destructive/10 px-2 py-2 text-xs" data-discard-confirm="">
          <p className="font-medium">{t('products:stocktake.discardTitle')}</p>
          <p className="mt-1 text-muted-foreground">
            {t('products:stocktake.discardBody', { count: sessionCount })}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              data-discard-confirm-button=""
              className="h-7 border border-destructive/50 bg-destructive/20 px-3 text-xs"
              onClick={async () => { setDiscarding(false); await discard() }}
            >
              {t('products:stocktake.discardConfirm')}
            </button>
            <RefCancelButton onClick={() => setDiscarding(false)}>
              {t('products:stocktake.discardCancel')}
            </RefCancelButton>
          </div>
        </div>
      )}

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

              const { product, movement, plan, cost, costState, fact, frame, factBase } = row
              const unit = t(`products:units.${product.base_unit || 'pcs'}`)
              const difference = differenceBase({ factBase, planBase: plan })
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
                  {/* ══════════════════════════════════════════════════
                      الفعليُّ — **الخانةُ الوحيدةُ التي يكتبها إنسان**
                      ══════════════════════════════════════════════════

                      🔴 **بإطارها، لأن الواقفَ أمام الرفّ يعدّ عبواتٍ لا قطعًا**
                      — وإجبارُه على الضرب في رأسه هو عينُ «أدخلتُ ٥ عبوات
                      والصفُّ يقول ٧٥». **والعمودان محفوظان في
                      `stocktake_counts`، فالإطاران مشروعان.**

                      ⚠️ **والكتابةُ عند فقدان التركيز، والقيمةُ من العنصر لا
                      من الحالة:** لصقٌ يتبعه تبويبٌ قد يسبق إعادةَ الرسم
                      **فيُكتب ما قبل الأخير** — رقمٌ معقولٌ وخاطئ. */}
                  <RefTd write>
                    <span className="flex items-center gap-1">
                      <NumberField
                        min="0"
                        step="1"
                        className={`${FIELD} w-16`}
                        data-count-for={product.id}
                        value={fact}
                        onChange={(e) => setCounts({ ...counts, [product.id]: e.target.value })}
                        onBlur={(e) => writeCount({ salonId, product, raw: e.target.value, uom: frame })}
                      />
                      {/* ⚠️ **تغييرُ الإطار يُعيد الكتابةَ فورًا** — لا blur
                          لمنسدل، **والرقمُ يبقى كما كُتب ومعناه هو ما يتغيّر.** */}
                      <select
                        className={`${FIELD} w-20`}
                        data-count-uom={product.id}
                        value={frame}
                        onChange={(e) => {
                          setUoms({ ...uoms, [product.id]: e.target.value })
                          writeCount({ salonId, product, raw: counts[product.id], uom: e.target.value })
                        }}
                      >
                        {countUoms(product).map((uom) => (
                          <option key={uom} value={uom}>{t(`products:docs.uom_${uom}`)}</option>
                        ))}
                      </select>
                    </span>
                    {/* 🔴 **والقراءةُ بالوحدة الأساسيّة تحتها** — الإطاران معًا
                        وحدَهما يصدقان مع القارئ ومع الحساب. */}
                    {factBase !== null && (
                      <span className="block text-[10px] text-muted-foreground">
                        {unit}: <LtrNumber>{factBase}</LtrNumber>
                      </span>
                    )}
                  </RefTd>

                  <RefTd><LtrNumber>{cash(remainingTotal({ factBase, cost }))}</LtrNumber></RefTd>
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
                  {/* 🔴 **مجموعٌ يستثني شيئًا يقول ما استثناه.**
                      رقمُ ٣٬٨٠٠ فوق أربعةِ منتجاتٍ عُدّ منها اثنان يُقرأ
                      «قيمةُ المستودع» — **وهو قيمةُ ما عُدّ لا غير.** وهي
                      قاعدةُ `storageValueSummary` نفسُها: **المجموعُ يحمل ما
                      يقدر على تقييمه ويبلّغ عمّا لم يقدر.**

                      🔴 **وهذا السطرُ فقد اسمَه مرّةً قبل أن يُقرأ:** كُتب عبر
                      الصدفة، **فنفّذت ما بين العلامتين الخلفيّتين وابتلعت
                      الاسم** — وبقي «قاعدةُ  نفسُها». **ولا شيءَ كان يشتكي:
                      تعليقٌ ناقصٌ ماركداونٌ سليم.** ⇒ **والقراءةُ الراجعةُ هي
                      ما كشفته، لا نجاحُ الكاتب.** */}
                  {lineCount > 0 && counted.length < lineCount && (
                    <RefTag title={t('products:stocktakePeriod.totalPartialHelp')}>
                      {t('products:stocktakePeriod.totalCounted', { counted: counted.length, total: lineCount })}
                    </RefTag>
                  )}
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
        {/* 🔴 **«إلغاء» = إغلاقٌ، والعدُّ محفوظ — قرارُ المالك.**
            **ولا `discard()` هنا إطلاقًا:** رميُ عدِّ ساعةٍ خلف كلمةٍ محايدة
            فعلٌ مُتلِفٌ لا يُستدرَك، **ورميُ الجلسة فعلٌ ثانٍ باسمه الصريح
            بجانبه.** والنصُّ يقول ذلك بدل أن يتركه يُخمَّن. */}
        <RefCancelButton onClick={onClose} title={t('products:stocktakePeriod.cancelHelp')}>
          {t('products:stocktakePeriod.cancel')}
        </RefCancelButton>

        {/* ══════════════════════════════════════════════════════════
            🔴 «ألغِ الجرد وابدأ من جديد» — **الفعلُ المُتلِفُ باسمه**
            ══════════════════════════════════════════════════════════

            **لا يظهر إلّا وهناك جلسةٌ فعلًا** — زرُّ رميٍ على ورقةٍ فارغةٍ
            يعرض فعلًا لا شيءَ ليفعله، ويعلّم صاحبَه أن الزرَّ بلا أثر.

            ⚠️ **والرقمُ في السؤال لا في الزرّ وحدَه:** رميُ طلبيّةٍ لا يُتلف
            عملًا، **ورميُ جردٍ يُتلف ساعةَ إنسانٍ واقفٍ أمام رفّ** — و«هل أنت
            متأكّد؟» لا تقول ذلك. **وهي العمليّةُ الوحيدةُ هنا التي لا تتراجع
            عنها القاعدة: الصفوف تذهب بالتتالي (cascade).**

            ✅ **و`discard` من الخطّاف نفسِه** — لا نسخةَ ثانيةٌ من المنطق:
            تحذف الجلسةَ وتُفرّغ الأعدادَ والأُطُر، **وتُبلّغ عن فشلها في
            `writeError` الذي ترسمه هذه الشاشةُ أصلًا.**

            ⚠️ **والنصوصُ الخمسةُ مُعادُ استعمالُها من `stocktake.*`** — هي
            نفسُها التي تعرضها الشاشةُ القائمة، **فنصّان بنفس المعنى
            يتباعدان.** */}
        {/* ⚠️ **ولا `title` على زرّ الرمي:** كان `discardTitle` («إلغاء الجرد؟»)
            وهو نفسُ معنى النصّ على الزرّ — **تلميحٌ يعيد ما تقرؤه العينُ
            ضجيجٌ**، والشرحُ يعيش في السؤال الذي يفتحه الزرُّ لا فوقه. */}
        {stocktake && stocktake.session && !discarding && (
          <RefCancelButton onClick={() => setDiscarding(true)} data-discard-open="">
            {t('products:stocktake.discardButton')}
          </RefCancelButton>
        )}

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

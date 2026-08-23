import { balanceRows, BALANCE_STATE, COST_STATE, hasKnownValue } from './balanceView'
import { baseUnitsFor, UOM } from './stockDocument'
import { descendantIds } from './categoryVisibility'

// The counting sheet: which lines stand in front of somebody at the shelf, what
// each one already says, and what a count would change.
//
// ⚠️ WHAT IS RECORDED COMES FROM balanceView.js, NOT FROM A SECOND READER.
// Three decisions live there and a copy that missed any of them would make this
// screen count a shelf it believes is shorter than it is: "never moved" is not
// zero, NULL is not zero, and an archived product that still has stock is
// shown. The adjustment written from a wrong "recorded" is the one that does
// not scream — it looks exactly like an ordinary correction.
//
// ⚠️ AND THE GROUPING IS THE OPPOSITE OF THE BALANCE SCREEN'S, deliberately.
// That screen asks "what do I have and what is wrong with my record", so it
// folds "never moved" away as a reference. Here it is the richest column on the
// page: a wrong positive balance is caught by counting, but goods the system
// never knew about are found ONLY by somebody standing at the shelf seeing
// them. Folding that section would not make them harder to find — it would make
// them impossible, because what is not in front of the counter is not counted.
//
// So: nothing folded, nothing sorted by problem, and size solved by a CATEGORY
// filter — people count a shelf, not a warehouse. "Show the shampoo folder"
// cuts the sheet along the real world; "hide what has no balance" cuts it
// against the real world.

// ⚠️ THREE STATES, and the middle one is why this cannot be a truthiness check.
//
// An untouched box and a written zero are the same `''`-to-`0` trap that
// poisoned the supply screen, pointed at quantity instead of money — except the
// damage runs the other way. Number('') is 0, so an untouched row read as a
// count says "I counted zero" and writes off the whole shelf. A row nobody
// filled in must not be able to empty one.
//
// And zero is not a value to be avoided: it is one of the most important
// findings a stocktake produces. "I looked and there is nothing there" is
// exactly the sentence the ledger cannot generate by itself.
export const COUNT_STATE = {
  UNTOUCHED: 'untouched',
  ZERO: 'zero',
  NUMBER: 'number',
}

export function countState(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return COUNT_STATE.UNTOUCHED
  const counted = Number(raw)
  if (!Number.isFinite(counted) || counted < 0) return COUNT_STATE.UNTOUCHED
  return counted === 0 ? COUNT_STATE.ZERO : COUNT_STATE.NUMBER
}

/**
 * كم منتجًا في هذه الجلسة عليه عدٌّ — **من الجلسة كلِّها، لا مما يُرسم.**
 *
 * 🔴 **يوجد لأن الرقم الخطأ كاد يُشحن في سؤالٍ مُتلِف.** سؤالُ «ألغِ الجرد»
 * كان سيُبنى على صفوف الجدول المرسومة، **وهي مفلترةٌ بالبحث ومشروطةٌ بتكلفةٍ
 * معروفة** — والرميُ يمحو الجلسةَ كاملةً بلا نظرٍ إلى أيٍّ منهما.
 *
 * ⚠️ **فسؤالٌ يقول «٢» ثمّ يمحو تسعةً أسوأُ من سؤالٍ بلا رقمٍ إطلاقًا:** الرقمُ
 * يطمئن، **والطمأنينةُ هي ما يجعل الإصبعَ يضغط.**
 *
 * ✅ **ومناعتُه بنيويّةٌ لا منضبطة: لا يقبل صفوفًا ولا بحثًا ولا تكلفة** — يقبل
 * `counts` وحدَها، **فلا يوجد ما يُفلتَر أصلًا.** وهذا ما يجعله قابلًا للاختبار
 * بلا رسمٍ ولا حالةِ مكوّن.
 */
export function countedInSession(counts) {
  return Object.values(counts || {})
    .filter((raw) => countState(raw) !== COUNT_STATE.UNTOUCHED).length
}

// ══════════════════════════════════════════════════════════════════════════
// ٣.١٣ب — **القفزةُ فوق المسجَّل**، والمواصفةُ في
// `design/stocktake-anomaly-resistance.md`.
// ══════════════════════════════════════════════════════════════════════════
//
// 🔴 **الرقمان تقديران، ويُقالان تقديرين.** اختيرا ليومضا عند الحوادث الثلاث
// المقيسة (`150⟵1950` · `1950⟵28650` · `5⟵50`) ويصمتا عن كلّ حالةٍ مشروعةٍ
// معروفة، **ولا سندَ لهما غيرُ ذلك.** ⇒ **مُصدَّران باسمهما من موضعٍ واحد**،
// فمن يعدّلهما يجد جدولَ المقابلة في المواصفة ويعدّله معه.
export const ANOMALY_RATIO = 10
export const ANOMALY_FLOOR = 20

/**
 * هل يقفز هذا العددُ فوق المسجَّل قفزةً تستحقّ سؤالًا؟
 *
 * **ثلاثةٌ من شروطه الأربعة تُطفئ القاعدةَ لا تُشعلها، وكلٌّ يغلق إيجابًا
 * كاذبًا بعينه:**
 *
 * 🔴 **`المسجَّلُ موجب` يغلق أوّلَ جردٍ في صالونٍ حقيقيّ.** `planOf(null)`
 * تُرجع صفرًا لمنتجٍ بلا حركةٍ في الفترة — **وكلُّ نسبةٍ إلى صفرٍ لا نهائيّة**،
 * فبلا هذا الشرط تومض الورقةُ كلُّها على جردٍ صحيحٍ سطرًا سطرًا. **وحارسٌ يومض
 * مئتَي مرّةٍ يعلّم الناسَ التجاهل، فيموت حيًّا.**
 *
 * 🔴 **`المعدودُ > المسجَّل` يغلق الرفَّ الذي أُفرِغ — وكلَّ عجزٍ حقيقيّ.**
 * والصفرُ «عدٌّ حقيقيٌّ وأهمُّها» بنصّ المخطّط، **والعجزُ الكبيرُ هو غرضُ هذا
 * الموديول لا عطلُه.** ⇒ **الاتّجاهُ صعوديٌّ بقرار المالك.**
 * ⚠️ **والهابطُ ثغرةٌ مسجَّلةٌ لا مغطّاة** — ذيلُ `docs/SAFETY-GATE-stocktake.md`.
 *
 * ⚠️ **و`ANOMALY_FLOOR` هي ما يجعل `ANOMALY_RATIO` صالحةً للعيش:** مسجَّلٌ `1`
 * ومعدودٌ `12` نسبتُه اثنتا عشرةَ وفرقُه أحدَ عشرَ — **وضجيجٌ يوميٌّ على أرقامٍ
 * صغيرةٍ يفعل بالحارس ما تفعله المئتان.**
 *
 * ⚠️ **ويُحكَم على الوحدة الأساسيّة لا على ما كُتب** — تمامًا كـ`splitsAPiece`:
 * الإطارُ يغيّر معنى الرقم لا مقدارَه، **وعشرُ عبواتٍ من خمسَ عشرةَ ليست عشرة.**
 */
export function jumpsAboveRecord(countedBase, recordedBase) {
  const counted = Number(countedBase)
  const recorded = Number(recordedBase)
  if (!Number.isFinite(counted) || !Number.isFinite(recorded)) return false
  if (recorded <= 0) return false
  if (counted <= recorded) return false
  if (counted < recorded * ANOMALY_RATIO) return false
  return counted - recorded >= ANOMALY_FLOOR
}

/**
 * هل استقرّ الرقمُ في هذه الخانة؟ — أي: غادرَته اليدُ ولم يتغيّر بعدها.
 *
 * 🔴 **يوجد لأن هذا هو الفرقُ الوحيدُ بين ٣.١٣ب والشرط ③، وهو فرقٌ مقيسٌ لا
 * ذوق:** حكمُ «قطعٌ صحيحةٌ فقط» صحيحٌ على كلّ بادئةٍ من الرقم (`2` تمرّ، `2.5`
 * تومض)، **وحكمُ المقدار تُنقصه كلُّ بادئة** — فكتابةُ `1950` تمرّ بـ`195`
 * فيومض التنبيهُ قبل أن يكمل الرقم.
 *
 * ⇒ **فالتنبيهُ عند `onBlur`**، وهي نفسُها اللحظةُ التي يُكتب فيها الصفُّ
 * للقاعدة — **فلا لحظةَ جديدةٌ تُخترع.**
 *
 * ✅ **والمقارنةُ بالقيمة لا براية «قد غادر»**، فيختفي التنبيهُ من نفسِه لحظةَ
 * تغيُّر الرقم بلا كتابةِ حالةٍ ثانية — **وحالتان تصفان شيئًا واحدًا تتباعدان.**
 */
export function settledCount(blurred, productId, raw) {
  const seen = blurred || {}
  if (!Object.prototype.hasOwnProperty.call(seen, productId)) return false
  return String(seen[productId]) === String(raw)
}

// ⚠️ **حالتان لا واحدة، والثانيةُ هي التي تمنع اللوحَ من الكذب.**
//
// 🔴 **`UNJUDGED` ليست «سليمًا» ولا «شاذًّا» — هي «لا نعرف».** ومنتجٌ عُدَّ ثمّ
// غاب عن صفوف الورقة (رابطُ مجلّدٍ أُزيل أثناء الجلسة) **يبقى عدُّه في القاعدة
// ويُرحَّل معها** — **فإسقاطُه من اللوح يجعل اللوحَ يعِدّ غيرَ ما سيُرحَّل.**
// ⇒ **يُعرَض موسومًا**، ولا يُبتلع في الصمت.
export const CONFIRM_LINE = { FLAGGED: 'flagged', UNJUDGED: 'unjudged' }

/**
 * سطورُ لوح التأكيد — **من `counts` كلِّها، لا من الصفوف المرسومة.**
 *
 * 🔴 **وهذا عينُ العطل الذي كاد يُشحن في سؤال الرمي، بلبوسٍ أخطر:** الصفوفُ
 * المرسومةُ مفلترةٌ بالبحث ومشروطةٌ بتكلفةٍ معروفة، **والترحيلُ لا ينظر إلى
 * أيٍّ منهما.** ⇒ **لوحٌ يقول «سطرٌ شاذٌّ واحد» ثمّ يُرحَّل ثلاثةٌ شواذّ هو
 * أسوأُ من لوحٍ لا يوجد** — لأنه **يطمئن**، والطمأنينةُ هي ما يجعل الإصبعَ
 * يضغط.
 *
 * ⚠️ **و`rows` تُقبَل مصدرًا للرصيد لا مصفاةً للسطور:** كلُّ مفتاحٍ في `counts`
 * يُنظَر فيه، **ومن لا صفَّ له يخرج `UNJUDGED` لا يُحذَف.**
 *
 * ✅ **والترتيبُ ترتيبُ الورقة نفسِها** — فمن يقرأ اللوحَ يمشي على الرفّ بنفس
 * التسلسل، **والمجهولاتُ في الذيل** لأنها ليست في المشية أصلًا.
 */
export function linesToConfirm({ counts, uoms, rows, products } = {}) {
  const rowOf = new Map()
  const orderOf = new Map()
  let index = 0
  for (const row of rows || []) {
    if (!row || row.kind !== 'line' || !row.product) continue
    rowOf.set(row.product.id, row)
    orderOf.set(row.product.id, index)
    index += 1
  }
  const catalogue = new Map()
  for (const product of products || []) if (product && product.id) catalogue.set(product.id, product)

  const out = []
  for (const productId of Object.keys(counts || {})) {
    const raw = (counts || {})[productId]
    // ⚠️ **نفسُ ثلاثِ الحالات، لا `!raw`** — و`'0'` عدٌّ حقيقيٌّ يمرّ.
    if (countState(raw) !== COUNT_STATE.NUMBER && countState(raw) !== COUNT_STATE.ZERO) continue

    const row = rowOf.get(productId) || null
    const product = row ? row.product : (catalogue.get(productId) || null)
    const frame = (uoms || {})[productId] || (product ? defaultCountUom(product) : null)
    const countedBase = product ? usableCount(raw, product, frame) : null
    const entry = {
      productId,
      product,
      entered: raw,
      frame,
      countedBase,
      recordedBase: row ? row.plan : null,
      order: orderOf.has(productId) ? orderOf.get(productId) : Number.MAX_SAFE_INTEGER,
    }

    if (countedBase === null || !row) {
      out.push({ ...entry, state: CONFIRM_LINE.UNJUDGED })
    } else if (jumpsAboveRecord(countedBase, row.plan)) {
      out.push({ ...entry, state: CONFIRM_LINE.FLAGGED })
    }
  }
  return out.sort((a, b) => a.order - b.order)
}

// What the ledger already believes, as a number a difference can be taken
// against — and NOT as something to show.
//
// ⚠️ The screen shows three different things for these three states and this
// function flattens them to one, on purpose and in one direction only.
// post_stocktake computes `counted - coalesce(sum(quantity_base), 0)`, so a
// product that never moved is arithmetically zero to the database. The display
// must still say "غير مسجَّل" rather than "0", because the two send a person to
// different conclusions: one shelf was emptied, the other was never stocked.
export function recordedBase(row) {
  if (!row || row.balanceState === BALANCE_STATE.NEVER_MOVED) return 0
  return row.balanceBase
}

// Every product the counter should walk past, for one storage.
//
// `categoryId` narrows it to a folder AND ITS SUBFOLDERS — the same walk the
// archive dialog uses, so "the shampoo folder" means the same thing on both
// screens. null means the whole storage.
export function sheetRows({ balances, products, storageId, categoryId, categories }) {
  const rows = balanceRows({ balances, products, storageId })

  const inFolder = categoryId
    ? (() => {
      const category = (categories || []).find((c) => c.id === categoryId)
      // A folder that no longer exists narrows to nothing rather than to
      // everything. Silently widening a counting sheet is worse than an empty
      // one: the empty sheet is noticed.
      const ids = category ? descendantIds(category, categories) : new Set()
      return (row) => ids.has(row.product.category_id)
    })()
    : () => true

  return sortForCounting(rows.filter(inFolder))
}

// ⚠️ Sorted the way a shelf is walked, NOT the way a work list is ranked.
//
// sortBalanceRows puts the problems first, which is right when the question is
// "what needs attention". Here the question is "what is in front of me", and a
// sheet that reorders itself by problem makes the counter hunt for each product
// instead of reading down the page.
//
// ⚠️ The category key GROUPS, it does not rank: comparing ids puts one folder
// before another for no reason anybody would defend. That is deliberate and
// only safe because the screen draws a heading per folder — what matters is
// that a folder's products are adjacent, and inside it the catalogue's own
// sort_order decides, which is the order the person arranged them in.
export function sortForCounting(rows) {
  return [...(rows || [])].sort((a, b) => {
    const byCategory = String(a.product.category_id || '').localeCompare(String(b.product.category_id || ''))
    if (byCategory !== 0) return byCategory
    const byOrder = (a.product.sort_order || 0) - (b.product.sort_order || 0)
    if (byOrder !== 0) return byOrder
    return String(a.product.name || '').localeCompare(String(b.product.name || ''), 'ar')
  })
}

// One line's reading: what was counted, what is recorded, and the difference —
// or null for the difference when nothing was counted.
//
// ⚠️ `counted` is in BASE units here. The conversion from packages happens in
// stocktakeLine, which owns the factor and the whole-pieces refusal; repeating
// it would be a second copy of the rule that decides whether half a hairpin
// exists.
export function lineReading(row, rawCount, countedBase) {
  const state = countState(rawCount)
  if (state === COUNT_STATE.UNTOUCHED) {
    return { state, countedBase: null, recorded: recordedBase(row), difference: null }
  }
  const recorded = recordedBase(row)
  return { state, countedBase, recorded, difference: countedBase - recorded }
}

// ⚠️ WHAT THE CONFIRMATION IS ALLOWED TO CLAIM ABOUT MONEY.
//
// The value of an adjustment is `difference × cost`, and the cost is decided
// INSIDE post_stocktake by the fallback chain — this screen does not know it
// and must not pretend to. What it does know is the recorded average, and only
// for rows that have one.
//
// So the total carries the lines it can value and REPORTS the ones it cannot,
// the same rule storageValueSummary keeps: a total that excludes something says
// what it excluded. A surplus found on a product that never moved is the
// commonest unvaluable line there is — there is no average, because there has
// never been a movement to average.
//
// ⚠️ hasKnownValue is reused rather than re-derived, because the cell and the
// total disagreeing is a fault this module has already paid for once.
export function adjustmentValue(row, difference) {
  if (difference === null || difference === 0) return null
  // A never-moved or negative row has no average at all; a zero-cost row has
  // one whose worth is unknown. Neither can be multiplied honestly.
  if (!hasKnownValue(row) && row.costState !== COST_STATE.KNOWN) return null
  if (row.avgCost === null || row.avgCost === undefined) return null
  return difference * row.avgCost
}

// Everything the confirmation has to say before anybody presses save.
//
// ⚠️ It names the lines that will MOVE, not the lines that were counted, and
// the difference matters: counting fifty products and finding forty-seven right
// produces three movements. Somebody agreeing to "save the stocktake" is
// agreeing to those three, and they are what gets listed.
//
// ⚠️ But `countedLines` is reported too, because a stocktake where everything
// matched writes no movements at all (item 44) — and "nothing will change" is a
// completely different sentence from "you have not counted anything yet".
export function stocktakeSummary(rows, readings) {
  const changing = []
  let valued = 0
  let unvaluedLines = 0
  let countedLines = 0

  for (const row of rows || []) {
    const reading = readings[row.product.id]
    if (!reading || reading.state === COUNT_STATE.UNTOUCHED) continue
    countedLines += 1
    if (reading.difference === 0) continue

    const value = adjustmentValue(row, reading.difference)
    if (value === null) unvaluedLines += 1
    else valued += value

    changing.push({ row, reading, value })
  }

  return {
    countedLines,
    untouchedLines: (rows || []).length - countedLines,
    changing,
    valued,
    unvaluedLines,
  }
}

// The rows to send, in the shape stocktakeLine expects.
//
// ⚠️ ONLY the counted ones. An untouched row must never become a line: the
// database would read it as a count of zero and write the shelf off. This is
// the single most destructive thing this screen could do, and it is prevented
// by never building the line rather than by validating it later.
// ⚠️ COUNTS THAT WOULD BE DROPPED, and this exists because dropping them is
// silent, plausible and permanent.
//
// countedRowsToSend walks `rows`. Hand it a narrowed set — the folder filter —
// while counts exist outside it and every one of those is discarded without a
// word: the confirmation says "1 line counted" when somebody counted eight, and
// post_stocktake does not store counts (item 44), so the work is gone with
// nothing to recover it from.
//
// The screen's fix is to scope the document by WHAT WAS COUNTED and never by
// what is on screen. This is the second layer, and it fails closed: if the two
// ever disagree again, saving stops instead of quietly shrinking.
// How many boxes hold work that is not saved anywhere.
//
// ⚠️ Reported UPWARD so the page can ask before a shared storage lens throws it
// away. A count belongs to its storage and cannot follow one, so the honest
// move is to ask rather than to migrate — and asking needs a number, not a
// guess about whether anybody has started.
//
// A written zero counts: "the shelf is empty" is a finding somebody walked to
// the shelf to make. An untouched box does not.
export function unsavedCounts(rawCounts) {
  return Object.keys(rawCounts || {}).filter(
    (id) => countState(rawCounts[id]) !== COUNT_STATE.UNTOUCHED
  ).length
}

export function droppedCounts(rows, rawCounts) {
  const visible = new Set((rows || []).map((row) => row.product.id))
  return Object.keys(rawCounts || {}).filter((id) => (
    !visible.has(id) && countState(rawCounts[id]) !== COUNT_STATE.UNTOUCHED
  ))
}

export function countedRowsToSend(rows, rawCounts, uoms) {
  return (rows || [])
    .filter((row) => countState(rawCounts[row.product.id]) !== COUNT_STATE.UNTOUCHED)
    .map((row) => ({
      productId: row.product.id,
      countedQuantity: rawCounts[row.product.id],
      // ⚠️ THE FRAME THE PERSON COUNTED IN, not a fixed one. This sent 'unit'
      // for every row — base units — so counting three 250ml tubes meant typing
      // 750, and the multiplication item 35 exists to remove was handed back to
      // the counter. A test recorded that 'unit' literally, which made a
      // decision look like a guard.
      //
      // It is a conversion frame and not a stored fact: stocktakeLine uses it
      // to reach counted_base and then drops it, because a stocktake movement
      // carries no entered frame at all.
      enteredUom: (uoms || {})[row.product.id] || defaultCountUom(row.product),
    }))
}

// Which frames this product can be counted in, and which one the sheet opens
// with.
//
// ⚠️ Packages by default wherever a package holds more than one, because that
// is what somebody at a shelf can actually count. The other frames stay
// available per row for the open tube and the part-used jar — the case that
// makes a single fixed frame wrong rather than merely awkward.
export function countUoms(product) {
  return UOM.filter((uom) => {
    const factor = baseUnitsFor(product, uom)
    if (factor === null) return false
    // ⚠️ A PACKAGE OF ONE IS THE BASE UNIT UNDER ANOTHER NAME, and offering both
    // is a choice with no difference — which is worse than no choice, because a
    // control that changes nothing teaches people that controls change nothing.
    //
    // Found by rendering the component and reading the options, not by
    // reasoning: `baseUnitsFor` answers 1 for a one-per-package product, so the
    // plain "can this product be counted this way" filter said yes twice. The
    // membership test above it passed throughout — it asked whether the default
    // was in the list, and it was.
    return uom === 'unit' || factor !== 1
  })
}

// القيمةُ بالوحدة الأساسيّة التي تخزّنها هذه الخانة، أو عدمٌ حين لا تكون عدًّا.
//
// ⚠️ **الصفرُ يُرجع `0` لا عدمًا، والتمييزُ هو المقصود:** `''` تعني «ما عدَّها
// أحدٌ بعد» و`'0'` تعني «الرفُّ فارغ» — **وهي أكثرُ النتائج احتمالًا أن تخالف
// السجلّ.** و`if (!usable)` في أيّ موضعٍ على هذا الطريق تجمعهما.
//
// 🔴 **ومكانُها هنا لا في الهوك، وهذا نُقلٌ لا كتابةٌ جديدة.** كانت خاصّةً
// بـ`useStocktakeSession`، **واحتاجها جدولُ الجرد الجديد ليحسب أعمدةَ المال
// من خانةٍ كُتبت بالعبوات.** ⇒ **والبديلُ نسخةٌ ثانيةٌ من القاعدة التي تقرّر
// هل `'0'` عدٌّ** — وهو الصنفُ المسجَّلُ بأربع نسخٍ في `CLAUDE.md`.
//
// ⚠️ **ولا يجوز أن تستوردها مكتبةٌ من `hooks/`** — الاتّجاهُ مقلوب. فالمكتبةُ
// تملكها، والهوكُ يستوردها. **وسلوكُها لم يتغيّر بحرف.**
export function usableCount(raw, product, frame) {
  const text = String(raw ?? '').trim()
  if (text === '') return null
  const typed = Number(text)
  if (!Number.isFinite(typed) || typed < 0) return null
  const factor = baseUnitsFor(product, frame)
  if (factor === null) return null
  return typed * factor
}

export function defaultCountUom(product) {
  const perPackage = Number(product && product.units_per_package)
  return Number.isFinite(perPackage) && perPackage > 1 ? 'package' : 'unit'
}

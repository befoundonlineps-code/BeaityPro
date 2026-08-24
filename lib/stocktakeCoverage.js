// The stocktake as a period report — which is to say, COVERAGE.
//
// ⚠️ THE QUESTION THIS ANSWERS DID NOT HAVE DATA BEHIND IT UNTIL 054a. The old
// post_stocktake said `if v_diff = 0 then continue`, so a product counted and
// found correct left no row and neither did a product nobody counted: both were
// zero. A stocktake of fifty products with three discrepancies could say three
// things were wrong and could not say the other forty-seven were right, or
// which. Everything below reads stocktake_counts, which exists for exactly this.
//
// ⚠️ AND IT NEEDS NO MOVEMENTS, which is the point of balance_at_post. The
// difference for each line is `counted_base - balance_at_post`, both stored on
// the count row, both written under the posting lock. Reading the movements
// instead would answer a narrower question — a movement exists only where there
// WAS a difference, so "matched" would be unanswerable again.

// Only sessions that were posted. A session with no document is a count
// somebody abandoned or is still typing, and it describes nothing that happened.
//
// ⚠️ Not a filter somebody has to remember: everything here goes through this,
// so an open session has no path into a report rather than being excluded from
// one.
export function postedSessions(sessions) {
  return (sessions || []).filter((s) => s && s.document_id)
}

// What one posted count covered.
//
// `matched` is the number that did not exist before this stage. It is not
// `counted - differed` computed for display — it is the count of rows whose
// stored count equals the stored balance, which is a fact about the data.
export function sessionCoverage(session, counts) {
  const own = (counts || []).filter((c) => c.session_id === session.id)
  let differed = 0
  let matched = 0
  let unmeasured = 0

  for (const row of own) {
    // ⚠️ balance_at_post is null on a row belonging to a session that was never
    // posted — and, defensively, on any row a future path forgets to stamp.
    // Counting it as "matched" would invent agreement out of an absence, which
    // is the loudest possible way to be wrong in a coverage report.
    if (row.balance_at_post === null || row.balance_at_post === undefined) {
      unmeasured += 1
      continue
    }
    if (Number(row.counted_base) === Number(row.balance_at_post)) matched += 1
    else differed += 1
  }

  return { counted: own.length, matched, differed, unmeasured }
}

// Every posted count, newest first, with what it covered.
//
// Ordered by the DOCUMENT's date rather than by when counting started, because
// that is the date the stocktake carries everywhere else — and a count begun on
// Monday and posted on Wednesday belongs to Wednesday's ledger.
export function coverageByStocktake({ sessions, counts, documents }) {
  const byId = Object.fromEntries((documents || []).map((d) => [d.id, d]))

  return postedSessions(sessions)
    .map((session) => ({
      session,
      document: byId[session.document_id] || null,
      docDate: (byId[session.document_id] || {}).doc_date || session.started_at || '',
      storageId: session.storage_id,
      ...sessionCoverage(session, counts),
    }))
    .sort((a, b) => {
      // Newest first, and the id breaks the tie so the order is total: two
      // stocktakes posted the same day would otherwise draw in whatever order
      // the read returned, and the list would reshuffle itself on a refresh.
      if (a.docDate !== b.docDate) return a.docDate < b.docDate ? 1 : -1
      return String(b.session.id).localeCompare(String(a.session.id))
    })
}

// When each product was last counted, and the ones that never were.
//
// ⚠️ THE NEVER-COUNTED ARE THE POINT, not a leftover. A report of what was
// counted is reassuring by construction — everything in it is evidence of work.
// The products missing from it are the finding, and they are invisible unless
// something walks the catalogue rather than the counts.
export function coverageByProduct({ products, sessions, counts, documents }) {
  const posted = new Set(postedSessions(sessions).map((s) => s.id))
  const byId = Object.fromEntries((documents || []).map((d) => [d.id, d]))
  const dateOf = Object.fromEntries(
    postedSessions(sessions).map((s) => [s.id, (byId[s.document_id] || {}).doc_date || s.started_at || ''])
  )

  // 🔴 التاريخُ من `doc_date` عمدًا، لا من `counted_at` — والسببُ مقيسٌ لا ذوق.
  //
  // `saveCount` تكتب `upsert` بلا `counted_at`، **والافتراضُ لا يعمل إلّا عند
  // الإدراج** ⇒ **فإعادةُ عدِّ منتجٍ تستبدل الرقمَ وتُبقي ختمَ العدّ الأوّل.**
  //
  // ⚠️ **وموضعُ القياس يُسمّى، فالسلسلةُ حلقتان لا واحدة:**
  //   السلوكُ  ⟵ `docs/sql/109b_counted_at_on_a_row.sql` **على نسخةِ المراجعة
  //              وحدَها — و`109b` لا يُشغَّل على قاعدة المالك أبدًا**، وذلك
  //              مكتوبٌ في ترويسته.
  //   المخطّطُ ⟵ `docs/sql/109` شُغّل على قاعدة المالك (٢٤ آب ٢٠٢٦) فأعاد
  //              `updated_at_anywhere = 0` وسردَي الأعمدة غيرَ فارغَين.
  //
  // والمخرَجُ حالتان لا واحدة:
  //   A  upsert بلا `counted_at`  ⟶ `3 ⟶ 75` · الختمُ `moved = false`
  //   B  وكتابةٌ صريحةٌ للعمود     ⟶ `moved = true`
  // 🔴 **و`B` ليس زينة:** بدونه **لا يُفرَّق «الختمُ لم يتحرّك» عن «قياسي لا
  // يحرّك شيئًا»** — وهو شاهدُ الصدق الذي بُني لأجله.
  //
  // ⚠️ **فتبديلُه إلى `counted_at` يبدو أدقَّ — الاسمُ أقربُ إلى «متى عُدّ» —
  // وهو استيرادُ ختمٍ كاذب.** والاسمان يغريان بالعكس، ولهذا يُكتب هنا لا في
  // وثيقة: **من «يحسّن» هذا السطر لن يفتح البوّابة، سيفتح هذا الملفّ.**
  const seen = {}
  for (const row of counts || []) {
    if (!posted.has(row.session_id)) continue
    const when = dateOf[row.session_id] || ''
    const current = seen[row.product_id]
    if (!current) { seen[row.product_id] = { times: 1, last: when }; continue }
    current.times += 1
    if (when > current.last) current.last = when
  }

  return (products || []).map((product) => ({
    product,
    times: (seen[product.id] || {}).times || 0,
    lastCounted: (seen[product.id] || {}).last || null,
  }))
}

// The one number a person wants first: how much of the catalogue has ever been
// counted.
//
// ⚠️ Archived products are excluded from the denominator, because a report that
// can never reach 100% is a report nobody reads twice — and nobody is going to
// go and count something they have taken out of circulation.
export function coverageTotals(rows) {
  const live = (rows || []).filter((row) => row.product && row.product.is_active !== false)
  const counted = live.filter((row) => row.times > 0).length
  return { products: live.length, counted, never: live.length - counted }
}

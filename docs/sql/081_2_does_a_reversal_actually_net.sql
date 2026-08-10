-- ==========================================================================
-- 081_2 -- SURVEY ONLY. Read-only: nothing is written. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- 🔴 THE INVARIANT TEST TWO RIDES ON, MEASURED FOR THE FIRST TIME.
--
-- 079a's TEST TWO asks product_balances whether a live balance exists. But
-- product_balances sums EVERY movement, dead ones included — so its answer
-- equals "the live balance" only while a reversal writes an exact negation of
-- its original. That is the whole load-bearing assumption, it has never been
-- stated, and until this file runs it has never been checked.
--
-- ⇒ If the difference is zero on every pair, the invariant HOLDS AND IS
-- MEASURED, and it goes into 079a's header as a condition TEST TWO depends on
-- — not left as a coincidence that happens to be true.
--
-- ⇒ If any pair leaves a remainder, TEST TWO is wrong today: a product whose
-- supply was reversed still reports a balance, and the supplier stays frozen
-- for exactly the reason 079a exists to remove.
--
-- ---------------------------------------------------------------------------
-- 🔴 THE FIRST DRAFT OF THIS FILE WAS STRUCTURALLY BLIND TO EVERY TRANSFER,
-- AND A TEST RUN PROVED IT — reading it would not have.
--
-- A transfer writes BOTH LEGS UNDER ONE DOCUMENT: −10 out of one storage and
-- +10 into another, same product, same document. So grouping by (pair,
-- product) makes THE ORIGINAL ITSELF SUM TO ZERO before its reversal is
-- counted at all. Three seeded pairs against the draft:
--
--     transfer, reversed correctly     0    0    0   ✅ nets exactly
--     transfer, reversal wrote NOTHING 0    0    0   ✅ nets exactly   ← 🔴
--     supply, reversal short by 5      7   −5    2   🔴 remainder
--
-- ⚠️ AN ENTIRELY EMPTY REVERSAL WAS INDISTINGUISHABLE FROM A CORRECT ONE. And
-- not hypothetically: 079b_4 measured three pairs and ONE OF THEM IS A
-- TRANSFER (8749222a ↔ 429db60a), so one row in three would have come back ✅
-- meaning nothing at all.
--
-- ⚠️ It is 079b_4's own sentence one level down — "a query that filters away
-- the shape it is testing for cannot report it" — except the filtering was
-- done by GROUP BY rather than by WHERE, which is why it did not look like
-- filtering.
--
-- ✅ TWO FIXES, AND THE SECOND IS NOT REDUNDANT:
--
--   1. group by storage_id as well. The empty reversal becomes two 🔴 rows at
--      −10 and +10; the correct transfer becomes two ✅ rows.
--   2. count the LINES on each side, and give lines_reversal = 0 its own
--      verdict CHECKED FIRST. An empty reversal is zero on both sides of every
--      sum, so any arithmetic verdict placed above it swallows it — including
--      the storage-split one, for a document that touched a single storage.
--
-- ---------------------------------------------------------------------------
-- ⚠️ QUANTITY AND VALUE, NOT QUANTITY ALONE — and the counter-example is
-- already written down here. 043's header describes movements whose
-- QUANTITIES cancel while their VALUE does not:
--
--     −15 @ 10  ·  +15 @ 30  ·  +15 @ 50
--     Q_est = 0   ⇒ a quantity-only test wipes the badge
--     S_est = 300 ⇒ and the average shown is 70 while the true one is 50
--
-- pinned by test-utils/stockFixtures.test.js under the name "quantities that
-- cancel while the value does not". Both sums, or neither.
--
-- ⚠️ AND NO coalesce ON unit_cost, DELIBERATELY. The objection to write one
-- was that a null cost drops out of the numerator and leaves the pair passing
-- under 043's fault. 079b_1 measured the column: `unit_cost · numeric · NOT
-- NULL`, no default. The hole does not exist — and a defensive coalesce would
-- be WORSE than nothing, because it converts a future `ALTER … NULLABLE` into
-- a silent zero instead of the error that would tell us about it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WITNESS OF TRUTH — item 1ج. 079b_4 measured THREE reversed pairs, and one
-- is a transfer naming TWO storages. So this returns AT LEAST FOUR rows, not
-- three.
--
-- ⇒ ZERO ROWS DOES NOT MEAN "everything nets". It means the walk found no
-- pairs, and an empty result on a question shaped "is anything left over"
-- reads identically to a clean bill of health.
--
-- ⚠️ AND THE PAIRS ARE DERIVED FROM reverses_document_id, NOT LISTED. A
-- written list of document ids finds what was put in it and stays silent about
-- a fourth pair created tomorrow.
-- ==========================================================================

with pairs as (
  -- Every reversal and the document it reverses. The direction is the one the
  -- schema actually has: the reversal points at its original, never the other
  -- way round — recorded in 043 after the column was once looked for under the
  -- wrong name.
  select
    r.reverses_document_id as original_id,
    r.id                   as reversal_id,
    r.salon_id
  from public.stock_documents r
  where r.reverses_document_id is not null
),
sums as (
  -- ⚠️ storage_id IS IN THE KEY. Without it a transfer's two legs cancel each
  -- other inside the ORIGINAL, and the reversal is never examined.
  select
    p.original_id,
    p.reversal_id,
    m.product_id,
    m.storage_id,
    count(*) filter (where m.document_id = p.original_id)                        as lines_original,
    count(*) filter (where m.document_id = p.reversal_id)                        as lines_reversal,
    sum(case when m.document_id = p.original_id then m.quantity_base else 0 end) as original_qty,
    sum(case when m.document_id = p.reversal_id then m.quantity_base else 0 end) as reversal_qty,
    sum(case when m.document_id = p.original_id
             then m.quantity_base * m.unit_cost else 0 end)                      as original_value,
    sum(case when m.document_id = p.reversal_id
             then m.quantity_base * m.unit_cost else 0 end)                      as reversal_value
  from pairs p
  join public.stock_movements m
    on  m.document_id in (p.original_id, p.reversal_id)
    and m.salon_id = p.salon_id
  group by p.original_id, p.reversal_id, m.product_id, m.storage_id
)
select
  s.original_id,
  s.reversal_id,
  coalesce(pr.name, '⚠️ (منتج غير موجود)') as product,
  s.storage_id,
  s.lines_original,
  s.lines_reversal,
  s.original_qty,
  s.reversal_qty,
  (s.original_qty + s.reversal_qty)        as qty_left_over,
  (s.original_value + s.reversal_value)    as value_left_over,
  case
    -- ⚠️ FIRST, always. An empty reversal is zero on both sides of every sum,
    -- so every arithmetic branch below would call it a perfect netting.
    when s.lines_reversal = 0
      then '🔴 العكس ما كتب ولا سطر هون — والصفر على الطرفين بيقرأ مقاصّةً تامّة'
    when (s.original_qty + s.reversal_qty) = 0
     and (s.original_value + s.reversal_value) = 0
      then '✅ يقاصّ تمامًا — بالكمّية وبالقيمة'
    when (s.original_qty + s.reversal_qty) = 0
      then '🔴 الكمّية تقاصّت والقيمة لأ — وهي الحالة اللي ٠٤٣ بيسمّيها'
    else '🔴 بيضلّ أثر — واختبار المورّد مبنيٌّ على مقاصّةٍ ما بتقاصّ'
  end                                      as verdict
from sums s
left join public.products pr
  on pr.id = s.product_id
order by verdict, product, s.storage_id;

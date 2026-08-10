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
-- MEASURED, and it gets written into 079a's header as a condition TEST TWO
-- depends on — not left as a coincidence that happens to be true.
--
-- ⇒ If any pair leaves a remainder, TEST TWO is wrong today: a product whose
-- supply was reversed still reports a balance, and the supplier stays frozen
-- for exactly the reason 079a exists to remove.
--
-- ---------------------------------------------------------------------------
-- ⚠️ QUANTITY AND VALUE, NOT QUANTITY ALONE — and this project has the
-- counter-example already written down. 043's header describes movements whose
-- QUANTITIES cancel while their VALUE does not:
--
--     −15 @ 10  ·  +15 @ 30  ·  +15 @ 50
--     Q_est = 0   ⇒ a quantity-only test wipes the badge
--     S_est = 300 ⇒ and the average shown is 70 while the true one is 50
--
-- and test-utils/stockFixtures.test.js pins it under the name "quantities that
-- cancel while the value does not". A netting check that asks only about
-- quantity would pass on exactly that shape. Both sums, or neither.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WITNESS OF TRUTH — item 1ج. 079b_4 measured THREE reversed pairs (six
-- non-live rows, no `both` row). So this must return AT LEAST THREE rows — one
-- per product per pair, and a transfer pair may name only one product.
--
-- ⇒ ZERO ROWS DOES NOT MEAN "everything nets". It means the walk found no
-- pairs, and an empty result on a question shaped "is anything left over"
-- reads identically to a clean bill of health. Nothing below may be believed
-- until the row count is compared with three.
--
-- ⚠️ AND THE PAIRS ARE DERIVED FROM reverses_document_id, NOT LISTED. A
-- written list of document ids would find what was put in it and stay silent
-- about a fourth pair created tomorrow.
-- ==========================================================================

with pairs as (
  -- Every reversal, and the document it reverses. The direction is the one the
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
  select
    p.original_id,
    p.reversal_id,
    m.product_id,
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
  group by p.original_id, p.reversal_id, m.product_id
)
select
  s.original_id,
  s.reversal_id,
  coalesce(pr.name, '⚠️ (منتج غير موجود)') as product,
  s.original_qty,
  s.reversal_qty,
  (s.original_qty + s.reversal_qty)        as qty_left_over,
  (s.original_value + s.reversal_value)    as value_left_over,
  case
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
order by verdict, product;

-- ==========================================================================
-- 079b_3 -- SURVEY ONLY. Read-only: nothing is written.
--
-- RUN AFTER 079a — it reads the stock_document_liveness view, which 079a
-- creates. ⚠️ AND IT DELIBERATELY DOES NOT INLINE THE LIVENESS CONDITION so it
-- could run earlier: that inlining is the third copy this whole round exists
-- to prevent, and a dry run that computes a DIFFERENT condition from the guard
-- it previews is the exact fault 068b_3 had (069a's header records it).
--
-- ---------------------------------------------------------------------------
-- THE QUESTION THE OWNER ASKED: which products are locked today, and which of
-- them this script releases?
--
-- Every row is one product with the OLD verdict and the NEW verdict beside it,
-- per field. Nothing here is a count — the rows are few and a human reading
-- "this product, that field, was locked, now open" is the check. A number
-- would have to be believed; this can be disagreed with.
--
--     movements_ever    every movement, reversed ones included  ← the OLD test
--     movements_live    movements whose document still stands   ← the NEW test
--                       for the consignment flag
--     balance_base      the live balance across all storages    ← the NEW test
--                       for the supplier
--
-- ---------------------------------------------------------------------------
-- ⚠️ TWO PRODUCTS ARE PREDICTED BY NAME, AND THE PREDICTION CAN FAIL.
--
-- «شامبو 250 مل» and «مقشر ليزر» each had a supply entered and then REVERSED.
-- Both must come back with movements_ever > 0 and movements_live = 0, and both
-- must therefore read 🔓 on the flag column: locked before, open now. They are
-- the two products this database froze permanently by way of a correction
-- working exactly as designed.
--
-- If either one shows movements_live > 0, the view is wrong or the reversal is
-- not what we think it is — and 079a must not be trusted until that is
-- explained. A named prediction that can be falsified is the only kind worth
-- writing down.
--
-- ⚠️ AND WITNESS OF TRUTH — item 1ج, structural rather than numeric: the query
-- walks FROM products with left joins, so every product appears whether it
-- ever moved or not. Zero rows means the query failed, never "no products are
-- locked".
--
-- ⚠️ AN EARLIER DRAFT PROPPED THAT UP WITH "at least three products exist
-- (test-utils/stockFixtures.js records the owner's three)". Both halves were
-- wrong to write. The count is EIGHT, measured in 067_1 — and more to the
-- point, a fixtures file is a record of what we built a test out of, not a
-- measurement of this database. Citing one as evidence about the other is the
-- same substitution corrected twice already in this thread. The structural
-- witness above needs no number at all, which is why it replaces it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND movements_live COUNTS `distinct m.id` DELIBERATELY. The view's left
-- join cannot fan out only while a UNIQUE index sits on reverses_document_id,
-- and that index lives in another file (045, measured by 079b_2). A logical
-- read of the view — is_live, exists — is unharmed either way. A COUNT is not:
-- it would double in silence. So this file does not lean on the index it
-- cannot see.
-- ==========================================================================

with any_movement as (
  select m.product_id, m.salon_id, count(*) as movements_ever
  from public.stock_movements m
  group by m.product_id, m.salon_id
),
live_movement as (
  select m.product_id, m.salon_id, count(distinct m.id) as movements_live
  from public.stock_movements m
  join public.stock_document_liveness l
    on  l.document_id = m.document_id
    and l.salon_id    = m.salon_id
  where l.is_live
  group by m.product_id, m.salon_id
),
balance as (
  -- Summed across storages, exactly as the trigger sums it: the guard asks
  -- about the product in the salon, not in one storage.
  select b.product_id, b.salon_id, coalesce(sum(b.balance_base), 0) as balance_base
  from public.product_balances b
  group by b.product_id, b.salon_id
)
select
  p.name,
  coalesce(p.is_consignment, false)          as is_consignment,
  (p.supplier_id is not null)                as has_supplier,
  coalesce(a.movements_ever, 0)              as movements_ever,
  coalesce(l.movements_live, 0)              as movements_live,
  coalesce(b.balance_base, 0)                as balance_base,

  -- ── the consignment flag ────────────────────────────────────────────────
  -- OLD: any movement at all froze it. NEW: only a live one.
  case
    when coalesce(a.movements_ever, 0) = 0 then 'مفتوح ← مفتوح'
    when coalesce(l.movements_live, 0) > 0 then 'مقفول ← مقفول'
    else '🔓 مقفول ← مفتوح'
  end as flag_before_after,

  -- ── the supplier ────────────────────────────────────────────────────────
  -- OLD: any movement at all froze it, on EVERY product, consignment or not.
  -- NEW: only while the product is consignment AND holds a live balance.
  case
    when coalesce(a.movements_ever, 0) = 0 then 'مفتوح ← مفتوح'
    when coalesce(p.is_consignment, false) and coalesce(b.balance_base, 0) <> 0
      then 'مقفول ← مقفول'
    else '🔓 مقفول ← مفتوح'
  end as supplier_before_after
from public.products p
left join any_movement  a on a.product_id = p.id and a.salon_id = p.salon_id
left join live_movement l on l.product_id = p.id and l.salon_id = p.salon_id
left join balance       b on b.product_id = p.id and b.salon_id = p.salon_id
order by coalesce(a.movements_ever, 0) desc, p.name;

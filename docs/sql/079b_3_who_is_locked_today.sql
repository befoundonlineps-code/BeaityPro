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
-- 🔴 THE PREDICTION, AND IT IS THE OPPOSITE OF WHAT AN EARLIER DRAFT SAID.
--
--     flag_before_after      "مقفول ← مقفول" ON EVERY PRODUCT THAT MOVED.
--                            Not one release. Read on, this is the answer.
--     supplier_before_after  "🔓 مقفول ← مفتوح" on every non-consignment
--                            product that moved. This is where the release is,
--                            and it is broad.
--
-- ⚠️ THE DRAFT PREDICTED «شامبو 250 مل» and «مقشر ليزر» would come back with
-- movements_live = 0 and release. They will not, and 070 already said so —
-- each has ONE reversed supply among several live movements:
--
--     شامبو 250 مل   supply 100 · supply 20 · supply 7 · stocktake −2   live
--                    + supply 10, reversed          ⇒ 4 live, balance 125
--     مقشر ليزر      supply 5 · supply 10 · return −10                  live
--                    + supply 10, reversed          ⇒ 3 live, balance 5
--
-- Both stay locked on the flag.
--
-- ⚠️ AND THE SECOND ROW ABOVE WAS ITSELF MISCOUNTED HERE FIRST — it listed a
-- fourth live movement, "stocktake +5", which does not exist. 5 + 10 − 10 = 5
-- closes exactly against the measured balance; a stocktake of +5 would have
-- made it 10. The verdict never moved (both products stay locked either way),
-- but a wrong enumeration must not be carried into another header as a fact.
--
-- ⚠️ AND WHAT CAUGHT IT IS WORTH MORE THAN THE FIX: `balance_base` sits in the
-- same row as `movements_live`, and the two are derived independently — one
-- from a view over sums, one from a join count. So the row checks itself, and
-- nobody designed that. It is the cheapest kind of witness there is: two
-- numbers that must agree, printed side by side, in a query written for
-- neither purpose.
--
-- ⚠️ THE SLIP IS ONE WORD WIDE AND IT HAS NOW HAPPENED TWICE IN TWO FILES: "a
-- document was reversed" became "the product's movements were reversed". The
-- condition for release is that EVERYTHING the product moved is dead, not that
-- one reversal exists among them. Stated as a false prediction it would have
-- done the precise damage described for 079b_4's false witness: every row
-- reading "مقفول ← مقفول" against a header promising releases, and the reader
-- concluding the view is broken.
--
-- ⇒ NO PRODUCT IN THIS DATABASE QUALIFIES. Every product that moved has at
-- least one live movement.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND THAT IS A FINDING TO RECORD RATHER THAN A DISAPPOINTMENT: TEST ONE'S
-- CHANGE — from `exists` to "a live movement" — IS CORRECT AND THIS DATA
-- CANNOT DEMONSTRATE IT. Nothing here exercises it, so it ships UNTESTED IN
-- THE FIELD, on the same footing as 066b's per-salon guard, and it is written
-- into docs/sql/README.md as such rather than counted among what 079b proved.
--
-- The supplier column is what this run actually demonstrates, and it
-- demonstrates a lot: every ordinary product that ever moved was frozen by a
-- rule that had no reason to apply to it.
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

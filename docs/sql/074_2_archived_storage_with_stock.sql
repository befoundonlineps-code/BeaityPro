-- ==========================================================================
-- 074 · QUERY 2 of 2 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- WHY: whether the hole in 074_1 is theoretical or already inhabited.
--
-- An archived storage holding stock is goods that no screen can reach: the
-- storage is not in the picker, so its products are not listed, and a transfer
-- has no source to start from. Exactly the stranding 068a refuses one level
-- down — and if a row comes back here, it happened before anybody wrote a
-- guard for it.
--
-- ⚠️ EVERY storage, archived or not, with its balance. Filtering to the
-- archived ones would answer "is there stranded stock" and hide the number that
-- makes the answer readable — how much sits in the live ones, which is what
-- says whether a zero on the archived rows means "safe" or "nothing here yet".
--
-- ⚠️ AND is_active IS READ FROM to_jsonb ALONGSIDE, not named alone. The column
-- surfaced in 073_1 only because the whole row was read; naming it here and
-- nothing else would repeat the narrowing that hid it in the first place, in
-- the file written because it appeared.
--
-- WHAT TO LOOK AT:
--   • ⚠️ any row with is_active = false AND products_with_stock > 0 — that is
--     stranded stock existing today, and it outranks everything else here
--   • a storage with is_active = false and no stock is a clean archive, and is
--     the state the guard should keep reachable
--   • which_products names them, because "there is stock" sends somebody
--     looking and a list does not
-- ==========================================================================

select
  to_jsonb(s)                                        as storage_row,
  count(*) filter (where b.balance_base <> 0)        as products_with_stock,

  -- ⚠️ PER UNIT, BECAUSE A SINGLE SUM ADDS WHAT CANNOT BE ADDED.
  --
  -- A first version wrote sum(b.balance_base) across all products, and
  -- product_unit is pcs · ml · g. So it added millilitres to pieces to grams and
  -- printed one number. Every product is pcs today, so the total is homogeneous
  -- BY ACCIDENT — and nothing in the column said it was an accident. The first
  -- product measured in millilitres would have made it a false number that
  -- looks precise.
  --
  -- ⚠️ And it is this project's own rule, broken by the file that keeps quoting
  -- it: no number in front of a person without its unit. Four honest figures
  -- beat one comfortable one, and the signal was never in the total anyway — it
  -- is in products_with_stock and which_products.
  (
    select string_agg(x.unit || ': ' || x.total, ' · ' order by x.unit)
    from (
      select p2.base_unit as unit, sum(b2.balance_base) as total
      from public.product_balances b2
      join public.products p2 on p2.id = b2.product_id and p2.salon_id = b2.salon_id
      where b2.storage_id = s.id
        and b2.salon_id   = s.salon_id
        and b2.balance_base <> 0
      group by p2.base_unit
    ) x
  )                                                   as totals_by_unit,

  string_agg(p.name, ' · ' order by p.name)
    filter (where b.balance_base <> 0)                as which_products,
  -- The pairing that makes it one glance instead of two columns compared by eye.
  case
    when s.is_active = false and count(*) filter (where b.balance_base <> 0) > 0
      then '⚠️ ARCHIVED WITH STOCK'
    when s.is_active = false then 'archived, empty'
    else 'live'
  end                                                as verdict
from public.storages s
left join public.product_balances b
  on b.storage_id = s.id and b.salon_id = s.salon_id
left join public.products p
  on p.id = b.product_id and p.salon_id = b.salon_id
-- ⚠️ s.id ALONE. Postgres's functional dependency covers every column of s —
-- including to_jsonb(s) — once the primary key is grouped by, so the extra
-- names bought nothing. And `s.*` beside `to_jsonb(s)` on the same statement is
-- an unusual shape whose behaviour would have been discovered at execution.
-- This thread has paid that price twice; the narrow form removes the question.
group by s.id
order by verdict, s.name;

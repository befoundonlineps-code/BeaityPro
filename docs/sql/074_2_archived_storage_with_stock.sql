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
  coalesce(sum(b.balance_base) filter (where b.balance_base <> 0), 0) as total_base,
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
group by s.id, s.is_active, s.salon_id, s.*
order by verdict, s.name;

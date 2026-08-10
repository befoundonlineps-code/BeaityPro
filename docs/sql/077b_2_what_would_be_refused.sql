-- ==========================================================================
-- 077b · QUERY 2 of 2 -- VERIFICATION ONLY. Read-only: NOTHING IS WRITTEN.
--
-- RUN AFTER 077a.
--
-- ---------------------------------------------------------------------------
-- WHY: the guard's condition, run against live data without archiving anything.
-- Which storages could be archived today, and which would be refused and over
-- what.
--
-- ⚠️ AND IT MUST MATCH THE FUNCTION, WHICH IS THE ONLY THING IT IS FOR. 068b_3
-- drifted from its trigger exactly here — the trigger was corrected and the dry
-- run was not — so this reads product_balances with the same `<> 0` test the
-- body uses, and nothing of its own.
--
-- ⚠️ It also answers the semantic question the old body got right and a naive
-- version would get wrong: a storage whose movements NET TO ZERO holds nothing
-- and must remain archivable. If such a storage exists it appears here as
-- archivable with zero products, which is the correct answer and the one an
-- EXISTS-over-movements check would have refused.
--
-- ⚠️ AND WHAT IT CANNOT PROVE: this runs in the SQL editor as a role that
-- bypasses RLS. The trigger is now definer, so it reads as its owner — measured
-- separately by 068b_1's owner_bypasses_rls, which is the same dependency and
-- the same limit. A green result here says the condition is right, not that the
-- trigger can see the rows it selects.
--
-- WHAT TO LOOK AT:
--   • verdict — '⚠️ WOULD BE REFUSED' names the storages that cannot be
--     archived until they are emptied, and `which_products` names what to move
--   • 'archivable' with products_with_stock = 0 is the netted-to-zero case
--     working correctly
--   • totals_by_unit is per base unit, never one sum: pcs, ml and g do not add
-- ==========================================================================

select
  s.name                                          as storage_name,
  s.kind,
  s.is_active,
  count(*) filter (where b.balance_base <> 0)     as products_with_stock,
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
  )                                               as totals_by_unit,
  string_agg(p.name, ' · ' order by p.name)
    filter (where b.balance_base <> 0)             as which_products,
  case
    when count(*) filter (where b.balance_base <> 0) > 0
      then '⚠️ WOULD BE REFUSED'
    else 'archivable'
  end                                             as verdict
from public.storages s
left join public.product_balances b
  on b.storage_id = s.id and b.salon_id = s.salon_id
left join public.products p
  on p.id = b.product_id and p.salon_id = b.salon_id
group by s.id
order by verdict, s.name;

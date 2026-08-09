-- ==========================================================================
-- 056d · QUERY 7 of 7 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven). RUN AFTER 056c.
--
-- ---------------------------------------------------------------------------
-- WHY: how often unit_value will be 0, as a number rather than a worry.
--
-- ⚠️ NOT A PASS/FAIL. A product with no catalogue price is ordinary data, and
-- the decision already taken is that its line is written with unit_value = 0 so
-- the shortage stays VISIBLE and is charged nothing. This says how often that
-- will happen — which is the difference between a designed case and a surprise
-- six months from now.
--
-- ⚠️ THE EDITOR RUNS AS THE OWNER, so RLS is bypassed and these are the TRUE
-- counts across the whole database.
--
-- WHAT TO LOOK AT: no_price_though_sold_by_package is the interesting one — a
-- product sold by the package with no package price is the case where a
-- sales-basis fine silently charges nothing for a real shortage.
-- ==========================================================================

select
  count(*)                                              as products,
  count(*) filter (where p.nominal_purchase_price is null) as no_nominal_price,
  count(*) filter (where p.package_price is null)          as no_package_price,
  count(*) filter (where p.package_price is null
                     and p.sell_by_packages)                as no_price_though_sold_by_package
from public.products p
where p.kind = 'product';

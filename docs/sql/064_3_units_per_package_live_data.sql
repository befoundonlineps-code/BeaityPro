-- ==========================================================================
-- 064 · QUERY 3 of 5 -- SURVEY ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven).
-- Safe to run at any time.
--
-- ---------------------------------------------------------------------------
-- WHY: whether any live row ALREADY carries the value that would have raised
-- 22012 (division by zero) before the nullif guard was added to 056c.
--
-- ⚠️ ZERO IS REACHABLE, NOT HYPOTHETICAL. lib/productForm.js:200 sends
-- `Number(v.unitsPerPackage)`, and `Number('')` is 0 — an untouched box arrives
-- as a literal zero. Only the screen's validator refuses it. That is
-- unit_cost_required's lesson word for word: an empty field becomes 0, and 0
-- satisfies every range test ever written about it.
--
-- ⚠️ NULL WAS NEVER THE RISK. A null divisor yields null, and coalesce turns it
-- into the 0 that "no price" already means. Zero was the risk. Both columns are
-- counted anyway, because counting only what you expect is how you learn only
-- what you expected.
--
-- ⚠️ THE EDITOR RUNS AS THE OWNER, so RLS is bypassed and these are the TRUE
-- counts across the whole database — which is what makes them worth reading,
-- and which means they say nothing about isolation between salons.
--
-- EXPECTED: factor_zero and factor_negative both 0. A non-zero is a catalogue
-- fault worth fixing on its own, independent of the fine — 056c will no longer
-- stop to report it.
-- ==========================================================================

select
  count(*)                                              as products,
  count(*) filter (where p.units_per_package is null)    as factor_null,
  count(*) filter (where p.units_per_package = 0)        as factor_zero_expect_0,
  count(*) filter (where p.units_per_package < 0)        as factor_negative_expect_0
from public.products p
where p.kind = 'product';

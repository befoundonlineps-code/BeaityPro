-- ==========================================================================
-- 064 · QUERY 5 of 5 -- SURVEY ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven).
-- Safe to run at any time.
--
-- ---------------------------------------------------------------------------
-- WHY: a table can carry policies while row security is switched OFF, in which
-- case the policies are text and every row is visible to everybody.
--
-- ⚠️ POLICIES PRESENT AND RLS OFF IS THE MOST REASSURING-LOOKING FAILURE IN THIS
-- WHOLE AREA — 064_4 would print a perfect list of correct-looking predicates
-- about a table that is not enforcing any of them. 058 drew this distinction and
-- it is not pedantry; it is why this query exists as its own read rather than as
-- a footnote to the one above.
--
-- ⚠️ Every table in the schema, not the ones expected to matter. Same reason as
-- 064_4: a hand-written list fails open.
--
-- WHAT TO LOOK AT: rls_enabled must be true on storage_responsibles, employees,
-- storages, products, stock_movements, stock_fines and stock_fine_lines. Read
-- the rest of the column anyway — a false anywhere is worth knowing about.
-- ==========================================================================

select
  cl.relname                as table_name,
  cl.relrowsecurity         as rls_enabled,
  cl.relforcerowsecurity    as rls_forced
from pg_class cl
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relkind = 'r'
order by cl.relname;

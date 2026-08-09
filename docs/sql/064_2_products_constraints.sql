-- ==========================================================================
-- 064 · QUERY 2 of 5 -- SURVEY ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven).
-- Safe to run at any time.
--
-- ---------------------------------------------------------------------------
-- WHY: this is the question itself — does a CHECK on units_per_package exist in
-- the catalogue, or only in the diagram?
--
-- ⚠️ NO contype FILTER, deliberately. Asking `where contype = 'c'` is still
-- asking the catalogue, and it is the exact question that missed entry_uom —
-- which was a TYPE standing where a constraint was assumed. Reading every
-- constraint on the table and looking is the only version of this that cannot
-- fail the same way.
--
-- WHAT TO LOOK AT: any row whose definition mentions units_per_package —
-- expected, if the diagram is right, to read CHECK ((units_per_package > 0)).
-- If no such row exists, the diagram was wrong and 064_3 becomes the live
-- question. Either way 056c is already safe: its divisor is wrapped in
-- nullif(..., 0).
-- ==========================================================================

select
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname = 'products'
order by con.contype, con.conname;

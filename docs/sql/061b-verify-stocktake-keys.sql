-- ==========================================================================
-- 061b -- VERIFICATION ONLY, in its own paste. Run AFTER 061a.
--
-- PREPARED, NOT RUN BY ME. The owner executes it. No DDL.
--
-- ⚠️ THE SAME PROPERTY CHECK 060b USES, WIDENED TO THE FOUR TABLES THE FINE
-- READS THROUGH — and widened deliberately rather than pointed at the two
-- constraints 061a just changed.
--
-- Checking the two by name would confirm this fix and say nothing about the
-- next simple reference somebody adds. That is how six of these were found one
-- at a time, each because a person happened to notice it. The list below is
-- derived by the query; nothing here names a constraint.
--
-- EXPECTED
--
--   Every row `is_composite = true`, with exactly three exceptions — the
--   references to `salons` itself, which name one column because salons IS the
--   scope:
--       stock_fines_salon_id_fkey
--       stocktake_sessions_salon_id_fkey
--       (and product_orders' equivalent if it appears)
--
--   ⚠️ ANY OTHER false IS A SALON-SCOPED COLUMN THAT CAN POINT OUTSIDE ITS
--   SALON. A row appearing that nobody expected is the same finding wearing a
--   different name — read it, do not assume it is one of the known ones.
--
--   ⚠️ And `references_salons` is computed rather than judged, so the exception
--   cannot be claimed for a constraint that does not qualify for it.
-- ==========================================================================

select
  cl.relname as table_name,
  con.conname,
  (pg_get_constraintdef(con.oid) like 'FOREIGN KEY (%,%)%')   as is_composite,
  (pg_get_constraintdef(con.oid) like '%REFERENCES salons(%') as references_salons,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and con.contype = 'f'
  and cl.relname in ('stock_fines', 'stock_fine_lines',
                     'stocktake_sessions', 'stocktake_counts')
order by cl.relname, con.conname;

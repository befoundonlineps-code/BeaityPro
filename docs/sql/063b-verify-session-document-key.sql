-- ==========================================================================
-- 063b -- VERIFICATION ONLY, in its own paste. Run AFTER 063a. No DDL.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- ⚠️ THE PROPERTY AGAIN, not the constraint just changed — 061b's widening is
-- what found the seventh and eighth, and pointing this at one name would give
-- back the blindness that cost eight findings.
--
-- EXPECTED, over the four tables the fine reads through:
--
--   is_composite TRUE on every row EXCEPT the references to salons itself,
--   which name one column because salons IS the scope:
--       stock_fines_salon_id_fkey
--       stocktake_sessions_salon_id_fkey
--
--   ⚠️ AND started_by IS THE ONE DELIBERATE EXCEPTION, so it will read
--   is_composite = false with references_salons = false — the shape that means
--   "fault" on every other row. It is not one, and 062 settled why:
--   profiles carries no unique (id, salon_id) at all, so a composite key there
--   is not merely risky, it CANNOT BE CREATED. Written here so nobody reads the
--   row as the ninth instance and "fixes" it.
--
--   stocktake_sessions_document_id_fkey must now read
--     FOREIGN KEY (document_id, salon_id) REFERENCES stock_documents(id, salon_id)
--     ON DELETE RESTRICT
--   ⚠️ RESTRICT, not SET NULL. SET NULL would turn a finished stocktake back
--   into an open one, because document_id IS NULL is this module's definition
--   of "open".
-- ==========================================================================

select
  cl.relname as table_name,
  con.conname,
  (pg_get_constraintdef(con.oid) like 'FOREIGN KEY (%,%)%')   as is_composite,
  (pg_get_constraintdef(con.oid) like '%REFERENCES salons(%') as references_salons,
  (pg_get_constraintdef(con.oid) like '%SET NULL%')           as sets_null_on_delete,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and con.contype = 'f'
  and cl.relname in ('stock_fines', 'stock_fine_lines',
                     'stocktake_sessions', 'stocktake_counts')
order by cl.relname, con.conname;

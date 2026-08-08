-- ==========================================================================
-- 060b -- VERIFICATION ONLY, in its own paste. Run AFTER 060a.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No DDL: nothing here can undo anything.
--
-- ⚠️ ONE QUERY PER PASTE.
--
-- ---------------------------------------------------------------------------
-- ⚠️ IT CHECKS THE PROPERTY, NOT THE CONSTRAINT THAT WAS JUST CHANGED.
--
-- Checking stock_fines_document_id_fkey by name would confirm the fix and
-- confirm nothing else — which is exactly how the first three composite keys
-- were each missed until somebody happened to look at them. A fifth simple
-- reference added to either table next month would pass a by-name check without
-- a word.
--
-- So: every foreign key on both tables, with a computed answer to the only
-- question that matters about each one.
--
-- EXPECTED
--
--   FIVE rows, and `is_composite` TRUE on every single one:
--     stock_fines_employee_fkey        (employee_id, salon_id)
--     stock_fines_storage_fkey         (storage_id, salon_id)
--     stock_fines_document_id_fkey     (document_id, salon_id)   <- 060a
--     stock_fine_lines_fine_fkey       (fine_id, salon_id)  ON DELETE CASCADE
--     stock_fine_lines_product_fkey    (product_id, salon_id)
--
--   ⚠️ A FALSE ANYWHERE is a salon-scoped column that can point outside its
--   salon, and it is the fault this whole sequence exists to remove. A SIXTH
--   ROW nobody expected is the same finding wearing a different face — read the
--   name, do not assume it is one of these five renamed.
--
--   ⚠️ And salon_id's own reference to salons is deliberately NOT in this list:
--   it names one column because salons IS the scope. If it appears with
--   is_composite = false, that is correct and is the one exception. Said here
--   so nobody "fixes" it.
-- ==========================================================================

select
  cl.relname as table_name,
  con.conname,
  -- ⚠️ Computed rather than eyeballed. "FOREIGN KEY (a, b)" has a comma inside
  -- the first bracket and "FOREIGN KEY (a)" does not — so this answers, per
  -- row, the only question being asked, and a list of five definitions does not
  -- have to be read carefully by somebody who already believes they are right.
  (pg_get_constraintdef(con.oid) like 'FOREIGN KEY (%,%)%') as is_composite,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname in ('stock_fines', 'stock_fine_lines')
  and con.contype = 'f'
order by cl.relname, con.conname;

-- ==========================================================================
-- 053 -- SURVEY ONLY, before the order tables can be written.
--
-- PREPARED, NOT RUN BY ME. The owner executes it. Read-only: no DDL, nothing
-- created, nothing changed.
--
-- ---------------------------------------------------------------------------
-- WHY THIS COMES BEFORE THE SCRIPT AND NOT WITH IT
--
-- The plan puts RLS in the same script that creates the tables, because any gap
-- between creating a table and protecting it is a live hole rather than a
-- theoretical one. That is right — and it means the policy text has to be known
-- BEFORE the create is written, not after.
--
-- ⚠️ AND THIS REPOSITORY HAS NEVER HELD ONE. Every existing table was created
-- by the owner directly in the SQL editor, so no script here creates a policy
-- and no document records the text of one. DATABASE_DIAGRAM.md says the
-- policies were verified against pg_policies — it does not say what they are.
--
-- ⚠️ Inventing one is the worst available guess, because the two ways of being
-- wrong are not symmetric:
--
--   too strict  ->  nobody can read the table. Loud, immediate, recoverable.
--   too loose   ->  every salon reads every other salon's orders. Silent,
--                   and INDISTINGUISHABLE FROM CORRECT while there is one
--                   salon in the database — which there is.
--
-- That is the same silence as a view losing security_invoker: it works
-- perfectly until the day a second salon exists, and nothing on any screen
-- points at the line that caused it.
--
-- So the new tables copy the isolation the existing ones already use, read from
-- the database rather than reconstructed. `stock_documents` is the closest
-- relative: salon-scoped, written through an RPC, read directly by the screens.
-- ==========================================================================

select
  p.tablename,
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  -- The USING clause decides which rows are visible, and WITH CHECK decides
  -- which may be written. A table can be readable-but-not-writable by having
  -- one and not the other, so both are needed to copy the shape faithfully.
  p.qual        as using_clause,
  p.with_check  as with_check_clause
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in ('stock_documents', 'stock_movements', 'products')
order by p.tablename, p.cmd, p.policyname;

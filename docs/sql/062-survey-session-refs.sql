-- ==========================================================================
-- 062 -- SURVEY ONLY. Read-only: no DDL. ⚠️ ONE QUERY PER PASTE.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE SEVENTH AND EIGHTH, AND BOTH ARE MINE, AND BOTH ARE IN 054a
--
-- 061b's widened check found two more simple references, neither on anybody's
-- list:
--
--     stocktake_sessions_document_id_fkey  -> stock_documents(id)
--     stocktake_sessions_started_by_fkey   -> profiles(id)
--
-- That is the whole argument for widening it. Six were found one at a time, by
-- somebody noticing them; the seventh and eighth were found by a query that was
-- not looking for anything in particular.
--
-- ---------------------------------------------------------------------------
-- THEY ARE NOT THE SAME CASE, AND ONLY ONE IS PROPOSED FOR NARROWING
--
-- document_id -> stock_documents is the fix already applied twice. Its target
-- was proven safe by 059 (unique (id, salon_id), salon_id NOT NULL). Being
-- NULLABLE here is not an obstacle: MATCH SIMPLE passes a null, which is
-- exactly the behaviour an unposted session needs — the same reason
-- stock_fines.employee_id could go composite while staying nullable.
--
-- ⚠️ started_by -> profiles IS DIFFERENT, and my position is that it should be
-- LEFT ALONE. Three reasons, and the third is the one that decides it:
--
--   1. It is not part of the isolation chain. Every other column narrowed so
--      far answers "WHICH THING IN MY SALON". This one answers "which human
--      account touched this", and nothing hangs off it: no money, no movement,
--      no visibility. Its worst failure is a wrong word in the resume banner.
--
--   2. The invariant is already enforced where it matters. The INSERT policy on
--      stocktake_sessions requires salon_id to equal the CALLER's profile's
--      salon, and started_by defaults to auth.uid(). A profile with no salon
--      fails that policy before any foreign key is consulted.
--
--   3. ⚠️ AND NARROWING IT WOULD FORBID RATHER THAN CONSTRAIN — the trap 058
--      query 7 exists for, and here it is plausible rather than hypothetical,
--      because profiles.salon_id really is nullable. started_by is defaulted to
--      auth.uid() and therefore usually NOT null, so the composite key would
--      demand a profiles row matching (that id, this salon). For a salonless
--      profile no such row exists, and the whole session insert would be
--      refused — not the attribution, the count itself.
--
-- So: measure, then narrow document_id only. Queries 2 and 3 exist to test my
-- reasoning about started_by rather than to enable a change — if profiles turns
-- out to have unique (id, salon_id) AND a NOT NULL salon_id, reason 3 collapses
-- and the question is open again on reasons 1 and 2 alone.
-- ==========================================================================

-- 1 -- stocktake_sessions.document_id: nullable, confirmed rather than inferred
-- from ON DELETE SET NULL.
select
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'stocktake_sessions'
  and c.column_name = 'document_id';

-- 2 -- can profiles be referenced compositely at all? Every unique and
-- primary-key constraint on it, in full, with nothing filtered out.
select
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname = 'profiles'
  and con.contype in ('p', 'u')
order by con.contype, con.conname;

-- 3 -- and profiles.salon_id's nullability, read fresh rather than recalled
-- from 057. ⚠️ Quoting an earlier result from memory is how a stale sentence in
-- DATABASE_DIAGRAM became a premise this month.
select
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'profiles'
  and c.column_name = 'salon_id';

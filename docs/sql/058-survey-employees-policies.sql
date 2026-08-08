-- ==========================================================================
-- 058 -- SURVEY ONLY. Read-only: no DDL.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- ---------------------------------------------------------------------------
-- WHY THIS EXISTS: A CONCLUSION DRAWN FROM AN ABSENCE
--
-- 056a's stock_fines_select reads `employees` inside its USING clause, so
-- EMPLOYEES' OWN RLS APPLIES TO THAT SUBQUERY. If that table is ever narrowed —
-- or is already narrower than assumed — a fine becomes invisible even to
-- management. It fails closed, so nothing leaks; it also fails silently, and a
-- manager who cannot see a fine has no way to tell that from there being none.
--
-- ⚠️ AND WHAT IS "KNOWN" ABOUT IT TODAY IS NOT KNOWN. 057's query 4 listed
-- policies whose qual does NOT mention profiles.salon_id, and `employees` was
-- absent from that list — from which it follows only that it is not unusual in
-- that one respect. Reading "it must be the standard salon_id predicate" out of
-- that is an inference from an absence, not a reading of the text.
--
-- That is this round's own fault in its third form. First a hand-written LIST
-- failed open (CLAUDE.md §4b). Then a hand-written SENTENCE did, when
-- DATABASE_DIAGRAM was quoted as though it were a measurement. This would be an
-- ABSENCE FROM A FILTERED RESULT read as a positive fact — the same shape
-- again, and the most convincing of the three, because a query really did run.
--
-- Raised in review. One query, and it reads the text.
-- ==========================================================================

-- 1 -- every policy on employees, in full, with no filter of any kind.
--
-- ⚠️ Not `where cmd = 'SELECT'`. The subquery in stock_fines_select is a read,
-- but a table with RLS enabled and NO select policy refuses every read — and
-- that state is invisible to a query that only asks about select policies.
-- Reading all of them and looking is the only version that cannot miss it.
select
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual       as using_clause,
  p.with_check as with_check_clause
from pg_policies p
where p.schemaname = 'public'
  and p.tablename = 'employees'
order by p.cmd, p.policyname;

-- 2 -- and whether RLS is even on, which no policy listing can tell you.
--
-- ⚠️ A table with policies and relrowsecurity = false enforces none of them.
-- The listing above would look identical either way.
select
  c.relname,
  c.relrowsecurity     as rls_enabled,
  c.relforcerowsecurity as forced_for_owner,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('employees', 'profiles')
order by c.relname;

-- 3 -- the two columns the fine's policy depends on, read rather than assumed.
--
-- profile_id must be readable and must be the link 057 measured; role must be
-- the enum whose labels the policy names. ⚠️ If `role` were nullable, the IN
-- would go UNKNOWN for that row and the management branch would silently fail
-- to grant — which is safe and confusing, exactly like everything else here.
select
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'employees'
  and c.column_name in ('id', 'salon_id', 'profile_id', 'role')
order by c.column_name;

-- 4 -- the labels the management branch is allowed to name.
--
-- ⚠️ The IN list in 056a is a PLACEHOLDER taken from the reviewer's message, not
-- a decision. This is the list the owner chooses from, and a label misspelt in
-- the policy would be refused by Postgres as an invalid enum input — loud, which
-- is the good direction — but only when the policy is created, not when it runs.
select
  e.enumlabel,
  e.enumsortorder
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
  and t.typname = 'employee_role'
order by e.enumsortorder;

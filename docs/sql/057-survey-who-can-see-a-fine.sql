-- ==========================================================================
-- 057 -- SURVEY ONLY, before the fine's visibility is decided.
--
-- PREPARED, NOT RUN BY ME. The owner executes it. Read-only: no DDL.
--
-- ---------------------------------------------------------------------------
-- THE QUESTION, RAISED IN REVIEW AND NOT ANSWERABLE BY THE CONVENTION
--
-- stock_fines_select uses the same salon_id predicate every other table uses,
-- so every member of staff can read every colleague's fines.
--
-- ⚠️ THAT IS CONSISTENT AND THAT IS NOT AN ARGUMENT. The convention was built
-- for stock: quantities, costs, documents — data about THINGS, where nobody is
-- exposed by a colleague reading it. stock_fines is the first table in this
-- schema whose rows are about a named person's MONEY. A convention extended to
-- a case it was never tested against is the same move as "same shape, same
-- claim", which this project has paid for repeatedly.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND NARROWING MAY NOT BE EXPRESSIBLE AT ALL TODAY, which is why this is a
-- survey and not a patch.
--
-- DATABASE_DIAGRAM records that employees are "مستقلين عن profiles" —
-- independent of profiles. RLS can only speak about auth.uid(), which reaches
-- profiles. So "an employee may read her OWN fine" requires a path from a
-- profile to an employee row, and if no such column exists the rule cannot be
-- written at all — not narrowly, not at all.
--
-- Likewise "management may read all of them" requires some notion of management
-- on profiles. Whether one exists has never been read here.
--
-- So the order is: find out what the schema can express, THEN decide. Choosing
-- first would produce a decision that cannot be implemented, or a column added
-- to make a policy possible — which is the schema following the policy rather
-- than the other way round.
--
-- ⚠️ Every query reads a whole category and filters by eye (CLAUDE.md §4b).
-- Asking `where column_name = 'employee_id'` would find what I already expect
-- and stay silent about a link spelled any other way — which is exactly how
-- first_name/last_name and reverses_document_id were each missed once.
-- ==========================================================================

-- 1 -- profiles, EVERY column. What identifies a user, and whether anything on
-- the row says what they are allowed to be.
select
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'profiles'
order by c.ordinal_position;

-- 2 -- employees, EVERY column. If a path to a profile exists it is here, and
-- it may be spelled profile_id, user_id, auth_id or something else entirely.
select
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'employees'
order by c.ordinal_position;

-- 3 -- every foreign key in the schema that touches profiles or employees.
--
-- ⚠️ This is the query that would find a link table nobody thought to mention —
-- a join between the two spelled under a name this conversation has never used.
-- Reading the relationships rather than guessing the column is the whole point.
select
  cl.relname   as from_table,
  con.conname,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and con.contype = 'f'
  and pg_get_constraintdef(con.oid) like any (array['%REFERENCES profiles%', '%REFERENCES employees%'])
order by cl.relname, con.conname;

-- 4 -- and whether any policy in the schema already narrows by something other
-- than salon_id.
--
-- If one exists, the fine should follow it rather than inventing a second way
-- of saying the same thing; if none does, the fine would be the first, and that
-- is a decision rather than a copy.
select
  p.tablename,
  p.cmd,
  p.policyname,
  p.qual
from pg_policies p
where p.schemaname = 'public'
  and (p.qual is null or p.qual not like '%profiles.salon_id%')
order by p.tablename, p.cmd, p.policyname;

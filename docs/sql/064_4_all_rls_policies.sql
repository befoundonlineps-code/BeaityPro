-- ==========================================================================
-- 064 · QUERY 4 of 5 -- SURVEY ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven).
-- Safe to run at any time.
--
-- ---------------------------------------------------------------------------
-- WHY: 056c's whole resolution argument rests on employees and
-- storage_responsibles BOTH carrying the plain salon predicate, so that every
-- user in a salon sees the same set and the COUNT is the same whoever posts. If
-- either is ever narrowed per user, TWO responsibles can look like ONE to a
-- receptionist — and the fine then names a person who was not the only one
-- answerable. A wrong name on a wage deduction, written silently.
--
-- employees was measured directly by 058. storage_responsibles has NEVER had
-- its policy read — only its columns. That asymmetry is 058's own warning
-- applied to a different table: absence from a filtered result is not a fact.
--
-- ⚠️ NOT FILTERED TO "THE TABLES 056c TOUCHES". That list is written by hand and
-- fails OPEN the moment it forgets one. The schema is small enough to read
-- whole and filter by eye.
--
-- WHAT TO LOOK AT: the `qual` column (the USING clause) on every
-- storage_responsibles row and every employees row. Expected on both: the plain
-- predicate, salon_id = (select profiles.salon_id from profiles where
-- profiles.id = auth.uid()) — and nothing narrower, no reference to the calling
-- user's own employee id or role.
--
-- ⚠️ A policy list is only half the answer; 064_5 asks whether RLS is switched
-- on at all.
-- ==========================================================================

select
  p.tablename,
  p.policyname,
  p.cmd,
  p.roles,
  p.qual,
  p.with_check
from pg_policies p
where p.schemaname = 'public'
order by p.tablename, p.cmd, p.policyname;

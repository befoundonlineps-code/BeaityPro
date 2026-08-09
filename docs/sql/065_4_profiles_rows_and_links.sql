-- ==========================================================================
-- 065 · QUERY 4 of 4 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- WHY: 065_3 reads what the profiles table CAN hold. This reads what it does
-- hold, and how far the second fork actually is if it turns out to be the one.
--
-- ⚠️ to_jsonb(p) — THE WHOLE ROW, NOT A COLUMN LIST. This is the single
-- discipline that produced this entire line of questioning: `run_6` wrote
-- to_jsonb(e) instead of naming columns, so `profile_id: null` arrived with the
-- row without anyone asking for it. Had it said `e.name`, nothing would have
-- surfaced, the fine screen would have been built, and it would have shown an
-- empty list forever with no way to tell that from "no fines".
--
-- Naming columns here would repeat exactly the mistake that was caught, in the
-- one query written to understand it.
--
-- ⚠️ THE EDITOR RUNS AS THE OWNER, so RLS is bypassed: every profile in the
-- database, which is the true set.
--
-- WHAT TO LOOK AT:
--   • how many profile rows exist at all, and what each one carries
--   • linked_employee — null on every row means no account is tied to an
--     employee anywhere, which is the same fact run_7 measured from the other
--     side. Seeing it from both sides is the point: run_7 asked "which employees
--     have accounts", this asks "which accounts have employees", and a link
--     table that is empty in both directions is a different situation from one
--     that is merely sparse.
--   • whether any column here could serve as a management marker — read it
--     beside 065_3 rather than instead of it.
-- ==========================================================================

select
  to_jsonb(p)                                as profile_row,
  (select e.id   from public.employees e where e.profile_id = p.id) as linked_employee,
  (select e.role from public.employees e where e.profile_id = p.id) as linked_role
from public.profiles p
order by p.id;

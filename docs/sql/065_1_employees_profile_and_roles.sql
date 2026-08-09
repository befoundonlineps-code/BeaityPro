-- ==========================================================================
-- 065 · QUERY 1 of 2 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time, before or after anything else.
--
-- ⚠️ This is MY writing of the query review called `run_7`. That file never
-- reached me — the third time now (check1, check2, run_7). If the reviewer's
-- version arrives, compare the two rather than assuming they agree.
--
-- ---------------------------------------------------------------------------
-- WHY: the first real fine was written against اية النمورة, and her row carries
-- profile_id = null — no login account.
--
-- stock_fines_select identifies "me" through employees.profile_id = auth.uid().
-- An employee with no profile_id can never match that, so for her the first half
-- of the policy — "a fine is visible to the employee it names" — does not work
-- at all. That is not a defect: someone with no account never signs in. It
-- decides how much of the policy is alive.
--
-- ⚠️ AND THE ANSWER CHANGES WHAT THE POLICY IS. If most employees have no
-- account — the normal shape of a salon where only the owner signs in — then the
-- policy reduces in practice to "managers only", which is a different decision
-- from the one taken when the ten roles were shown. The fine screen, when it is
-- built, will be built on this policy. Its reach should be known before, not
-- after.
--
-- ⚠️ AND IT ANSWERS THE DECLARED EDGE IN THE SAME PASS: hiring a second employee
-- with the `executive` role makes the candidate set two on the common storage,
-- which silently turns fines off there. How many hold it today is the distance
-- to that edge, and it is one column of this same listing.
--
-- ⚠️ EVERY EMPLOYEE, NO FILTER AND NO ROLLUP. A count per role would answer the
-- executive question and hide the profile question; a count of nulls would do
-- the reverse. The table is small enough to read whole, and reading the category
-- and filtering by eye is what this project does after a `contype = 'c'` filter
-- missed a TYPE it was not asking about.
--
-- ⚠️ THE EDITOR RUNS AS THE OWNER, so RLS is bypassed: this is every employee in
-- the database, which is the true set. It says nothing about isolation.
--
-- WHAT TO LOOK AT:
--   • has_login — how many rows say false. That is the reach of the policy's
--     first half, counted in people.
--   • role — how many rows say 'executive'. One means the common storage still
--     resolves to a single person; two means fines are already off there.
-- ==========================================================================

select
  e.id,
  e.name,
  e.role,
  (e.profile_id is not null) as has_login,
  e.profile_id,
  e.is_assistant,
  e.salon_id,
  e.created_at
from public.employees e
order by e.role, e.name;

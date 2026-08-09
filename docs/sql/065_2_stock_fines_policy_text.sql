-- ==========================================================================
-- 065 · QUERY 2 of 2 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- WHY: 065_1 measures how many employees can satisfy the policy. This one reads
-- what the policy actually SAYS, out of the catalogue, rather than reasoning
-- from anyone's description of it.
--
-- ⚠️ THE DESCRIPTION HAS BEEN PASSED AROUND SEVERAL TIMES IN THIS REVIEW — "a
-- fine is visible to the employee it names, or to an administrator, executive or
-- owner" — and it has never once been read back from pg_policies in a message
-- either of us could see. 064_4 printed every policy in the schema, but the
-- conclusions drawn about stock_fines were drawn from prose, and prose is where
-- `reversed_document_id` and `nominal_purchase_price` both went wrong.
--
-- ⚠️ AND THE STAKES ARE SPECIFIC, not general tidiness: the exact role list in
-- the USING clause decides who the fine screen can show a fine to. If it names
-- three roles and the salon's employees hold two of them, the screen has a
-- smaller audience than its designer thinks. Getting that from the catalogue
-- costs one query; getting it wrong costs a screen built for the wrong people.
--
-- ⚠️ BOTH TABLES, NOT ONE. stock_fine_lines carries the numbers — shortage_base,
-- unit_value, line_value — and its policy was measured to be the plain salon
-- predicate. Reading them side by side is what makes the asymmetry visible
-- rather than remembered: the head is restricted, the lines are not, and the
-- lines are where the money is written.
--
-- WHAT TO LOOK AT: `qual` on stock_fines_select — the roles it names, and
-- whether it reaches the employee through profile_id as assumed. Then
-- stock_fine_lines_select beside it, which should be the plain salon predicate.
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
  and p.tablename in ('stock_fines', 'stock_fine_lines')
order by p.tablename, p.cmd, p.policyname;

-- ==========================================================================
-- 082 -- SURVEY ONLY. Read-only: nothing is written. RUN AFTER 077a AND 079a.
--
-- ⚠️ TWO LINES, AND ITS PURPOSE IS NARROWER THAN IT LOOKS. It confirms that
-- what is STORED matches what was SENT. It does not discover anything, and it
-- was nearly written to discover something already answered.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS NOT WORTH A FILE, AND WHY:
--
-- The live question — do the two stock guards COMPARE a balance or merely test
-- that a row EXISTS in product_balances — matters, because «سيروم علاجي 100
-- مل» has two live movements and a balance of exactly zero, so it HAS a row.
-- Under an `exists` test, a storage holding only that product would be refused
-- archiving on the grounds of stock that is not there.
--
-- ✅ And the repository answers it:
--
--     069a:101   refuse_unlinking_stocked_folder    b.balance_base <> 0
--     077a:119   refuse_archiving_stocked_storage   b.balance_base <> 0
--
-- Both COMPARE. The failing case does not exist. And 078 had already printed
-- all eleven trigger bodies in full, so nothing here needed discovering by
-- another survey.
--
-- ---------------------------------------------------------------------------
-- 🔴 SO WHY THIS RUNS ANYWAY — and the reason is a distinction this thread has
-- now corrected twice in a row.
--
-- Those two references are LINE NUMBERS IN FILES. That is the same substitution
-- just corrected for DATABASE_DIAGRAM:447: one grade better, because a source
-- file is what was sent rather than what somebody wrote about it — and the same
-- class, because **the file says what was sent and the catalogue says what
-- settled.**
--
-- ⚠️ AND THE GAP IS NOT THEORETICAL HERE:
--
--   • refuse_archiving_stocked_storage was found ALREADY LIVE, in a different
--     form, in the middle of this round — the repository did not know it
--     existed, and 077a was written to replace what was actually there.
--   • 079b_2 measured freeze_consignment_after_use's flags, its settings and
--     its Arabic — and never its body.
--   • 078's printout PREDATES both 077a and 079a, so its copies are the old
--     ones.
--
-- ⇒ Whether the stored text matches the deposited text is a genuinely open
-- question. That is all this asks.
--
-- ⚠️ WITNESS OF TRUTH — item 1ج: THREE rows, and proname is printed, so a
-- missing function shows as an absent NAME. Fewer than three means one of them
-- is not there, which would itself be the finding.
--
-- ⚠️ pg_get_functiondef, NOT prosrc — the definition carries SECURITY DEFINER
-- and `set search_path`, and prosrc silently drops both.
-- ==========================================================================

select
  p.proname                  as function_name,
  pg_get_functiondef(p.oid)  as stored_definition
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in (
    'refuse_unlinking_stocked_folder',
    'refuse_archiving_stocked_storage',
    'freeze_consignment_after_use'
  )
order by p.proname;

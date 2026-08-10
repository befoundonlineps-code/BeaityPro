-- ==========================================================================
-- 082 -- SURVEY ONLY. Read-only: nothing is written. RUN AFTER 077a AND 079a.
--
-- Four columns. It confirms that what is STORED matches what was SENT — it
-- does not discover anything, and it was nearly written to discover something
-- already answered.
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
-- ✅ And the repository answers it: 069a:101 and 077a:119 both compare
-- `b.balance_base <> 0`. And 078 had already printed all eleven trigger bodies
-- in full.
--
-- 🔴 SO WHY THIS RUNS: those are LINE NUMBERS IN FILES — the same substitution
-- corrected for DATABASE_DIAGRAM:447 one round ago. One grade better, because
-- a source file is what was SENT rather than what somebody wrote about it, and
-- the same class, because **the file says what was sent and the catalogue says
-- what settled.** Not theoretical: refuse_archiving_stocked_storage was found
-- ALREADY LIVE in a different form mid-round, 079b_2 measured
-- freeze_consignment_after_use's flags and its Arabic and never its body, and
-- 078's printout predates both 077a and 079a.
--
-- ---------------------------------------------------------------------------
-- 🔴 AND THE FIRST DRAFT PRINTED THREE WHOLE BODIES FOR THE EYE, ON A QUESTION
-- SHAPED "does A match B" — which is what 079b_2 WAS REWRITTEN TO STOP DOING,
-- in this same series, for this same reason.
--
-- "Nobody proof-reads a four-hundred-character Arabic paragraph", and the
-- incident behind that rule was eighteen sentences silently translated, each
-- still fluent. Three function bodies are far longer, and comparing them
-- against files in another window at the end of a long day does not happen.
--
-- ⚠️ AND THE FULL AUTOMATIC COMPARISON IS NOT AVAILABLE HERE: the expected
-- text lives in the repository, not the database, and embedding it would
-- create the second copy 069a exists to prevent. Three cheap things are
-- available instead — and one of them was written, RUN, and rejected.
--
-- ---------------------------------------------------------------------------
-- 🔴 A ✅/🔴 NEEDLE WAS WRITTEN AND FAILED IN BOTH DIRECTIONS, MEASURED.
--
--   position('balance_base <> 0' in prosrc) > 0
--     → 🔴 on a guard that compares correctly, because the ordinary shape —
--       and 077a's own shape — sums into a variable and compares the variable:
--
--           select coalesce(sum(b.balance_base), 0) into v_balance … ;
--           if v_balance <> 0 then raise …
--
--       The needle would have screamed at the real 077a.
--
--   loosened to '<> 0'
--     → fixes that and breaks the reverse: prosrc carries COMMENTS, so a body
--       whose comment mentions "balance <> 0" while its code tests `exists`
--       passes. That is 077b_1 literally, where a needle counted
--       stock_movements inside a comment.
--
-- ⇒ A needle that errs in the direction that screams AND in the direction that
-- stays silent is not a check, and does not get to wear a ✅.
--
-- ✅ WHAT SURVIVES IS THE USEFUL HALF: print the five lines around the
-- product_balances read. The reader still decides — but over five lines
-- instead of a hundred and twenty, and that is the difference between a check
-- that happens and one that is skipped.
--
-- ⚠️ And a guard that does NOT read product_balances at all prints so, which
-- would itself be the finding.
--
-- ---------------------------------------------------------------------------
-- ⚠️ identity_args — BECAUSE THE WITNESS COUNTS ROWS AND HAS NO READING FOR
-- "FOUR". An old overload under the same name prints a duplicated name and
-- reads as a display glitch, when it is a real discovery: the trigger executes
-- only one of them (CLAUDE.md item 5 — a function's identity is its
-- arguments). With the signature beside it, a fourth row becomes legible.
--
-- ⚠️ AND A TRIGGER FUNCTION TAKES NO ARGUMENTS, so the column returns an EMPTY
-- STRING and prints a blank cell that reads as null. Wrapped in nullif. That
-- is 080's own lesson — coalesce cannot see '' — applied here in the same
-- round it was learned.
--
-- ⚠️ definition_md5 — IT PINS TODAY. IT DOES NOT COMPARE WITH THE FILE, and
-- nobody should try: pg_get_functiondef RE-RENDERS the function — it rewrites
-- the header and the dollar quoting — so its output never equals the source
-- bytes, and an md5 taken against the file would report a difference that does
-- not exist. What it is for: recorded in the handoff, tomorrow's drift becomes
-- a glance at thirty-two characters instead of reading three bodies.
--
-- ⚠️ WITNESS OF TRUTH — item 1ج: THREE rows, and proname is printed, so a
-- missing function shows as an absent NAME. More than three is an overload and
-- identity_args is what makes it readable.
-- ==========================================================================

select
  p.proname                                                     as function_name,
  coalesce(
    nullif(pg_get_function_identity_arguments(p.oid), ''),
    '(بلا وسائط — دالّة مشغّل)')                                as identity_args,
  md5(pg_get_functiondef(p.oid))                                as definition_md5,
  coalesce(
    (select string_agg(a.line, E'\n' order by a.n)
       from regexp_split_to_table(p.prosrc, E'\n') with ordinality as a(line, n)
      where exists (
        select 1
          from regexp_split_to_table(p.prosrc, E'\n') with ordinality as b(line, n)
         where b.line ilike '%product_balances%'
           and abs(a.n - b.n) <= 2
      )),
    '🔴 (ما بيقرأ product_balances إطلاقًا — وهاد هو الاكتشاف)')  as around_the_balance_read
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in (
    'refuse_unlinking_stocked_folder',
    'refuse_archiving_stocked_storage',
    'freeze_consignment_after_use'
  )
order by p.proname, identity_args;

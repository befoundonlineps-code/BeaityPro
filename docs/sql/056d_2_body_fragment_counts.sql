-- ==========================================================================
-- 056d · QUERY 2 of 7 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven). RUN AFTER 056c.
--
-- ---------------------------------------------------------------------------
-- WHY: the function's CONTENT, because `where proname = ...` cannot tell a
-- reverted body from a current one — both carry the same name and the same
-- signature. Query 1 proves the function exists; only this one proves it is the
-- function 056c wrote.
--
-- ⚠️ Every needle is punctuation-bearing or a quoted literal, never a bare word
-- a comment could also contain. The counter cannot tell code from comment, and
-- 056c's header discusses all of these by name.
--
-- ⚠️ WITH EXACTLY ONE EXCEPTION, AND IT IS MARKED WHERE IT SITS:
-- nullif_comment_updated_expect_1 matches a phrase FROM a comment, deliberately,
-- because a comment is the thing it is checking. The rule above is about not
-- mistaking a comment for code; this needle is not making that mistake, it is
-- aiming at the comment on purpose. What makes it safe is measurement rather
-- than intent — the phrase occurs exactly once in the body — and the rule stands
-- unchanged for every other needle here. Do not copy this pattern to check code.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THIS FILE HAS AN ORDER DEPENDENCY THAT ITS COLUMN NAMES CANNOT EXPRESS
--
-- nullif_comment_updated_expect_1 reads 0 until 056c has been RE-RUN to sync the
-- corrected comment into the deployed body. A column named expect_1 answering 0
-- in a row of ones reads as a failure, and here it is not one — it is the
-- database still carrying the older wording.
--
-- So the binding order is: 056c (re-run) -> 056d_2 -> 056d_3. Nothing in this
-- file should be read before that re-run.
--
-- ⚠️ Written HERE rather than said in a message, because this file is read alone
-- six months from now and the message is not read with it.
--
-- EXPECTED, AFTER THE RE-RUN: every column matches the number in its own name,
-- and fine_before_close_expect_true is true.
-- ==========================================================================

with fn as (
  select p.prosrc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'post_stocktake_session'
)
select
  (select (length(prosrc) - length(replace(prosrc, 'insert into stock_fines (id,', '')))
          / length('insert into stock_fines (id,') from fn)                 as fine_head_insert_expect_1,
  (select (length(prosrc) - length(replace(prosrc, 'insert into stock_fine_lines (', '')))
          / length('insert into stock_fine_lines (') from fn)               as fine_lines_insert_expect_1,
  -- The id is generated, never RETURNED: RETURNING applies stock_fines_select,
  -- which is not the plain salon predicate, and would refuse a poster who is
  -- neither the fined employee nor a manager. Expect 1 and 0 respectively.
  (select (length(prosrc) - length(replace(prosrc, 'v_fine_id := gen_random_uuid();', '')))
          / length('v_fine_id := gen_random_uuid();') from fn)              as fine_id_generated_expect_1,
  (select (length(prosrc) - length(replace(prosrc, 'returning id into v_fine_id', '')))
          / length('returning id into v_fine_id') from fn)                  as fine_id_returned_expect_0,
  -- The purchase basis reads the stamped cost, NOT the nominal column whose
  -- unit is unrecorded (item 31). `m.unit_cost` qualified is the fine's read;
  -- the ladder's own reads are unqualified or use a different alias.
  (select (length(prosrc) - length(replace(prosrc, 'when ''purchase_price'' then m.unit_cost', '')))
          / length('when ''purchase_price'' then m.unit_cost') from fn)     as purchase_basis_is_unit_cost_expect_1,
  -- ⚠️ The needle carries `nullif` deliberately. A zero packaging factor is
  -- reachable (Number('') is 0 in productForm.js:200) and would raise 22012,
  -- taking the whole posting down for a catalogue fault. Matching the bare
  -- division instead would go on saying ✓ about a body that had lost the guard.
  (select (length(prosrc) - length(replace(prosrc, 'p.package_price / nullif(p.units_per_package, 0)', '')))
          / length('p.package_price / nullif(p.units_per_package, 0)') from fn) as sales_basis_per_base_unit_expect_1,
  -- The "nobody is charged" half exists at all. Both labels are written once,
  -- in the one CASE that decides between them.
  (select (length(prosrc) - length(replace(prosrc, '''many_responsibles''', '')))
          / length('''many_responsibles''') from fn)                        as many_responsibles_expect_1,
  (select (length(prosrc) - length(replace(prosrc, '''no_responsible''', '')))
          / length('''no_responsible''') from fn)                           as no_responsible_expect_1,
  -- ⚠️ THE ONLY NEEDLE HERE AIMED AT A COMMENT, AND IT EXISTS BECAUSE OF WHAT
  -- THE OTHER NINE CANNOT SAY.
  --
  -- 056c was corrected after it ran: 064_2 read the catalogue and the note
  -- beside `nullif` turned out to overstate its own guard. Nothing executable
  -- changed — which means re-running 056c to sync the comment would be followed
  -- by a verification that proves ONLY THAT WHAT DID NOT CHANGE DID NOT CHANGE,
  -- and says nothing about the single thing that did.
  --
  -- ⚠️ This is last round's stale-needle fault mirrored. There a needle outlived
  -- the text it matched; here a needle was missing for text that was born. Both
  -- leave a ✓ that is about something other than the change.
  --
  -- ⚠️ And a comment is the right target precisely because the comment SHIPS:
  -- whoever reads this function reads it through pg_get_functiondef, so a note
  -- that is right in the repository and wrong in the database is the wrong note.
  -- That is 046's lesson — a description shipped to the database becomes part of
  -- the behaviour it describes.
  --
  -- Expect 0 BEFORE the re-run and 1 after. Zero here is not a failure; it is
  -- the deployed body still carrying the older wording.
  (select (length(prosrc) - length(replace(prosrc, 'DEAD CODE TODAY, PROVABLY', '')))
          / length('DEAD CODE TODAY, PROVABLY') from fn)                      as nullif_comment_updated_expect_1,
  -- ⚠️ THE ORDER 054c ③ DEPENDS ON: the session is closed by the LAST statement,
  -- so the fine block must sit ABOVE it. A body where the fine insert came after
  -- would still work today and would silently break the narrowing of
  -- stocktake_counts' UPDATE policy later.
  --
  -- ⚠️ The first term is not redundant. position() answers 0 for absent, and
  -- `0 < n` is true — so without it this column would report ✓ on a body that
  -- had no fine insert at all, which is the one answer it must never give.
  (select position('insert into stock_fine_lines (' in prosrc) > 0
      and position('insert into stock_fine_lines (' in prosrc)
        < position('update stocktake_sessions' in prosrc) from fn)          as fine_before_close_expect_true
;

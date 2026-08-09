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
-- EXPECTED: every column matches the number in its own name, and
-- fine_before_close_expect_true is true.
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

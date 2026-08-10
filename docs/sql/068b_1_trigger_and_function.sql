-- ==========================================================================
-- 068b · QUERY 1 of 3 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN AFTER 068a.
--
-- ---------------------------------------------------------------------------
-- WHY: that the trigger exists, fires on the right event, that the function kept
-- the two properties CREATE OR REPLACE silently resets, and that its OWNER can
-- actually see the rows it is asked to guard.
--
-- ⚠️ prosecdef AND search_path ARE READ FROM THE DEFINITION, not assumed.
-- CLAUDE.md item 6: any CREATE OR REPLACE rewrites the object whole, and every
-- property not restated is exposed. A function that lost `set search_path` still
-- works and still passes every behavioural test.
--
-- security DEFINER is deliberate. A first draft said invoker and justified it
-- with a cross-salon leak that `b.salon_id = old.salon_id` already refuses. The
-- deciding argument is the direction of failure: invoker fails toward
-- PERMITTING — narrow the SELECT policy on stock_movements and the guard sees
-- nothing, so it allows the one deletion it exists to refuse.
--
-- ⚠️ AN EARLIER VERSION OF THIS FILE NAMED THE OUTPUT COLUMN
-- `is_security_definer_expect_false` AFTER THE FUNCTION HAD BECOME definer.
-- Not a stale comment — a stale expectation INSIDE THE RESULT. Whoever ran it
-- would read a column called "expected false" holding true and mark a success
-- as a failure; and the worst repair available to them is to put the function
-- back to invoker so the name comes true, restoring the exact fail-toward-
-- permitting this whole correction removed. That would pass every test we have,
-- because the difference only shows the day stock_movements' policy narrows.
--
-- It is 066c_1 again, one degree worse: there the stale list was in a comment,
-- here it was in the output.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND THE OWNER COLUMNS, WHICH CLOSE A DOOR definer ONLY MOVED
--
-- product_balances is a view with security_invoker = true, and an invoker view
-- inside a definer function is evaluated with THE FUNCTION OWNER'S rights. If
-- that role does not bypass RLS, the view returns zero rows, v_products comes
-- back empty, and the delete passes. Same door as before, an owner standing
-- where a policy stood.
--
-- ⚠️ Nothing else here can see it. 068b_3 runs the condition in the SQL editor
-- as a role that bypasses RLS, so it always sees everything and gives a
-- reassuring answer about a path the trigger does not take. Two green checks
-- that never touch the assumption.
--
-- EXPECTED: one trigger row, BEFORE DELETE, FOR EACH ROW, on
-- storage_categories; prosecdef = TRUE; search_path=public in proconfig; and
-- owner_bypasses_rls = TRUE.
--
-- ⚠️ If owner_bypasses_rls comes back FALSE, the trigger is a guard that cannot
-- see what it guards — do not ship the storage window until that is resolved.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND THIS READING HAS A SHELF LIFE. RUN IT AGAIN AFTER ANY ROLE CHANGE.
--
-- rolbypassrls is a property of a ROLE, not of anything in this repository. It
-- can be revoked, or the function's owner changed, without a commit, without a
-- migration, and without a single test going red. Everything here would keep
-- passing while the trigger quietly stopped being able to see stock.
--
-- ⚠️ So this is not a once-in-the-project's-life check. It belongs to the same
-- class as the run-state log itself: a fact that lives on the owner's side and
-- that the repository cannot watch. Re-run it whenever database roles or
-- ownership are touched — and record the result in docs/sql/README.md, because
-- "it was true when we looked" is the only form this claim can ever take.
--
-- No guard is asked for here, because none can be built from inside the
-- repository. What is asked is that the sentence be written down rather than
-- the reading be mistaken for a standing promise.
-- ==========================================================================

select
  t.tgname                                   as trigger_name,
  c.relname                                  as on_table,
  t.tgtype                                   as tgtype_bits,
  pg_get_triggerdef(t.oid)                   as definition,
  p.proname                                  as function_name,
  p.prosecdef                                as is_security_definer_expect_true,
  p.proconfig                                as settings_expect_search_path,
  owner.rolname                              as function_owner,
  owner.rolbypassrls                         as owner_bypasses_rls_expect_true,
  owner.rolsuper                             as owner_is_superuser
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_roles owner on owner.oid = p.proowner
where n.nspname = 'public'
  and c.relname = 'storage_categories'
  and not t.tgisinternal
order by t.tgname;

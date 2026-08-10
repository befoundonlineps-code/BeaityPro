-- ==========================================================================
-- 068b · QUERY 1 of 3 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN AFTER 068a.
--
-- ---------------------------------------------------------------------------
-- WHY: that the trigger exists, fires on the right event, and that the function
-- kept the two properties CREATE OR REPLACE silently resets.
--
-- ⚠️ security invoker AND search_path ARE READ FROM THE DEFINITION, not assumed.
-- CLAUDE.md item 6: any CREATE OR REPLACE rewrites the object whole, and every
-- property not restated is exposed. A function that lost `set search_path` still
-- works and still passes every behavioural test.
--
-- ⚠️ AND security DEFINER is deliberate here. A first draft said invoker and
-- justified it with a cross-salon leak that `b.salon_id = old.salon_id` already
-- refuses. The deciding argument is the direction of failure: invoker fails
-- toward PERMITTING — narrow the SELECT policy on stock_movements and the
-- guard sees nothing, so it allows the one deletion it exists to refuse.
--
-- EXPECTED: one trigger row, BEFORE DELETE, FOR EACH ROW, on
-- storage_categories; prosecdef = TRUE; and search_path=public in proconfig.
--
-- ⚠️ Both properties are read rather than assumed because CREATE OR REPLACE
-- rewrites the function whole and resets everything not restated — a body that
-- lost `set search_path` behaves identically until the day it does not.
-- ==========================================================================

select
  t.tgname                                   as trigger_name,
  c.relname                                  as on_table,
  t.tgtype                                   as tgtype_bits,
  pg_get_triggerdef(t.oid)                   as definition,
  p.proname                                  as function_name,
  p.prosecdef                                as is_security_definer_expect_false,
  p.proconfig                                as settings_expect_search_path
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public'
  and c.relname = 'storage_categories'
  and not t.tgisinternal
order by t.tgname;

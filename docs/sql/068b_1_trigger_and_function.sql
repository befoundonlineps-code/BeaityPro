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
-- ⚠️ AND security INVOKER is deliberate here, unlike most of this schema. The
-- trigger must see exactly what the caller sees: if it ran as definer it would
-- read balances across salons and could refuse a deletion because of stock in a
-- salon the caller cannot see — a refusal with no explanation available to the
-- person reading it.
--
-- EXPECTED: one trigger row, BEFORE DELETE, FOR EACH ROW, on
-- storage_categories; and prosecdef = false with search_path=public in
-- proconfig.
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

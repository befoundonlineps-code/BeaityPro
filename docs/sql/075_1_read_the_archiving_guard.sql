-- ==========================================================================
-- 075 · QUERY 1 of 2 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- 🔴 WHY: a live, load-bearing guard exists that is in NO script, NO test and NO
-- header — and nobody knew about it.
--
-- trg_refuse_archiving_stocked_storage sits on storages, BEFORE UPDATE FOR EACH
-- ROW, and its function mentions is_active. So archiving a stocked storage is
-- already refused. ⚠️ The hole announced last round was never a hole.
--
-- ⚠️ And its NAME testifies to where it came from: `trg_` prefix, while 068a's
-- trigger carries none. A different convention is a different hand or a
-- different time — it is from before docs/sql, written straight into the
-- editor. Which is exactly what 071's header warned about and then had happen
-- to it: what was created in the editor is invisible to a grep and fully alive
-- in the database.
--
-- ---------------------------------------------------------------------------
-- 🔴 AND "A GUARD EXISTS" IS NOT "A GUARD IS RIGHT" — every question that cost
-- rounds on 068a is open here, and none of them can be answered from a name:
--
--   • definer or invoker?      invoker fails toward PERMITTING — measured
--   • is search_path pinned?
--   • does it walk sub-folders? 068a needed a recursive walk and it was not
--                               optional
--   • does it refuse only on the transition to archived, or on ANY update?
--     ⚠️ The trigger has no WHEN clause, so it fires on every edit of every
--     storage and the gate is inside the function. Written loosely, it could
--     refuse renaming a storage that has stock.
--   • does its message name the way out, and does it have a key in
--     raisedCodes? Otherwise it arrives in English, or not at all.
--
-- ⚠️ SO IT IS READ WITH pg_get_functiondef, NOT prosrc. prosrc is the BODY
-- alone: rebuilding a script from it silently drops SECURITY DEFINER and
-- `set search_path`, and the rebuilt function keeps working until the day it
-- does not. This project has already paid for that distinction once.
--
-- WHAT TO LOOK AT: the whole definition, read as text. Then it is deposited as
-- a script with a header, and measured the way 068a was — because the picker is
-- about to be built on top of it, and "exists" has cost this project more than
-- any other word.
-- ==========================================================================

select
  p.proname                                   as function_name,
  p.prosecdef                                 as is_security_definer,
  p.proconfig                                 as settings,
  own.rolname                                 as function_owner,
  own.rolbypassrls                            as owner_bypasses_rls,
  obj_description(p.oid, 'pg_proc')           as function_comment,
  pg_get_functiondef(p.oid)                   as full_definition,
  (select string_agg(pg_get_triggerdef(t.oid), E'\n')
     from pg_trigger t
    where t.tgfoid = p.oid and not t.tgisinternal) as trigger_definitions
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles own on own.oid = p.proowner
where n.nspname = 'public'
  and p.proname = 'refuse_archiving_stocked_storage';

-- ==========================================================================
-- 078 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time. ⚠️ Long output — one function per
-- row, each with its whole definition. Read it in passes rather than at once.
--
-- ---------------------------------------------------------------------------
-- 🔴 WHY: 076 counted eleven user triggers. ONE of them is in this repository,
-- and ONE has a comment — and they are the same one, written this week.
--
-- The other ten are live behaviour that no script describes, no test guards,
-- and nobody in this project could have named a week ago. That is not a remark
-- about anybody; it is the measured distance between what gets reviewed and
-- what runs.
--
-- ⚠️ AND FIVE OF THEM ARE SECURITY DEFINER WITH NO search_path:
--
--   log_clients_changes · sync_resource_units ·
--   seed_business_hours_for_new_salon · seed_service_catalog_for_new_salon
--   (+ refuse_archiving_stocked_storage, invoker, fixed by 077a)
--
-- A definer function owned by postgres runs with its privileges and resolves
-- unqualified names through the CALLER's search_path. The owner bypasses RLS —
-- measured in 068b_1. Two rounds were spent on exactly this in 068a while four
-- like it had been running for months.
--
-- ⚠️ AND IT IS NOT IGNORANCE OF THE RULE: four seeders on salons DO pin their
-- path (absence · adjustment · cancellation · reschedule) while two of the same
-- family on the same table do not. The rule was known and applied in some
-- places — which is word for word what this project has been saying about
-- itself all thread.
--
-- 🔴 AND freeze_consignment_after_use IS ON products — BEFORE UPDATE, invoker,
-- no search_path, no comment. It touches the screen being built right now: the
-- product dialog was called "verified, twenty-one fields, conditionals work" —
-- verified against a database that has a trigger nobody knew about. The window
-- saves, the trigger refuses, and the text arrives in English unless the code
-- has a key in raisedCodes.
--
-- ⇒ Which field is frozen? When exactly is "after use"? Does the message name a
-- way out? Read before any screen that edits a product ships. That precedes the
-- catalogue.
--
-- 🔴 AND SIX TRIGGERS FIRE ON salons — four reason-seeders, business hours, and
-- the service catalogue. Creating a second salon writes into six tables
-- automatically. ⚠️ Which matters now specifically because 066b's per-salon
-- guard is recorded as UNTESTED IN THE FIELD and waits for a second salon —
-- and whoever creates it will set off six things they did not know about.
--
-- ---------------------------------------------------------------------------
-- ⚠️ DERIVED FROM pg_trigger, NOT A LIST OF NAMES. The functions are found by
-- being attached to a trigger, so this cannot miss one the way a written list
-- missed stock_fine_lines and then storages. Same reason 076 has no relname.
--
-- ⚠️ AND pg_get_functiondef, NOT prosrc: the definition carries SECURITY
-- DEFINER and `set search_path`, and a script rebuilt from the body alone drops
-- both silently. Anything deposited from this output must come from the
-- definition column.
--
-- WHAT TO LOOK AT, in this order:
--   1. freeze_consignment_after_use — it blocks the product dialog
--   2. the five definer-without-path rows — what unqualified names they use is
--      the whole question
--   3. every raise ... using — each error code must have a key in
--      lib/raisedCodes.js, and ten of these were never checked because the
--      guard reads docs/sql and they are not there
-- ==========================================================================

select
  c.relname                                   as on_table,
  t.tgname                                    as trigger_name,
  p.proname                                   as function_name,
  p.prosecdef                                 as is_security_definer,
  p.proconfig                                 as settings,
  own.rolname                                 as function_owner,
  (obj_description(p.oid, 'pg_proc') is not null) as has_comment,
  -- Every code it can raise, so the raisedCodes gap is readable without hunting
  -- through the definition by eye.
  --
  -- ⚠️ THE FIRST VERSION OF THIS WOULD HAVE SAID NOTHING AND LOOKED LIKE AN
  -- ANSWER — in the column written to expose silence. Three narrowings, all in
  -- the same direction:
  --
  --   'g' without 'i'  -> Postgres regexes are case sensitive, prosrc keeps the
  --                       case as typed, and RAISE EXCEPTION in capitals is a
  --                       very common SQL house style. These ten functions were
  --                       written by other hands. One raising five codes in
  --                       capitals would have returned null and read as
  --                       "raises nothing".
  --   [a-z_]+          -> misses a code with a digit or a capital.
  --   `exception` required -> `raise 'code'` is valid plpgsql and defaults to
  --                       EXCEPTION level.
  --
  -- ⚠️ And a non-capturing group for the optional word, so [1] stays the code
  -- rather than becoming the word "exception ".
  --
  -- ⚠️ `as m(arr)` and `arr[1]`, not `m` and `m[1]`: a set-returning function
  -- aliased with one name gives that name to both the column and the whole row,
  -- and some forms answer `cannot subscript type record`. Naming the column
  -- removes the question instead of discovering it at execution.
  (select string_agg(x.arr[1], ' · ')
     from regexp_matches(
            p.prosrc,
            $re$raise\s+(?:exception\s+)?'([a-zA-Z0-9_]+)'$re$,
            'gi'
          ) as x(arr))                        as raises_codes,
  pg_get_functiondef(p.oid)                   as full_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_roles own on own.oid = p.proowner
where n.nspname = 'public'
  and not t.tgisinternal
order by
  -- The two that block work come first, then the security class, then the rest.
  case
    when p.proname = 'freeze_consignment_after_use' then 0
    when p.prosecdef and p.proconfig is null then 1
    else 2
  end,
  c.relname, p.proname;

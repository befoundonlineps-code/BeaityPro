-- ==========================================================================
-- 076 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- 🔴 WHY: every trigger question so far carried a list of tables, and a list of
-- tables IS a hand-written expectation — the thing this whole thread has been
-- spent hunting.
--
--   071  asked five tables. It missed stock_fine_lines.
--   074_1 asked three. It found trg_refuse_archiving_stocked_storage — a live,
--         load-bearing, undocumented guard — ONLY because somebody happened to
--         suspect storages that week.
--
-- ⚠️ So the guard we did not know about was found by luck, not by method. Had
-- the suspicion fallen elsewhere it would still be unknown.
--
-- The question that cannot miss anything is shorter: every non-internal trigger
-- in public. No relname, no list, no suspicion.
--
-- ⚠️ AND WHAT HAS NEVER BEEN ASKED ABOUT IS WIDER THAN WHAT HAS: products ·
-- product_categories · suppliers · product_orders · product_order_lines ·
-- stocktake_counts · salons · employees · profiles. The same era that left a
-- guard on storages built all of these — so a second one is not a guess, it is
-- the ordinary inference from a first.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND IT CARRIES ITS OWN WITNESS (CLAUDE.md 1ج): it must return
-- refuse_unlinking_stocked_folder and refuse_archiving_stocked_storage — two we
-- know exist. If those two appear, the query has proved it can see hand-written
-- triggers, and anything else it returns is news.
--
-- ✅ AND THAT IS WHAT MAKES THE NEGATIVE ANSWER SAYABLE FOR THE FIRST TIME. If
-- the two come back alone, we can say "there are no others" instead of "we
-- found none among the ones we asked about" — a sentence this schema has never
-- been able to support.
--
-- WHAT TO LOOK AT:
--   • the two known ones — if either is missing, STOP: the query is not seeing
--     what it must, and nothing else in the result means anything
--   • every other row is a behaviour nobody in this thread knew about
--   • timing/event: BEFORE/AFTER and INSERT/UPDATE/DELETE, and whether the
--     definition carries a WHEN clause — a trigger without one fires on every
--     row of every change and puts its gate inside the function
--   • in_repo: whether the function's name appears in any docs/sql script is
--     NOT answerable here — it is a repository question, and the mismatch
--     between the two is exactly what produced this file
-- ==========================================================================

select
  c.relname                                   as on_table,
  t.tgname                                    as trigger_name,
  p.proname                                   as function_name,
  pg_get_triggerdef(t.oid)                    as definition,
  p.prosecdef                                 as is_security_definer,
  p.proconfig                                 as settings,
  own.rolname                                 as function_owner,
  obj_description(p.oid, 'pg_proc')           as function_comment,
  -- The gate: a trigger with no WHEN fires on everything and decides inside.
  (pg_get_triggerdef(t.oid) like '%WHEN%')    as has_when_clause
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_roles own on own.oid = p.proowner
where n.nspname = 'public'
  and not t.tgisinternal
order by c.relname, t.tgname;

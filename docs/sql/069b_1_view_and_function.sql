-- ==========================================================================
-- 069b · QUERY 1 of 2 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN AFTER 069a.
--
-- ---------------------------------------------------------------------------
-- WHY: three things CREATE OR REPLACE resets without saying so.
--
--   1. the view's security_invoker — reloptions, read not assumed. Its absence
--      means the view runs with its OWNER's rights and every salon sees every
--      salon's folders. ⚠️ Invisible while one salon exists.
--   2. the function is still definer and still pinned to search_path=public
--      after being rewritten by 069a.
--   3. the function's body now READS THE VIEW. Counting the fragment is what
--      distinguishes "069a ran" from "069a was pasted but the older body is
--      still deployed" — `where proname =` cannot tell those apart.
--
-- EXPECTED:
--   view_options              {security_invoker=true}
--   is_security_definer       true
--   settings                  {search_path=public}
--   body_reads_view_expect_1  1
--   body_has_own_walk_expect_0 0
-- ==========================================================================

select
  (select cl.reloptions
     from pg_class cl
     join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public'
      and cl.relname = 'product_category_descendants')      as view_options_expect_invoker,

  p.prosecdef                                               as is_security_definer_expect_true,
  p.proconfig                                               as settings_expect_search_path,

  -- ⚠️ The needle is the JOIN, punctuation and all — not the view's bare name,
  -- which also appears in this function's comments and would count them.
  (length(p.prosrc) - length(replace(p.prosrc, 'join public.product_category_descendants d', '')))
    / length('join public.product_category_descendants d')  as body_reads_view_expect_1,

  -- ⚠️ AND THE OLD WALK MUST BE GONE, not merely joined beside. A body carrying
  -- both would pass the count above while still computing its own closure —
  -- which is the exact drift 069a exists to make impossible.
  (length(p.prosrc) - length(replace(p.prosrc, 'with recursive descendants', '')))
    / length('with recursive descendants')                  as body_has_own_walk_expect_0
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'refuse_unlinking_stocked_folder';

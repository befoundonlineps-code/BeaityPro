-- ==========================================================================
-- 054f -- VERIFICATION ONLY, in its own paste. Run AFTER 054e.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No DDL: nothing here can undo anything.
--
-- EXPECTED
--
-- 1  one row: post_stocktake_session, and NOTHING called post_stocktake.
--    ⚠️ Two rows means the drop named a signature that does not exist and
--    reported success — which is why 054e has no `if exists`.
-- 2  the raise codes the surviving function can still produce, so
--    lib/raisedCodes.js can be checked against the database rather than against
--    the script that was pasted. Four expected: session_not_found,
--    session_already_posted, product_not_found, count_invalid.
-- ==========================================================================

select
  p.proname,
  p.prosecdef as security_definer_expect_false,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'post_stocktake%'
order by p.proname;

with fn as (
  select p.prosrc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'post_stocktake_session'
  limit 1
)
select
  (select position('session_not_found' in prosrc) from fn) > 0      as raises_session_not_found,
  (select position('session_already_posted' in prosrc) from fn) > 0 as raises_already_posted,
  (select position('product_not_found' in prosrc) from fn) > 0      as raises_product_not_found,
  (select position('count_invalid' in prosrc) from fn) > 0          as raises_count_invalid;

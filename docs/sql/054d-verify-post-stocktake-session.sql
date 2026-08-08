-- ==========================================================================
-- 054d -- VERIFICATION ONLY, in its own paste. Run AFTER 054c.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No DDL: nothing here can undo anything in 054c however wrong it is.
--
-- ⚠️ AND UNLIKE 053b THIS ONE CAN CHECK BEHAVIOUR, because a function's text is
-- readable from the editor even though a policy's effect is not. What it still
-- cannot do is run the function — that needs a real session with real counts,
-- and posting one is not something a verification script should do to a live
-- salon's stock.
--
-- ---------------------------------------------------------------------------
-- EXPECTED
--
-- 1  exists      one post_stocktake_session, prosecdef = false, proconfig null.
--                ⚠️ SECURITY INVOKER is the point, not an accident: the
--                function meets the eight policies from 054a like any other
--                write. 051b:28 records the same for its four siblings, and
--                050c measured it. A `true` here would mean RLS stopped being
--                the gate for stocktakes.
--
-- 2  both alive  post_stocktake (5 args, jsonb) AND post_stocktake_session
--                (4 args) both present, deliberately and temporarily. The old
--                one keeps the screen working until it moves; 054e drops it.
--                ⚠️ Two functions writing stocktakes is two answers to one
--                question, so this row is a REMINDER, not a pass.
--
-- 3  ⚠️ THE ORDER, WHICH IS THE ONE THING A LATER EDIT WOULD BREAK SILENTLY.
--    balance_at_post must be written BEFORE document_id is set, or the session
--    is already closed when the counts are updated — and once the UPDATE policy
--    on stocktake_counts is narrowed to open sessions, that becomes `0 rows
--    affected` with no error anywhere. Measured as positions in the body:
--
--        balance_before_document_expect_true = true
--
--    A false here does not break anything TODAY. It arms a silent failure for
--    the day the residual named in 054a is closed, which is exactly the kind of
--    fault that arrives months after the change that caused it.
--
-- 4  coverage    the body must NOT skip a zero-difference product before
--    writing balance_at_post. Asserted as a position too: the `update
--    stocktake_counts` must come before the `if v_diff = 0 then continue`.
--
--        balance_before_skip_expect_true = true
--
--    ⚠️ This is the whole stage in one boolean. Get it wrong and everything
--    else still works: documents post, movements are right, the screen looks
--    correct — and a product counted and found correct leaves no trace, which
--    is the state we started from.
-- ==========================================================================

-- 1 -- the function, its security context, and its argument list.
select
  p.proname,
  p.prosecdef as security_definer_expect_false,
  p.proconfig as search_path_expect_null,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('post_stocktake', 'post_stocktake_session')
order by p.proname;

-- 2 -- exactly one of each, so a second copy created by a mistyped signature
-- shows up as a number rather than as silence.
select
  p.proname,
  count(*) as copies_expect_1
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('post_stocktake', 'post_stocktake_session')
group by p.proname
order by p.proname;

-- 3 and 4 -- the two orderings, read as positions inside the body.
--
-- ⚠️ A CTE and scalar subqueries rather than aggregates beside bare columns.
-- 051c ended with an aggregate next to an ungrouped p.prosrc, Postgres refused
-- it, and because the editor runs a file as one transaction the refusal rolled
-- back the CREATE OR REPLACE above it. This file changes nothing, so it could
-- not do that — the shape is kept anyway because the habit is the guard.
with fn as (
  select p.prosrc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'post_stocktake_session'
  limit 1
)
select
  (select position('set balance_at_post' in prosrc) from fn)        as at_balance,
  (select position('if v_diff = 0' in prosrc) from fn)              as at_skip,
  (select position('set document_id' in prosrc) from fn)            as at_close,

  -- ④ The stage, in one boolean: the coverage row is written before the
  -- zero-difference products are skipped.
  ((select position('set balance_at_post' in prosrc) from fn) > 0
   and (select position('set balance_at_post' in prosrc) from fn)
     < (select position('if v_diff = 0' in prosrc) from fn))        as balance_before_skip_expect_true,

  -- ③ The order that arms or disarms a future silent failure.
  ((select position('set balance_at_post' in prosrc) from fn) > 0
   and (select position('set balance_at_post' in prosrc) from fn)
     < (select position('set document_id' in prosrc) from fn))      as balance_before_document_expect_true,

  -- The idempotency guard the old function never had, and the lock that makes
  -- it one rather than a hopeful read.
  ((select position('session_already_posted' in prosrc) from fn) > 0) as refuses_double_post_expect_true,
  ((select position('for update' in prosrc) from fn) > 0)             as locks_session_expect_true;

-- 5 -- the Arabic hints, read back because this script deposits them.
--
-- ⚠️ The standing rule: every text this project puts into the database is read
-- back by a select in the same round. 048 measured 18 of 18 hints silently
-- turned English, and nothing on any screen would have shown it — a hint is the
-- second rung of the error ladder and reaches a user verbatim.
with fn as (
  select p.prosrc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'post_stocktake_session'
  limit 1
)
select
  (select position('جلسة الجرد غير موجودة' in prosrc) from fn) > 0 as hint_session_not_found_expect_true,
  (select position('هذا الجرد مُرحَّل من قبل' in prosrc) from fn) > 0 as hint_already_posted_expect_true,
  (select position('منتج بالمستند غير موجود' in prosrc) from fn) > 0 as hint_product_not_found_expect_true,
  (select position('العدد لازم يكون صفرًا أو أكبر' in prosrc) from fn) > 0 as hint_count_invalid_expect_true;

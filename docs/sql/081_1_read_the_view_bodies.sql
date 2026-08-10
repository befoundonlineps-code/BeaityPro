-- ==========================================================================
-- 081_1 -- SURVEY ONLY. Read-only: nothing is written. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- 🔴 product_balances HAS NEVER BEEN READ. THREE GUARDS DEPEND ON ITS BODY.
--
-- 068a, 077a and 079a all read this view, and 079b_2 measures only its
-- OPTIONS — `security_invoker` — not its definition. So every sentence any of
-- us has written about "a live balance" is a claim about a body nobody in this
-- thread has looked at.
--
-- ⚠️ AND IT IS NOT AN ACADEMIC GAP. On a test harness the relationship turned
-- out to be finer than 079a's header says: `balance_base` SUMS THE DEAD
-- MOVEMENTS TOO, and it equals the live balance only because a reversal writes
-- an exact negation of every line — 7, then −7, and the pair contributes zero.
--
-- ⇒ SO THE MECHANISM MAKING TEST TWO CORRECT IS NETTING, NOT THE VIEW. The
-- view serves TEST ONE alone. TEST TWO is riding on an invariant that has
-- never been stated and never been measured, and two ordinary futures break it
-- with no error anywhere:
--
--     • a PARTIAL reversal becoming possible
--     • somebody "improving" product_balances to exclude reversed documents —
--       which reads like a cleanup and silently changes what TEST TWO means
--
-- 081_2 measures the netting. This file reads the bodies.
--
-- ---------------------------------------------------------------------------
-- ⚠️ ALL THREE VIEWS, NOT THE ONE IN QUESTION — item 4ب. Reading the whole
-- category costs the same as reading one, and the eye filters. The other two
-- are guards' dependencies too:
--
--     product_balances              068a · 077a · 079a
--     product_category_descendants  069a, and the storage window
--     stock_document_liveness       079a, and it has never been read back
--                                   either — it was written this round and
--                                   only its OPTIONS have been measured
--
-- ⚠️ WITNESS OF TRUTH — item 1ج: THREE rows, named. relname is printed, so a
-- missing view is visible as an absent name rather than as a shorter list
-- nobody counts. Fewer than three means one of them is gone, and no reading of
-- the others is worth anything until that is explained.
--
-- ⚠️ AND reloptions RIDES ALONG, because a body is only half the story: a
-- correct definition running with its owner's rights shows every salon's rows
-- to every salon, and that failure is invisible while one salon exists.
-- ==========================================================================

select
  c.relname                                                        as view_name,
  pg_get_userbyid(c.relowner)                                      as view_owner,
  coalesce(array_to_string(c.reloptions, ', '), '🔴 (بلا خيارات)') as reloptions,
  pg_get_viewdef(c.oid, true)                                      as definition
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'v'
  and c.relname in (
    'product_balances',
    'product_category_descendants',
    'stock_document_liveness'
  )
order by c.relname;

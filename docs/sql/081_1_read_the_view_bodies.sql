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
-- out to be finer than 079a's header said: `balance_base` SUMS THE DEAD
-- MOVEMENTS TOO, and equals the live balance solely because a reversal writes
-- an exact negation of every line — 7, then −7, contributing zero.
--
-- ⇒ SO THE MECHANISM MAKING TEST TWO CORRECT IS NETTING, NOT THE VIEW. The
-- view serves TEST ONE alone. 081_2 measures the netting; this file reads the
-- bodies.
--
-- ---------------------------------------------------------------------------
-- 🔴 AND THE FIRST DRAFT OF THIS FILE FILTERED ON THE SHAPE IT WAS ASKING
-- ABOUT: `where … relkind = 'v'`.
--
-- A MATERIALIZED view is relkind 'm'. It would have vanished from the result
-- entirely, and the file would have printed "the view is missing" — while the
-- truth is worse than missing. product_balances as a matview is a SNAPSHOT
-- that only moves on REFRESH, and all three guards would then be refusing and
-- allowing on a stale balance. A storage archived after its stock left, a
-- consignment supplier frozen against a balance emptied yesterday.
--
-- ⚠️ "GONE" AND "STALE" WOULD HAVE PRINTED THE SAME LINE. That is the same
-- fault this series has now hit three times, and each time in a new disguise:
-- 079b_4 filtered it out with WHERE, 081_2 with GROUP BY, and here with a
-- WHERE on the very property in question.
--
-- ✅ AND THE HONEST NARROWING, because two of the three are already settled by
-- a run that happened: 079b_2 returned `security_invoker=true` for
-- product_balances and stock_document_liveness, and a materialized view
-- REJECTS that option outright (measured: ERROR: unrecognized parameter
-- "security_invoker"). So those two are proven ordinary views by evidence
-- already in hand. product_category_descendants alone is unproven — and it is
-- what 069a and the storages window read.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND pg_get_viewdef IS GUARDED, because it THROWS on a real table and one
-- throw drops the entire query — reintroducing, as an error, exactly the
-- silence just removed from the WHERE. The CASE is the guard, and it is the
-- standard idiom: CASE evaluates its branches in order and does not evaluate
-- an arm whose condition is false.
--
-- ⚠️ AND relkind IS CAST ::text. It is type "char", and concatenating it
-- unquoted answers `operator is not unique` and takes the whole query with it.
-- Found by RUNNING this file, not by reading it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ ALL THREE NAMED, NO FILTER ON KIND — item 4ب. reloptions rides along
-- because a body is only half the story: a correct definition running with its
-- owner's rights shows every salon's rows to every salon, and that failure is
-- invisible while one salon exists.
--
-- ⚠️ WITNESS OF TRUTH — item 1ج: THREE rows, named. relname is printed, so a
-- missing object is visible as an absent NAME rather than as a shorter list
-- nobody counts. Fewer than three, and no reading of the others is worth
-- anything until that is explained.
-- ==========================================================================

select
  c.relname                                                        as object_name,
  case c.relkind
    when 'v' then 'view'
    when 'm' then '🔴 MATERIALIZED view — لقطة بتتحدّث بالـREFRESH لا منظورًا'
    when 'r' then '🔴 جدول حقيقيّ — مش منظورًا إطلاقًا'
    else '⚠️ relkind = ' || c.relkind::text
  end                                                              as object_kind,
  pg_get_userbyid(c.relowner)                                      as object_owner,
  coalesce(array_to_string(c.reloptions, ', '), '🔴 (بلا خيارات)') as reloptions,
  case
    when c.relkind in ('v', 'm') then pg_get_viewdef(c.oid, true)
    else '🔴 لا جسم يُقرأ — الكائن مش منظورًا'
  end                                                              as definition
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in (
    'product_balances',
    'product_category_descendants',
    'stock_document_liveness'
  )
order by c.relname;

-- ==========================================================================
-- 068b · QUERY 3 of 3 -- VERIFICATION ONLY. Read-only: NOTHING IS WRITTEN.
--
-- RUN AFTER 068a AND 069a.
--
-- ⚠️ THE ONE WORTH READING TWICE.
--
-- ---------------------------------------------------------------------------
-- WHY: the trigger's own condition, run against live data without deleting
-- anything. It answers "which un-ticks would be refused today" BEFORE anybody
-- opens the storage window and finds out one at a time.
--
-- ⚠️ AND ITS ONLY VALUE IS THAT IT MATCHES THE TRIGGER. A dry run that computes
-- a different condition is a second opinion wearing the clothes of a first.
--
-- An earlier version of this file joined `p.category_id = sc.category_id` — the
-- direct folder alone — and stayed that way after 068a was corrected to walk
-- descendants. So it would have reported would_be_refused = FALSE for a folder
-- whose stock sits in its child: the owner reads that the path is clear, opens
-- the window, and is refused. Which is precisely the "find out one at a time"
-- this file exists to prevent, produced by the file itself.
--
-- ⚠️ Nothing in it could have said so. It succeeds and prints a clean table.
--
-- ⚠️ AND IT IS THE THIRD FAULT IN A ROW BORN OF A CORRECT FIX — prose that
-- described code, then an expectation inside an output, now a query mirroring a
-- logic it had silently drifted from. The useful question after a repair is not
-- "is this right?" but "what was mirroring this before I changed it?".
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND A SECOND THING IT CANNOT PROVE, WHICH MATTERS MORE.
--
-- This runs in the SQL editor as a role that bypasses RLS, so it sees every
-- movement in the database. The trigger does not: it reads product_balances, an
-- invoker view, evaluated with the FUNCTION OWNER'S rights. If that owner does
-- not bypass RLS, the trigger sees nothing where this query sees everything —
-- and this file would still print a confident, correct-looking list about a
-- path the trigger never takes.
--
-- ⚠️ So a green result here says the CONDITION is right. It says nothing about
-- whether the trigger can see the rows the condition selects. That is
-- 068b_1's owner_bypasses_rls column, and neither file covers the other.
--
-- WHAT TO LOOK AT:
--   • rows where would_be_refused = true — links that cannot be removed until
--     the shelf is cleared.
--   • ⚠️ `via_descendant` names WHERE the stock is. A refusal explained by a
--     child is the case the direct-folder version missed entirely, so it is
--     printed rather than folded into a count.
--
-- ⚠️ AN EARLIER HEADER SAID "a short list is expected". IT MEASURED SIX OF SIX.
-- And the sentence that used to sit beside it — "a long one is information
-- rather than a problem" — had been dropped in an edit, leaving the wrong
-- expectation without the clause that contained it. So a reader met everything
-- refused and a header calling that unexpected.
--
-- 🔴 SIX OF SIX IS NOT A TIDINESS PROBLEM, IT IS A LOCK. See PROJECT_HANDOFF
-- §3.13ج: the seed linked every folder to every storage without anybody
-- deciding it, movements were then recorded against those undecided links, and
-- this guard now refuses to undo them. Every checkbox in the storage window is
-- untickable, and the route we described for narrowing them does not exist on
-- this data.
-- ==========================================================================

-- ⚠️ READS product_category_descendants (069a) — IT NO LONGER CARRIES ITS OWN
-- COPY OF THE WALK.
--
-- This file held a second recursive CTE, written to match the trigger's. That
-- is what drifted: the trigger was corrected to descend and this stayed on the
-- direct folder. Now both read one view, so "does the dry run match the guard"
-- stops being a question anybody has to keep answering.
--
-- ⚠️ RUN 069a BEFORE THIS. Without the view this file errors — which is the
-- right failure: loud, immediate, and impossible to mistake for a clean table.
select
  s.name                                          as storage_name,
  c.name                                          as folder_name,
  sc.seeded                                       as still_default,
  count(*) filter (where b.balance_base <> 0)     as products_with_stock,
  string_agg(
    p.name || case when cl.node_id <> cl.root_id then ' (بمجلّد فرعي)' else '' end,
    ' · ' order by p.name
  ) filter (where b.balance_base <> 0)             as which,
  count(*) filter (where b.balance_base <> 0 and cl.node_id <> cl.root_id)
                                                   as via_descendant,
  count(*) filter (where b.balance_base <> 0) > 0  as would_be_refused
from public.storage_categories sc
join public.storages s           on s.id = sc.storage_id  and s.salon_id = sc.salon_id
join public.product_categories c on c.id = sc.category_id and c.salon_id = sc.salon_id
left join public.product_category_descendants cl
  on cl.root_id  = sc.category_id
 and cl.salon_id = sc.salon_id
left join public.products p
  on p.category_id = cl.node_id
 and p.salon_id    = cl.salon_id
left join public.product_balances b
  on b.product_id = p.id
 and b.storage_id = sc.storage_id
 and b.salon_id   = sc.salon_id
group by s.id, s.name, c.id, c.name, sc.seeded
order by would_be_refused desc, via_descendant desc, s.name, c.name;

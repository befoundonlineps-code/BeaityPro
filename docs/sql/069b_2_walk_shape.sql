-- ==========================================================================
-- 069b · QUERY 2 of 2 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN AFTER 069a.
--
-- ---------------------------------------------------------------------------
-- WHY: that the view returns the walk it promises, read against the real tree
-- rather than argued from the SQL.
--
-- ⚠️ EVERY folder, with what it reaches — not a spot check on a folder somebody
-- expects to have children. A survey filtered to the interesting case cannot
-- report that the interesting case is absent.
--
-- WHAT TO LOOK AT:
--   • self_included = true on EVERY row. A folder must be its own descendant,
--     which is what lets a caller write one join condition instead of "this
--     folder OR anything under it" — and writing that by hand at each call site
--     is where the direct-folder version came from.
--   • strict_descendants — how deep the tree actually goes.
--
-- ⚠️ AN EARLIER HEADER HERE PREDICTED A FLAT TREE, AND THE MEASUREMENT HAD
-- ALREADY ARRIVED BEFORE THE QUERY THAT MEASURES IT.
--
-- 068b_3 returned via_descendant = 1 on two rows: «تجريبي» is a child of
-- «عناية بالشعر». So this query confirms a number that is already known, and
-- the prediction it was written around was wrong.
--
-- ⚠️ AND THAT CHANGES WHAT THE DESCENDANT FIX WAS. It was not a precaution
-- against a tree somebody might build one day — it was repairing something
-- already broken in the live data. Read the first row: «عناية بالشعر» in the
-- test storage holds two blocking products, one directly (مبرد ومهدئ ليزر) and
-- one in the child. The direct-folder version WOULD ALSO HAVE REFUSED — on the
-- direct product — but would have named ONE. The owner moves it, tries again,
-- and is refused by a product never mentioned.
--
-- That is the exact scenario written up as a future hazard when the walk was
-- deposited once. It is in the data now, in two rows.
-- ==========================================================================

select
  root.name                                   as folder_name,
  count(*)                                    as reachable_nodes,
  bool_or(d.node_id = d.root_id)              as self_included_expect_true,
  count(*) filter (where d.node_id <> d.root_id) as strict_descendants,
  string_agg(child.name, ' · ' order by child.name)
    filter (where d.node_id <> d.root_id)     as which_below
from public.product_category_descendants d
join public.product_categories root  on root.id  = d.root_id  and root.salon_id  = d.salon_id
join public.product_categories child on child.id = d.node_id and child.salon_id = d.salon_id
group by root.id, root.name
order by strict_descendants desc, root.name;

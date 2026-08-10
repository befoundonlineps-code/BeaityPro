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
--   • depth_below — 0 everywhere means the tree is flat TODAY. That is a fact
--     about the data, not about the walk, and it is worth knowing before
--     reading any result of 068b_3: with a flat tree the descendant version and
--     the old direct-folder version agree on every row, so 068b_3 CANNOT
--     currently demonstrate the difference it was corrected for.
--
-- ⚠️ That last line is the point of this query. A green 068b_3 today proves the
-- condition runs; it does not prove the descendant walk works, because there is
-- nothing beneath anything to walk to. Reading them together is what stops a
-- flat-tree result being taken for a working walk.
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

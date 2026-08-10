-- ==========================================================================
-- 066c · QUERY 6 of 6 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 066a -> 066b -> 066c_1 … 066c_6. RUN AFTER 066b.
--
-- ⚠️ THE ONE WORTH READING TWICE.
--
-- ---------------------------------------------------------------------------
-- WHY: the owner measured a behaviour in the reference that nobody wrote as a
-- rule — "Move between storages" opened from General Storage offers NO
-- destination, and opened from Cosmotology offers several. The reason is that a
-- transfer needs a folder in common, and General shares none.
--
-- ⚠️ THAT FILTER IS NOT A RULE TO BE IMPLEMENTED. It falls out of a join on
-- this table. This query IS that join, run before any screen exists — so the
-- destination list can be seen to be right before it is built, rather than
-- debugged afterwards through a dropdown.
--
-- ⚠️ AND AFTER 066b IT WILL LOOK WRONG ON PURPOSE. The seed puts every folder
-- in every storage, so every storage shares folders with every other and this
-- listing will show them ALL as reachable. That is the seed being honest —
-- nothing has been narrowed yet — not the query failing. The value of running
-- it now is the BASELINE: it should show the complete graph. It becomes
-- interesting the moment the owner starts un-ticking, and running it again then
-- is what proves the un-ticking reached the transfer list.
--
-- WHAT TO LOOK AT:
--   • right after 066b — every storage reaches every other, shared_folders
--     equal to the salon's folder count. Any pair MISSING here means the seed
--     did not reach one of them.
--   • after narrowing — a storage with no row at all is one that can no longer
--     transfer anywhere, which is a real and legitimate state (General Storage
--     in the reference), and the screen must say so rather than show an empty
--     dropdown with no explanation.
-- ==========================================================================

-- ⚠️ GROUPED BY id, DISPLAYED BY name. Raised in review: two storages sharing a
-- name would collapse into one row and their destination lists would merge
-- invisibly. Nothing stops two storages being called the same thing, and the
-- failure would look like a correct answer — which is the whole class this file
-- was written to avoid. Same reason item 4 refuses name matching in checks.
select
  src.name                          as from_storage,
  dst.name                          as to_storage,
  count(*)                          as shared_folders,
  string_agg(c.name, ' · ' order by c.name) as folders
from public.storage_categories a
join public.storage_categories b
  on b.category_id = a.category_id
 and b.salon_id    = a.salon_id
 and b.storage_id <> a.storage_id
join public.storages src on src.id = a.storage_id
join public.storages dst on dst.id = b.storage_id
join public.product_categories c on c.id = a.category_id
group by src.id, src.name, dst.id, dst.name
order by src.name, dst.name;

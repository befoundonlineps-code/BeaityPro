-- ==========================================================================
-- 066c · QUERY 4 of 6 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 066a -> 066b -> 066c_1 … 066c_6. RUN AFTER 066b.
--
-- ---------------------------------------------------------------------------
-- WHY: whether the seed actually landed on every storage, and whether it landed
-- on the RIGHT number of folders.
--
-- ⚠️ PER STORAGE, NOT A TOTAL. A grand total of rows equals storages × folders
-- whether the rows are spread evenly or piled on one storage, so it answers the
-- question in a reassuring voice without looking. 056d_5 made this same split
-- (per kind, not a total) for the same reason.
--
-- ⚠️ AND folders_in_salon IS COMPUTED PER ROW, NOT TYPED IN. The expected value
-- is derived from product_categories in the same query, so this cannot pass by
-- being compared against a number somebody remembered. A hand-written expected
-- count is the fault this round has already paid for four times.
--
-- EXPECTED after 066b: linked_folders = folders_in_salon on EVERY row, and one
-- row per storage — including any storage the owner has not thought about.
--
-- ⚠️ A storage MISSING from this listing is the interesting failure, and it is
-- the one a count cannot show: it means the storage exists and the seed skipped
-- it, so its tree will render empty. The left join is what makes it appear with
-- a zero instead of vanishing.
-- ==========================================================================

select
  s.name                                          as storage_name,
  s.kind,
  count(sc.id)                                    as linked_folders,
  (select count(*) from public.product_categories c
    where c.salon_id = s.salon_id)                as folders_in_salon
from public.storages s
left join public.storage_categories sc
  on sc.storage_id = s.id and sc.salon_id = s.salon_id
group by s.id, s.name, s.kind, s.salon_id
order by s.kind, s.name;

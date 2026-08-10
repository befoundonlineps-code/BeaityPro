-- ==========================================================================
-- 066b -- DATA ONLY. No DDL, no SELECT. Verification is 066c_1 … 066c_6.
--
-- PREPARED, NOT RUN BY ME. The owner executes it, AFTER 066a.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE DECISION THIS FILE MAKES, STATED BEFORE IT IS RUN
--
-- "Populate it from the current reality" has no direct answer, because OUR
-- database has no storage-to-folder assignment to read. The reference app has
-- one; ours has never had the concept. So the seed is a choice, and there are
-- only two:
--
--   every folder in every storage   -> the catalogue keeps showing exactly what
--                                      it shows today, and the owner un-ticks
--   empty                           -> every storage's tree renders EMPTY the
--                                      moment the filter is wired
--
-- The second is the one that can break silently: an empty tree and "this
-- storage holds nothing yet" are the same screen, and the catalogue would look
-- like it lost the products rather than like it is waiting to be told. That is
-- the shape this project keeps refusing — an absence that reads as a fact.
--
-- ⚠️ So: EVERY FOLDER IN EVERY STORAGE, and it is a seed rather than a claim.
-- It asserts nothing about where stock actually is; it says "nothing has been
-- narrowed yet", which is true. Narrowing is the owner's, one checkbox at a
-- time, in the window built for it.
--
-- ---------------------------------------------------------------------------
-- RE-RUNNABLE. `on conflict do nothing` against the pair constraint, so running
-- it twice adds nothing and running it after some un-ticking RE-ADDS what was
-- un-ticked. That second one matters and is not obvious: this file is a seed,
-- not a repair. Once the owner has narrowed anything, running it again undoes
-- that narrowing without an error and without a row count that looks wrong.
--
-- ⚠️ Cross-salon safety is in the join, not in a WHERE: folders are matched to
-- storages ON salon_id, so a second salon can never be handed another salon's
-- folders. The composite foreign keys in 066a would refuse it anyway — this is
-- the same claim made twice, which is the point.
-- ==========================================================================

insert into public.storage_categories (salon_id, storage_id, category_id)
select s.salon_id, s.id, c.id
from public.storages s
join public.product_categories c
  on c.salon_id = s.salon_id
on conflict (storage_id, category_id) do nothing;

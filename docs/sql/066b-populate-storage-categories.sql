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
-- ⚠️ SEEDS ONCE PER SALON, AND THE GUARD IS THE `not exists`, NOT THE WARNING
--
-- An earlier draft relied on `on conflict do nothing` and a paragraph saying
-- "re-running this after narrowing RE-ADDS what was un-ticked, silently". That
-- was true, which is exactly why it was not enough: this project chooses the
-- model that CANNOT represent the bad state over the one that documents it.
--
-- With the `not exists`, a second run against a salon that already has rows
-- inserts ZERO. Not "restores what you deleted" — nothing. The hazard stops
-- being a note somebody has to read at the right moment.
--
-- ⚠️ PER SALON RATHER THAN GLOBAL, and the difference shows up later: a
-- salon-wide check would let salon one's rows block salon two from ever being
-- seeded, so the second salon would open to empty trees — the precise failure
-- this file exists to prevent, moved one tenant along.
--
-- `on conflict` stays as the second line of defence. Two independent guards
-- against one hazard, in the house style: the `not exists` decides whether to
-- seed at all, the constraint decides that no pair lands twice.
--
-- ⚠️ Cross-salon safety is in the join, not in a WHERE: folders are matched to
-- storages ON salon_id, so a second salon can never be handed another salon's
-- folders. The composite foreign keys in 066a would refuse it anyway — the same
-- claim made twice, which is the point.
--
-- ⚠️ AND `seeded = true` IS WRITTEN EXPLICITLY HERE. The column defaults to
-- false so the storage window's own inserts are decisions for free; this file
-- is the one place that says "nobody chose this", and it has to say it out loud.
-- ==========================================================================

insert into public.storage_categories (salon_id, storage_id, category_id, seeded)
select s.salon_id, s.id, c.id, true
from public.storages s
join public.product_categories c
  on c.salon_id = s.salon_id
where not exists (
  select 1 from public.storage_categories sc
  where sc.salon_id = s.salon_id
)
on conflict (storage_id, category_id) do nothing;

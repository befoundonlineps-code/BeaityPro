-- ==========================================================================
-- 066a -- CHANGE ONLY. No SELECT in this file. Verification is 066c_1 … 066c_6.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- RUN ORDER: 066a (this) -> 066b (populate) -> 066c_1 … 066c_6.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS IS: WHICH PRODUCT FOLDERS LIVE IN WHICH STORAGE
--
-- The reference's storage window carries a right-hand pane, "Products in
-- storage": every folder in the salon, with a checkbox, and the storage ticks
-- the ones it holds. That is the whole feature.
--
-- ⚠️ AND IT IS MANY-TO-MANY, MEASURED — WHICH KILLED TWO SIMPLER MODELS.
--
-- The live data showed a perfect partition: Cosmotology {After Laser,
-- Hydration, Peeling} = 3, Hair Care {after Dressing, Pre Dressing} = 2, the
-- rest 3, total 8, with no folder shared. That looked like a rule and was read
-- as one — a folder belongs to exactly one storage — which would have made this
-- a single `storage_id` column on product_categories.
--
-- Then the owner created a storage "Test 3" and ticked the same three folders
-- Cosmotology has. One folder, two storages. The partition was an accident of
-- test data, not a structure.
--
-- > THE LESSON, WRITTEN WHERE THE NEXT PERSON WILL BE TEMPTED THE SAME WAY:
-- > absence from a result is not a fact, and a result that is total and tidy is
-- > the most persuasive version of that mistake. 3 + 2 + 3 = 8 with no overlap
-- > reads as proof and was a coincidence.
--
-- So: neither product_categories.storage_id (refused by a folder in two
-- storages) nor products.storage_id (the assignment is on the folder, not the
-- product). A junction table, and NEITHER products NOR product_categories is
-- touched at all — no migration on either.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS BUYS BEYOND THE CATALOGUE TREE
--
-- The reference's "Move between storages" fills its destination list from
-- exactly this table, and the owner measured the consequence: opening it from
-- General Storage offers NO destination, because no other storage holds any of
-- General's three folders. Opening it from Cosmotology offers several, because
-- Test 3 shares its folders.
--
-- ⚠️ That filter is not a rule anybody writes. It falls out of the join. A
-- transfer needs a folder in common, and the table already knows.
--
-- ---------------------------------------------------------------------------
-- DEPENDENCIES, AND WHY THEY NEED NO SURVEY FIRST
--
-- Both composite references below require unique (id, salon_id) on their
-- targets. storages carries it (proven by 058 and leaned on by 061a). For
-- product_categories the repository says products.category_id is already a
-- composite reference to it — a document, not a measurement.
--
-- ⚠️ It is not surveyed first because POSTGRES REFUSES THE FOREIGN KEY WITHOUT
-- IT. If the unique constraint is missing, this file fails on that line, names
-- the constraint it wanted, and the whole transaction rolls back — nothing half
-- created. A dependency that verifies itself does not need a round trip; one
-- that fails silently would.
--
-- ---------------------------------------------------------------------------
-- ATOMIC ON PURPOSE: one table, its constraints, its indexes, its policies and
-- its comments are ONE transaction. This is the case CLAUDE.md item 1 protects
-- rather than forbids — if a constraint is refused, the table must go with it.
-- What must not share a transaction is a CHECK that can undo the change, and
-- there is none here.
--
-- ⚠️ The Arabic comments are read back in 066c_5, NOT here. CLAUDE.md says a
-- script that deposits Arabic reads it back in the same file; the guard in
-- lib/sqlVerificationShape.test.js forbids any SELECT beside DDL and has no
-- carve-out for it. The guard is enforced and the prose is not, so the guard
-- wins — the same split 056c/056d already made. Worth reconciling in the docs.
-- ==========================================================================

create table if not exists public.storage_categories (
  id          uuid        primary key default gen_random_uuid(),
  salon_id    uuid        not null references public.salons (id) on delete restrict,
  storage_id  uuid        not null,
  category_id uuid        not null,
  created_at  timestamptz not null default now(),

  -- Composite, both of them, and this is the fifth table to learn it: a plain
  -- reference to (id) lets a row point at a storage in one salon and a folder
  -- in another, and nothing would ever say so.
  constraint storage_categories_storage_fkey
    foreign key (storage_id, salon_id)
    references public.storages (id, salon_id) on delete restrict,

  constraint storage_categories_category_fkey
    foreign key (category_id, salon_id)
    references public.product_categories (id, salon_id) on delete restrict,

  -- A folder is either in a storage or it is not. Ticking a ticked box is not a
  -- second assignment, and without this the same pair could be stored twice and
  -- the tree would show the folder twice.
  constraint storage_categories_one_per_pair unique (storage_id, category_id),

  -- The mirror key, so anything referencing this row later can do it
  -- compositely without another migration. Costs an index; buys the next table.
  constraint storage_categories_id_salon_key unique (id, salon_id)
);

-- The unique above indexes (storage_id, category_id), which serves "which
-- folders are in this storage". The other direction — "which storages hold this
-- folder" — is what the transfer destination list asks, and it has no index
-- without this one.
create index if not exists storage_categories_category_idx
  on public.storage_categories (category_id, salon_id);

alter table public.storage_categories enable row level security;

-- ⚠️ SELECT, INSERT and DELETE — and DELETE is the one that needs saying.
--
-- products, storages, suppliers and product_categories deliberately have NO
-- delete policy: archiving is the only path, and the ban is structural because
-- RLS refuses what it has no policy for. This table is the opposite case. It is
-- a link, not a thing: un-ticking a checkbox in the storage window IS deleting
-- a row, and there is nothing to archive — an "inactive link" is just a link
-- that should not be there. Same class as supplier_contacts,
-- storage_responsibles and product_set_components, which all carry DELETE.
--
-- And no UPDATE policy, also structural: a row here is two foreign keys and
-- nothing else, so there is no field to change. Moving a folder from one
-- storage to another is a delete and an insert, and an UPDATE that rewrote
-- storage_id in place would let one statement do both halves with nothing
-- recording that it happened.
drop policy if exists storage_categories_select on public.storage_categories;
create policy storage_categories_select on public.storage_categories
  for select using (
    salon_id = (select profiles.salon_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists storage_categories_insert on public.storage_categories;
create policy storage_categories_insert on public.storage_categories
  for insert with check (
    salon_id = (select profiles.salon_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists storage_categories_delete on public.storage_categories;
create policy storage_categories_delete on public.storage_categories
  for delete using (
    salon_id = (select profiles.salon_id from profiles where profiles.id = auth.uid())
  );

comment on table public.storage_categories is
  'أي مجلّدات المنتجات موجودة بأي مستودع. العلاقة متعدّد-لمتعدّد: المجلّد الواحد ممكن يكون بأكتر من مستودع، والمستودع فيه أكتر من مجلّد. المنتج بيرث مستودعاته من مجلّده، وما فيه عمود مستودع لا على المنتج ولا على المجلّد.';

comment on column public.storage_categories.storage_id is
  'المستودع. بيتحدّد من نافذة تعديل المستودع، بلوح «المنتجات بالمستودع».';

comment on column public.storage_categories.category_id is
  'مجلّد المنتجات. حذف السطر معناه إن المجلّد ما عاد بهذا المستودع — ما بينحذف المجلّد نفسه ولا منتجاته.';

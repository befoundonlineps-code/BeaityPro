-- ==========================================================================
-- 053a -- CHANGE ONLY. No SELECT in this file. Verification is 053b.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- RUN ORDER: 053 (survey, done) -> 053a (this) -> 053b (verification).
--
-- Stage 5: the goods order. Two tables, and their isolation in the SAME script,
-- because a table that exists without its policy is a readable table and the
-- gap is however long it takes to paste twice.
--
-- No Arabic is deposited by this script -- every comment below is English, like
-- 050b and 051a -- so there is nothing here for 053b to read back.
--
-- ---------------------------------------------------------------------------
-- WHAT THE SURVEY CHANGED, AND IT CHANGED A DECISION ALREADY TAKEN
--
-- The plan approved earlier gave product_order_lines NO salon_id, on the
-- reasoning that a child's salon follows from its parent. The survey says the
-- house does not do that: stock_movements is a detail table under
-- stock_documents -- the same relationship, exactly -- and it carries its own
-- salon_id with its own policy on it, not a join to the parent.
--
-- So the column is here. Isolation by joining to the parent has no precedent in
-- this schema; isolation by a column on every table has one in the only detail
-- table that matches this shape.
--
-- ⚠️ AND COPYING THE COLUMN OPENS A HOLE THAT DERIVING IT COULD NOT HAVE:
-- two rows can now disagree. A line saying salon A, hanging off an order saying
-- salon B, is exactly the cross-salon state all of this exists to prevent -- and
-- it is REACHABLE, not theoretical, because these tables are written straight
-- from the client:
--
--   the client posts { salon_id: mine, order_id: <another salon's order> }
--   the WITH CHECK passes -- salon_id really is mine
--   the foreign key passes -- ⚠️ referential integrity ALWAYS bypasses row
--     security, so the order it points at does not have to be visible to exist
--
-- Hence the composite key: (order_id, salon_id) references (id, salon_id).
-- There is no such pair unless the order is mine, so the pair cannot be forged
-- and the two rows cannot drift apart. It costs one unique constraint and one
-- foreign-key clause, and it is the only thing in this file that is an addition
-- rather than a copy.
--
-- ---------------------------------------------------------------------------
-- THE DELETE POLICY, WHICH IS A DECISION AND NOT A COPY
--
-- The survey found no DELETE policy on products, stock_documents or
-- stock_movements -- and RLS refuses any command with no matching policy, so
-- the absence is a structural ban, not an omission. That matches the rule the
-- diagram already records for suppliers/storages/categories/products:
-- archiving is the only road, and the screen shows no delete button at all.
--
-- ⚠️ Two of the three questions are not open, and only one of them is mine:
--
--   1. WHICH CLAUSE. None -- Postgres allows only USING on a DELETE policy;
--      WITH CHECK is a syntax error there. The "both clauses" shape that UPDATE
--      has is not available, so nothing is being chosen.
--   2. WHICH PREDICATE. The measured one, like the other seven.
--   3. WHETHER THIS TABLE GETS DELETION AT ALL. ⚠️ This one is the decision.
--
-- And it comes out differently here for a reason that is about the data, not
-- about consistency: a stock document records that goods MOVED and money was
-- recorded. Deleting one deletes the record of an event, which is why the house
-- reverses instead. An order records nothing that happened -- no stock, no
-- money, and nothing anywhere points back at it, since there is no
-- from_order_id. Deleting one destroys the record of no event.
--
-- ⚠️ AND IT IS NEEDED ON BOTH TABLES, FOR TWO DIFFERENT REASONS. The parent for
-- "delete this order"; the child for "remove this line" while editing one. With
-- a policy on the parent alone, editing could add lines and change lines and
-- never remove one -- and the failure would be 0 rows affected, not an error:
-- RLS refuses by matching nothing. Silent, and indistinguishable from a row
-- that was already gone.
--
-- ⚠️ ONE THING THE CHILD POLICY DOES NOT DO, said here so nobody proves it with
-- the wrong test: ON DELETE CASCADE is referential integrity, so it bypasses
-- row security like the foreign key above. Deleting a parent removes its lines
-- whatever the child's policy says. The child policy governs the DIRECT delete
-- only, and deleting an order is not a test of it.
--
-- ⚠️ AND THE DATABASE WILL NOT ASK. Any order of the salon can be deleted,
-- including one that filled a supply last year -- and because there is no
-- from_order_id, nothing can even tell that it did. That is the same absent
-- column that removed the RESTRICT-versus-SET-NULL question, seen from the
-- other side. The confirmation has to live on the screen; there is nowhere else
-- left to put it.
--
-- ---------------------------------------------------------------------------
-- NO `TO` CLAUSE ON ANY OF THE EIGHT, WHICH IS {public} -- CORRECTED, NOT CHOSEN
--
-- The first draft wrote `to authenticated` and said it was not copied because
-- the survey's roles column had not come back. It had come back: {public} on
-- all seven existing policies, on all three tables. So the clause is dropped
-- and these match the house literally.
--
-- ⚠️ AND THE REASON FOR PREFERRING THE LITERAL MATCH IS NOT THE BEHAVIOUR --
-- the two really are equivalent, since an anonymous request either fails the
-- predicate (auth.uid() is null) or has no applicable policy, and both deny.
-- It is that "the same as the other three" is a property somebody can CHECK, in
-- one query, years from now. "Different but equivalent for reasons written in a
-- comment" has to be re-derived by whoever finds it, and the re-derivation is
-- where a wrong conclusion gets drawn.
--
-- The grant is a different lever and is easy to confuse with this one: RLS
-- filters rows, GRANT decides whether the role may touch the table at all, and
-- pg_policies says nothing about it. Missing, it fails loudly with "permission
-- denied"; present, it changes nothing RLS does not still decide. anon is not
-- granted. ⚠️ What the existing three tables grant has never been measured
-- either -- 053b now asks, alongside these two, so the answer arrives with a
-- script that had to run anyway.
-- ==========================================================================

create table if not exists public.product_orders (
  id           uuid        primary key default gen_random_uuid(),
  salon_id     uuid        not null references public.salons (id)    on delete restrict,
  supplier_id  uuid        not null references public.suppliers (id) on delete restrict,
  order_date   date        not null default current_date,
  note         text,
  created_at   timestamptz not null default now(),

  -- ⚠️ NOT redundant with the primary key. A composite foreign key needs a
  -- unique constraint on exactly the columns it references, so without this
  -- line the one in product_order_lines cannot be created at all.
  constraint product_orders_id_salon_key unique (id, salon_id)
);

-- ⚠️ `on delete restrict` written out, on both, rather than left to the
-- default. NO ACTION behaves the same here, but the diagram already carries an
-- item about a foreign key created with no ON DELETE beside a sibling that had
-- CASCADE -- a mismatch nobody chose. Neither can ever fire: suppliers and
-- salons have no delete policy, so they are archived, not deleted.

create table if not exists public.product_order_lines (
  id                  uuid        primary key default gen_random_uuid(),
  salon_id            uuid        not null,
  order_id            uuid        not null,
  product_id          uuid        not null references public.products (id) on delete restrict,

  -- ⚠️ Unconstrained numeric, deliberately. stock_movements.entered_quantity
  -- has a type this repository has never measured -- a function body names the
  -- columns it touches and says nothing about their types. A narrower type here
  -- than there would round a number on the way INTO the order and hand the
  -- supply screen a different quantity than was typed. Wider cannot.
  entered_quantity    numeric     not null,

  -- ⚠️ THE THREE VALUES BELOW ARE MEASURED AGAINST THE WRITER, NOT THE COLUMN,
  -- and the first draft of this file did not say which. It cited 050b for the
  -- price -- a real measurement -- and cited nothing for these, in the same
  -- voice. Raised in review; the citation is the fix, not the values.
  --
  -- WHAT IS MEASURED: lib/stockDocument.js:31 exports UOM = ['package',
  -- 'portion', 'unit'] and every write path validates against it before
  -- building a row (stockLine, the multi-line builder, and the stocktake
  -- builder all call UOM.includes and refuse otherwise). It is exported for
  -- exactly this reason -- "a second list would be a second answer" -- so it is
  -- the single source for every uom the application can produce.
  --
  -- WHAT IS NOT: whether stock_movements.entered_uom carries a constraint of
  -- its own, and what it says. Nobody here has ever asked. That is the same
  -- unmeasured class as entered_quantity's type, one line above.
  --
  -- ⚠️ THE DIFFERENCE FROM THE salon_id GAP, which is why this one is written
  -- rather than deferred: both directions of error here are LOUD. Too strict
  -- refuses an insert with a named constraint, and cannot happen today since
  -- the writer validates against the same list first. Too loose lets a typo
  -- land, which the supply screen then refuses when it reads the order back --
  -- also by name. The salon_id question was the other kind: wrong in one
  -- direction and indistinguishable from correct.
  --
  -- 053b asks the database both halves anyway: stock_movements' own constraint
  -- text, and the distinct entered_uom values actually stored in it.
  entered_uom         text        not null,

  -- numeric(14,4) is copied exactly from stock_movements.entered_unit_price
  -- (050b), which was measured. Nullable: an order may be a list of what is
  -- wanted with no price agreed yet.
  entered_unit_price  numeric(14,4),

  sort_order          integer     not null default 0,
  created_at          timestamptz not null default now(),

  -- ⚠️ THE COMPOSITE KEY, and the plain order_id reference deliberately absent:
  -- this one already enforces it, and a second foreign key on the same column
  -- would be a second thing to keep in step.
  constraint product_order_lines_order_fkey
    foreign key (order_id, salon_id)
    references public.product_orders (id, salon_id) on delete cascade,

  constraint product_order_lines_quantity_positive_check
    check (entered_quantity > 0),
  constraint product_order_lines_uom_check
    check (entered_uom in ('package', 'portion', 'unit')),
  constraint product_order_lines_price_nonneg_check
    check (coalesce(entered_unit_price, 0) >= 0)
);

create index if not exists product_orders_salon_date_idx
  on public.product_orders (salon_id, order_date desc, id);

-- The child's own index: the composite foreign key indexes nothing, and both
-- the join and the cascade read by order_id.
create index if not exists product_order_lines_order_idx
  on public.product_order_lines (order_id, sort_order, id);

alter table public.product_orders      enable row level security;
alter table public.product_order_lines enable row level security;

grant select, insert, update, delete on public.product_orders      to authenticated;
grant select, insert, update, delete on public.product_order_lines to authenticated;

-- --------------------------------------------------------------------------
-- product_orders
-- --------------------------------------------------------------------------

drop policy if exists product_orders_select on public.product_orders;
create policy product_orders_select on public.product_orders
  for select
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

-- ⚠️ WITH CHECK is not a second line of defence on these two tables, it is the
-- only one. stock_documents is written through post_stock_document, which runs
-- as its owner and never meets a policy; these are written by the client, so
-- without this clause a request may name any salon_id it likes.
drop policy if exists product_orders_insert on public.product_orders;
create policy product_orders_insert on public.product_orders
  for insert
  with check (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

drop policy if exists product_orders_update on public.product_orders;
create policy product_orders_update on public.product_orders
  for update
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()))
  with check (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

drop policy if exists product_orders_delete on public.product_orders;
create policy product_orders_delete on public.product_orders
  for delete
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

-- --------------------------------------------------------------------------
-- product_order_lines
-- --------------------------------------------------------------------------

drop policy if exists product_order_lines_select on public.product_order_lines;
create policy product_order_lines_select on public.product_order_lines
  for select
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

drop policy if exists product_order_lines_insert on public.product_order_lines;
create policy product_order_lines_insert on public.product_order_lines
  for insert
  with check (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

drop policy if exists product_order_lines_update on public.product_order_lines;
create policy product_order_lines_update on public.product_order_lines
  for update
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()))
  with check (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

drop policy if exists product_order_lines_delete on public.product_order_lines;
create policy product_order_lines_delete on public.product_order_lines
  for delete
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

-- --------------------------------------------------------------------------

comment on table public.product_orders is
  'A goods order: a helper template for filling a supply, not a commitment. Nothing points back at it -- there is deliberately no from_order_id on stock_documents -- so the same order may be used for two supplies, and deleting one destroys the record of no event. That is why these two tables have a DELETE policy and stock_documents does not.';

comment on column public.product_order_lines.salon_id is
  'Copied from the parent rather than derived by joining to it, because stock_movements -- the only detail table in this schema with the same relationship to its parent -- carries its own. The composite foreign key to (product_orders.id, salon_id) is what makes the copy unable to disagree: referential integrity bypasses row security, so without it a client could attach a line to an order it cannot see.';

comment on column public.product_order_lines.sort_order is
  'The position of the line as typed. ⚠️ The default is a trap and is kept only so an insert cannot fail on it: every row saying 0 means order by sort_order returns them in no defined order. The screen must write the position explicitly, as the products window does for set components.';

comment on column public.product_order_lines.entered_unit_price is
  'Per ENTERED unit, matching stock_movements.entered_unit_price exactly so pre-filling a supply is a copy and not a conversion. Nullable: an order may list what is wanted before a price is agreed.';

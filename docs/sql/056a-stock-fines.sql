-- ==========================================================================
-- 056a -- CHANGE ONLY. No SELECT in this file. Verification is 056b.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- RUN ORDER: 056a (this) -> 056b -> 056c (post_stocktake_session) -> 056d.
--
-- No Arabic is deposited here, so there is nothing for 056b to read back.
--
-- ---------------------------------------------------------------------------
-- THE THREE DECISIONS THIS SHAPE EXISTS TO CARRY
--
--  WHO      a fine is charged only when the responsible resolves to EXACTLY ONE
--           person at the moment of the event. Zero or many means no fine, and
--           the reason is recorded rather than left as an absence.
--  ANCHOR   the moment of POSTING, not of counting. Neither anchor can answer
--           "who lost the goods"; posting is the only one that does not pretend
--           to. counted_at says when the discrepancy was DISCOVERED, and even a
--           full responsibility history would not change that.
--  CLAIM    `attribution` is a bounded type, not free text.
--
-- ---------------------------------------------------------------------------
-- ⚠️ fine_basis IS REUSED, NOT REDEFINED, and that is measured rather than
-- assumed. The survey returned:
--
--     storages.fine_basis   USER-DEFINED   udt_name = fine_basis
--     fine_basis            purchase_price | sales_price
--
-- The same signature entry_uom has. So the column below takes the existing type
-- and no second list of the two labels is written anywhere — the fault that
-- cost a round when 053a wrote `text` plus a three-literal CHECK beside an enum
-- the database already had.
--
-- ---------------------------------------------------------------------------
-- WHAT IS NOT STORED, AND WHY EACH ONE
--
--     amount          = shortage_value * fine_percent / 100
--     shortage_value  = sum over lines of (shortage_base * unit_value)
--
-- ⚠️ 050b states the rule in its own words: "The net is NOT stored. It follows
-- from the two, and a third stored number is a third thing that can disagree
-- with them." Both of these follow from frozen inputs, so both are derived —
-- and the rounding lives in one library function where a test can reach it.
--
-- ⚠️ AND shortage_value IS NOT PUT ON THE HEAD EITHER, which is the less
-- obvious half: it is the sum of the lines, and storing it is a second
-- statement of what the lines already say (ADR-053). The lines are frozen, so
-- the sum cannot move.
--
-- ⚠️ WHAT *IS* FROZEN, and the test is always the same one: can it be recovered
-- afterwards? unit_value cannot — a product's price changes and fine_basis
-- decides which price was even being read. fine_percent and fine_basis cannot —
-- they live on `storages` and the storage dialog edits them, so a fine derived
-- from them at read time would move every historical figure at once with
-- nothing recording that it had. That is balance_at_count's fault exactly, in
-- another context.
--
-- ---------------------------------------------------------------------------
-- ⚠️ NO `void` COLUMN, AND NO DELETE POLICY
--
-- A reversed stocktake makes its fine void — and that is DERIVED, not stored:
-- stock_documents.reverses_document_id already exists and reverse_stock_document
-- already writes it (051c:64,72, read). A row pointing at this fine's document
-- means the stocktake was undone. Measured, not proposed: `stocktake` IS in
-- REVERSIBLE_TYPES (lib/stockDocumentList.js:17), so the cheap version of this
-- question — "maybe a stocktake cannot be reversed at all" — is closed the
-- other way.
--
-- One state fewer, and a fact that cannot go stale against the thing it
-- describes. Same move as "posted" being document_id rather than a status.
--
-- And no DELETE policy at all, like stock_documents and stock_movements: a fine
-- records an event and a sum of money. The house reverses, it does not delete.
-- There is no UPDATE policy either, for the same reason — a fine that can be
-- edited is a fine nobody can rely on, and RLS refusing a command it has no
-- policy for makes the ban structural rather than a rule somebody remembers.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE GAP THIS CREATES, SAID RATHER THAN LEFT
--
-- A stocktake with no shortage produces no row, so an absent row means "nothing
-- was short" — EXCEPT for stocktakes posted before this script ran, which have
-- no row for an entirely different reason. The owner's decision is no backfill:
-- charging somebody for a shortage that predates the policy is unfair however
-- exact the arithmetic. So the boundary is recorded on the table itself, where
-- somebody querying it will meet it.
-- ==========================================================================

do $$
begin
  -- ⚠️ CREATE TYPE has no `if not exists`, and this file is meant to be
  -- re-runnable the way 054a was — which mattered the day a policy was narrowed
  -- after the script had already been pasted. Swallowing duplicate_object and
  -- nothing else keeps that without hiding a real failure.
  create type public.fine_attribution as enum ('posting');
exception when duplicate_object then null;
end $$;

do $$
begin
  -- One column that says how the responsible was resolved OR why they were not.
  -- ⚠️ Not three columns encoding one fact: a separate `resolved` boolean beside
  -- a reason beside a method is three things that can disagree, and the
  -- disagreement is silent.
  create type public.fine_resolution as enum (
    'storage_owner',        -- a professional storage: exactly one owner, structurally
    'named_responsible',    -- storage_responsibles row naming an employee
    'role_responsible',     -- storage_responsibles row naming a role that resolved to one
    'no_responsible',       -- nobody is marked
    'many_responsibles'     -- more than one, so no single person to charge
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.stock_fines (
  id           uuid        primary key default gen_random_uuid(),
  salon_id     uuid        not null references public.salons (id)    on delete restrict,

  -- ⚠️ UNIQUE. One stocktake, one fine — the idempotency key, the same role the
  -- session plays for posting. Without it a re-run of 056c's logic would charge
  -- twice for one shortage.
  document_id  uuid        not null references public.stock_documents (id) on delete restrict,

  -- ⚠️ Composite for the same reason employee_id is, and it was left plain in
  -- the same file that explained why it should not be — caught in review, one
  -- column over from the fix that had just been made.
  --
  -- ⚠️ AND SAFE UNCONDITIONALLY, WHICH HAD TO BE MEASURED RATHER THAN ASSUMED.
  -- A composite key onto a NULLABLE salon_id would not merely constrain, it
  -- would FORBID: stock_fines.salon_id is NOT NULL, so `NULL = value` stays
  -- UNKNOWN and no row would ever match — a "general" storage belonging to no
  -- salon could never be fined at all. 058 query 7 read it: salon_id is
  -- mandatory on both storages and products, so there is no such row and the
  -- key constrains without forbidding anything.
  storage_id   uuid        not null,

  -- ⚠️ NULLABLE ON PURPOSE. Null is not missing data — it is the recorded fact
  -- that nobody could be charged, and `resolution` says which of the two ways.
  --
  -- ⚠️ The simple reference this used to carry was the round's own lesson NOT
  -- applied one column over: the file cites "the order tables' lesson" on
  -- stock_fine_lines.salon_id and left this one plain, while every other
  -- employee column in the schema is composite (storages.owner_employee_id,
  -- stock_documents.employee_id, storage_responsibles.employee_id). Caught in
  -- review. The composite key is declared below.
  employee_id  uuid,

  attribution        public.fine_attribution not null default 'posting',
  resolution         public.fine_resolution  not null,

  -- The role's text as it read at that moment. "She was the executive then" is
  -- the justification, and the role assignment can change afterwards.
  role_at_resolution text,

  -- The policy, frozen. numeric(5,2) and the 0-100 range mirror the column on
  -- storages that this is a copy of.
  fine_percent  numeric(5,2)      not null,
  fine_basis    public.fine_basis not null,

  created_at    timestamptz not null default now(),

  -- ⚠️ COMPOSITE, so a fine cannot name an employee of another salon. The
  -- target exists and is measured: `employees_id_salon_id_key` (055).
  --
  -- ⚠️ AND A NULL employee_id STILL PASSES, which is what is wanted and is worth
  -- saying because it looks like a hole. A foreign key defaults to MATCH SIMPLE,
  -- which is satisfied whenever ANY of its columns is null — so an unresolved
  -- fine, whose whole point is a null employee, is not checked against employees
  -- at all. MATCH FULL would refuse it and would be wrong here.
  constraint stock_fines_employee_fkey
    foreign key (employee_id, salon_id)
    references public.employees (id, salon_id) on delete restrict,

  constraint stock_fines_storage_fkey
    foreign key (storage_id, salon_id)
    references public.storages (id, salon_id) on delete restrict,

  constraint stock_fines_one_per_document unique (document_id),
  -- Not redundant with the primary key: the composite foreign key below needs a
  -- unique constraint on exactly the columns it references.
  constraint stock_fines_id_salon_key unique (id, salon_id),

  constraint stock_fines_percent_range_check
    check (fine_percent >= 0 and fine_percent <= 100),

  -- ⚠️ THE TWO HALVES CANNOT BE MIXED UP STRUCTURALLY. An employee with a
  -- resolution of 'many_responsibles', or a null employee with 'storage_owner',
  -- are both refused here rather than by whoever reads the row.
  --
  -- Null-safe by construction and not by luck: `is not null` returns true or
  -- false and never unknown, and `resolution` is NOT NULL so the IN can never
  -- go unknown either. That is the check 052b's first draft failed.
  constraint stock_fines_employee_matches_resolution_check
    check ((employee_id is not null)
         = (resolution in ('storage_owner', 'named_responsible', 'role_responsible'))),

  -- A role text present on a fine that did not resolve by role is a lie in the
  -- data, and an absent one on a fine that did is the justification missing.
  constraint stock_fines_role_text_matches_resolution_check
    check ((role_at_resolution is not null) = (resolution = 'role_responsible'))
);

create index if not exists stock_fines_salon_created_idx
  on public.stock_fines (salon_id, created_at desc, id);

create index if not exists stock_fines_employee_idx
  on public.stock_fines (employee_id);

create table if not exists public.stock_fine_lines (
  id            uuid    primary key default gen_random_uuid(),
  salon_id      uuid    not null,
  fine_id       uuid    not null,
  -- Composite, like storage_id above and for the same measured reason:
  -- products.salon_id is NOT NULL, so no product exists that this key would
  -- make unfineable.
  product_id    uuid    not null,

  -- ⚠️ POSITIVE, and the sign is dropped on purpose. A stocktake's shortage is a
  -- NEGATIVE movement, and carrying that sign here would make every sum need a
  -- minus somebody has to remember. A fine line is "this much was missing".
  --
  -- Surpluses produce no line at all: nobody is fined for finding more.
  shortage_base numeric not null,

  -- The price actually used, frozen, per fine_basis. Unrecoverable afterwards.
  unit_value    numeric(14,4) not null,

  constraint stock_fine_lines_one_per_product unique (fine_id, product_id),

  -- The order tables' lesson applied rather than cited: copying salon_id down is
  -- what makes two rows able to disagree, and referential integrity bypasses row
  -- security — so without this a client could attach a line to a fine it cannot
  -- see.
  constraint stock_fine_lines_fine_fkey
    foreign key (fine_id, salon_id)
    references public.stock_fines (id, salon_id) on delete cascade,

  constraint stock_fine_lines_product_fkey
    foreign key (product_id, salon_id)
    references public.products (id, salon_id) on delete restrict,

  constraint stock_fine_lines_amounts_check
    check (shortage_base > 0 and unit_value >= 0)
);

create index if not exists stock_fine_lines_fine_idx
  on public.stock_fine_lines (fine_id, product_id);

alter table public.stock_fines      enable row level security;
alter table public.stock_fine_lines enable row level security;

grant select, insert on public.stock_fines      to authenticated;
grant select, insert on public.stock_fine_lines to authenticated;

-- --------------------------------------------------------------------------
-- ⚠️ SELECT AND INSERT ONLY, and the absences are the design.
--
-- No UPDATE: a fine that can be edited is a fine nobody can rely on. No DELETE:
-- it records an event and a sum of money. RLS refuses any command it has no
-- policy for, so both bans are structural — the same reason products,
-- stock_documents and stock_movements have no DELETE policy either.
--
-- INSERT is needed because post_stocktake_session (056c) writes these, and that
-- function runs as the INVOKER — none of the five stock functions is SECURITY
-- DEFINER (051b:28, prosecdef = false, measured), so it meets these policies
-- like any other write.
--
-- The predicate is the measured one, copied from 053's survey, with no TO clause
-- — {public}, matching the other tables.
-- --------------------------------------------------------------------------

-- ⚠️ THE ONE POLICY IN THIS SCHEMA THAT DOES NOT COPY THE CONVENTION, and the
-- reason is that the convention was never asked this question.
--
-- Every other table's salon_id predicate was written for STOCK — quantities,
-- costs, documents, data about THINGS, where nobody is exposed by a colleague
-- reading it. These rows are about a named person's MONEY. Extending the
-- convention here would be "same shape, same claim", which this project has
-- paid for repeatedly.
--
-- ✅ And 057 measured that narrowing is expressible with no new column:
-- `employees.profile_id -> profiles(id)`, UNIQUE. (DATABASE_DIAGRAM claimed the
-- two were independent; that line was stale and has been corrected.)
--
-- ⚠️ BOTH BRANCHES CARRY salon_id EXPLICITLY. The first one does not need it to
-- be correct — the composite foreign key above already makes an employee of
-- another salon unreferenceable — and it carries it anyway, because a policy
-- that is safe only because of a constraint declared 90 lines away is safe
-- until somebody edits the constraint. Two independent statements, and the
-- weaker one is still true on its own.
--
-- ✅ THE ROLE LIST IS THE OWNER'S DIRECT DECISION: administrator, executive,
-- owner — chosen after the full ten labels of employee_role were read out to
-- him (058 query 4), not picked from the three that happened to be mentioned in
-- conversation. The earlier draft of this comment called them a placeholder;
-- that stopped being true and is corrected rather than left standing.
--
-- Written as an explicit IN rather than as a negation on purpose: a role added
-- to employee_role tomorrow is granted nothing silently — it fails closed,
-- which is the right direction for a policy about somebody's pay.
--
-- ✅ And the subquery's own table is safe to lean on, measured by 058: employees
-- has RLS actually enabled (not merely policies defined), and employees_select
-- is the standard salon_id predicate with no further narrowing — so a manager
-- can read her own employees row and this branch resolves. `role` is NOT NULL,
-- so the IN can never go UNKNOWN and grant nothing by accident.
--
-- ⚠️ And this subquery reads `employees`, so EMPLOYEES' OWN RLS APPLIES TO IT.
-- If that table is ever narrowed, a fine can become invisible even to
-- management — failing closed, so harmless, but confusing. 058 reads that
-- policy's text directly rather than inferring it from an absence.
drop policy if exists stock_fines_select on public.stock_fines;
create policy stock_fines_select on public.stock_fines
  for select
  using (
    employee_id = (select e.id from public.employees e
                    where e.profile_id = auth.uid()
                      and e.salon_id = stock_fines.salon_id)
    or exists (select 1 from public.employees e
                where e.profile_id = auth.uid()
                  and e.salon_id = stock_fines.salon_id
                  and e.role in ('administrator', 'executive', 'owner'))
  );

drop policy if exists stock_fines_insert on public.stock_fines;
create policy stock_fines_insert on public.stock_fines
  for insert
  with check (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

drop policy if exists stock_fine_lines_select on public.stock_fine_lines;
create policy stock_fine_lines_select on public.stock_fine_lines
  for select
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

drop policy if exists stock_fine_lines_insert on public.stock_fine_lines;
create policy stock_fine_lines_insert on public.stock_fine_lines
  for insert
  with check (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

-- --------------------------------------------------------------------------

comment on table public.stock_fines is
  'One row per posted stocktake that found a shortage. ⚠️ AN ABSENT ROW MEANS NOTHING WAS SHORT — except for stocktakes posted before this table existed, which have none for an entirely different reason. There is deliberately no backfill: charging somebody for a shortage that predates the policy is unfair however exact the arithmetic. ⚠️ A fine whose document was reversed is void, and that is derived from stock_documents.reverses_document_id rather than stored — one state fewer, and a fact that cannot go stale against the thing it describes.';

comment on column public.stock_fines.attribution is
  'What is being claimed, as data rather than prose. ⚠️ It is ALWAYS an administrative attribution to whoever was responsible at the moment of POSTING — never a finding that the shortage occurred during their responsibility. counted_at records when a discrepancy was discovered, not when it happened, so no anchor available can answer that. The sentence saying so lives in i18n and is asserted by a render test wherever a fine amount is drawn; this column is the machine-readable half of the same statement.';

comment on column public.stock_fines.employee_id is
  'Null is a recorded fact, not missing data: nobody could be charged, and `resolution` says whether that was because there was no responsible or more than one. ⚠️ The row is written either way, so "a shortage nobody was charged for" is visible rather than being an absence indistinguishable from a fine of zero.';

comment on column public.stock_fines.fine_percent is
  'Frozen from storages at posting, never read live. The storage dialog edits fine_percent and fine_basis, so a fine derived from them at read time would move every historical figure at once with nothing recording that it had — balance_at_count''s fault in another context. ⚠️ The AMOUNT is not stored: it follows from these and the lines, and a third stored number is a third thing that can disagree.';

comment on column public.stock_fine_lines.unit_value is
  'The price actually used, per fine_basis, frozen because it cannot be recovered afterwards — a product''s price changes and the basis decides which price was even being read. ⚠️ The line total and the fine total are both derived from here; neither is stored, and shortage_base is positive because a fine line means "this much was missing" rather than carrying the movement''s negative sign into every sum.';

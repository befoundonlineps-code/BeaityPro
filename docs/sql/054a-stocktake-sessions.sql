-- ==========================================================================
-- 054a -- CHANGE ONLY. No SELECT in this file. Verification is 054b.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- RUN ORDER: 054a (this) -> 054b -> 054c (post_stocktake) -> 054d.
--
-- No Arabic is deposited by this script, so there is nothing for 054b to read
-- back.
--
-- ---------------------------------------------------------------------------
-- WHAT THE STOCKTAKE LOSES TODAY, MEASURED IN 049b's BODY
--
--   v_diff := v_counted - v_balance;
--   if v_diff = 0 then continue; end if;      <-- no row. none. ever.
--
-- ⚠️ So a product counted and found CORRECT leaves no trace, and neither does a
-- product nobody counted. Both are zero rows, and nothing distinguishes them.
-- A stocktake of fifty products with three discrepancies stores three movements
-- and a document: afterwards it can say three things were wrong and cannot say
-- that forty-seven were right, or which forty-seven.
--
-- That is exactly what a period report needs — COVERAGE — and today the
-- question has no data behind it at all. Not partial: absent.
--
-- The count itself is also unrecoverable: quantity_base holds the DIFFERENCE,
-- and entered_quantity is null on a stocktake movement (correctly — nobody
-- typed a movement, they typed a count, and storing the count there would put
-- entered_quantity 10 beside quantity_base -5).
--
-- ---------------------------------------------------------------------------
-- WHY THE COUNTS GET THEIR OWN PARENT AND NOT stock_documents
--
-- The counts are written AS THEY ARE TYPED, so a count survives a reload, a
-- closed browser, and a different device — the owner's condition: being called
-- away mid-count is the ordinary case, not the exception, and losing half a
-- stocktake pushes somebody to guess rather than recount.
--
-- ⚠️ Which means they need a parent that exists BEFORE posting — and
-- post_stocktake is what creates the document. Hanging them on a
-- stock_documents row would mean creating it at the first count, and then:
--
--   lib/stockDocumentList.js:17
--   REVERSIBLE_TYPES = [..., 'stocktake', ...]
--
--   a half-written count appears in the documents list as a POSTED stocktake
--   with no movements -- indistinguishable from a stocktake that found nothing
--   wrong, which is the exact ambiguity this script exists to remove, one layer
--   up. And the reverse button lights up on it, producing a permanent reversal
--   document for a count that never happened.
--
-- So: their own parent. The in-progress count lives entirely outside
-- stock_documents, and nothing in the list, the reversal path or any report
-- changes.
--
-- ⚠️ AND "POSTED" IS A FACT, NOT A STATE. document_id null means open;
-- document_id set means posted, and points at the document. No status column
-- anywhere — a foreign key cannot disagree with the thing it points at, and a
-- posted_at timestamp could be filled with no document behind it.
--
-- ---------------------------------------------------------------------------
-- THE ABANDONED COUNT, ANSWERED BY CONSTRUCTION
--
-- The coverage report reads counts THROUGH the document. A session nobody
-- finished has no document, so it cannot reach the report — not because a query
-- excludes it, but because there is no path to it. Nothing to remember.
--
-- Its rows stay rather than being cleaned up, and that is the point: ten
-- products really were counted, and whoever opens that storage tomorrow
-- RESUMES instead of recounting.
--
-- ⚠️ And the partial unique index is the TRIGGER, not the hazard. It fires only
-- when somebody tries to start a new count -- which is the moment the question
-- should be asked. Without it two parallel sessions exist silently and the
-- second person's counts are invisible to the first.
--
-- ⚠️ Auto-joining an old session without asking is the danger the index
-- prevents: a session three weeks old hands somebody else's counts to a new
-- person, pre-filled as though they were their own, and posts them against
-- today's balance. Silent, plausible, permanent — the class all of this hunts.
-- So the screen asks one question with two answers ("resume" / "discard and
-- start fresh"), naming the date and the number counted, because discarding
-- destroys an hour of real work — unlike an order, which destroys none.
--
-- Discard is a DELETE and not a flag: a cancelled_at column would make the
-- index `where document_id is null and cancelled_at is null`, which is the
-- status column refused at the front door coming back through the side one.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE WHOLE FILE IS IDEMPOTENT, and that is load-bearing rather than tidy.
--
-- create table if not exists · create index if not exists · enable row level
-- security · grant · drop policy if exists + create policy · comment on —
-- every one of them may be run twice with the same result. So if this file was
-- already pasted before the DELETE policies below were narrowed in review,
-- RE-RUN THE WHOLE THING: it converges on what is written here rather than
-- leaving the database and the file disagreeing about what was executed.
--
-- ⚠️ UPDATE ON stocktake_counts IS DELIBERATELY *NOT* NARROWED, and the residual
-- is named rather than hidden. It should be — rewriting a posted count is the
-- same history edit as deleting one — but post_stocktake writes balance_at_post
-- through it, and a policy the posting path has to tiptoe around fails as
-- `0 rows affected` rather than as an error. Silence in the operation this
-- whole feature exists for is a worse trade than a rewrite no screen offers.
-- Closable once 054c fixes the order (balances first, document_id last) and
-- 054d asserts it — as its own decision, not slipped in with this one.
-- ==========================================================================

create table if not exists public.stocktake_sessions (
  id           uuid        primary key default gen_random_uuid(),
  salon_id     uuid        not null references public.salons (id)   on delete restrict,
  storage_id   uuid        not null references public.storages (id) on delete restrict,

  -- ⚠️ WHO IS AT THE KEYBOARD, and profiles rather than employees on purpose.
  -- The two answer different questions: post_stocktake takes p_employee_id and
  -- attributes the DOCUMENT, which can be somebody other than the person
  -- typing. This exists so the screen can say "your interrupted count" instead
  -- of "an open count", and only auth.uid() can answer that.
  --
  -- Defaulted so the client need not send it. Not policed beyond that: a client
  -- that lied would change the wording of a question and nothing else.
  started_by   uuid        references public.profiles (id) on delete set null default auth.uid(),

  started_at   timestamptz not null default now(),

  -- ⚠️ NULL until posted. This is the whole state machine.
  document_id  uuid        references public.stock_documents (id) on delete set null,

  -- The target of the composite foreign key below, exactly as product_orders
  -- carries one. Not redundant with the primary key: a composite reference
  -- needs a unique constraint on precisely the columns it names.
  constraint stocktake_sessions_id_salon_key unique (id, salon_id)
);

-- ⚠️ ONE OPEN COUNT PER STORAGE, and a partial index because a storage may have
-- any number of FINISHED counts. Two people counting the same storage then
-- write into one session and their counts merge, instead of two parallel
-- stocktakes neither of which knows about the other.
create unique index if not exists stocktake_sessions_one_open_per_storage
  on public.stocktake_sessions (salon_id, storage_id)
  where document_id is null;

create index if not exists stocktake_sessions_document_idx
  on public.stocktake_sessions (document_id);

create table if not exists public.stocktake_counts (
  id                       uuid        primary key default gen_random_uuid(),
  salon_id                 uuid        not null,
  session_id               uuid        not null,
  product_id               uuid        not null references public.products (id) on delete restrict,

  -- What the person counted, in base units. Unconstrained numeric for the
  -- reason product_order_lines.entered_quantity is: a narrower type than the
  -- one stock_movements uses would round on the way in, and that type has never
  -- been measured.
  --
  -- ⚠️ Zero is a real count and the most important one — it says the shelf is
  -- empty, which is the finding most likely to differ from the record. Only a
  -- negative count is refused.
  counted_base             numeric     not null,

  -- The frame the person counted in, kept so the sheet can be redrawn saying
  -- "3 packages" rather than "750". entry_uom, the same type stock_movements
  -- uses (053c measured it), so the permitted units are stated once.
  counted_entered_quantity numeric,
  counted_entered_uom      public.entry_uom,

  -- ⚠️ WRITTEN BY post_stocktake UNDER ITS LOCK, and null until then.
  --
  -- The first draft of this design stored the balance AT COUNTING TIME, and the
  -- resumable session is what exposed the fault: with counts written as they
  -- are typed, the gap between counting and posting is now hours or days. A
  -- balance recorded then would carry an official-looking number that disagrees
  -- with the arithmetic that actually ran — worse than not having it.
  --
  -- What the counter sees on screen is a DISPLAY. This is the RECORD, and it is
  -- the number the difference was computed from.
  balance_at_post          numeric,

  counted_at               timestamptz not null default now(),

  -- ⚠️ The upsert target. Counting a product twice corrects the first answer
  -- rather than adding a second, and without this the sheet would accumulate a
  -- row per keystroke-flush and post whichever the planner returned first.
  constraint stocktake_counts_one_per_product unique (session_id, product_id),

  -- The order tables' lesson applied rather than cited: copying salon_id down
  -- is what makes two rows able to disagree, and referential integrity bypasses
  -- row security — so without this a client could attach a count to a session
  -- it cannot see.
  constraint stocktake_counts_session_fkey
    foreign key (session_id, salon_id)
    references public.stocktake_sessions (id, salon_id) on delete cascade,

  constraint stocktake_counts_nonneg_check
    check (counted_base >= 0 and coalesce(counted_entered_quantity, 0) >= 0)
);

create index if not exists stocktake_counts_session_idx
  on public.stocktake_counts (session_id, product_id);

alter table public.stocktake_sessions enable row level security;
alter table public.stocktake_counts   enable row level security;

grant select, insert, update, delete on public.stocktake_sessions to authenticated;
grant select, insert, update, delete on public.stocktake_counts   to authenticated;

-- --------------------------------------------------------------------------
-- The same predicate the other five tables use, copied from the measurement in
-- 053 rather than reconstructed, and with no TO clause — {public}, matching.
-- --------------------------------------------------------------------------

drop policy if exists stocktake_sessions_select on public.stocktake_sessions;
create policy stocktake_sessions_select on public.stocktake_sessions
  for select
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

drop policy if exists stocktake_sessions_insert on public.stocktake_sessions;
create policy stocktake_sessions_insert on public.stocktake_sessions
  for insert
  with check (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

-- ⚠️ UPDATE is not optional here and is easy to mistake for optional: it is how
-- post_stocktake closes the session by writing document_id, and the function
-- runs as the INVOKER (051b:28 — none of the stock functions is SECURITY
-- DEFINER, measured), so it meets this policy like any other write.
drop policy if exists stocktake_sessions_update on public.stocktake_sessions;
create policy stocktake_sessions_update on public.stocktake_sessions
  for update
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()))
  with check (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

-- ⚠️ DELETE IS NARROWED TO AN OPEN SESSION, and the first draft was not — it
-- named the gap and then left it to the screen, which is the pattern this
-- project has refused all round: protection on the screen is not protection.
-- Raised in review.
--
-- The order's DELETE policy is unnarrowed because an order documents NO event;
-- the owner settled that. A session with a document is the opposite: a real
-- count, at a real time, against balances read under a lock. Deleting it
-- cascades the counts away and leaves stock_documents and stock_movements
-- standing — a stocktake whose coverage record no longer exists, which is the
-- one thing these tables were created to hold.
--
-- ⚠️ And it must survive a REVERSAL too, which is the case that settles it: a
-- reversed stocktake says the ADJUSTMENT was wrong, not that nobody counted.
-- The coverage is still true. So nothing should ever delete a posted session,
-- and there is no administrative correction that needs it — reverse_stock_
-- document already covers undoing the stock effect.
drop policy if exists stocktake_sessions_delete on public.stocktake_sessions;
create policy stocktake_sessions_delete on public.stocktake_sessions
  for delete
  using (document_id is null
     and salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

drop policy if exists stocktake_counts_select on public.stocktake_counts;
create policy stocktake_counts_select on public.stocktake_counts
  for select
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

drop policy if exists stocktake_counts_insert on public.stocktake_counts;
create policy stocktake_counts_insert on public.stocktake_counts
  for insert
  with check (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

-- The upsert lands here when the same product is counted twice, and
-- post_stocktake writes balance_at_post through it.
drop policy if exists stocktake_counts_update on public.stocktake_counts;
create policy stocktake_counts_update on public.stocktake_counts
  for update
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()))
  with check (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

-- Removing one product's count from an OPEN sheet, and narrowed for the same
-- reason as the parent: deleting one count out of a posted stocktake rewrites
-- its coverage just as surely as deleting all of them, and more quietly.
--
-- ⚠️ Discarding a whole session does NOT come through here: ON DELETE CASCADE
-- is referential integrity and bypasses row security, so the parent's policy is
-- the gate — which is now the narrowed one above. This governs the direct
-- delete only.
drop policy if exists stocktake_counts_delete on public.stocktake_counts;
create policy stocktake_counts_delete on public.stocktake_counts
  for delete
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid())
     and exists (select 1 from public.stocktake_sessions s
                  where s.id = session_id and s.document_id is null));

-- --------------------------------------------------------------------------

comment on table public.stocktake_sessions is
  'A count in progress, and the parent the counts hang on before there is a document. It exists because the counts are written as they are typed — being called away mid-count is ordinary, and losing half a stocktake pushes somebody to guess rather than recount. ⚠️ Deliberately NOT a stock_documents row: an unposted stocktake document would appear in the documents list as a posted stocktake with no movements, indistinguishable from one that found nothing wrong, with the reverse button lit. "Posted" is document_id being set — a fact, not a status column.';

comment on column public.stocktake_sessions.started_by is
  'The profile at the keyboard, not the employee the document is attributed to — post_stocktake takes p_employee_id for that, and they can differ. This exists so the resume question can say "your interrupted count" rather than "an open count".';

comment on column public.stocktake_counts.balance_at_post is
  'What post_stocktake read UNDER ITS LOCK, written at posting and null before. ⚠️ Not the balance at counting time: with resumable sessions the gap is hours or days, so a balance stored then would be an official-looking number disagreeing with the arithmetic that ran. What the counter sees on screen is a display; this is the record.';

comment on column public.stocktake_counts.counted_base is
  'The count, in base units. Zero is a real count and the most important one — it says the shelf is empty, the finding most likely to differ from the record. A row here means THIS PRODUCT WAS COUNTED, which is the fact the whole table exists for: today a product counted and found correct leaves no trace at all, and neither does one nobody counted.';

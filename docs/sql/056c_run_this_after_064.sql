-- ==========================================================================
-- 056c -- CHANGE ONLY. No SELECT in this file. Verification is 056d.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- RUN ORDER: 064 (five files) -> 056c (this) -> 056d (seven files).
--
-- ✅ ALREADY RUN ONCE, and 056d's seven queries all matched.
--
-- ⚠️ THE DEPLOYED BODY IS ONE COMMENT BEHIND THIS FILE. After that run, 064
-- measured units_per_package and the comment beside `nullif` turned out to
-- overstate its own guard; it is corrected below. Nothing executable changed —
-- 056d_2 counts executable fragments only, so its ✓ still holds — but
-- pg_get_functiondef will read the older wording until this file is run again.
-- It is CREATE OR REPLACE and idempotent, so re-running it plus 056d_2 and
-- 056d_3 is the whole cost of bringing the two into line. That is the owner's
-- call, not a defect: 046 exists because a wrong description shipped to the
-- database is part of the behaviour it describes.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AN UNWRITTEN DEPENDENCY, NAMED HERE BECAUSE NOTHING ELSE NAMES IT
--
-- Line ~228 takes `for update` on products, and under RLS a SELECT ... FOR
-- UPDATE applies the USING clause of the table's **UPDATE** policy on top of its
-- SELECT policy. This function never updates products — it only locks them — yet
-- it depends on products_update existing, a policy that exists for the products
-- screen and has nothing to do with stocktaking.
--
-- ⚠️ No gap today: 064_4 read every policy in the schema and products_update and
-- stocktake_sessions_update are both present, both on the plain salon predicate.
-- The risk is a future tidy-up reasoning "the stock module never updates
-- products, this policy is redundant" — which would break posting with a
-- permissions error naming a table the posting does not write.
--
-- ⚠️ And the honest limit of writing it HERE: whoever drops that policy will be
-- reading policies, not this file. This line records the dependency; it does not
-- guard it.
--
-- ⚠️ AND IT MUST NOT RUN BEFORE 060a, 061a AND 063a. The "failing loud is safe"
-- policy below rests on one claim — that the session, the document, the storage
-- and the products all belong to one salon BY CONSTRUCTION rather than by how
-- the application has behaved so far. Those three files are what make that a
-- constraint. docs/sql/README.md records run state only up to 052c, so their
-- status is not readable from the repository; it lives with the owner.
--
-- The body below is 054c's, unchanged except for the block marked ⑥. The cost
-- ladder is byte-identical and lib/costLadderParity.test.js proves it, now
-- pointed at this file rather than 054c — a parity guard aimed at a superseded
-- file is a guard for something nobody runs.
--
-- ---------------------------------------------------------------------------
-- ⑥ WHAT IS ADDED: THE FINE, WRITTEN INSIDE THE POSTING
--
-- The decisions it carries were settled before any of it was written, and are
-- recorded in PROJECT_HANDOFF stage 7: charged only when the responsible
-- resolves to EXACTLY ONE person; anchored at POSTING, not at counting; never
-- split between two people; and "no fine" is a row that says so rather than an
-- absence.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE PRICE. `nominal_purchase_price` IS NOT READ, AND THAT REVERSES A LINE
-- IN THE DIAGRAM RATHER THAN OVERLOOKING IT.
--
-- DATABASE_DIAGRAM:534 calls that column "أساس الغرامة". It cannot be, and the
-- repository already knew why: item 31 is open, and components/
-- StockDocumentScreen.js:172 refuses to use the same column as an automatic
-- default in the same words —
--
--     "nothing records whether that number is per package or per base unit,
--      and the two differ by the packaging factor"
--
-- shortage_base is in BASE units. Multiplying it by a number of unknown unit is
-- either right or 250x too large on an ordinary product, and the product of that
-- multiplication is a deduction from somebody's wages. So the owner decided:
--
--     purchase_price  ->  stock_movements.unit_cost, the cost this very function
--                         stamped on the shortage movement two statements ago.
--
-- ✅ AND IT IS PER BASE UNIT BY CONSTRUCTION, so item 31 cannot reach it.
--
-- ✅ AND A SHORTAGE LINE CAN NEVER CARRY AN ESTIMATE, which is a property of the
-- arithmetic and not a hope: a shortage means counted < balance, and
-- counted_base is CHECKed >= 0, so balance > 0 on every shortage line — so
-- `v_estimated := (v_balance <= 0)` is FALSE there always, and tier 1 (the
-- weighted average of prices actually paid in this storage) is the only tier a
-- fine line can be priced from. That is CLAUDE.md's own sentence about what
-- unit_cost is allowed to mean, holding here without needing to be enforced.
--
--     sales_price     ->  package_price / nullif(units_per_package, 0).
--
-- package_price is named "سعر البيع للعبوة" on the screen and is per PACKAGE
-- explicitly, unlike the purchase column. There is no sales column per base
-- unit anywhere in the schema, and inventing one is not this file's business.
--
-- ⚠️ AN EARLIER DRAFT OF THIS HEADER SAID "units_per_package is CHECKed > 0, so
-- the division cannot fail". That was repeated from DATABASE_DIAGRAM:528 and was
-- never READ from the catalogue — caught in review, and the sentence is left
-- here corrected rather than deleted, because it is the exact shape this project
-- keeps paying for: a document quoted until it sounds measured.
--
-- ✅ 064 HAS SINCE ASKED, AND THE ANSWER CLOSES IT: the constraint really is
-- there — CHECK ((units_per_package > (0)::numeric)) — the column is NOT NULL
-- with a default of 1, and zero rows offend it across seven products. The
-- document was telling the truth; demanding the measurement was still right.
-- The divisor keeps its nullif as immunity against a future ALTER, not as a
-- guard against a value that can occur today. See the nullif below.
--
-- ⚠️ A MISSING PRICE IS A LINE OF ZERO, NOT AN ABSENT LINE. Both source columns
-- are nullable (`numberOrNull` in lib/productForm.js, and package_price is
-- nulled outright when the product is not sold by packages), so a product with
-- no price is ordinary data and not a fault. The owner's decision: the line is
-- written with unit_value = 0. The shortage stays visible inside the fine's own
-- record and is charged nothing — `shortage_base > 0` beside `unit_value = 0`
-- says that by itself. Dropping the line instead would make the fine quietly
-- smaller than the shortage with nothing to read as the reason, which is the
-- poisoning fault in another costume.
--
-- ⚠️ THE CASE HAS NO `else`. A third label added to fine_basis tomorrow yields
-- NULL, which the NOT NULL column refuses — loud. An `else` would have priced it
-- as a sale silently.
--
-- ⚠️ AND unit_value IS COPIED ONTO THE LINE EVEN WHEN IT IS RECOVERABLE. For the
-- purchase basis it also sits on the movement, so this is two statements of one
-- fact — normally the thing this project removes. Kept, because the sales basis
-- genuinely cannot be recovered (the catalogue price moves), the column is NOT
-- NULL either way, and the two can never disagree: both are written in one
-- transaction from one expression, and neither table has an UPDATE policy.
--
-- ---------------------------------------------------------------------------
-- ⚠️ NO `RETURNING`, AND THAT IS NOT A STYLE CHOICE — IT IS THE ONE TRAP THIS
-- BLOCK HAD
--
-- `INSERT ... RETURNING` applies the table's SELECT policy to the returned row.
-- stock_fines_select (056a) is the one policy in the schema that is NOT the
-- plain salon predicate: it grants a row to the employee it names, or to an
-- administrator / executive / owner. So a receptionist posting a stocktake that
-- fines somebody else would be refused by 42501 on the RETURNING — and this
-- function has no exception handler, so the whole posting would roll back for a
-- reason that has nothing to do with stocktaking.
--
-- The id is generated here instead. gen_random_uuid() is the table's own default
-- (056a:115), so nothing about the row changes; only the read disappears.
--
-- ---------------------------------------------------------------------------
-- ⚠️ A FIFTH FAILURE PATH, AND THE ENUMERATION THAT APPROVED "LOUD" MISSED IT
--
-- The argument for having no exception handler was an enumeration of what could
-- fail, and one line of it read:
--
--     fine_percent outside 0-100  =>  storages carries the same CHECK  =>  impossible
--
-- That is true of the RANGE and says nothing about NULL: `fine_percent >= 0 and
-- fine_percent <= 100` returns UNKNOWN for a null, and a CHECK refuses only
-- FALSE. It is exactly the class 052b was rewritten for and that 044 was
-- re-read for. stock_fines.fine_percent is NOT NULL, so a storage with no policy
-- would abort the posting with 23502 — loud, but reading as a bug in this
-- function rather than as something the user can fix.
--
-- So it is refused by name instead, with a hint that says what to do.
--
-- ⚠️ THIS PARAGRAPH USED TO SAY "this branch is probably dead", AND THE SENTENCE
-- OUTLIVED ITS WORLD BY ABOUT AN HOUR. It was dead because lib/storageForm.js:73
-- refused a blank box — and 056d_4 then measured both columns nullable, which
-- made the screen, not the schema, the only thing holding the branch shut.
--
-- What the screen was holding shut turned out to be a fault: it pre-filled 100
-- and purchase_price, so both live storages carried a 100% wage deduction the
-- owner said was written to fill the box. The fields are optional now, blank
-- stores null, and check5 cleared both rows to null.
--
-- ✅ SO THE BRANCH IS LIVE, AND BOTH STORAGES ARE INSIDE IT. Its Arabic sentence
-- has still never been seen on a screen — 056d_3 read it out of prosrc, which
-- proves the text, not the path. The first stocktake with a shortage is now the
-- only way to it.
--
-- ⚠️ And the shape of this is worth keeping: a guard built for an unreachable
-- state, where the thing making it unreachable was later found to be the defect,
-- and the state was then entered on purpose.
--
-- ⚠️ AND ONE PATH IS DECLARED RATHER THAN GUARDED: `unit_value >= 0` would
-- refuse a negative weighted average. Costs are never stored negative, and
-- sum(quantity_base) > 0 on every shortage line, so it should not arise; a
-- greatest(x, 0) here would invent a number to hide a broken book. The
-- constraint is the guard, and it is loud.
--
-- ---------------------------------------------------------------------------
-- WHO IS CHARGED, IN ONE QUERY THAT READS THE WHOLE CATEGORY
--
-- A professional storage resolves structurally: storages_owner_matches_kind_check
-- makes (kind='professional') = (owner_employee_id IS NOT NULL), so there is
-- exactly one owner and no search.
--
-- A common storage asks storage_responsibles, and the query below asks it ONCE
-- for both kinds of row — a row naming an employee, and a row naming a role that
-- everybody holding it answers to:
--
--     r.employee_id = e.id  or  r.role = e.role
--
-- ⚠️ It also disposes of the third row shape without a branch. lib/storageForm.js
-- records that a row naming NEITHER is possible — the exclusive-or CHECK is a
-- design claim never read back from the database, and neither the composite key
-- (a NULL passes MATCH SIMPLE for free) nor the unique constraints see it. Both
-- comparisons go NULL on such a row, NULL is not true, and it selects nobody.
-- Nothing had to know it was there.
--
-- `employees.role` is a single NOT NULL column, so one employee holds one role —
-- which is why role_at_resolution can be read off the charged employee herself
-- and cannot be ambiguous between two ticked roles.
--
-- A named row wins the label over a role row when both resolve to the same one
-- person: naming her is the direct statement, and role_at_resolution must be
-- NULL then anyway (stock_fines_role_text_matches_resolution_check).
--
-- ⚠️ AND THIS LEANS ON TWO POLICIES BELONGING TO OTHER TABLES, said rather than
-- assumed: the function is the INVOKER (no stock function is SECURITY DEFINER),
-- so employees' and storage_responsibles' own RLS filters this query. Both are
-- the plain salon predicate today — 058 read employees_select directly — so
-- everyone in a salon sees the same set and the count is the same for whoever
-- posts. If either is ever narrowed per user, TWO responsibles could look like
-- ONE to a receptionist and the fine would name a person who was not the only
-- one answerable. That is the only way this block can be wrong quietly.
--
-- ---------------------------------------------------------------------------
-- WHERE IT SITS, AND WHY NOT ANYWHERE ELSE
--
-- After the loop, because it reads the movements the loop wrote. Before the
-- final UPDATE, because 054c ③ makes that update the last statement on purpose:
-- until it runs the session is still OPEN, which is what allows stocktake_counts'
-- UPDATE policy to be narrowed later without the posting path failing silently
-- at `0 rows affected`. This block touches no count, so it changes nothing about
-- that ordering — and it is put above rather than below so that it cannot.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.post_stocktake_session(p_session_id uuid, p_employee_id uuid DEFAULT NULL::uuid, p_doc_date timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_salon_id   uuid;
  v_storage_id uuid;
  v_posted     uuid;
  v_doc_id     uuid;
  v_row        record;
  v_balance    numeric;
  v_diff       numeric;
  v_cost       numeric;
  v_ids        uuid[];
  v_estimated  boolean;
  -- ⑥ the fine. p_employee_id is who POSTS; v_charged_id is who PAYS, and they
  -- are different questions with different answers.
  v_kind         public.storage_kind;
  v_owner_id     uuid;
  v_fine_percent numeric;
  v_fine_basis   public.fine_basis;
  v_candidates   uuid[];
  v_charged_id   uuid;
  v_resolution   public.fine_resolution;
  v_role_text    text;
  v_fine_id      uuid;
begin
  -- ④ The session is the idempotency key, and `for update` is what makes it
  -- one: two posts at the same instant serialise here instead of both reading
  -- "not posted" and both writing a document.
  select salon_id, storage_id, document_id
    into v_salon_id, v_storage_id, v_posted
    from stocktake_sessions
   where id = p_session_id
     for update;
  if not found then
    raise exception 'session_not_found' using hint = 'جلسة الجرد غير موجودة';
  end if;
  if v_posted is not null then
    raise exception 'session_already_posted' using hint = 'هذا الجرد مُرحَّل من قبل';
  end if;

  -- ① The products come from the table now. Same lock, same ordering, same
  -- existence check as the canonical body.
  select array_agg(distinct product_id) into v_ids
    from stocktake_counts where session_id = p_session_id;
  if v_ids is not null and array_length(v_ids, 1) > 0 then
    perform 1 from products where id = any(v_ids) order by id for update;
    if (select count(*) from products where id = any(v_ids)) <> array_length(v_ids, 1) then
      raise exception 'product_not_found' using hint = 'منتج بالمستند غير موجود';
    end if;
  end if;

  insert into stock_documents (salon_id, doc_type, storage_id, employee_id, doc_date, note)
  values (v_salon_id, 'stocktake', v_storage_id, p_employee_id, p_doc_date, p_note)
  returning id into v_doc_id;

  -- Ordered so two runs of the same data take the products in the same
  -- sequence. It changes no result, and it makes a diff of two runs readable.
  for v_row in
    select id, product_id, counted_base
      from stocktake_counts
     where session_id = p_session_id
     order by product_id
  loop
    -- The table's CHECK already refuses a negative count and a null. Kept
    -- anyway, and not as decoration: a CHECK is one ALTER away from being
    -- dropped, and this costs one comparison per line.
    if v_row.counted_base is null or v_row.counted_base < 0 then
      raise exception 'count_invalid' using hint = 'العدد لازم يكون صفرًا أو أكبر';
    end if;

    select coalesce(sum(quantity_base), 0) into v_balance
      from stock_movements
     where storage_id = v_storage_id and product_id = v_row.product_id;

    v_diff := v_row.counted_base - v_balance;

    -- ② ⚠️ WRITTEN FOR EVERY COUNTED PRODUCT, BEFORE the zero-difference skip
    -- below. This is the record that the product was counted and what the
    -- database believed at that instant — the fact that does not exist today.
    -- It is also why it is written HERE and not at counting time: this is the
    -- balance the difference was computed from, under this lock, and with a
    -- resumable session the two moments can be days apart.
    update stocktake_counts
       set balance_at_post = v_balance
     where id = v_row.id;

    if v_diff = 0 then
      continue;
    end if;

    -- Reasoning for the five tiers lives in docs/sql/043-cost-estimated.sql.
    -- The condition is written once and negated with `not`, deliberately.
    --
    -- ⑥ ⚠️ And on a SHORTAGE line it is always false: v_diff < 0 means
    -- counted_base < v_balance, and counted_base is CHECKed >= 0, so v_balance
    -- > 0. Every line a fine is ever built from is priced by tier 1.
    v_estimated := (v_balance <= 0);

    if not v_estimated then
      select sum(quantity_base * unit_cost) / sum(quantity_base) into v_cost
        from stock_movements
       where storage_id = v_storage_id and product_id = v_row.product_id;
    else
      select unit_cost into v_cost
        from stock_movements
       where storage_id = v_storage_id and product_id = v_row.product_id and quantity_base > 0
       order by created_at desc, id desc limit 1;

      if v_cost is null then
        select m.unit_cost into v_cost
          from stock_movements m
         where m.salon_id = v_salon_id and m.product_id = v_row.product_id and m.quantity_base > 0
         order by m.created_at desc, m.id desc limit 1;
      end if;

      if v_cost is null then
        select nominal_purchase_price into v_cost from products where id = v_row.product_id;
      end if;

      v_cost := coalesce(v_cost, 0);
    end if;

    insert into stock_movements (salon_id, document_id, storage_id, product_id,
                                 employee_id, quantity_base, unit_cost,
                                 entered_quantity, entered_uom,
                                 cost_is_estimated)
    -- ⑤ Explicit NULLs for the entered pair. The person typed a count and the
    -- movement is a difference derived from it; of the three possible answers
    -- (the count, the difference, neither) only neither makes no untrue claim.
    values (v_salon_id, v_doc_id, v_storage_id, v_row.product_id, p_employee_id,
            v_diff, v_cost,
            null, null,
            v_estimated);
  end loop;

  -- ⑥ ------------------------------------------------------------------------
  -- THE FINE. Only when this stocktake actually lost something: a shortage is a
  -- negative movement of this document, and nobody is fined for finding more.
  -- An absent fine row therefore means "nothing was short", which is exactly
  -- what stock_fines' own comment promises a reader.
  if exists (select 1 from stock_movements
              where document_id = v_doc_id and quantity_base < 0) then

    -- The policy, read at POSTING because that is the anchor, and read with
    -- salon_id as well as id: the composite key already makes another salon's
    -- storage unreferenceable, and a query that is correct on its own is
    -- correct after somebody edits the key.
    select s.kind, s.owner_employee_id, s.fine_percent, s.fine_basis
      into v_kind, v_owner_id, v_fine_percent, v_fine_basis
      from storages s
     where s.id = v_storage_id and s.salon_id = v_salon_id;

    -- ⚠️ `select ... into` over zero rows assigns NULL rather than leaving the
    -- variables alone, so without this the missing storage would arrive as a
    -- missing POLICY two lines below and be reported as the wrong thing.
    if not found then
      raise exception 'storage_not_found' using hint = 'مستودع الجرد غير موجود';
    end if;

    if v_fine_percent is null or v_fine_basis is null then
      raise exception 'fine_policy_missing'
        -- ⚠️ The sentence uses المصدر rather than الأمر, so it addresses nobody
        -- by gender — CLAUDE.md's rule for new text, and a hint IS new text:
        -- it reaches the screen verbatim. The named key wins over it anyway
        -- (products:stocktake.finePolicyMissing), because a key is translatable
        -- and this is Arabic living in the database.
        using hint = 'ما بينفع ترحيل الجرد وهذا المستودع بلا سياسة غرامة. تعيين نسبة الغرامة وأساسها بنافذة المستودع، وبعدها إعادة الترحيل.';
    end if;

    if v_kind = 'professional' then
      -- One owner, structurally. storages_owner_matches_kind_check makes the
      -- equivalence, so there is nothing to search and nothing to count.
      v_charged_id := v_owner_id;
      v_resolution := 'storage_owner';
      v_role_text  := null;
    else
      -- Everybody this storage makes answerable, by either route, counted once.
      select array_agg(distinct e.id) into v_candidates
        from employees e
       where e.salon_id = v_salon_id
         and exists (select 1 from storage_responsibles r
                      where r.storage_id = v_storage_id
                        and r.salon_id   = v_salon_id
                        and (r.employee_id = e.id or r.role = e.role));

      if coalesce(array_length(v_candidates, 1), 0) <> 1 then
        -- Zero and many are the same answer to "who pays" and different answers
        -- to "why not", so the row is written either way and says which.
        v_charged_id := null;
        v_role_text  := null;
        v_resolution := case when coalesce(array_length(v_candidates, 1), 0) = 0
                             then 'no_responsible'
                             else 'many_responsibles' end;
      else
        v_charged_id := v_candidates[1];

        if exists (select 1 from storage_responsibles r
                    where r.storage_id = v_storage_id
                      and r.salon_id   = v_salon_id
                      and r.employee_id = v_charged_id) then
          v_resolution := 'named_responsible';
          v_role_text  := null;
        else
          -- Her own role IS the role that resolved her: employees.role is a
          -- single NOT NULL column, so she holds exactly one and it must be one
          -- of the ticked ones for her to be here at all.
          --
          -- ⚠️ A SECOND READ, AND THE RACE IT OPENS IS NAMED HERE SO NOBODY HAS
          -- TO DIAGNOSE IT LATER. Raised in review. This row is not locked, and
          -- nothing protects her: the RESTRICT on storage_responsibles.
          -- employee_id only covers a NAMED responsible, and this branch is
          -- reached precisely because she is NOT named. If she is deleted
          -- between the candidate query and this line, `select ... into` over
          -- zero rows assigns NULL — so v_role_text goes null while resolution
          -- stays 'role_responsible', and
          -- stock_fines_role_text_matches_resolution_check refuses the row.
          --
          -- ⚠️ The failure is SAFE and MISLEADING, which is why it is written
          -- down: no wrong data is stored, the whole posting rolls back, and the
          -- message will read as a defect in this function when it is a rare
          -- race. It has been left as-is on the reviewer's call.
          --
          -- The alternative, if it ever earns its cost: read the role in the
          -- candidate query itself (a single-member candidate set has exactly
          -- one role, so an aggregate over it IS her role) — one snapshot, no
          -- second read, no race. Not done today because it makes the one query
          -- the fine's correctness rests on do two things, and this file's own
          -- constraint is that its logic be simple enough to be SEEN correct.
          select e.role::text into v_role_text
            from employees e where e.id = v_charged_id and e.salon_id = v_salon_id;
          v_resolution := 'role_responsible';
        end if;
      end if;
    end if;

    -- ⚠️ The id is generated rather than RETURNED: RETURNING would apply
    -- stock_fines_select, which is not the plain salon predicate, and would
    -- refuse a poster who is neither the fined employee nor a manager.
    v_fine_id := gen_random_uuid();

    insert into stock_fines (id, salon_id, document_id, storage_id, employee_id,
                             attribution, resolution, role_at_resolution,
                             fine_percent, fine_basis)
    -- attribution is written out although the column defaults to it: what is
    -- being claimed is the point of the row, and a default states it in a place
    -- nobody reading this function would look.
    values (v_fine_id, v_salon_id, v_doc_id, v_storage_id, v_charged_id,
            'posting', v_resolution, v_role_text,
            v_fine_percent, v_fine_basis);

    -- The lines come from the movements this function just wrote, not from a
    -- tally kept alongside the loop: one source, so the fine and the ledger
    -- cannot disagree about what was missing or what it was worth.
    --
    -- The sign is dropped here — a fine line means "this much was missing", and
    -- carrying the movement's minus would put one into every sum forever.
    insert into stock_fine_lines (salon_id, fine_id, product_id,
                                  shortage_base, unit_value)
    select v_salon_id, v_fine_id, m.product_id,
           - m.quantity_base,
           case v_fine_basis
             when 'purchase_price' then m.unit_cost
             -- ⚠️ nullif ON THE DIVISOR — AND IT IS DEAD CODE TODAY, PROVABLY.
             -- Keep it; do not read it as load-bearing.
             --
             -- The history matters more than the line. "units_per_package is
             -- CHECKed > 0" was asserted twice from DATABASE_DIAGRAM:528 and
             -- never read from the catalogue, so review demanded a measurement.
             -- 064_2 then answered:
             --
             --   products_units_per_package_check | c |
             --     CHECK ((units_per_package > (0)::numeric))
             --
             -- The document was telling the truth. 064_1 adds NOT NULL with
             -- default 1, and 064_3 found zero nulls, zero zeroes, zero
             -- negatives across seven products.
             --
             -- ⚠️ SO THE CLAIM THIS COMMENT USED TO MAKE WAS ITSELF UNMEASURED.
             -- It said zero was "reachable, not hypothetical" because
             -- productForm.js:200 sends Number('') === 0. That is true about the
             -- SCREEN and false about the COLUMN: the constraint refuses it with
             -- 23514 and no such row is ever stored. The divisor reads the
             -- column, and only the column. A comment written while correcting
             -- an unmeasured claim had become an unmeasured claim.
             --
             -- Both branches are now closed by measurement, not by argument:
             --   row present -> NOT NULL and > 0, so nullif never fires
             --   row absent  -> the LEFT JOIN already yields NULL, and the
             --                  division is NULL with or without nullif
             --
             -- ⚠️ It stays for one narrow reason only: the CHECK is one ALTER
             -- away from removal, and this costs a single comparison on a path
             -- that runs once per posting. That is insurance against a future
             -- schema change — NOT a guard against a value that can occur today.
             when 'sales_price'    then coalesce(p.package_price / nullif(p.units_per_package, 0), 0)
           end
      from stock_movements m
      -- ⚠️ LEFT, and the reason is the direction it fails in. An inner join
      -- drops a shortage line whose product it cannot see — a fine quietly
      -- SHORTER than the shortage, with nothing to read as the reason. A left
      -- join keeps the line and lets the price arrive NULL, which coalesce
      -- turns into the 0 that was already the decided answer for "no price".
      --
      -- Neither can happen today: stock_movements.product_id is RESTRICT so the
      -- row exists, and products' RLS is the plain salon predicate matching
      -- m.salon_id. The join is written for the direction it fails in anyway,
      -- because "cannot happen today" is the sentence this project has had to
      -- withdraw most often.
      left join products p on p.id = m.product_id and p.salon_id = m.salon_id
     where m.document_id = v_doc_id
       and m.quantity_base < 0;
  end if;

  -- ③ ⚠️ LAST STATEMENT BEFORE THE RETURN, and that placement is the design.
  -- Until this runs the session is OPEN, so every update above touched counts
  -- belonging to an open session — which is what lets stocktake_counts' UPDATE
  -- policy be narrowed to open sessions later without the posting path failing
  -- at `0 rows affected`. Moving this line up would break that silently.
  update stocktake_sessions
     set document_id = v_doc_id
   where id = p_session_id;

  return v_doc_id;
end;
$function$;

comment on function public.post_stocktake_session(uuid, uuid, timestamp with time zone, text) is
  'Posts a stocktake from a stocktake_sessions row whose counts were written as they were typed. Replaces post_stocktake(uuid, jsonb, ...), which is kept alive only until the screen moves and is dropped in 054e — two functions writing stocktakes is two answers to one question. ⚠️ Writes balance_at_post for EVERY counted product including the ones with no difference, which is the coverage record that did not exist before, and sets stocktake_sessions.document_id as its last statement so the counts are still attached to an open session while they are updated. ⚠️ Since 056c it also writes the fine: one stock_fines row per stocktake that lost something, charged only when the storage resolves to exactly one responsible person and otherwise recording WHY nobody was charged. The purchase basis reads the unit_cost this function just stamped — per base unit by construction — and NOT products.nominal_purchase_price, whose unit is unrecorded (item 31); the sales basis is package_price divided by units_per_package. Nothing here is wrapped in an exception handler on purpose: every way it can fail is either unreachable or a defect in this function, and swallowing a defect is how a year of stocktakes ends up with a missing fine that reads as "nothing was short".';

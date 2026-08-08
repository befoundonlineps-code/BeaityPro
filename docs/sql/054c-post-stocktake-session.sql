-- ==========================================================================
-- 054c -- CHANGE ONLY. No SELECT in this file. Verification is 054d.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- RUN ORDER: 054a -> 054b -> 054c (this) -> 054d. 054a must have run: this
-- function reads stocktake_counts.
--
-- The body below comes from the canonical post_stocktake in
-- docs/sql/043-cost-estimated.sql — NOT from memory, and not from 049b, which
-- says in its own header that 043 holds the canonical text.
--
-- ⚠️ AND "TAKEN MECHANICALLY" WAS AN OVERSTATEMENT, corrected here after the
-- reviewer asked. It is true of the COST LADDER and not of the function: the
-- loop was rewritten by hand to read a table instead of a jsonb argument, the
-- session lock and the balance update are new, and two variables were renamed.
-- The phrase was carried over from 049b's header, where it described a real
-- copy of three hint strings.
--
-- ✅ So the part where it has to hold is MEASURED, and permanently:
-- lib/costLadderParity.test.js cuts the ladder out of both files by its own
-- landmarks, strips comments, applies the two documented renames and compares.
-- 20 statements of 20 identical. It re-runs with every suite, so the day
-- somebody edits one ladder and not the other, a test says so.
--
-- The ladder is the right place to spend that, because it is where a dropped
-- line is INVISIBLE: every tier returns a number, so a missing tier does not
-- fail — it hands back a different cost, once, for a product with no history,
-- and the stamped unit_cost is permanent (ADR-051).
--
-- ---------------------------------------------------------------------------
-- ⚠️ A NEW NAME AND NOT A NEW SIGNATURE, WHICH IS A DECISION ABOUT DOWNTIME
--
-- CLAUDE.md §5 says a changed parameter list makes an OVERLOAD rather than a
-- replacement, so the old one must be dropped explicitly. Dropping
-- post_stocktake(uuid, jsonb, ...) here would be correct and would BREAK THE
-- STOCKTAKE SCREEN THE MOMENT IT RAN — lib/stockIO.js still calls the old
-- signature, and SQL runs at the owner's pace while code ships at mine. The two
-- do not land together, and a salon cannot count stock in between.
--
-- So this is a second function under its own name. No overload, no ambiguity,
-- no flag day: the old one keeps working until the screen moves.
--
-- ⚠️ AND THE OLD ONE MUST THEN BE DROPPED — two functions writing stocktakes is
-- two answers to one question, which is the thing this project keeps refusing.
-- That is 054e, after the screen is live, and it is a step rather than a wish:
-- 054d reports both existing so the pair is visible until it is resolved.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES, AND WHY EACH ONE
--
-- ① The lines come from stocktake_counts, not from a jsonb argument. That is
--    the whole point: they were written as they were typed, so they survived
--    the reload, the closed browser and the other device.
--
-- ② EVERY counted product gets balance_at_post written, INCLUDING the ones
--    whose difference is zero. `if v_diff = 0 then continue` still governs the
--    MOVEMENT — a movement of zero moved nothing — but it no longer governs the
--    record of having counted. That is the fault this whole stage exists for:
--    today a product counted and found correct is indistinguishable from one
--    nobody counted, because both are zero rows.
--
-- ③ ⚠️ THE ORDER IS LOAD-BEARING: balances first, document_id LAST. The session
--    is closed by the final statement in the function, so the counts are still
--    attached to an OPEN session while they are being updated. That is what
--    makes it possible to narrow the UPDATE policy on stocktake_counts later
--    (054a names it as a residual) without the posting path failing silently at
--    `0 rows affected`. 054d asserts the order rather than assuming it.
--
-- ④ An already-posted session is refused. The old function had no idempotency
--    key of any kind (registered item), so a double submit posted twice; here
--    the session IS the key, and `for update` on it means two simultaneous
--    posts serialise rather than both reading "not posted".
--
-- ⑤ entered_quantity and entered_uom on the movement are explicit NULLs.
--    Settled rounds ago and unchanged: the person typed a COUNT, not a
--    movement, and the movement is `counted - balance`. Storing 10 beside a
--    quantity_base of -5 would make every screen print two views of one number
--    that are not two views of one number.
--
-- Everything else — the five-tier cost ladder, cost_is_estimated, the product
-- lock, the Arabic hints — is the canonical text unchanged.
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
  'Posts a stocktake from a stocktake_sessions row whose counts were written as they were typed. Replaces post_stocktake(uuid, jsonb, ...), which is kept alive only until the screen moves and is dropped in 054e — two functions writing stocktakes is two answers to one question. ⚠️ Writes balance_at_post for EVERY counted product including the ones with no difference, which is the coverage record that did not exist before, and sets stocktake_sessions.document_id as its last statement so the counts are still attached to an open session while they are updated.';

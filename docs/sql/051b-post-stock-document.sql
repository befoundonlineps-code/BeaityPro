-- ==========================================================================
-- Stage 4b -- post_stock_document stores the bonus and refuses it where it
--             has no meaning
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- ⚠️ THREE `raise exception` STATEMENTS ARE ADDED TO THE FUNCTION BODY below,
-- but none of them RUNS while this script is executed: the body is stored as
-- text and only planned when the function is called. Nothing here opens a
-- transaction that could roll the CREATE OR REPLACE back.
--
-- RUN ORDER: 051a -> 051b -> 051c -> 051d. 051a must run first: this function
-- writes to bonus_quantity, and a column that does not exist yet fails on the
-- first CALL, not on this script (PL/pgSQL plans a statement the first time it
-- is executed, never at creation).
--
-- ---------------------------------------------------------------------------
-- NO DROP FUNCTION HERE, and that is a difference from 047 and 050c
--
-- Those two added PARAMETERS, which makes an overload rather than a
-- replacement, so the old signature had to be dropped explicitly. The bonus
-- travels inside p_lines as one more field of each line object, so the
-- signature is untouched: same 15 parameters, same types, same order. There is
-- exactly one post_stock_document before this script and exactly one after,
-- and 051d asserts it rather than assuming it.
--
-- ⚠️ AND THE WHOLE OBJECT IS REWRITTEN ANYWAY. CREATE OR REPLACE replaces
-- every property, not only the body -- so LANGUAGE and RETURNS are restated
-- below, and the ABSENCE of SECURITY DEFINER and of a search_path setting is
-- deliberate and measured, not forgotten: 050c verified this function as
-- prosecdef = false with proconfig = null, and 051d re-reads both. Adding them
-- here would be a silent privilege change smuggled in with a feature.
--
-- ---------------------------------------------------------------------------
-- WHAT THE FUNCTION DOES AND DOES NOT DO WITH THE BONUS
--
-- It STORES it, and it REFUSES the three shapes that have no meaning. It does
-- not divide by it: unit_cost arrives already landed from lib/documentMoney.js,
-- as it has since stage 4, and no new arithmetic runs under the lock.
--
-- The database also cannot check the two against each other, and this is worth
-- saying out loud rather than leaving as an omission somebody later "fixes":
-- unit_cost carries the document discount and the freight spread across every
-- line, so it is NOT recoverable from this line's own price, quantity and
-- bonus. There is no consistency check to write here. The screen is where the
-- two are kept in step, and the tests are where that is held.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.post_stock_document(p_doc_type stock_doc_type, p_storage_id uuid, p_lines jsonb, p_supplier_id uuid DEFAULT NULL::uuid, p_employee_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_doc_date timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text, p_supplier_doc_number text DEFAULT NULL::text, p_discount_kind text DEFAULT NULL::text, p_discount_value numeric DEFAULT NULL::numeric, p_transport_amount numeric DEFAULT NULL::numeric, p_transport_paid_to text DEFAULT NULL::text, p_paid_amount numeric DEFAULT NULL::numeric, p_payment_method text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_salon_id uuid;
  v_doc_id   uuid;
  v_line     jsonb;
  v_pid      uuid;
  v_qty      numeric;
  v_cost     numeric;
  v_sum_qty  numeric;
  v_ids      uuid[];
  v_estimated boolean;
  v_entered  numeric;                                     -- ① جديد
  v_bonus    numeric;                                     -- ① جديد
begin
  if p_doc_type in ('transfer', 'reversal', 'stocktake') then
    raise exception 'wrong_function_for_doc_type'
      using hint = 'التحويل والعكس والجرد لهم دوال مستقلة';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'stock_document_empty' using hint = 'المستند بلا سطور';
  end if;
  select salon_id into v_salon_id from storages where id = p_storage_id;
  if not found then
    raise exception 'storage_not_found' using hint = 'المستودع غير موجود';
  end if;
  select array_agg(distinct (l->>'product_id')::uuid)
    into v_ids from jsonb_array_elements(p_lines) l;
  perform 1 from products where id = any(v_ids) order by id for update;
  if (select count(*) from products where id = any(v_ids)) <> array_length(v_ids, 1) then
    raise exception 'product_not_found' using hint = 'منتج بالمستند غير موجود';
  end if;
  insert into stock_documents (salon_id, doc_type, storage_id, supplier_id,
                               employee_id, appointment_id, doc_date, note,
                               supplier_doc_number,
                               discount_kind, discount_value,
                               transport_amount, transport_paid_to,
                               paid_amount, payment_method)
  values (v_salon_id, p_doc_type, p_storage_id, p_supplier_id,
          p_employee_id, p_appointment_id, p_doc_date, p_note,
          p_supplier_doc_number,
          p_discount_kind, p_discount_value,
          p_transport_amount, p_transport_paid_to,
          p_paid_amount, p_payment_method)
  returning id into v_doc_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_pid := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'quantity_base')::numeric;
    if v_qty is null or v_qty = 0 then
      raise exception 'stock_line_zero' using hint = 'سطر بكمية صفر';
    end if;

    -- ② جديد: يُقرأ المُدخَل مرّةً واحدةً هنا فيصير الرقمُ الذي يفحصه الشرط
    -- هو الرقمَ نفسَه الذي يُخزَّن. كان يُقرأ داخل الإدراج مباشرةً، فلو فُحص
    -- ثمّ أُدرج لصارا تعبيرين يمكن أن يفترقا.
    v_entered := (v_line->>'entered_quantity')::numeric;
    v_bonus   := (v_line->>'bonus_quantity')::numeric;

    -- ③ جديد: شكل السطر يُرفض قبل أن تُحسب كلفته.
    if v_bonus is not null then
      if p_doc_type not in ('supply', 'opening') then
        raise exception 'bonus_supply_only'
          using hint = 'البضاعة المجّانيّة تُسجَّل بالتوريد وحده';
      end if;
      if v_bonus < 0 then
        raise exception 'bonus_negative'
          using hint = 'الكمّية المجّانيّة لا تكون سالبة';
      end if;
      -- ⚠️ يحمي القاسم لا الشكل: وزن السطر بتوزيع الخصم والنقل هو
      -- (المستلَم − المجّانيّ) × السعر، فوزنٌ سالبٌ واحد يفسد حصص كلّ
      -- الأسطر لا حصّة سطره.
      if v_entered is null or v_bonus > v_entered then
        raise exception 'bonus_over_quantity'
          using hint = 'المجّانيّ جزءٌ من الكمّية المستلمة لا زيادةٌ عليها';
      end if;
    end if;

    if p_doc_type in ('supply', 'opening') then
      v_cost := (v_line->>'unit_cost')::numeric;
      if v_cost is null or v_cost < 0 then
        raise exception 'unit_cost_required' using hint = 'سعر الشراء إجباري بالتوريد';
      end if;

      --
      v_estimated := false;
    else
      select sum(quantity_base) into v_sum_qty
        from stock_movements
       where storage_id = p_storage_id and product_id = v_pid;

      v_estimated := (coalesce(v_sum_qty, 0) <= 0);

      if not v_estimated then
        select sum(quantity_base * unit_cost) / sum(quantity_base) into v_cost
          from stock_movements
         where storage_id = p_storage_id and product_id = v_pid;
      else
        select unit_cost into v_cost
          from stock_movements
         where storage_id = p_storage_id and product_id = v_pid and quantity_base > 0
         order by created_at desc, id desc
         limit 1;

        if v_cost is null then
          select m.unit_cost into v_cost
            from stock_movements m
           where m.salon_id = v_salon_id and m.product_id = v_pid and m.quantity_base > 0
           order by m.created_at desc, m.id desc
           limit 1;
        end if;

        if v_cost is null then
          select nominal_purchase_price into v_cost from products where id = v_pid;
        end if;

        v_cost := coalesce(v_cost, 0);
      end if;
    end if;
    insert into stock_movements (salon_id, document_id, storage_id, product_id,
                                 employee_id, quantity_base, unit_cost,
                                 entered_quantity, entered_uom,
                                 cost_is_estimated,
                                 entered_unit_price, line_discount_kind, line_discount_value,
                                 bonus_quantity)
    values (v_salon_id, v_doc_id, p_storage_id, v_pid, p_employee_id,
            v_qty, v_cost,
            v_entered,
            (v_line->>'entered_uom')::entry_uom,
            v_estimated,
            (v_line->>'entered_unit_price')::numeric,
            v_line->>'line_discount_kind',
            (v_line->>'line_discount_value')::numeric,
            v_bonus);
  end loop;
  return v_doc_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Verification: one copy, the bonus reaching BOTH the guard and the insert,
-- the three refusals present by name, and security unchanged.
--
-- ⚠️ Content, never existence: the old version has the same name and the same
-- signature, so count(*) = 1 would be true of it too. And the fragments below
-- all carry a bracket or a keyword that only appears in executed code -- a
-- plain word would also match the Arabic comments inside the body.
-- ---------------------------------------------------------------------------
select
  count(*)                                                    as copies_expect_1,
  bool_or(p.prosrc like '%bonus_quantity)%')                  as insert_names_column_expect_t,
  bool_or(p.prosrc like '%v_bonus)%')                         as insert_stores_value_expect_t,
  bool_or(p.prosrc like '%v_entered,%')                       as insert_uses_read_once_expect_t,
  bool_or(p.prosrc like '%bonus_supply_only%')                as refuses_on_issue_expect_t,
  bool_or(p.prosrc like '%bonus_negative%')                   as refuses_negative_expect_t,
  bool_or(p.prosrc like '%bonus_over_quantity%')              as refuses_over_quantity_expect_t,
  bool_or(p.prosecdef)                                        as security_definer_expect_false,
  bool_or(p.proconfig is null)                                as search_path_unset_expect_true
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'post_stock_document';

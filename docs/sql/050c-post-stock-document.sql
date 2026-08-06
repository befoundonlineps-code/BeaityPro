-- ==========================================================================
-- Stage 4 -- post_stock_document takes the money
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No RAISE is executed here, no DO block, no temp table.
--
-- SIX new parameters for the document, and three line fields read out of the
-- JSON. Nothing else moved -- the text is patched mechanically from the
-- deployed version (049a), not retyped.
--
-- THE ALLOCATION IS NOT HERE, and that is a correction to what I described.
-- I said the split would run inside this function. It does not need to: the
-- function already accepts unit_cost per line for a supply, and a landed cost
-- IS a unit cost. So the client sends the allocated figure exactly as it
-- sends a typed one today, no new arithmetic runs under the lock, and the
-- split stays where 20 tests can reach it (lib/documentMoney.js).
--
-- This adds no new exposure: the client already decides unit_cost for every
-- supply. It moves nothing from the database to the browser.
--
-- NEW PARAMETERS MAKE AN OVERLOAD, so the previous signature is dropped by
-- hand and verification counts copies (law 5).
-- ==========================================================================

drop function if exists public.post_stock_document(
  stock_doc_type, uuid, jsonb, uuid, uuid, uuid, timestamp with time zone, text, text);

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
  v_estimated boolean;                                    -- ① جديد
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
                                 entered_unit_price, line_discount_kind, line_discount_value)
    values (v_salon_id, v_doc_id, p_storage_id, v_pid, p_employee_id,
            v_qty, v_cost,
            (v_line->>'entered_quantity')::numeric,
            (v_line->>'entered_uom')::entry_uom,
            v_estimated,
            (v_line->>'entered_unit_price')::numeric,
            v_line->>'line_discount_kind',
            (v_line->>'line_discount_value')::numeric);
  end loop;
  return v_doc_id;
end;
$function$;


-- Verification: one copy, the money reaching the body, security unchanged.
select p.proname, count(*) as copies
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'post_stock_document'
group by p.proname;

select (length(p.prosrc) - length(replace(p.prosrc, 'p_payment_method)', '')))
       / length('p_payment_method)') as document_money_reaches_insert,
       (length(p.prosrc) - length(replace(p.prosrc, 'line_discount_value)', '')))
       / length('line_discount_value)') as line_money_reaches_insert,
       p.prosecdef as security_definer_expect_false,
       p.proconfig as search_path_expect_null
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'post_stock_document';

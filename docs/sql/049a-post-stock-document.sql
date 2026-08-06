-- ==========================================================================
-- Restore the Arabic `using hint` text in post_stock_document
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- WHAT THIS CHANGES: the 6 hint strings, and nothing else. No
-- signature, no logic, no structure. CREATE OR REPLACE alone suffices because
-- the signature is unchanged; no DROP FUNCTION is needed or wanted.
--
-- WHY: the hints were translated to English while working around an encoding
-- problem, and check 5 of script 048 proved the workaround was wider than the
-- problem. Two functions predating this project -- freeze_consignment_after_use
-- and refuse_archiving_stocked_storage -- still hold intact Arabic inside their
-- bodies. Arabic survives inside $function$ perfectly well, so these messages
-- were translated, not damaged.
--
-- A hint is not a comment. It is the SECOND rung of the error ladder (named
-- key, then hint, then the generic sentence) and it reaches a user screen
-- verbatim. An English sentence there is a wrong sentence in an Arabic product.
--
-- SOURCE: the canonical text in docs/sql/047-supplier-doc-number.sql, which was
-- never translated. Taken mechanically, not retyped.
--
-- THE ARABIC `--` COMMENTS ARE REMOVED rather than translated here, and that is
-- deliberate: a paraphrase written in this file would be a second account of
-- the reasoning, free to drift from the one it came from. The body points at
-- that file instead. The executable code is identical to it, verified by
-- comparing every non-comment line.
-- ==========================================================================

-- Reasoning for every marked change lives in docs/sql/047-supplier-doc-number.sql

CREATE OR REPLACE FUNCTION public.post_stock_document(p_doc_type stock_doc_type, p_storage_id uuid, p_lines jsonb, p_supplier_id uuid DEFAULT NULL::uuid, p_employee_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_doc_date timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text, p_supplier_doc_number text DEFAULT NULL::text)
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
                               supplier_doc_number)
  values (v_salon_id, p_doc_type, p_storage_id, p_supplier_id,
          p_employee_id, p_appointment_id, p_doc_date, p_note,
          p_supplier_doc_number)
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
                                 cost_is_estimated)                -- ① جديد
    values (v_salon_id, v_doc_id, p_storage_id, v_pid, p_employee_id,
            v_qty, v_cost,
            (v_line->>'entered_quantity')::numeric,
            (v_line->>'entered_uom')::entry_uom,
            v_estimated);                                          -- ① جديد
  end loop;
  return v_doc_id;
end;
$function$;

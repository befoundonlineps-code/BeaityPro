-- ==========================================================================
-- Stage 4 -- the reversal copies the three new columns too
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No RAISE is executed here, no DO block, no temp table.
--
-- The owner caught this: reverse_stock_document copies an EXPLICIT column
-- list, so a column added to the table is silently dropped by every reversal
-- until it is named here. Reversing a discounted supply would produce
-- movements with a null price and a null discount while the original carried
-- real ones.
--
-- It is the same principle already settled for unit_cost and
-- cost_is_estimated: a reversal is not a new decision about the money, it is
-- the negation of one that was taken, so it inherits the description along
-- with the number.
--
-- Two lines change. No signature, no logic, no DROP.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.reverse_stock_document(p_document_id uuid, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_src     stock_documents;
  v_doc_id  uuid;
  v_ids     uuid[];
begin
  select * into v_src from stock_documents where id = p_document_id;
  if not found then
    raise exception 'stock_document_not_found' using hint = 'المستند غير موجود';
  end if;
  if v_src.doc_type = 'reversal' then
    raise exception 'cannot_reverse_a_reversal' using hint = 'لا يُعكس مستند عكسي';
  end if;
  perform 1 from stock_documents where reverses_document_id = p_document_id;
  if found then
    raise exception 'already_reversed' using hint = 'المستند معكوس سابقًا';
  end if;
  select array_agg(distinct product_id) into v_ids
    from stock_movements where document_id = p_document_id;
  perform 1 from products where id = any(v_ids) order by id for update;
  insert into stock_documents (salon_id, doc_type, storage_id, to_storage_id,
                               employee_id, reverses_document_id, doc_date, note)
  values (v_src.salon_id, 'reversal', v_src.storage_id, v_src.to_storage_id,
          v_src.employee_id, p_document_id, now(), p_note)
  returning id into v_doc_id;

  insert into stock_movements (salon_id, document_id, storage_id, product_id,
                               employee_id, quantity_base, unit_cost,
                               entered_quantity, entered_uom,
                               cost_is_estimated,
                               entered_unit_price, line_discount_kind, line_discount_value)
  select v_src.salon_id, v_doc_id, m.storage_id, m.product_id, m.employee_id,
         -m.quantity_base, m.unit_cost, m.entered_quantity, m.entered_uom,
         m.cost_is_estimated,
         m.entered_unit_price, m.line_discount_kind, m.line_discount_value
    from stock_movements m
   where m.document_id = p_document_id;
  return v_doc_id;
end;
$function$;

-- Verification: the three names appear in the copy, once each.
select (length(p.prosrc) - length(replace(p.prosrc, 'm.entered_unit_price', '')))
       / length('m.entered_unit_price') as copies_price,
       (length(p.prosrc) - length(replace(p.prosrc, 'm.line_discount_kind', '')))
       / length('m.line_discount_kind') as copies_kind,
       (length(p.prosrc) - length(replace(p.prosrc, 'm.line_discount_value', '')))
       / length('m.line_discount_value') as copies_value
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'reverse_stock_document';

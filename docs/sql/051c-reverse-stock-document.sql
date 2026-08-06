-- ==========================================================================
-- Stage 4b -- the reversal copies bonus_quantity too
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No RAISE is executed here, no DO block, no temp table.
--
-- RUN ORDER: 051a -> 051b -> 051c -> 051d.
--
-- ---------------------------------------------------------------------------
-- THIS FILE EXISTS BEFORE ANYBODY ASKED FOR IT, and that is the point
--
-- In stage 4 the owner caught that reverse_stock_document copies an EXPLICIT
-- column list, so any column added to stock_movements is silently dropped by
-- every reversal until it is named here. 050d fixed it, and 050e caught that
-- 050d had been read and not executed -- a check counting the function's
-- EXISTENCE would have passed while three columns went missing.
--
-- So bonus_quantity is named here in the same round it is born, and 051d
-- re-measures it rather than trusting this file was run.
--
-- ---------------------------------------------------------------------------
-- COPIED AS IT IS, NOT NEGATED -- and the asymmetry is deliberate
--
-- quantity_base is negated because the reversal moves the goods the other way.
-- entered_quantity is NOT negated: it is what a person typed, and nobody typed
-- minus seven. bonus_quantity follows entered_quantity for the same reason --
-- one of the seven was free, and reversing the document does not make it
-- un-free.
--
-- ⚠️ The result is a row with a NEGATIVE quantity_base carrying a POSITIVE
-- bonus, which is exactly why 051a does not add the obvious-looking CHECK
-- (bonus_quantity is null or quantity_base > 0). That constraint would refuse
-- every reversal written below.
--
-- It is the same principle already settled for unit_cost and
-- cost_is_estimated: a reversal is not a new decision about the goods, it is
-- the negation of one that was taken, so it inherits the description along
-- with the number.
--
-- One line changes in the column list and one in the select. No signature, no
-- logic, no DROP.
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
                               entered_unit_price, line_discount_kind, line_discount_value,
                               bonus_quantity)
  select v_src.salon_id, v_doc_id, m.storage_id, m.product_id, m.employee_id,
         -m.quantity_base, m.unit_cost, m.entered_quantity, m.entered_uom,
         m.cost_is_estimated,
         m.entered_unit_price, m.line_discount_kind, m.line_discount_value,
         m.bonus_quantity
    from stock_movements m
   where m.document_id = p_document_id;
  return v_doc_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Verification: the four inherited columns appear in the copy, once each, and
-- the sign is applied to quantity_base alone.
-- ---------------------------------------------------------------------------
select
  count(*)                                                    as copies_expect_1,
  (length(p.prosrc) - length(replace(p.prosrc, 'm.bonus_quantity', '')))
    / length('m.bonus_quantity')                              as copies_bonus_expect_1,
  (length(p.prosrc) - length(replace(p.prosrc, 'm.entered_unit_price', '')))
    / length('m.entered_unit_price')                          as copies_price_expect_1,
  (length(p.prosrc) - length(replace(p.prosrc, 'm.line_discount_kind', '')))
    / length('m.line_discount_kind')                          as copies_kind_expect_1,
  (length(p.prosrc) - length(replace(p.prosrc, 'm.line_discount_value', '')))
    / length('m.line_discount_value')                         as copies_value_expect_1,
  -- ⚠️ Exactly one minus sign on a copied column, and it is on the quantity.
  -- If a later edit negates the bonus or the entered quantity "for symmetry",
  -- this goes to 2 and says so.
  (length(p.prosrc) - length(replace(p.prosrc, '-m.', '')))
    / length('-m.')                                           as negated_columns_expect_1
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'reverse_stock_document';

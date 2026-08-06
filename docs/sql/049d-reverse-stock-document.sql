-- ==========================================================================
-- Restore the Arabic `using hint` text in reverse_stock_document
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- WHAT THIS CHANGES: the 3 hint strings, and nothing else. No
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
-- SOURCE: the canonical text in docs/sql/043-cost-estimated.sql, which was
-- never translated. Taken mechanically, not retyped.
--
-- THE ARABIC `--` COMMENTS ARE REMOVED rather than translated here, and that is
-- deliberate: a paraphrase written in this file would be a second account of
-- the reasoning, free to drift from the one it came from. The body points at
-- that file instead. The executable code is identical to it, verified by
-- comparing every non-comment line.
-- ==========================================================================

-- Reasoning for every marked change lives in docs/sql/043-cost-estimated.sql

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
                               cost_is_estimated)
  select v_src.salon_id, v_doc_id, m.storage_id, m.product_id, m.employee_id,
         -m.quantity_base, m.unit_cost, m.entered_quantity, m.entered_uom,
         m.cost_is_estimated
    from stock_movements m
   where m.document_id = p_document_id;
  return v_doc_id;
end;
$function$;

-- ==========================================================================
-- 070 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- 🔴 WHY THIS STOPPED BEING CURIOSITY AND BECAME A PRECONDITION
--
-- Two facts measured separately, and their product is worse than either:
--
--   §3.13ب  «مبرد ومهدئ ليزر» holds 28650 in the test storage, source unknown,
--           everything else in the salon between 0 and 125.
--   §3.13ج  That product is now one of the two blocking removal of «عناية
--           بالشعر» from that storage. All six links are refused.
--
-- ⚠️ SO THE PHANTOM NUMBER IS LOAD-BEARING. The storage cannot be configured
-- until it is dealt with, and every exit currently available writes fiction or
-- charges a person:
--
--   transfer   -> pushes 28650 imaginary units into another storage, and
--                 stamps them with a document
--   write-off  -> a write-off document for goods that never existed, poisoning
--                 the cost column the fine itself stands on
--   stocktake  -> counts what is really there, computes a shortage of 28640,
--                 and writes a fine against somebody's wages for a mistyped key
--
-- ⚠️ The honest exit is the one already in the schema and not yet discussed:
-- reverses_document_id. Reversing the document that carried the error removes
-- its effect and leaves two documents saying what happened and why — ADR-051
-- doing what it was built for.
--
-- ⚠️ AND WITHOUT THIS QUERY THERE IS NO HONEST EXIT AT ALL: reversal needs a
-- document to reverse. Five movements exist in that storage; if one of them
-- carries the whole number, one reversal settles it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ NOT FILTERED TO THAT PRODUCT. Every movement in the salon is listed with
-- its document, ordered by size. A filter would confirm what is already
-- suspected and would hide a second number nobody has noticed — and the whole
-- reason this one was found is that a survey read the whole class.
--
-- WHAT TO LOOK AT:
--   • the row(s) that add up to 28650, and their document_id and doc_type
--   • whether one document carries it or several — one reversal or several
--   • ⚠️ reversed_by: a document already reversed needs no second reversal, and
--     a movement whose document is reversed but whose balance persists would be
--     a different and much worse finding
--   • and any OTHER movement whose size is out of scale with its neighbours
-- ==========================================================================

select
  m.created_at,
  d.doc_type,
  s.name                                   as storage_name,
  p.name                                   as product_name,
  m.entered_quantity,
  m.entered_uom,
  m.quantity_base,
  m.unit_cost,
  m.cost_is_estimated,
  m.document_id,
  d.doc_date,
  d.note,
  d.reverses_document_id,
  (select r.id from public.stock_documents r
    where r.reverses_document_id = d.id
      and r.salon_id = d.salon_id
    limit 1)                               as reversed_by
from public.stock_movements m
join public.stock_documents d on d.id = m.document_id and d.salon_id = m.salon_id
join public.storages s        on s.id = m.storage_id  and s.salon_id = m.salon_id
join public.products p        on p.id = m.product_id  and p.salon_id = m.salon_id
order by abs(m.quantity_base) desc, m.created_at;

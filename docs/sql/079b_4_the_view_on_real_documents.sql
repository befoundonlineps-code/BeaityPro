-- ==========================================================================
-- 079b_4 -- SURVEY ONLY. Read-only: nothing is written. RUN AFTER 079a.
--
-- ---------------------------------------------------------------------------
-- THE VIEW'S OWN ARITHMETIC, ON THE REAL DOCUMENTS — because 079b_3 reads the
-- view and would inherit any error in it while looking entirely healthy.
--
-- A reversal retires the PAIR. Both halves must read is_live = false:
--
--     the original    ← something reverses it   (reversed_by_document_id)
--     the reversal    ← it reverses something   (reverses_document_id)
--
-- ⚠️ AND THE WITNESS IS ALREADY KNOWN, WHICH IS WHAT MAKES THIS FALSIFIABLE
-- RATHER THAN DECORATIVE — item 1ج:
--
--   • 070 found the two consecutive stocktakes 39 seconds apart that wrote the
--     28650, and 072 confirmed neither carried a fine, so reversing them was
--     clean. Those documents must appear here as a retired pair.
--   • the supplies for «شامبو 250 مل» and «مقشر ليزر» were reversed. Two more
--     pairs, four more non-live rows.
--
-- So a plausible-looking output with EVERY document live means the join found
-- nothing and the view is answering "live" to everything — which would make
-- 079a's TEST ONE identical to the old `exists`, and 079b_3 would print
-- "مقفول ← مقفول" everywhere while claiming to have measured a change.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND ONE ROW SHAPE MUST NOT EXIST — a document that both reverses
-- something and was itself reversed. `cannot_reverse_a_reversal` in
-- reverse_stock_document refuses it, so `both` in the last column would mean
-- that guard has a hole. It is printed rather than filtered out, because a
-- query that filters away the shape it is testing for cannot report it.
--
-- ⚠️ NO `where` ON DOC TYPE OR DATE — item 4ب. The whole table is read and the
-- eye filters. The document counts here are small enough that a narrowing
-- would buy nothing and could hide the one row that matters.
-- ==========================================================================

select
  d.doc_date,
  d.doc_type,
  l.document_id,
  l.is_live,
  l.reverses_document_id,
  l.reversed_by_document_id,
  case
    when l.reverses_document_id is not null
     and l.reversed_by_document_id is not null then '🔴 both — cannot_reverse_a_reversal has a hole'
    when l.reverses_document_id    is not null then 'this one is a reversal'
    when l.reversed_by_document_id is not null then 'this one was reversed'
    else 'stands'
  end as why
from public.stock_document_liveness l
join public.stock_documents d
  on  d.id       = l.document_id
  and d.salon_id = l.salon_id
order by d.doc_date desc, l.document_id;

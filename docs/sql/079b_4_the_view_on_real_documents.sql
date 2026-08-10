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
-- RATHER THAN DECORATIVE — item 1ج. THREE PAIRS, read off 070's output:
--
--     8749222a  (transfer)          ← reversed by 429db60a
--     1ba5a461  (supply, شامبو)     ← reversed by 539553bb
--     038a8bcf  (supply, مقشر)      ← reversed by 92a40815
--
-- Six non-live rows. If every document comes back live, the join found nothing
-- and the view is answering "live" to everything — which would make 079a's
-- TEST ONE identical to the old `exists`, and 079b_3 would print
-- "مقفول ← مقفول" everywhere while claiming to have measured a change.
--
-- ---------------------------------------------------------------------------
-- 🔴 AND THE OPPOSITE PREDICTION IS THE STRONGER ONE, BECAUSE EVERY INSTINCT
-- IN THIS THREAD GETS IT BACKWARDS:
--
--     THE TWO STOCKTAKES THAT WROTE THE 28650 MUST COME BACK is_live = true.
--
-- Nobody reversed them. They were nominated for reversal and 072 established
-- that reversing them would be clean — a recommendation, not an event. The
-- proof is in our own record: PROJECT_HANDOFF.md:624 shows both of them still
-- SUMMING INTO the 28650 that is on the books today, which is only possible
-- while their movements still count.
--
-- ⚠️ AN EARLIER DRAFT OF THIS FILE NAMED THEM AS A RETIRED PAIR — "so
-- reversing them was clean" became "so they were reversed" in the retelling,
-- and the transfer pair, which is real, was not in the list at all. A false
-- witness is worse than no witness: absence leaves the reader careful, and a
-- lie aims their care at the one thing that is working. Whoever read it would
-- have seen is_live = true on those two and concluded the VIEW was broken.
--
-- So it stays, inverted: those two documents live, and the 28650 still on the
-- books, is the view telling the truth about a correction NOT YET MADE.
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

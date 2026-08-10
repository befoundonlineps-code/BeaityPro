-- ==========================================================================
-- 073 · QUERY 2 of 2 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ⚠️ THE ONE WORTH READING TWICE.
--
-- ---------------------------------------------------------------------------
-- 🔴 WHY: one stocktake was measured with a shortage and NO fine — 68bb6b81,
-- 2026-08-06, general storage, «شامبو 250 مل», −2 at 50.
--
-- The likely explanation is that it predates the fine mechanism: 056a ran two
-- days later. ⚠️ THAT IS A GUESS, NOT A MEASUREMENT — and the alternative is
-- far worse: that posting can write a shortage WITHOUT a fine, which is a hole
-- in the guard phase 7 was closed on.
--
-- ⚠️ AND THE DIFFERENCE IS DECIDED BY ONE QUESTION: is there any stocktake with
-- a shortage and no fine DATED AFTER 056a? If that document is the only one, it
-- is history. If there is another, it is a defect.
--
-- Leaving it as "probably history" is exactly the class this whole thread was
-- spent refusing.
--
-- ---------------------------------------------------------------------------
-- ⚠️ EVERY stocktake document, not the ones without fines. A query filtered to
-- the suspicious case cannot report that the suspicious case is absent, and it
-- cannot show the ones WITH fines beside them — which is what makes "before the
-- mechanism / after the mechanism" readable as a line rather than asserted.
--
-- WHAT TO LOOK AT:
--   • verdict = '⚠️ SHORTAGE, NO FINE' — the case this file was written for.
--     Read after_fines_were_live beside it: FALSE means it predates the
--     mechanism and is history; TRUE means a live hole, and that outranks
--     everything else in this file.
--   • ⚠️ verdict = '⚠️ FINE WITHOUT SHORTAGE' — a fine with no cause. Rarer and
--     worse, and it has its own label so it cannot hide inside 'no shortage'.
--   • ⚠️ Read has_shortage and fine_id DIRECTLY as well. verdict is a
--     convenience computed here, and a label that summarises is a label that
--     can be wrong about what it summarises — this one already was.
-- ==========================================================================

select
  d.id                                        as document_id,
  d.doc_date,
  d.created_at,
  s.name                                      as storage_name,
  count(m.id) filter (where m.quantity_base < 0)   as shortage_lines,
  count(m.id) filter (where m.quantity_base > 0)   as surplus_lines,
  (count(m.id) filter (where m.quantity_base < 0)) > 0 as has_shortage,
  f.id                                        as fine_id,
  f.resolution,
  f.fine_percent,
  -- ⚠️ The pairing that makes the answer readable in one row: a shortage with
  -- no fine is the case; a shortage with a fine is the mechanism working; and
  -- the dates put a line between them without anybody asserting where it falls.
  -- ⚠️ FOUR OUTCOMES, NOT THREE. A first version collapsed "a fine with no
  -- shortage" into the reassuring 'no shortage' — the very case its own header
  -- called "the opposite surprise, worth a glance". Swallowed by the label that
  -- tells the reader to move on.
  --
  -- ⚠️ And it is worse than the case this file was written for: a shortage
  -- without a fine may be history. A FINE WITHOUT A SHORTAGE is a fine with no
  -- cause — a row naming a person with nothing underneath it.
  case
    when (count(m.id) filter (where m.quantity_base < 0)) > 0 and f.id is null
      then '⚠️ SHORTAGE, NO FINE'
    when (count(m.id) filter (where m.quantity_base < 0)) = 0 and f.id is not null
      then '⚠️ FINE WITHOUT SHORTAGE'
    when f.id is not null then 'fined'
    else 'no shortage'
  end                                         as verdict,

  -- ⚠️ THE BEFORE/AFTER LINE, DERIVED FROM THE ROWS INSTEAD OF REMEMBERED.
  --
  -- The header used to say "if it predates 056a it is history" — and 056a's run
  -- date is not in this query, not in the repository, and lives only with the
  -- owner. The data carries it: the earliest stock_fines.created_at is the
  -- moment the mechanism was demonstrably live. Anything before it can be
  -- history; anything after it cannot.
  --
  -- Same move as reading the formula out of 056c instead of inventing one.
  -- ⚠️ AND coalesce HERE TOO, for the sibling of the same fault: with no fines
  -- at all min() is null, so every row would answer null and "before the line"
  -- would be indistinguishable from "there is no line". It works today because
  -- fines exist; on a fresh salon it would go quiet with perfect composure.
  coalesce(
    d.created_at >= (select min(f2.created_at) from public.stock_fines f2
                      where f2.salon_id = d.salon_id),
    false
  )                                           as after_fines_were_live,
  -- And the distinction the coalesce would otherwise hide, said out loud.
  (select count(*) from public.stock_fines f3 where f3.salon_id = d.salon_id) = 0
                                              as no_fines_exist_at_all
from public.stock_documents d
join public.storages s        on s.id = d.storage_id and s.salon_id = d.salon_id
left join public.stock_movements m on m.document_id = d.id and m.salon_id = d.salon_id
left join public.stock_fines f     on f.document_id = d.id and f.salon_id = d.salon_id
where d.doc_type = 'stocktake'
group by d.id, d.doc_date, d.created_at, s.name, f.id, f.resolution, f.fine_percent
order by d.doc_date, d.created_at;

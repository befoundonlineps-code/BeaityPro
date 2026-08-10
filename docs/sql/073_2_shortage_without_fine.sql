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
--   • has_shortage = true AND fine_id IS NULL — the case. Read its doc_date.
--   • ⚠️ if the ONLY such row is dated before 056a, it is history and the branch
--     closes. Any row after it is a live hole and outranks everything else here.
--   • has_shortage = false with a fine present would be the opposite surprise,
--     and is worth a glance while the whole class is on screen.
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
  case
    when (count(m.id) filter (where m.quantity_base < 0)) = 0 then 'no shortage'
    when f.id is not null then 'fined'
    else '⚠️ SHORTAGE, NO FINE'
  end                                         as verdict
from public.stock_documents d
join public.storages s        on s.id = d.storage_id and s.salon_id = d.salon_id
left join public.stock_movements m on m.document_id = d.id and m.salon_id = d.salon_id
left join public.stock_fines f     on f.document_id = d.id and f.salon_id = d.salon_id
where d.doc_type = 'stocktake'
group by d.id, d.doc_date, d.created_at, s.name, f.id, f.resolution, f.fine_percent
order by d.doc_date, d.created_at;

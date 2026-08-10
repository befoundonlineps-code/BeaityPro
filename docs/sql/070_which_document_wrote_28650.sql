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
-- ⚠️ AND units_per_package IS IN THE OUTPUT, BECAUSE THREE OF THE FOUR NUMBERS
-- CANNOT BE CHECKED AGAINST EACH OTHER.
--
-- entered_quantity, entered_uom and quantity_base only become an equation with
-- the packaging factor beside them:
--
--   1910 × 15 = 28650   -> "1910 packages" typed, a plausible slip for 19 or 191
--   28650 ×  1          -> the whole number typed in pieces, a different mistake
--
-- and the difference decides what gets built: the first is caught by a
-- confirmation on the entry unit, the second is not.
--
-- ⚠️ AND IT OPENS A THIRD POSSIBILITY THAT IS INVISIBLE WITHOUT IT: that the
-- equation does not hold at all — base is not entered × factor under any
-- reading. That would be far worse than the typo, because it means either the
-- frame conversion does not produce what we think, or units_per_package CHANGED
-- after the movement was stamped. Three numbers cannot be verified; four can.
--
-- WHAT TO LOOK AT:
--   • the row(s) that add up to 28650, their document_id and their doc_type
--   • frame_check — 'ok' means entered × factor = base. Anything else is the
--     third possibility above and outranks everything else in this file.
--   • whether one document carries it or several — one reversal or several
--   • ⚠️ reversed_by: an already-reversed document needs no second reversal, and
--     a movement whose document is reversed while its balance persists would be
--     a different and much worse finding
--   • and any OTHER movement out of scale with its neighbours
--
-- ---------------------------------------------------------------------------
-- 🔴 AND ONE BRANCH IS ALREADY MEASURED FROM THE REPOSITORY, BEFORE THIS RUNS
--
-- If doc_type comes back 'stocktake', reversal is NOT the clean exit:
--
--   • reverse_stock_document's newest version is 051c. stock_fines was created
--     in 056a — five scripts later. Zero mentions of stock_fines in ANY
--     reversal script (measured across all thirteen that name the function).
--   • reversal does not delete the original document; it writes a counter
--     document. stock_fines.document_id keeps pointing at the original, which
--     is still there.
--
-- ⚠️ So a reversed stocktake leaves its FINE STANDING — a deduction against a
-- person with no live document justifying it, which is worse than the phantom
-- balance we are trying to leave. If doc_type is 'stocktake', the first
-- question is not "how do we reverse" but "what happens to the fine", and it is
-- measured before anything is reversed.
--
-- ✅ And if doc_type is 'supply' or 'opening', the reversal is clean as
-- described — no fine is attached to those.
--
-- ✅ AND REVERSAL IS REACHABLE IN THE APP TODAY, measured rather than assumed:
-- lib/stockIO.js:137 calls rpc('reverse_stock_document', …) and
-- components/StockDocumentsList.js draws the action. So the honest exit exists
-- as a screen, not only as a column the schema knows about.
-- ==========================================================================

select
  m.created_at,
  d.doc_type,
  s.name                                   as storage_name,
  p.name                                   as product_name,
  m.entered_quantity,
  m.entered_uom,
  p.units_per_package,
  p.units_per_portion,
  m.quantity_base,
  -- ⚠️ The equation, evaluated rather than left to the eye. 'ok' means the two
  -- frames agree; anything else is the third possibility named in the header.
  -- A stocktake adjustment has no entered frame at all — that is by design, not
  -- a mismatch — so it is named as its own answer instead of reading as a fault.
  -- ⚠️ THREE UNITS, NOT TWO. entry_uom is package · portion · unit — measured,
  -- and measured by us. A first version split it into "package" and "not
  -- package", so a legitimate portion movement would read ⚠️ MISMATCH: the
  -- loudest label in this file, fired at a normal case. And with
  -- units_per_portion = 1 by chance it would read ok while checking nothing.
  --
  -- ⚠️ And the irony is worth keeping: portion was ruled an ENTRY unit rather
  -- than a display frame three rounds ago — correctly, and about the balance
  -- column. This is a check about entry, the one place it matters, and it is
  -- where it got dropped. A closed list of three read as two, by the people who
  -- had measured it.
  --
  -- ⚠️ AND abs() ON BOTH SIDES MEANS THIS COMPARES MAGNITUDES AND NEVER SEES
  -- DIRECTION. The entered quantity is a magnitude and the sign comes from
  -- doc_type, so that is right here — but a supply recorded with a negative
  -- sign reads ok, and the sign is the difference between goods arriving and
  -- goods leaving. Checking it needs a doc_type → sign map, which is a
  -- different question; what this file owes is to say that it does not.
  case
    -- Named by what the document IS, not by the one type somebody assumed.
    -- entered_quantity is also null for sale, service_consumption and reversal,
    -- and none of those is a fault either — a label that guessed 'stocktake'
    -- would be claiming to know a source the condition does not carry.
    when m.entered_quantity is null
      then 'no entered frame (' || d.doc_type || ')'
    when m.entered_uom = 'package'
      then case when abs(m.entered_quantity * p.units_per_package) = abs(m.quantity_base)
                then 'ok' else '⚠️ MISMATCH' end
    when m.entered_uom = 'portion'
      then case
             when p.units_per_portion is null then '⚠️ portion entry, no portion size'
             when abs(m.entered_quantity * p.units_per_portion) = abs(m.quantity_base)
               then 'ok' else '⚠️ MISMATCH'
           end
    when m.entered_uom = 'unit'
      then case when abs(m.entered_quantity) = abs(m.quantity_base)
                then 'ok' else '⚠️ MISMATCH' end
    -- A fourth value would mean entry_uom grew and this check did not.
    else '⚠️ unknown entered_uom: ' || coalesce(m.entered_uom::text, 'null')
  end                                      as frame_check,
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

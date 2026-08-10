-- ==========================================================================
-- 072 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- WHY: whether reversing the two stocktakes that wrote 28650 is clean, and one
-- larger question that the narrow version of it cannot see.
--
-- Both adjustments were POSITIVE — a surplus, not a shortage — and a fine is
-- computed from shortage_base. So probably no fine attaches to them, and the
-- reversal is clean.
--
-- ⚠️ "PROBABLY" IS NOT THE STANDARD HERE. stock_fines.document_id is NOT NULL
-- and unique per document, but nothing measured says whether posting writes a
-- fine row for EVERY stocktake or only for one with a shortage. A header with
-- no lines is possible and has never been read.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND THE SECOND ANSWER IS WORTH MORE THAN THE FIRST, WHICH IS WHY THIS IS
-- NOT FILTERED TO THOSE TWO DOCUMENTS.
--
-- If a fine turns up sitting on a document that has ALREADY been reversed, that
-- is not a future branch to design around — it is a deduction standing today,
-- in this database, with no live document justifying it. A query narrowed to
-- the two documents in question could not see it.
--
-- Which is the same reason 070 was not filtered to one product: the number was
-- found at all because a survey read the whole class.
--
-- WHAT TO LOOK AT:
--   • lines — a header with 0 lines answers "does posting write a fine for
--     every stocktake". Zero rows overall answers it differently, and both are
--     answers.
--   • ⚠️ document_reversed_by — anything non-null here is the finding above,
--     and it outranks everything else in this file.
--   • resolution and employee_id together: a fine naming nobody
--     (no_responsible / many_responsibles) is a recorded reason, not a charge.
-- ==========================================================================

select
  f.id                                        as fine_id,
  d.doc_type,
  d.doc_date,
  s.name                                      as storage_name,
  e.name                                      as charged_employee,
  f.resolution,
  f.role_at_resolution,
  f.fine_percent,
  f.fine_basis,
  count(l.id)                                 as lines,
  coalesce(sum(l.shortage_base), 0)           as shortage_total,
  coalesce(sum(l.line_charged), 0)            as charged_total,
  -- ⚠️ The column that matters most. A fine whose document has been reversed is
  -- a charge outliving its cause.
  (select r.id from public.stock_documents r
    where r.reverses_document_id = d.id
      and r.salon_id = d.salon_id
    limit 1)                                  as document_reversed_by,
  f.attribution,
  f.created_at
from public.stock_fines f
join public.stock_documents d on d.id = f.document_id and d.salon_id = f.salon_id
join public.storages s        on s.id = f.storage_id  and s.salon_id = f.salon_id
left join public.employees e  on e.id = f.employee_id and e.salon_id = f.salon_id
left join public.stock_fine_lines l on l.fine_id = f.id and l.salon_id = f.salon_id
group by f.id, d.id, d.doc_type, d.doc_date, d.salon_id, s.name, e.name,
         f.resolution, f.role_at_resolution, f.fine_percent, f.fine_basis,
         f.attribution, f.created_at
order by d.doc_date desc, f.created_at desc;

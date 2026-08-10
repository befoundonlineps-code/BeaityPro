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
-- ---------------------------------------------------------------------------
-- ⚠️ EVERY COLUMN NAME HERE CHECKED AGAINST A MEASUREMENT, NAMED:
--
--   stock_fine_lines  056a's create block — six columns, no line_charged. The
--                     amount is shortage_base × unit_value, computed below.
--   stock_fines       056a — resolution, role_at_resolution, fine_percent,
--                     fine_basis, attribution, employee_id, document_id.
--   employees.name    ✅ measured in this thread: check3 returned to_jsonb(e)
--                     whole — {id, name, role, salon_id, created_at,
--                     profile_id, is_assistant, phone_number}. `name`, not
--                     full_name. That row is the reason to_jsonb was used
--                     instead of a hand-picked column list.
--   stock_documents   doc_type · doc_date · reverses_document_id (DIAGRAM:572)
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
  -- ⚠️ THE MONEY IS A PRODUCT, NOT A STORED COLUMN. A first version selected
  -- `l.line_charged`, which does not exist — stock_fine_lines has exactly six
  -- columns (056a): id · salon_id · fine_id · product_id · shortage_base ·
  -- unit_value. The query would have failed at execution.
  --
  -- ⚠️ And the fault is in the method, not the line. The column name entered
  -- this work from a review message reporting the first fine field by field,
  -- and the creation script — in this repository, authoritative, three commands
  -- away — was never opened. A measurement in hand that was not consulted, which
  -- is the same fault as claiming a present from an old copy.
  coalesce(sum(l.shortage_base * l.unit_value), 0)             as shortage_value,
  coalesce(sum(l.shortage_base * l.unit_value), 0)
    * coalesce(f.fine_percent, 0) / 100                        as charged_total,
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

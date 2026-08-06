-- ==========================================================================
-- 052a -- SURVEY ONLY. Read-only. Run this FIRST, before 052b.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No DDL in this file, so nothing here can be undone by anything here.
--
-- RUN ORDER: 052a (survey) -> 052b (the constraint) -> 052c (verification).
--
-- ---------------------------------------------------------------------------
-- WHY A SURVEY BEFORE THE CONSTRAINT
--
-- ADD CONSTRAINT validates every existing row. If one violates it the ALTER
-- fails and says so — correctly, and without naming which row. There is real
-- data in these tables now, so the question "can this constraint be added at
-- all?" is asked here, where the answer is a list rather than an error.
--
-- ⚠️ EXPECTED: zero rows. Every line written so far came through a screen that
-- refuses a discount larger than its line. A row here is not a disaster — it is
-- a document that needs reversing before 052b can run — but it must be looked
-- at rather than discovered as a failed migration.
--
-- ---------------------------------------------------------------------------
-- WHAT IS BEING SURVEYED, AND WHY IT IS NOT ALREADY IMPOSSIBLE
--
-- post_stock_document refuses a NEGATIVE unit_cost (unit_cost_required). That
-- catches most of this, and it is why the answer to "is a discount over the
-- line refused by the database?" is "partly" rather than "no".
--
-- But it is a guard on the RANGE of a derived number, and CLAUDE.md already
-- records what those miss: a legitimate value carrying the wrong meaning. The
-- hole is measured, not supposed. Two lines, one refused:
--
--   line A   1 x 150, discount 200 (amount)  ->  net -50
--   line B   1 x  50                         ->  net  50
--   freight 100, so the weights sum to ZERO and spread() splits it evenly
--
--   landed:  A = -50 + 50 = 0        B = 50 + 50 = 100
--   sent as unit_cost:  0 and 100  ->  nothing is negative  ->  ACCEPTED
--
-- So line A is stamped unit_cost = 0 with cost_is_estimated = FALSE: a
-- confident zero, which is the exact shape of the poisoning this module spent a
-- session removing. And line B carries freight that was apportioned against a
-- negative weight.
-- ==========================================================================

select m.id,
       d.doc_type,
       d.doc_date,
       m.product_id,
       m.entered_quantity,
       m.bonus_quantity,
       m.entered_unit_price,
       m.line_discount_kind,
       m.line_discount_value,
       m.unit_cost,
       -- What the line was charged before the discount, by the same expression
       -- 052b is about to enforce. Shown so a row that appears here explains
       -- itself without a second query.
       (abs(m.entered_quantity) - coalesce(m.bonus_quantity, 0)) * m.entered_unit_price
         as line_gross
from stock_movements m
left join stock_documents d on d.id = m.document_id
-- ⚠️ `m.line_discount_kind is not null` GUARDS BOTH BRANCHES, and the survey
-- needs it for the same reason the constraint does. Without it a row with a
-- value and no kind makes every branch UNKNOWN, `not UNKNOWN` is UNKNOWN, and
-- WHERE keeps only rows that are TRUE — so the one shape most worth finding
-- would have been the one shape this survey could not see, and it would have
-- reported "zero rows" with confidence.
where m.line_discount_value is not null
  and not (
    m.line_discount_kind is not null
    and (
      (m.line_discount_kind = 'percent' and m.line_discount_value <= 100)
      or (m.line_discount_kind = 'amount'
          and m.entered_unit_price is not null
          and m.entered_quantity is not null
          and m.line_discount_value
              <= (abs(m.entered_quantity) - coalesce(m.bonus_quantity, 0)) * m.entered_unit_price)
    )
  )
order by d.doc_date desc nulls last, m.id;

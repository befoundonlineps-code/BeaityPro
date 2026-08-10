-- ==========================================================================
-- 079b_1 -- SURVEY ONLY. Read-only: nothing is written. Safe at any time.
--
-- ⚠️ RUN THIS ONE **BEFORE** 079a, NOT AFTER. It is the only verification file
-- in this thread that measures a PREMISE rather than a result, and the premise
-- decides whether 079a is written correctly at all.
--
-- ---------------------------------------------------------------------------
-- THE QUESTION: does anything except products.is_consignment record that the
-- goods belonged to somebody else?
--
-- 079a gives its two fields two different tests, and the whole justification is
-- one measurable asymmetry:
--
--     supplier_id     is copied onto every stock_documents row
--                     ⇒ the product column is a default, not the record
--                     ⇒ freeze it only while the goods are actually owned
--                       by that supplier (a live balance)
--
--     is_consignment  is copied nowhere we can find
--                     ⇒ the product column IS the record
--                     ⇒ freeze it once anything real has happened (history)
--
-- ⚠️ AND THE SECOND LINE IS AN INFERENCE UNTIL THIS FILE RUNS. What was read
-- is the INSERT lists of the four posting functions — and DATABASE_DIAGRAM.md
-- states the limit of that at line 576: a function's text reveals the columns
-- it TOUCHES, never the table's columns. Absence from a function body is
-- "not written by these four", not "not there".
--
-- ⇒ IF stock_documents OR stock_movements CARRIES A CONSIGNMENT FLAG, then the
-- flag is mirrored exactly as the supplier is, TEST ONE in 079a is too strict,
-- and both fields should have gone back to the live-balance test. Say so and
-- 079a is rewritten before it runs.
--
-- ---------------------------------------------------------------------------
-- ⚠️ NO FILTER ON column_name, ON PURPOSE — CLAUDE.md item 4ب. Asking
-- `where column_name = 'is_consignment'` is asking the catalogue a narrow
-- question, and a narrow question hides everything it did not think of. This
-- project has paid for that four times in one round (first_name/last_name ·
-- reverses_document_id · a TYPE where a CHECK was expected · a constraint
-- Postgres named itself). The whole column list is read, and the eye filters.
--
-- ⚠️ WITNESS OF TRUTH — CLAUDE.md item 1ج. An absence query must contain
-- something known to be present, or "there is none" and "I never looked here"
-- print identically. Two rows MUST appear or the result means nothing:
--
--     stock_documents  · supplier_id     ← 049a:65 puts it in the insert list
--     stock_movements  · document_id     ← every movement carries its document
--
-- If those two are missing, this query did not reach these tables and no
-- conclusion may be drawn from anything else it printed.
--
-- ---------------------------------------------------------------------------
-- AND TWO ANSWERS ARRIVE FREE, BOTH OF THEM NEEDED THIS WEEK:
--
--   1. products.is_consignment · is_nullable — 079a wraps both sides in
--      coalesce(…, false) for the null→false case. If this says NO, that
--      coalesce is provably dead code kept as insurance, exactly as
--      nullif(units_per_package, 0) turned out to be in 056c. Recording which
--      it is stops the next reader from "simplifying" it back out.
--
--   2. the whole products column list — which the catalogue screen needs
--      anyway, and which no file in this repository currently holds.
-- ==========================================================================

select
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('stock_documents', 'stock_movements', 'products')
order by c.table_name, c.ordinal_position;

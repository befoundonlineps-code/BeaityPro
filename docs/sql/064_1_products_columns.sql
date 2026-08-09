-- ==========================================================================
-- 064 · QUERY 1 of 5 -- SURVEY ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven).
-- Safe to run at any time, before or after anything else.
--
-- ---------------------------------------------------------------------------
-- WHY: 056c divides by products.units_per_package for the sales basis. The
-- claim "it is CHECKed > 0" was repeated twice in this work and its only source
-- in the repository is DATABASE_DIAGRAM:528 — a document, not the catalogue.
-- "الوثائق بتوجّهك، والقاعدة بتقرّر."
--
-- ⚠️ EVERY column is listed, not just units_per_package. Filtering down to the
-- column you already have in mind is exactly how a TYPE (entry_uom) went unseen
-- where a constraint was being looked for. Read the category, filter by eye.
--
-- WHAT TO LOOK AT: the units_per_package row — its data_type, its is_nullable,
-- and its column_default.
-- ==========================================================================

select
  c.column_name,
  c.data_type,
  c.udt_name,
  c.numeric_precision,
  c.numeric_scale,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'products'
order by c.ordinal_position;

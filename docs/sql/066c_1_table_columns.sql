-- ==========================================================================
-- 066c · QUERY 1 of 6 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 066a -> 066b -> 066c_1 … 066c_6. RUN AFTER 066a.
--
-- ⚠️ Its own file rather than the tail of 066a: a verification query that fails
-- rolls back the DDL above it and reports its own error, never the undo it
-- caused. 051c was lost that way and 051d is what noticed.
--
-- ---------------------------------------------------------------------------
-- WHY: every column of the new table, read whole rather than checked one by
-- one. A query that asks "is category_id there?" learns only what it already
-- suspected; a listing shows the four columns beside each other and their
-- nullability, which is where a missing NOT NULL would show.
--
-- EXPECTED: five rows — id, salon_id, storage_id, category_id, created_at.
-- All uuid except created_at (timestamptz). is_nullable = NO on all five.
-- id defaults to gen_random_uuid(), created_at to now().
-- ==========================================================================

select
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'storage_categories'
order by c.ordinal_position;

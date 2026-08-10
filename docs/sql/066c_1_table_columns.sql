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
-- suspected; a listing shows the columns beside each other and their
-- nullability, which is where a missing NOT NULL would show.
--
-- EXPECTED: six rows.
--
--   id           uuid        NOT NULL   default gen_random_uuid()
--   salon_id     uuid        NOT NULL
--   storage_id   uuid        NOT NULL
--   category_id  uuid        NOT NULL
--   created_at   timestamptz NOT NULL   default now()
--   seeded       boolean     NOT NULL   default false
--
-- So: uuid everywhere except created_at (timestamptz) and seeded (boolean),
-- and is_nullable = NO on all six.
--
-- ⚠️ THIS HEADER SAID "five rows" UNTIL REVIEW CAUGHT IT, AND THE IRONY IS THE
-- POINT RATHER THAN A JOKE. `seeded` was added to 066a and the hand-written
-- expectation here was not — in the one file whose entire job is to catch a
-- hand-written list that has gone stale.
--
-- ⚠️ And the dangerous half is not the reader who stops at a sixth row they did
-- not expect. It is the reader who finds all five they were told to look for,
-- ticks the check, and moves on — a pass, on a list that was wrong. That is the
-- exact failure shape this file exists to prevent, so it is written down here
-- rather than quietly corrected.
--
-- The QUERY was never wrong: `order by c.ordinal_position` with no column
-- filter reads whatever is there. Only the prose beside it aged, which is the
-- fifth time this round.
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

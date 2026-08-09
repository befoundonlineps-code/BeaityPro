-- ==========================================================================
-- 056d · QUERY 4 of 7 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven). RUN AFTER 056c.
--
-- ---------------------------------------------------------------------------
-- WHY: the fifth failure path, MEASURED. 056c raises fine_policy_missing on a
-- storage with no policy, on the grounds that the range CHECK on
-- storages.fine_percent lets a NULL through — a CHECK refuses only on FALSE, and
-- a comparison against NULL is UNKNOWN. Whether that branch is live has never
-- been asked.
--
-- ⚠️ EVERY column of storages, not the two that matter. Filtering by the column
-- already in mind is how a TYPE went unseen where a constraint was looked for.
--
-- WHAT TO LOOK AT: is_nullable on fine_percent and on fine_basis. YES on either
-- means 056c's guard is load-bearing rather than defensive.
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
  and c.table_name = 'storages'
order by c.ordinal_position;

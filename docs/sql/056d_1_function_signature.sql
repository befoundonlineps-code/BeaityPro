-- ==========================================================================
-- 056d · QUERY 1 of 7 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven). RUN AFTER 056c.
--
-- ⚠️ ITS OWN FILE, AND THAT IS THE STRUCTURAL RULE RATHER THAN TIDINESS: a
-- verification query that fails rolls back the CREATE OR REPLACE above it and
-- reports its own error, never the undo it caused. 051c was lost exactly that
-- way, and 051d — a separate file — is what noticed.
--
-- ---------------------------------------------------------------------------
-- WHY: one function, not two. Adding a parameter makes an OVERLOAD rather than
-- a replacement, and the call then becomes ambiguous. 056c changed no parameter,
-- so this must still say 1.
--
-- EXPECTED: copies_expect_1 = 1, and the signature identical to before 056c.
-- ==========================================================================

select
  count(*) as copies_expect_1,
  string_agg(pg_get_function_identity_arguments(p.oid), E'\n---\n') as signatures
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'post_stocktake_session';

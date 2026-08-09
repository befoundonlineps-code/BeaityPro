-- ==========================================================================
-- 056d · QUERY 5 of 7 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven). RUN AFTER 056c.
--
-- ---------------------------------------------------------------------------
-- WHY: query 4 says whether the column PERMITS a null policy. This says whether
-- any live row actually CARRIES one — the difference between a branch that is
-- reachable in principle and one that is reachable today.
--
-- ⚠️ PER KIND, NOT A TOTAL. A total of zero and "there are no common storages at
-- all" are the same number, and only one of them means the branch is dead. A
-- grand total would answer the wrong question in a reassuring voice.
--
-- ⚠️ THE EDITOR RUNS AS THE OWNER, so RLS is bypassed and these are the TRUE
-- counts across the whole database. That is what makes them worth reading, and
-- it means they say nothing whatever about isolation between salons.
--
-- EXPECTED: no_percent_expect_0 and no_basis_expect_0 both 0 on every kind. A
-- non-zero is not a defect — it means fine_policy_missing will fire for real,
-- and that its Arabic sentence (query 3) is a sentence somebody will read.
-- ==========================================================================

select
  s.kind,
  count(*)                                            as storages,
  count(*) filter (where s.fine_percent is null)       as no_percent_expect_0,
  count(*) filter (where s.fine_basis   is null)       as no_basis_expect_0
from public.storages s
group by s.kind
order by s.kind;

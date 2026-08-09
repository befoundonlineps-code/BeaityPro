-- ==========================================================================
-- 056d · QUERY 6 of 7 -- VERIFICATION ONLY. Read-only: NOTHING IS WRITTEN.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven). RUN AFTER 056c.
--
-- ⚠️ THE ONE WORTH READING TWICE.
--
-- ---------------------------------------------------------------------------
-- WHY: this is 056c's resolution — the logic that decides WHO PAYS — run against
-- live data without writing a row. It answers "who would this storage actually
-- fine today" before a single fine exists, which is the only way to find out
-- before real money is attached to the answer.
--
-- The subquery is the SAME shape the function uses, including the `or` that
-- handles a named row and a role row in one pass and disposes of a row naming
-- NEITHER without a branch (both comparisons go NULL, and NULL is not true).
--
--   would_charge_count = 1  ->  a fine WOULD be charged, to that one person
--                        0  ->  'no_responsible'    — row written, nobody charged
--                       >1  ->  'many_responsibles' — row written, nobody charged
--
-- WHAT TO LOOK AT: the design says the live common storage has BOTH an
-- owner-column responsible and a storage_responsibles row, so it should show 2 —
-- and 2 means 'many_responsibles': the fine is recorded, the reason is recorded,
-- and nobody is charged. Seeing that number here is what makes the central case
-- of this whole stage reachable rather than hypothetical.
--
-- ⚠️ AND WHAT THIS CANNOT SHOW: the editor runs as the OWNER, so RLS is bypassed
-- and these are the true counts. 056c's resolution runs as the INVOKER and is
-- filtered by employees' and storage_responsibles' own policies. If either
-- policy is narrower than the plain salon predicate, a receptionist would see a
-- SMALLER set than this query shows — two responsibles collapsing to one, and a
-- fine landing on a name that was never the only answerable one. That claim is
-- not tested here and must not be read into this result: 064_4 and 064_5 are
-- where it is measured.
-- ==========================================================================

select
  s.name,
  s.kind,
  s.fine_percent,
  s.fine_basis,
  case
    when s.kind = 'professional' then 1
    else coalesce(array_length((
      select array_agg(distinct e.id)
      from public.employees e
      where e.salon_id = s.salon_id
        and exists (
          select 1 from public.storage_responsibles r
          where r.storage_id = s.id
            and r.salon_id   = s.salon_id
            and (r.employee_id = e.id or r.role = e.role)
        )
    ), 1), 0)
  end as would_charge_count
from public.storages s
order by s.kind, s.name;

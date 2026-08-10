-- ==========================================================================
-- 066c · QUERY 3 of 6 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 066a -> 066b -> 066c_1 … 066c_6. RUN AFTER 066a.
--
-- ---------------------------------------------------------------------------
-- WHY: this table gets three policies and deliberately not a fourth, and both
-- halves of that need reading rather than remembering.
--
--   select · insert · delete   present, all on the plain salon predicate
--   update                     ABSENT ON PURPOSE — a row here is two foreign
--                              keys and nothing else, so there is no field to
--                              change. Moving a folder between storages is a
--                              delete and an insert; an UPDATE rewriting
--                              storage_id in place would do both halves with
--                              nothing recording that it happened.
--
-- ⚠️ DELETE IS THE ONE THAT NEEDS CHECKING, because it is the opposite of every
-- neighbouring table. products, storages, suppliers and product_categories have
-- NO delete policy — archiving is the only path and RLS makes the ban
-- structural. This is a link, not a thing: un-ticking a checkbox IS deleting a
-- row, and there is nothing to archive. Its absence would look like consistency
-- with the neighbours and would break the window.
--
-- ⚠️ AND rls_enabled IS A SEPARATE QUESTION FROM "policies exist". A table can
-- carry a perfect list of policies with row security switched off, in which
-- case they are text and every row is visible to everybody — the most
-- reassuring-looking failure in this area, and why 064_5 exists as its own read.
--
-- EXPECTED: rls_enabled = true, and exactly three policy rows (select, insert,
-- delete), each qual/with_check reading
--   salon_id = (SELECT profiles.salon_id FROM profiles WHERE profiles.id = auth.uid())
-- ==========================================================================

select
  cl.relrowsecurity                             as rls_enabled,
  cl.relforcerowsecurity                        as rls_forced,
  p.policyname,
  p.cmd,
  p.roles,
  p.qual,
  p.with_check
from pg_class cl
join pg_namespace n on n.oid = cl.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname and p.tablename = cl.relname
where n.nspname = 'public'
  and cl.relname = 'storage_categories'
order by p.cmd, p.policyname;

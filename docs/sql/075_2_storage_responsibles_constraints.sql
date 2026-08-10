-- ==========================================================================
-- 075 · QUERY 2 of 2 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- WHY: 074_1 showed storage_responsibles carrying TWO pairs of foreign-key
-- machinery pointing at storages (19504/19505 and 19781/19782), with their
-- matching pairs on storages. Two foreign keys from the same child to the same
-- parent.
--
-- On stock_documents that is legitimate and expected — storage_id and
-- to_storage_id are two different columns meaning two different things. On a
-- link table between a storage and an employee there is no reason for two.
--
-- ⚠️ The likely reading is a PLAIN key left behind when the COMPOSITE one was
-- added — precisely what the 058 / 061a / 063b campaign went through the schema
-- removing. If so it is dead weight rather than a fault: the composite one
-- enforces everything the plain one did and more. But a leftover that nobody
-- named is how a later reader concludes the composite key was never added.
--
-- ⚠️ NO contype FILTER. Asking only for 'f' is still asking the catalogue, and
-- it is the question that missed entry_uom — a TYPE standing where a constraint
-- was assumed. Read them all and look.
--
-- WHAT TO LOOK AT:
--   • two FOREIGN KEY definitions naming storages: one on (storage_id) alone
--     and one on (storage_id, salon_id) would confirm the leftover reading
--   • ⚠️ if instead BOTH are composite, or they reference different columns,
--     the reading is wrong and something else is going on — which is the
--     answer this query exists to make possible rather than assumed
--   • and the storage_kind mirror key from 061a should be visible here too
-- ==========================================================================

select
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid)               as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname = 'storage_responsibles'
order by con.contype, con.conname;

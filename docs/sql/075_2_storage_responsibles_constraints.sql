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
-- ⚠️ A FIRST DRAFT READ THIS AS A PLAIN KEY LEFT BEHIND, AND THE DIAGRAM SAYS
-- OTHERWISE — TWO COMPOSITE KEYS, BOTH DELIBERATE.
--
-- DATABASE_DIAGRAM:488 gives storage_responsibles a `storage_kind` column,
-- constant 'common' on purpose, as HALF OF A SECOND composite foreign key to
-- storages(id, kind) — making "no responsibles on a professional storage" a
-- structural refusal rather than a silence in the interface. So the expected
-- pair is:
--
--   (storage_id, salon_id)     -> storages (id, salon_id)     tenant isolation
--   (storage_id, storage_kind) -> storages (id, kind)          kind enforcement
--
-- Two foreign keys from one child to one parent, each enforcing a different
-- thing. Not a leftover at all — and the leftover reading would have had
-- somebody delete a load-bearing key as tidying.
--
-- ⚠️ AND ITS ABSENCE IS NOT A FAULT EITHER: the same diagram line marks it
-- «⏳ بانتظار تشغيل المالك» — pending the owner's run. So a missing second key
-- is a RUN-STATE fact, and docs/sql/README.md is where that gets recorded, not
-- a defect to chase.
--
-- ⚠️ AND ONE EXPECTATION WAS STRUCTURALLY IMPOSSIBLE AND IS GONE. The header
-- said "the storage_kind mirror key from 061a should be visible here too". A
-- mirror key is `unique (id, kind)` and it lives on the PARENT — on storages —
-- so this query, which reads the child's constraints, could never have shown
-- it. An expectation the output cannot satisfy is 066c_1's "five rows" again:
-- right in intent, and read as a failure.
--
-- ⚠️ NO contype FILTER. Asking only for 'f' is still asking the catalogue, and
-- it is the question that missed entry_uom — a TYPE standing where a constraint
-- was assumed. Read them all and look.
--
-- WHAT TO LOOK AT:
--   • the two FOREIGN KEY definitions above, both composite. That is the
--     designed state.
--   • ⚠️ only the salon one present -> the kind key is still pending; record it
--     in README rather than treating it as missing.
--   • ⚠️ one of them NOT composite -> then the leftover reading was right after
--     all, and the plain key is what should go.
--   • the storage_kind column itself, and the CHECK pinning it to 'common'.
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

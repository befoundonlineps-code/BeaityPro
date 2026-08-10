-- ==========================================================================
-- 073 · QUERY 1 of 2 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- 🔴 WHY: the two recorded fines carry fine_percent = 0.00, and 0 is the 100
-- seen in a mirror.
--
-- This project spent a whole round on useState('100') writing a fine policy
-- nobody decided, and the lesson was: make "not decided yet" representable
-- instead of manufacturing an answer. The column does accept null now — check5
-- emptied both storages itself.
--
-- ⚠️ SO WHERE DID THE ZERO COME FROM? If the owner chose it, it is a policy. If
-- a screen wrote it untouched, it is the same fault in a worse disguise: 100 was
-- CONSPICUOUS — a number that stops you. Zero is never noticed, it means "never
-- fine anyone, ever", and it can sit for years without being asked.
--
-- ✅ HALF OF THIS IS ALREADY MEASURED, FROM THE CODE: the dialog now starts at
-- '' (StorageFormDialog.js:72), storagePayload sends null for blank
-- (storageForm.js:140), and storageForm.test.js pins `fine_percent: null` for
-- an untouched pair. ⚠️ THE CURRENT SCREEN CANNOT WRITE A ZERO IT WAS NOT GIVEN.
--
-- So the open question is historical, and this query is the half the repository
-- cannot answer: what the two storages carry RIGHT NOW. A fine copies the
-- storage's policy at posting time, so reading the storages says whether 0 is
-- live policy or a value that has since been changed underneath those rows.
--
-- WHAT TO LOOK AT:
--   • null on both columns  -> the fines' 0 came from somewhere no longer
--     reachable, and nothing new can inherit it
--   • 0 on both             -> it is live, and the next question is whether
--     anybody typed it
--   • 100 on both           -> the fines' 0 predates check5 and something else
--     wrote it, which is its own finding
-- ==========================================================================

select
  s.name                     as storage_name,
  s.kind,
  s.fine_percent,
  s.fine_basis,
  (s.fine_percent is null)   as policy_not_decided,
  s.owner_employee_id,
  s.created_at
from public.storages s
order by s.kind, s.name;

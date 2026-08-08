-- ==========================================================================
-- 060a -- CHANGE ONLY. No SELECT in this file. Verification is 060b.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ ITS OWN FILE, AND NOT AN EDIT TO 056a, FOR A REASON THAT WOULD HAVE FAILED
-- SILENTLY
--
-- 056a has run. Its `create table if not exists` means that re-running the file
-- after editing it would SKIP THE WHOLE STATEMENT — no new constraint, no
-- error, no sign that anything was ignored. The table would keep the simple key
-- while the file said otherwise, and every later reader would trust the file.
--
-- Raised in review. It is also why 056a is left exactly as it ran: an executed
-- script is the only record of what was executed.
--
-- ---------------------------------------------------------------------------
-- WHY document_id JOINS THE OTHER THREE
--
-- stock_documents belongs to one salon, so a fine row could in principle point
-- at another salon's document while carrying its own salon_id. Only RLS
-- prevents that today — not the database — which is the same argument already
-- applied to employee_id, storage_id and product_id, and this project has chosen
-- the database everywhere else.
--
-- ✅ And safe without conditions, measured by 059 rather than assumed:
--     stock_documents_id_salon_id_key   UNIQUE (id, salon_id)
--     stock_documents.salon_id          NOT NULL
--
-- ⚠️ That second line is the one that mattered. A composite key onto a NULLABLE
-- salon_id does not constrain, it FORBIDS: stock_fines.salon_id is NOT NULL, so
-- `NULL = value` stays UNKNOWN and no row would ever match — a document
-- belonging to no salon could never carry a fine. There is no such document, so
-- the key constrains and forbids nothing.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE FOURTH OF FOUR, AND THE METHOD IS THE LESSON
--
-- Four columns in one file, each found separately, each because somebody
-- happened to notice it. The reviewer named the fault: inspecting the columns
-- that caught the eye is the same shape as filtering a catalogue query by the
-- column you already expect (CLAUDE.md §4b). Reading the whole constraint list
-- at once is what found this one — and it is what should have found all four
-- before any shipped. 060b therefore checks the PROPERTY, not this constraint:
-- every foreign key on both tables must name two columns.
-- ==========================================================================

alter table public.stock_fines
  drop constraint stock_fines_document_id_fkey;

alter table public.stock_fines
  add constraint stock_fines_document_id_fkey
  foreign key (document_id, salon_id)
  references public.stock_documents (id, salon_id) on delete restrict;

comment on column public.stock_fines.document_id is
  'The stocktake this fine came from, and UNIQUE across the table: one stocktake, one fine. ⚠️ The reference is composite on (document_id, salon_id) so a fine cannot name another salon''s document — the same shape every other salon-scoped column on these two tables carries. It was simple until 060a, and it was the fourth of four found one at a time.';

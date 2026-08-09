-- ==========================================================================
-- 063a -- CHANGE ONLY. No SELECT in this file. Verification is 063b.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE REVIEW ASKED WHICH `ON DELETE` TO KEEP. THE ANSWER IS NEITHER — THE
-- OLD ONE WAS WRONG BEFORE THE COMPOSITE KEY MADE IT AWKWARD.
--
-- The question raised was real: `ON DELETE SET NULL` on a composite key nulls
-- EVERY referencing column, not only the nullable one, unless Postgres 15's
-- `ON DELETE SET NULL (document_id)` is used. Since salon_id is NOT NULL the
-- cascade would raise instead of nulling — loud, but a behaviour change nobody
-- chose.
--
-- ⚠️ AND CHASING THE VERSION-SPECIFIC SYNTAX WOULD HAVE PRESERVED A BEHAVIOUR
-- THAT SHOULD NOT BE PRESERVED. Ask what SET NULL on document_id actually
-- means here:
--
--     a stock_document is deleted
--       -> the session's document_id becomes null
--       -> and `document_id IS NULL` is THIS MODULE'S DEFINITION OF "OPEN"
--       -> so a finished stocktake silently becomes a count in progress
--
-- Worse, `stocktake_sessions_one_open_per_storage` is a partial unique index on
-- exactly that condition, so the resurrected session would enter it and could
-- collide with a genuinely open count on the same storage.
--
-- "Posted" was made a FACT rather than a status column precisely so it could
-- not disagree with reality (054a). SET NULL is the one operation that makes it
-- disagree.
--
-- ⚠️ So: RESTRICT, and the Postgres version stops mattering — the column-list
-- syntax is not needed by either branch of the decision. A document a session
-- points at cannot be deleted, which is what the house does everywhere else
-- (stock_documents has no DELETE policy at all; the module reverses).
--
-- The column stays NULLABLE. That is untouched and is the whole state machine:
-- null until posting, set by post_stocktake_session as its last statement.
-- MATCH SIMPLE passes a null, so an open session satisfies the key trivially.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THIS TABLE HOLDS REAL DATA, so adding the constraint validates every
-- existing row. A refusal would mean a session already points at another
-- salon's document — worth stopping for, and it leaves the database unchanged.
-- ==========================================================================

alter table public.stocktake_sessions
  drop constraint stocktake_sessions_document_id_fkey;

alter table public.stocktake_sessions
  add constraint stocktake_sessions_document_id_fkey
  foreign key (document_id, salon_id)
  references public.stock_documents (id, salon_id) on delete restrict;

comment on column public.stocktake_sessions.document_id is
  'Null until posted; set by post_stocktake_session as its last statement. This IS the state machine — "posted" is a fact rather than a status column, so it cannot disagree with the thing it describes. ⚠️ The reference is composite on (document_id, salon_id) and RESTRICT, not SET NULL: nulling it on a document delete would turn a finished stocktake back into a count in progress, and stocktake_sessions_one_open_per_storage is a partial index on exactly that condition — so the resurrected session could collide with a genuinely open one.';

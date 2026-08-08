-- ==========================================================================
-- 061a -- CHANGE ONLY. No SELECT in this file. Verification is 061b.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ THESE TWO ARE MINE, NOT INHERITED DEBT — AND THAT IS THE POINT
--
-- 054a created them, and it created them with simple references:
--
--     054a:111   storage_id ... references public.storages (id)
--     054a:149   product_id ... references public.products (id)
--
-- They were described later as "pre-existing debt, outside the scope of that
-- fix". They are not pre-existing. I wrote them, in a file that applied the
-- composite-key lesson to `(session_id, salon_id)` on the very next constraint
-- and did not apply it to these — which makes them the fifth and sixth
-- instances of one lesson missed inside a file that was explaining it.
--
-- ---------------------------------------------------------------------------
-- WHY NOW RATHER THAN LATER: 056c IS ABOUT TO LEAN ON THEM
--
-- The fine's whole "loud failure is safe" argument rests on one claim — that
-- the session, the document and the products all belong to one salon BY
-- CONSTRUCTION. After 060a the document really does. These two did not: they
-- were a statement about how the application has behaved so far, not a
-- constraint in the database, and that is exactly the kind of assumption this
-- project has refused four times on stock_fines alone.
--
-- Raised in review. Closing it before 056c reads through these columns is
-- cheaper than documenting the lean and hoping the note is read.
--
-- ---------------------------------------------------------------------------
-- SAFE WITHOUT CONDITIONS, AND BOTH HALVES WERE ALREADY MEASURED
--
--   targets   storages and products each carry unique (id, salon_id), proven
--             by 058 — seven existing composite references could not have been
--             created otherwise.
--   sources   stocktake_sessions.salon_id and stocktake_counts.salon_id are
--             both NOT NULL — declared in 054a and confirmed by 054b's column
--             reading. So no row can slip through on a NULL, which is the
--             MATCH SIMPLE behaviour that would silently defeat the key.
--
-- ⚠️ AND THESE TABLES HOLD REAL DATA, unlike stock_fines when 060a ran. Adding
-- the constraint VALIDATES every existing row. If one fails, the ALTER refuses
-- and names the row — which is not a problem with this script: it would mean a
-- count already exists pointing at another salon's storage or product, and
-- that is worth stopping for. Nothing is dropped and nothing is rewritten; a
-- refusal here leaves the database exactly as it was.
-- ==========================================================================

alter table public.stocktake_sessions
  drop constraint stocktake_sessions_storage_id_fkey;

alter table public.stocktake_sessions
  add constraint stocktake_sessions_storage_id_fkey
  foreign key (storage_id, salon_id)
  references public.storages (id, salon_id) on delete restrict;

alter table public.stocktake_counts
  drop constraint stocktake_counts_product_id_fkey;

alter table public.stocktake_counts
  add constraint stocktake_counts_product_id_fkey
  foreign key (product_id, salon_id)
  references public.products (id, salon_id) on delete restrict;

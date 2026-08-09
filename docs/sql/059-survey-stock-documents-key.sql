-- ==========================================================================
-- 059 -- SURVEY ONLY. Read-only: no DDL.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- ⚠️ ONE QUERY PER PASTE. Two selects pasted together returned only the second
-- this week, and the first vanished without an error or a gap.
--
-- ---------------------------------------------------------------------------
-- THE FOURTH INSTANCE, AND THE ONE THAT SAYS SOMETHING ABOUT HOW IT WAS FOUND
--
-- 056a ran, and reading its constraints IN FULL — rather than checking the two
-- columns somebody had already noticed — turned up:
--
--     stock_fines_document_id_fkey
--       FOREIGN KEY (document_id) REFERENCES stock_documents(id) ON DELETE RESTRICT
--
-- Simple, not composite. stock_documents belongs to one salon, so a fine row
-- can in principle point at another salon's document while carrying its own
-- salon_id — and today the only thing preventing that is RLS, not the database.
-- That is the exact argument already applied to employee_id, storage_id and
-- product_id.
--
-- ⚠️ FOUR COLUMNS IN ONE FILE, EACH FOUND SEPARATELY, EACH BY SOMEBODY LOOKING
-- AT WHAT THEY HAPPENED TO NOTICE. The reviewer named the method fault himself:
-- checking storage_id and product_id because they had caught his eye is the
-- same shape as filtering a catalogue query by the column you expect. Reading
-- the whole constraint list at once is what found the fourth — and it is what
-- should have found all four at once, before any of them shipped.
--
-- ---------------------------------------------------------------------------
-- AND NO ALTER IS PROPOSED HERE, for the reason query 2 exists.
--
-- A composite key onto a NULLABLE salon_id does not constrain, it FORBIDS:
-- stock_fines.salon_id is NOT NULL, so `NULL = value` stays UNKNOWN and no row
-- would ever match. On storages and products that turned out fine. Whether it
-- does here has not been read, and the fix is only safe if it is.
-- ==========================================================================

-- 1 -- can stock_documents be referenced compositely at all? Every unique and
-- primary-key constraint on it, in full text, with nothing filtered out.
select
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname = 'stock_documents'
  and con.contype in ('p', 'u')
order by con.contype, con.conname;

-- 2 -- and is salon_id mandatory on it? The question that decides whether the
-- key would constrain or forbid.
select
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'stock_documents'
  and c.column_name = 'salon_id';

-- ==========================================================================
-- 066c · QUERY 2 of 6 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 066a -> 066b -> 066c_1 … 066c_6. RUN AFTER 066a.
--
-- ---------------------------------------------------------------------------
-- WHY: the constraints are the whole design of this table. Both references are
-- composite on purpose, and a plain reference to (id) would look identical in a
-- column listing while letting a row point at a storage in one salon and a
-- folder in another.
--
-- ⚠️ NO contype FILTER. Asking `where contype = 'f'` is still asking the
-- catalogue, and it is the exact question that missed entry_uom — a TYPE
-- standing where a constraint was assumed. Read them all and look.
--
-- ⚠️ AND POSTGRES NAMES SOME OF THEM. 052c measured this the hard way: a table
-- had five constraints where four were expected, because an inline `references`
-- got its name from Postgres rather than from the script. A count written from
-- the file would be wrong; the listing cannot be.
--
-- WHAT TO LOOK AT — five named here plus whatever Postgres added:
--   storage_categories_pkey                  (p)
--   storage_categories_one_per_pair          (u) on (storage_id, category_id)
--   storage_categories_id_salon_key          (u) on (id, salon_id)
--   storage_categories_storage_fkey          (f) FOREIGN KEY (storage_id, salon_id)
--                                                REFERENCES storages(id, salon_id)
--   storage_categories_category_fkey         (f) FOREIGN KEY (category_id, salon_id)
--                                                REFERENCES product_categories(id, salon_id)
--   + the salon_id reference to salons, named by Postgres
--
-- ⚠️ Read the definitions, not the names. Two columns inside the FOREIGN KEY
-- parentheses is the thing being verified; a name ending in _fkey proves
-- nothing about how many columns it covers.
--
-- ⚠️ AND EXPECT MORE ROWS THAN THE LIST ABOVE, ON POSTGRESQL 17. NOT NULL is
-- recorded in pg_constraint there with contype = 'n', so the six NOT NULL
-- columns can each appear as their own Postgres-named row. That is covered by
-- "plus whatever Postgres added" and is not a fault — it is said here so it
-- arrives as something expected rather than as a surprise mid-verification,
-- which is when a correct result is most likely to be read as a problem.
-- ==========================================================================

select
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname = 'storage_categories'
order by con.contype, con.conname;

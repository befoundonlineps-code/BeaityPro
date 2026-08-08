-- ==========================================================================
-- 053c -- SURVEY ONLY. Read-only: no DDL, nothing created, nothing changed.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- Two findings came out of 053b, and BOTH of them say my instrument was wrong
-- rather than my reading of the output. This file replaces the instruments.
--
-- ---------------------------------------------------------------------------
-- ⚠️ FINDING 1 -- entered_uom IS GUARDED IN THE DATABASE. MY QUERY COULD NOT
-- SEE THE GUARD.
--
-- 053b query 7 asked pg_constraint for contype = 'c' and found nothing on
-- entered_uom, and I let that be read as "no database guard at all, the
-- application is the only check". That conclusion is wrong, and the evidence
-- was already in this repository before the query ran:
--
--   049a:126  (v_line->>'entered_uom')::entry_uom
--   049b:116  (v_line->>'entered_uom')::entry_uom
--   049c:115  (v_line->>'entered_uom')::entry_uom
--   047:184 · 051b:177 · 043:297,451,576   -- the same cast, six functions
--
-- Every insert casts to `entry_uom`. The column is a TYPE, and a type is a
-- guard a CHECK query cannot see -- so a false negative was guaranteed by the
-- question, not by the database.
--
-- ⚠️ THIS IS THE THIRD TIME IN THIS ROUND, and the same shape each time: the
-- probe was sound and the CANDIDATES were incomplete. first_name/last_name
-- searched as name/full_name/contact_name; reverses_document_id searched as
-- reversed_document_id; and now a type searched as a constraint. The repository
-- already records the first two as one lesson. This is the third instance.
--
-- ⚠️ AND IT MAKES 053a's uom COLUMN A DIVERGENCE, exactly the class the salon_id
-- finding was. I wrote `entered_uom text` plus a CHECK listing three literals,
-- while the house writes an enum. Same failure mode as writing the isolation by
-- hand instead of copying it: a second statement of one fact, correct the day
-- it is written, free to drift afterwards. If a fourth label is ever added to
-- entry_uom, the supply table accepts it and the order table refuses it, and
-- nothing connects the two.
--
-- So query 1 reads the type's real labels -- because an ALTER onto a type whose
-- members I have not read is the same mistake one layer up.
--
-- ---------------------------------------------------------------------------
-- ⚠️ FINDING 2 -- THE TWO NULL ROWS ARE NEITHER OF THE TWO OPTIONS OFFERED.
--
-- The question was: are they old rows from before UOM.includes existed, or a
-- live write path that still bypasses validation? The code says a third thing
-- -- a path that deliberately writes NULL:
--
--   lib/stockDocument.js:235  "⚠️ NO entered_quantity AND NO entered_uom"
--
-- A stocktake is the one document where nobody typed a movement. They typed a
-- COUNT, and the movement is `counted - balance`, computed inside
-- post_stocktake under its own lock. Sending the count would store
-- entered_quantity 10 beside quantity_base -5 -- two columns that are not two
-- views of one number, and every movement display would print both.
--
-- So NULL is the designed answer, and stock_movements.entered_uom being
-- NULLABLE is correct rather than lax. Of the three possible values (the count,
-- the difference, neither) only neither makes no untrue claim.
--
-- ⚠️ AND THAT IS ALSO WHY product_order_lines.entered_uom IS NOT NULL AND THE
-- OTHER IS: an order line is always typed by a person in a unit they chose.
-- There is no stocktake-shaped row in that table. The two tables differ here on
-- purpose, and the difference is the one place 053a should NOT copy the house.
--
-- ⚠️ BUT THE CODE IS NOT THE OBSERVER. It says what is written today; the two
-- rows were written at some point in the past, possibly before that decision
-- was built into this function -- its own comment records that the fixture was
-- changed rounds earlier and the function was not. Query 2 asks the rows
-- themselves which document they belong to, which is the only answer that
-- cannot be out of date.
--
-- ---------------------------------------------------------------------------
-- FINDING 3 -- anon HOLDS EVERY PRIVILEGE ON EVERY TABLE, AND THAT IS THE
-- PLATFORM'S MODEL, NOT A LOCAL MISTAKE.
--
-- Supabase grants all privileges on the public schema to anon, authenticated
-- and service_role by default, and expects RLS to be the gate. So RLS is not
-- the first line of defence here. It is the ONLY one.
--
-- The consequence is worth stating in its strongest form, because the weaker
-- form is what gets remembered: a new table created with RLS forgotten is not
-- "visible to other salons". It is readable AND WRITABLE AND DELETABLE by any
-- anonymous request on the internet, with no login at all.
--
-- ⚠️ And the two ways of getting it wrong are not symmetric, which is why no
-- amount of care replaces a query:
--
--   RLS on, no policies  ->  refuses everything. Loud, immediate, found at once.
--   RLS forgotten        ->  opens everything to anon. No screen changes, no
--                            error is raised, and nothing distinguishes it from
--                            a protected table.
--
-- Query 3 is the standing audit for it: every table in public, whether RLS is
-- on, how many policies it has, and whether anon holds privileges on it. ⚠️ IT
-- IS MEANT TO BE RE-RUN AFTER EVERY NEW TABLE, not once. Recorded as ADR-054.
-- ==========================================================================

-- 1a -- the type itself. If typtype is 'e' it is an enum and the labels below
-- are the whole permitted set; 'd' would mean a domain, whose constraint is
-- reported by its own definition instead.
select
  t.typname,
  t.typtype,
  e.enumlabel,
  e.enumsortorder
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
left join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
  and t.typname = 'entry_uom'
order by e.enumsortorder;

-- 1b -- the two columns side by side, in both tables. ⚠️ This also closes the
-- oldest unmeasured fact in this area: stock_movements.entered_quantity's type,
-- which 050b, 051a and 053a all had to write around without knowing. udt_name
-- is the column that names an enum; data_type just says USER-DEFINED.
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.numeric_precision,
  c.numeric_scale,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('stock_movements', 'product_order_lines')
  and c.column_name in ('entered_uom', 'entered_quantity', 'entered_unit_price')
order by c.column_name, c.table_name;

-- 2 -- which documents the NULL-uom movements belong to. Expected: stocktake
-- only (and possibly `reversal`, since reverse_stock_document copies the column
-- unchanged from the row it reverses).
--
-- ⚠️ A supply, write-off, return or transfer appearing here would mean
-- something else entirely -- a row that reached the database without the unit
-- the person typed -- and that WOULD be the independent item the review
-- suspected. It is a different question from how many rows are null, which is
-- why doc_type is the column being grouped on.
select
  d.doc_type,
  count(*) as movements_with_null_uom
from public.stock_movements m
join public.stock_documents d on d.id = m.document_id
where m.entered_uom is null
group by d.doc_type
order by d.doc_type;

-- 3 -- ⚠️ THE STANDING AUDIT. Every base table in public, most exposed first.
--
-- A table with rls_enabled = false AND anon_privileges > 0 is open to the
-- internet. A table with rls_enabled = true and policies = 0 refuses everyone,
-- which is safe and probably unintended. Both are worth seeing; only the first
-- is urgent.
--
-- Counted with scalar subqueries rather than joins so that one table with many
-- policies cannot multiply another's row out of the result -- the arithmetic
-- error that makes an audit report the wrong number confidently.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policies,
  (select count(*) from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = c.relname
      and g.grantee = 'anon') as anon_privileges,
  case
    when not c.relrowsecurity
     and (select count(*) from information_schema.role_table_grants g
           where g.table_schema = 'public' and g.table_name = c.relname
             and g.grantee = 'anon') > 0
      then 'OPEN TO ANONYMOUS REQUESTS'
    when not c.relrowsecurity then 'no RLS, but anon holds nothing'
    when (select count(*) from pg_policies p
           where p.schemaname = 'public' and p.tablename = c.relname) = 0
      then 'RLS on with no policy: refuses everyone'
    else 'protected'
  end as verdict
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

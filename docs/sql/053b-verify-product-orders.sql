-- ==========================================================================
-- 053b -- VERIFICATION ONLY, in its own paste. Run AFTER 053a.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No DDL: nothing in this file can undo anything in 053a however wrong it is.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHAT THIS FILE CANNOT DO, SAID FIRST SO NO RESULT IS OVER-READ
--
-- It proves the policies EXIST and that their text MATCHES the ones already
-- protecting stock_documents. It cannot prove they WORK, and no script run in
-- the SQL editor can: that session runs as an owner/superuser role, which
-- bypasses row security entirely. Every row would be returned with the policies
-- in place, with them dropped, and with RLS switched off -- three states, one
-- output.
--
-- Nor is an empty table any help. "RLS blocked you" and "there is nothing here"
-- are the same zero, so a read probe on a table with no rows measures nothing.
--
-- ⚠️ So the behaviour is unproven until the app writes a real order through a
-- real session. That is the only observer with a role the policies apply to,
-- and the check belongs at that moment -- not to this file, which would only be
-- able to lie about it.
--
-- ---------------------------------------------------------------------------
-- EXPECTED, so the results are compared and not judged
--
-- 1  columns   product_orders 6, product_order_lines 9. salon_id NOT NULL on
--              BOTH. entered_unit_price numeric(14,4) and nullable.
-- 2  rls       both tables true.
-- 3  predicate distinct_predicates_expect_1 = 1 -- the survey's reading, that
--              all three existing tables share ONE predicate, re-measured here
--              rather than trusted, because query 4 compares against it.
-- 4  policies  8 rows. using_matches true on SELECT/UPDATE/DELETE, false on
--              INSERT (a DELETE policy has no WITH CHECK and an INSERT policy
--              has no USING -- that is Postgres, not an omission):
--
--                  cmd      using_matches   with_check_matches
--                  SELECT       true             false
--                  INSERT       false            true
--                  UPDATE       true             true
--                  DELETE       true             false
--
-- 5  constraints  the composite foreign key must read
--                 FOREIGN KEY (order_id, salon_id)
--                 REFERENCES product_orders(id, salon_id) ON DELETE CASCADE
--                 ⚠️ If it reads FOREIGN KEY (order_id) alone, the line can be
--                 attached to another salon's order and everything else here
--                 still passes.
-- 6  grants     the two new tables beside the three existing ones, because
--               what the house grants has never been measured either.
-- 7,8 uom       ⚠️ NOT A CHECK ON 053a -- A MEASUREMENT IT WAS WRITTEN WITHOUT.
--               053a's uom constraint lists package/portion/unit, measured from
--               lib/stockDocument.js:31, which is every value the application
--               can write. What stock_movements itself accepts, and what it
--               actually holds, has never been asked. These two ask.
--
--               A fourth value in query 8 means the order table would refuse a
--               uom the supply table already stores -- one ALTER, and better
--               known now than at the first pre-fill.
-- ==========================================================================

-- 1 -- the columns, with the two facts a function body can never reveal.
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.numeric_precision,
  c.numeric_scale,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('product_orders', 'product_order_lines')
order by c.table_name, c.ordinal_position;

-- 2 -- RLS engaged. relrowsecurity is the switch; without it the eight policies
-- below exist and are never consulted.
select
  c.relname,
  c.relrowsecurity     as rls_enabled_expect_true,
  c.relforcerowsecurity as forced_for_owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('product_orders', 'product_order_lines')
order by c.relname;

-- 3 -- ⚠️ Re-measure the premise before using it. Query 4 compares the new
-- policies against stock_documents' predicate; if the three existing tables do
-- not in fact share exactly one, that comparison is against an arbitrary pick
-- and its trues mean less than they read.
select count(distinct p.qual) as distinct_predicates_expect_1
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in ('stock_documents', 'stock_movements', 'products')
  and p.qual is not null;

-- 4 -- the eight policies, each compared TEXT AGAINST TEXT with the one already
-- in production. `is not distinct from` rather than `=`, because a clause that
-- does not exist is null and null = null is not true -- which would report every
-- INSERT policy as a mismatch and every DELETE policy as unknown.
with reference as (
  select p.qual
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'stock_documents'
    and p.cmd = 'SELECT'
  limit 1
)
select
  p.tablename,
  p.cmd,
  p.policyname,
  p.roles,
  (p.qual       is not distinct from (select qual from reference)) as using_matches_stock_documents,
  (p.with_check is not distinct from (select qual from reference)) as with_check_matches_stock_documents,
  p.qual        as using_clause,
  p.with_check  as with_check_clause
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in ('product_orders', 'product_order_lines')
order by p.tablename, p.cmd, p.policyname;

-- 5 -- the constraints, in full text. The composite foreign key is the one line
-- here that is not a copy of an existing pattern, so it is the one worth
-- reading rather than counting.
select
  cl.relname as table_name,
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname in ('product_orders', 'product_order_lines')
order by cl.relname, con.contype, con.conname;

-- 6 -- the grant, which RLS says nothing about. Without it every read fails
-- with "permission denied for table" no matter how correct the policies are.
--
-- ⚠️ The three existing tables are in the list on purpose. The policies were
-- copied from a measurement; the grant was not, because pg_policies does not
-- carry it. Reading both here is what turns "probably the same" into a row you
-- can look at -- and it costs one extra line in a query that had to run.
select
  g.table_name,
  g.grantee,
  g.privilege_type
from information_schema.role_table_grants g
where g.table_schema = 'public'
  and g.table_name in ('product_orders', 'product_order_lines',
                       'stock_documents', 'stock_movements', 'products')
  and g.grantee in ('authenticated', 'anon', 'public')
order by g.table_name, g.grantee, g.privilege_type;

-- 7 -- ⚠️ THE QUESTION 053a WAS WRITTEN WITHOUT AN ANSWER TO. Its uom
-- constraint lists package/portion/unit because that is what the application
-- writes (lib/stockDocument.js:31, exported so the document screens and the
-- stocktake sheet cannot answer differently). What stock_movements ACCEPTS is a
-- separate fact, and one no function body could ever have revealed -- the same
-- blind spot that hid entered_quantity's type.
select
  con.conname,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname = 'stock_movements'
  and con.contype = 'c'
order by con.conname;

-- 8 -- and what it actually HOLDS, which is the stronger of the two: a
-- constraint says what was allowed, the data says what was written. A value
-- here outside the three means 053a's constraint would refuse a row the supply
-- table already contains, and the pre-fill would fail on real history.
select
  m.entered_uom,
  count(*) as rows_stored
from public.stock_movements m
group by m.entered_uom
order by m.entered_uom;

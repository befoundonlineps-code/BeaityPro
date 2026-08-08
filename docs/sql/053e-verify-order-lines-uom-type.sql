-- ==========================================================================
-- 053e -- VERIFICATION ONLY, in its own paste. Run AFTER 053d.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No DDL: nothing in this file can undo anything in 053d however wrong it is.
--
-- ---------------------------------------------------------------------------
-- EXPECTED
--
-- 1  the two columns compared to each other rather than to a literal:
--       movements_type = order_lines_type = 'entry_uom'
--       types_match_expect_true  = true
--       order_lines_not_null_expect_true = true
--       movements_nullable_expect_true   = true   ⚠️ still nullable, on purpose
--
--    ⚠️ COMPARED, NOT ASSERTED AGAINST 'entry_uom' TYPED HERE. A literal in a
--    verification is a fourth copy of the fact the change exists to stop
--    copying — and it would still read `true` on the day somebody renamed the
--    type on one table only.
--
-- 2  product_order_lines constraints: product_order_lines_uom_check is GONE.
--    The other four stay — the primary key, the composite foreign key, the
--    positive-quantity check and the non-negative-price check.
--
-- 3  ⚠️ ALL EIGHT POLICIES STILL PRESENT. `alter column type` rewrites the
--    table, and the whole point of this round was what protects it. A policy
--    that quietly did not survive would leave a table that works perfectly and
--    is readable by every salon — the exact silence 053 was written to avoid.
--    Cheap to ask, and the one question whose wrong answer is invisible.
-- ==========================================================================

-- 1 -- the two columns, each measured, then compared to each other.
select
  (select c.udt_name from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'stock_movements'
      and c.column_name = 'entered_uom')                       as movements_type,
  (select c.udt_name from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'product_order_lines'
      and c.column_name = 'entered_uom')                       as order_lines_type,
  ((select c.udt_name from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = 'stock_movements'
       and c.column_name = 'entered_uom')
   = (select c.udt_name from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = 'product_order_lines'
         and c.column_name = 'entered_uom'))                   as types_match_expect_true,
  ((select c.is_nullable from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = 'product_order_lines'
       and c.column_name = 'entered_uom') = 'NO')              as order_lines_not_null_expect_true,
  ((select c.is_nullable from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = 'stock_movements'
       and c.column_name = 'entered_uom') = 'YES')             as movements_nullable_expect_true;

-- 2 -- the constraints that remain. product_order_lines_uom_check must not be
-- among them; everything else must still be.
select
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname = 'product_order_lines'
order by con.contype, con.conname;

-- 3 -- the isolation, re-read after a table rewrite. Eight rows, unchanged.
select
  p.tablename,
  p.cmd,
  p.policyname,
  p.roles,
  p.qual       as using_clause,
  p.with_check as with_check_clause
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in ('product_orders', 'product_order_lines')
order by p.tablename, p.cmd, p.policyname;

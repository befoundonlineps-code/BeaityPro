-- ==========================================================================
-- 054b -- VERIFICATION ONLY, in its own paste. Run AFTER 054a.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No DDL: nothing in this file can undo anything in 054a however wrong it is.
--
-- ⚠️ SAME LIMIT AS 053b, repeated because it is the one most likely to be
-- forgotten: this proves the policies EXIST and MATCH. It cannot prove they
-- WORK — the SQL editor runs as a role that bypasses row security, so every row
-- comes back with the policies in place, with them dropped, and with RLS off.
-- Behaviour is unproven until the app writes a count through a real session.
--
-- ---------------------------------------------------------------------------
-- EXPECTED
--
-- 1  columns     stocktake_sessions 6, stocktake_counts 9.
--                salon_id NOT NULL on BOTH. counted_entered_uom is
--                USER-DEFINED / entry_uom, matching stock_movements.
--                balance_at_post NULLABLE — it is written at posting, not
--                before, and a NOT NULL there would make every count
--                unwritable.
-- 2  rls         both true.
-- 3  policies    8 rows, roles {public} on all of them, and each clause
--                matching stock_documents' predicate text:
--
--                    cmd      using_matches   with_check_matches
--                    SELECT       true             false
--                    INSERT       false            true
--                    UPDATE       true             true
--                    DELETE       true             false
--
--                ⚠️ EXCEPT THE TWO DELETE POLICIES, which must NOT match —
--                they carry an extra conjunct and matching would mean the
--                narrowing was lost:
--
--                  stocktake_sessions_delete  ->  using_matches FALSE, and its
--                    text must contain `document_id IS NULL`
--                  stocktake_counts_delete    ->  using_matches FALSE, and its
--                    text must contain an EXISTS on stocktake_sessions
--
--                A `true` on either of those is the failure this expectation
--                exists for: the policy would read correct, delete would work,
--                and a posted stocktake's coverage could be erased.
--
--                UPDATE on the sessions is how post_stocktake closes one — the
--                function runs as the invoker (051b:28, prosecdef = false,
--                measured), so it meets these policies like any other write.
--                Missing it, posting fails with 0 rows affected, not an error.
-- 4  indexes     stocktake_sessions_one_open_per_storage must be UNIQUE and
--                PARTIAL, its definition ending `WHERE (document_id IS NULL)`.
--                ⚠️ Without the WHERE it becomes one count per storage EVER,
--                and the second stocktake of any storage is refused forever.
--                stocktake_counts_one_per_product must be unique on
--                (session_id, product_id) — it is the upsert target.
-- 5  constraints the composite foreign key must read
--                FOREIGN KEY (session_id, salon_id)
--                REFERENCES stocktake_sessions(id, salon_id) ON DELETE CASCADE
-- ==========================================================================

-- 1 -- the columns, with the two facts no function body can reveal.
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('stocktake_sessions', 'stocktake_counts')
order by c.table_name, c.ordinal_position;

-- 2 -- RLS engaged. Without relrowsecurity the eight policies exist and are
-- never consulted.
select
  c.relname,
  c.relrowsecurity as rls_enabled_expect_true
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('stocktake_sessions', 'stocktake_counts')
order by c.relname;

-- 3 -- the eight policies, compared TEXT AGAINST TEXT with the one already in
-- production rather than read by eye. `is not distinct from` because a clause
-- that does not exist is null, and null = null is not true.
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
  -- ⚠️ The two DELETE policies are SUPPOSED to differ, so "does it match?" is
  -- the wrong question for them and would read as a failure. This is the right
  -- one, and it must be true on exactly those two rows and false on the six.
  (p.cmd = 'DELETE' and p.qual like '%document_id IS NULL%') as delete_is_narrowed_to_open,
  p.qual as using_clause
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in ('stocktake_sessions', 'stocktake_counts')
order by p.tablename, p.cmd, p.policyname;

-- 4 -- ⚠️ THE INDEX DEFINITIONS IN FULL, because the partial clause is the
-- whole design and it is invisible in any summary. An index reported as
-- "unique on (salon_id, storage_id)" is CORRECT-LOOKING and catastrophic: it
-- would permit one stocktake per storage for the lifetime of the salon.
select
  i.indexname,
  i.indexdef
from pg_indexes i
where i.schemaname = 'public'
  and i.tablename in ('stocktake_sessions', 'stocktake_counts')
order by i.tablename, i.indexname;

-- 5 -- the constraints in full text. The composite foreign key is the one line
-- here that is not a copy of an existing pattern.
select
  cl.relname as table_name,
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname in ('stocktake_sessions', 'stocktake_counts')
order by cl.relname, con.contype, con.conname;

-- 6 -- the grants, beside the tables that already have them. RLS filters rows;
-- GRANT decides whether the role may touch the table at all, and pg_policies
-- says nothing about it.
select
  g.table_name,
  g.grantee,
  g.privilege_type
from information_schema.role_table_grants g
where g.table_schema = 'public'
  and g.table_name in ('stocktake_sessions', 'stocktake_counts', 'stock_documents')
  and g.grantee in ('authenticated', 'anon', 'public')
order by g.table_name, g.grantee, g.privilege_type;

-- 7 -- ⚠️ THE STANDING AUDIT FROM 053c, RE-RUN. Two tables were just created,
-- and ADR-054 says a table with RLS forgotten is not "visible to other salons"
-- — it is readable and writable by any anonymous request, because anon holds
-- every privilege on every table in this schema by the platform's default.
-- Every row must read `protected`.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policies,
  case
    when not c.relrowsecurity then 'OPEN TO ANONYMOUS REQUESTS'
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

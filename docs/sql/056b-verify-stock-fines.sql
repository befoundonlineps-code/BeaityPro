-- ==========================================================================
-- 056b -- VERIFICATION ONLY, in its own paste. Run AFTER 056a.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No DDL: nothing here can undo anything in 056a however wrong it is.
--
-- ⚠️ Same limit as every verification in this series: it proves the policies
-- EXIST and MATCH. The SQL editor runs as a role that bypasses row security, so
-- behaviour is unproven until the app reads a fine through a real session.
--
-- ---------------------------------------------------------------------------
-- EXPECTED
--
-- 1  types      fine_attribution: one label, `posting`.
--               fine_resolution: five, in the order written.
--               ⚠️ fine_basis MUST STILL BE TWO — purchase_price, sales_price.
--               A third label here means 056a redefined a type it was supposed
--               to reuse, which is the fault 053a shipped in the other
--               direction and 053d had to undo.
--
-- 2  columns    ⚠️ NO COUNT, for the same reason expectation 3 has none — and
--               this one was WRONG from the first draft and nobody noticed:
--               it said 10 and the table has 11. storage_id was there all
--               along; the count was simply never checked against the rows.
--               A hand-written number is the same failure as a hand-written
--               list (CLAUDE.md §4b), and writing it in an EXPECTATION makes it
--               worse — it invites the reader to compare against the wrong
--               figure and call a correct table broken.
--
--               What matters is the nullability, so that is what is written:
--               NULLABLE — employee_id, role_at_resolution
--               NOT NULL — everything else on both tables.
--               fine_basis is USER-DEFINED / fine_basis — the SAME udt_name
--               storages.fine_basis has, compared to it directly rather than to
--               a literal typed here.
--               employee_id and role_at_resolution NULLABLE; everything else on
--               the head NOT NULL except them.
--
-- 3  constraints  ⚠️ NO COUNT IS GIVEN HERE, ON PURPOSE. 054e's expectation
--               said "the other four" and the table had five, because the list
--               was enumerated from the constraints I had NAMED while an inline
--               `references` is named by Postgres. A count typed by hand goes
--               stale the moment a column changes; what is written below is
--               what must be PRESENT, and the query reads the rest.
--
--               ⚠️ FOUR COMPOSITE KEYS, and every one of them was added after
--               review caught it missing — the same lesson four columns running:
--                 stock_fines_employee_fkey  (employee_id, salon_id)
--                 stock_fines_storage_fkey   (storage_id, salon_id)
--                 stock_fine_lines_fine_fkey (fine_id, salon_id) ON DELETE CASCADE
--                 stock_fine_lines_product_fkey (product_id, salon_id)
--
--               And the XOR that makes "charged" and "not charged"
--               structurally unmixable:
--                 stock_fines_employee_matches_resolution_check
--
-- 4  policies   FOUR rows, not eight. select + insert on each table and NOTHING
--               ELSE. ⚠️ An UPDATE or DELETE row appearing here is the failure
--               this expectation exists for: RLS refusing a command it has no
--               policy for is what makes "a fine is never edited and never
--               deleted" structural instead of a habit.
--               roles {public}.
--
--               ⚠️ AND stock_fines_select MUST *NOT* MATCH stock_documents —
--               matching would mean the narrowing was lost. It is the one
--               policy in this schema written for a different question: these
--               rows are about a named person's money, not about stock. Its
--               text must contain `profile_id` and `e.role`.
--
--               The other three DO match. A false on any of them is a fault.
--
--               ⚠️ And `narrowed_to_person_or_management` reads NULL rather
--               than false on the two INSERT rows, which is correct and is not
--               a third state: an INSERT policy has no USING at all, so the
--               LIKE is applied to NULL and yields NULL. Read "not true" —
--               true belongs on stock_fines_select and nowhere else.
--
--               ⚠️ AND EVERY ROW WILL SHOW ONE `true` AND ONE `false`, BY
--               DESIGN — read it before it worries anybody. A SELECT policy has
--               no WITH CHECK and an INSERT policy has no USING; that is
--               Postgres, not a missing clause. So:
--
--                   cmd      using_matches   with_check_matches
--                   SELECT       true             false
--                   INSERT       false            true
--
--               A `false` in the column that does not apply is the expected
--               reading. What would be a fault is a `false` in the one that
--               does.
--
-- 5  exposure   ADR-054's standing audit, re-run because two tables were just
--               created. Every row must read `protected`.
-- ==========================================================================

-- 1 -- the three types side by side, so a redefined fine_basis is visible next
-- to the two that are new.
select
  t.typname,
  e.enumlabel,
  e.enumsortorder
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
  and t.typname in ('fine_attribution', 'fine_resolution', 'fine_basis')
order by t.typname, e.enumsortorder;

-- 2 -- the columns, and the type compared TO THE COLUMN IT WAS COPIED FROM
-- rather than to the name 'fine_basis' typed here. A literal would still read
-- true on the day somebody renamed the type on one table only.
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  (c.udt_name = (select c2.udt_name from information_schema.columns c2
                  where c2.table_schema = 'public' and c2.table_name = 'storages'
                    and c2.column_name = 'fine_basis'))
    as basis_type_matches_storages
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('stock_fines', 'stock_fine_lines')
order by c.table_name, c.ordinal_position;

-- 3 -- every constraint, in full text, with no contype filter.
--
-- ⚠️ CLAUDE.md §4b: the narrow question is what hid entry_uom. Read the whole
-- category and look, rather than asking for the ones already expected.
select
  cl.relname as table_name,
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname in ('stock_fines', 'stock_fine_lines')
order by cl.relname, con.contype, con.conname;

-- 4 -- the policies. FOUR, and the absences are the point.
with reference as (
  select p.qual
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'stock_documents' and p.cmd = 'SELECT'
  limit 1
)
select
  p.tablename,
  p.cmd,
  p.policyname,
  p.roles,
  (p.qual       is not distinct from (select qual from reference)) as using_matches_stock_documents,
  (p.with_check is not distinct from (select qual from reference)) as with_check_matches_stock_documents,
  -- ⚠️ The right question for the one policy that is SUPPOSED to differ.
  -- "Does it match?" would read as a failure on a correct narrowing — the same
  -- trap 054b hit with the delete policies. True on stock_fines_select and
  -- false on the other three.
  (p.qual like '%profile_id%' and p.qual like '%role%') as narrowed_to_person_or_management,
  p.qual as using_clause
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in ('stock_fines', 'stock_fine_lines')
order by p.tablename, p.cmd, p.policyname;

-- 5 -- the standing exposure audit from 053c. Two new tables, and anon holds
-- every privilege on every table in this schema by the platform's default
-- (ADR-054), so a table with RLS forgotten is open to the internet rather than
-- merely visible to other salons.
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

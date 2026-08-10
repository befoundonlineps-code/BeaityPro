-- ==========================================================================
-- 067 · QUERY 2 of 3 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- WHY: the toolbar shows only what a human starts, and greys what needs a
-- storage. Both halves rest on this query.
--
-- REPORTED (unverified here): stock_doc_type has nine values, four of them
-- written by the system — sale, service_consumption, reversal, stocktake — so
-- they get no buttons. And storage_id is NOT NULL on stock_documents and on
-- stocktake_sessions, which is what greys six of the seven operations.
--
-- ⚠️ AND THE SECOND HALF IS WHAT lib/storageScopedOperations.test.js CANNOT
-- REACH. That guard reads docs/sql, so it proves the code matches the scripts.
-- stock_documents has no creation script — it predates this folder — so its
-- storage_id is asserted in DATABASE_DIAGRAM and nowhere measured in the
-- repository. This query is the only place the claim can come from.
--
-- ⚠️ EVERY column of both tables, and every value of the enum — not the ones
-- expected. A filter that asks "is storage_id NOT NULL?" confirms what it
-- already believes; a listing shows the neighbours, including to_storage_id,
-- which is nullable and which a careless pattern would read instead.
-- ==========================================================================

select
  'enum'                       as source,
  t.typname                    as name,
  e.enumlabel                  as value,
  null::text                   as data_type,
  null::text                   as is_nullable
from pg_type t
join pg_enum e on e.enumtypid = t.oid
where t.typname = 'stock_doc_type'

union all

select
  'column',
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('stock_documents', 'stocktake_sessions')

order by source, name, value;

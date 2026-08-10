-- ==========================================================================
-- 067 · QUERY 3 of 3 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- WHY: "طلبيّة" is the one operation that stays lit at "all storages", and the
-- only reason is that product_orders has no storage column.
--
-- ⚠️ AND THAT MATTERS BECAUSE IT CONTRADICTS THE REFERENCE. The screenshot
-- shows "Order products" greyed out at "All storages", which is a correct
-- measurement of what their app does. Copying it would give us a rule that
-- works by accident — and here it would refuse an action our schema permits,
-- which is the opposite of what the greying is for.
--
-- ⚠️ AND IT IS THE ONLY `false` IN TABLE_NEEDS_STORAGE, so it is the single
-- entry whose wrongness would light a button that then fails at the database.
-- The guard checks it against 053a; this checks 053a against the database.
--
-- ⚠️ BOTH TABLES. A storage column on the LINES would scope the order just as
-- effectively as one on the head, and reading only the head would miss it —
-- the same shape as reading only the head of stock_documents and missing
-- to_storage_id. The repository grep that first answered this covered the whole
-- file, which is why it was right; this covers the whole pair.
--
-- WHAT TO LOOK AT: any column whose name contains storage, in either table.
-- Expected: none. If one appears, TABLE_NEEDS_STORAGE.product_orders must flip
-- to true and the button joins the greyed group.
-- ==========================================================================

select
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('product_orders', 'product_order_lines')
order by c.table_name, c.ordinal_position;

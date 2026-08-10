-- ==========================================================================
-- 071 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- 🔴 WHY: a claim was made one level too narrow, and the difference decides
-- whether a reversed stocktake leaves a fine standing.
--
-- What was measured: reverse_stock_document's newest version is 051c,
-- stock_fines was created in 056a — five scripts later — and zero of the
-- thirteen files naming that function mention stock_fines. ⚠️ THAT PROVES THE
-- FUNCTION DOES NOT TOUCH A FINE. It does not prove NOTHING does.
--
-- A trigger on stock_documents firing when a reversal row is inserted would do
-- it without appearing in any file that names the function — and a trigger of
-- exactly that shape was written this round (068a), so it is not a hypothetical
-- mechanism.
--
-- ⚠️ AND THE REPOSITORY CANNOT FINISH THIS. docs/sql was read whole: eighteen
-- files mention stock_fines and not one is a trigger on stock_documents; the
-- only create trigger in the folder is 068a's, on storage_categories. But
-- everything up to stage 5 was created directly in the SQL editor and has no
-- script here, so a trigger from that era would be invisible to the grep and
-- fully alive in the database. Reading the catalogue is the only way to close
-- it — which is the same promotion 066c_2 forced: from "the file I looked at
-- does not" to "the class does not".
--
-- ⚠️ AND IT MATTERS IN BOTH DIRECTIONS. If something is found, the conclusion
-- in PROJECT_HANDOFF §3.13د inverts. If nothing is found, "structurally, not
-- probably" becomes a statement about the class rather than about one function.
-- ==========================================================================

-- 1 -- every trigger on the tables a reversal touches, plus what its function
-- reads. No filter on name or timing: a trigger that fires on INSERT of a
-- reversal document is the case, and asking only for that shape is how a query
-- confirms what it already suspects.
select
  c.relname                                   as on_table,
  t.tgname                                    as trigger_name,
  not t.tgisinternal                          as is_user_trigger,
  pg_get_triggerdef(t.oid)                    as definition,
  p.proname                                   as function_name,
  -- ⚠️ The body, not the name. A trigger called anything at all is what it
  -- does, and "does it mention stock_fines" is the whole question.
  (position('stock_fines' in coalesce(p.prosrc, '')) > 0) as function_touches_fines
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
left join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public'
  -- ⚠️ stock_fine_lines IS IN THE LIST, and its absence from a first draft was
  -- the same narrowing this file exists to undo. The lines carry the AMOUNTS; a
  -- trigger on them does to the money what a trigger on stock_fines does to the
  -- header, and reading only the header would have missed it.
  and c.relname in ('stock_documents', 'stock_movements', 'stocktake_sessions',
                    'stock_fines', 'stock_fine_lines')
order by c.relname, t.tgname;

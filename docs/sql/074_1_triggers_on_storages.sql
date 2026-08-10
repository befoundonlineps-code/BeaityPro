-- ==========================================================================
-- 074 · QUERY 1 of 2 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ---------------------------------------------------------------------------
-- 🔴 WHY: archiving a whole storage does exactly what unlinking a folder does,
-- and only one of the two is guarded.
--
-- 068a refuses removing a folder from a storage that still holds its products,
-- because the removal hides the products and leaves their movements in place.
-- ⚠️ ARCHIVING THE STORAGE ITSELF DOES THE SAME THING ONE LEVEL UP: it drops out
-- of the picker, every product in it disappears from every screen, and the
-- movements stay. And transfer cannot rescue them, because the storage is no
-- longer selectable at all.
--
-- ⚠️ Nothing is known to prevent it. Archiving is an UPDATE on
-- storages.is_active; 068a is a trigger on DELETE in storage_categories. And
-- 071 never asked about storages — its five tables were the stock_* family and
-- the fines. So we do not know whether anything fires there at all.
--
-- ⚠️ AND THAT IS THE POINT OF ASKING RATHER THAN ASSUMING: if a trigger already
-- exists, whatever it does comes first and the design follows it. If none does,
-- the gap is confirmed rather than suspected.
--
-- WHAT TO LOOK AT:
--   • any row with is_user_trigger = true — that is something we did not write
--     down, and it decides the shape of the fix
--   • RI_ConstraintTrigger_* rows are Postgres's own foreign-key machinery and
--     are expected; they say the references exist, nothing more
--   • function_touches_active: whether a trigger's body even mentions the
--     column the archiving happens through
-- ==========================================================================

select
  c.relname                                   as on_table,
  t.tgname                                    as trigger_name,
  not t.tgisinternal                          as is_user_trigger,
  pg_get_triggerdef(t.oid)                    as definition,
  p.proname                                   as function_name,
  (position('is_active' in coalesce(p.prosrc, '')) > 0) as function_touches_active
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
left join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public'
  and c.relname in ('storages', 'storage_categories', 'storage_responsibles')
order by c.relname, t.tgname;

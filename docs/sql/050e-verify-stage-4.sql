-- ==========================================================================
-- Stage 4 -- verification, one query, one row per check.
--
-- READ ONLY. Run after 050a..050d.
--
-- Shaped as a single result on purpose: ten separate SELECTs depend on the
-- editor showing every result set, which is behaviour we have never measured.
-- One row per check depends on nothing.
--
-- EXPECTED, all of them:
--   documents: 6 money columns          6
--   movements: 3 line columns           3
--   checks on stock_documents           3 value guards + 1 range guard = 4
--   checks on stock_movements           1 value guard + 1 range guard = 2
--   post_stock_document copies          1
--   document money reaches the insert   1
--   line money reaches the insert       1
--   reversal copies the three           3
--   security_definer (both functions)   false, false
--   arabic hints still arabic           18 of 18
-- ==========================================================================

select 'documents: money columns (expect 6)' as check_name,
       count(*)::text as result
from information_schema.columns
where table_name = 'stock_documents'
  and column_name in ('discount_kind','discount_value','transport_amount',
                      'transport_paid_to','paid_amount','payment_method')
union all
select 'movements: line columns (expect 3)',
       count(*)::text
from information_schema.columns
where table_name = 'stock_movements'
  and column_name in ('entered_unit_price','line_discount_kind','line_discount_value')
union all
-- The value guards are read by NAME, not counted: a count says four
-- constraints exist and not that they are the four we meant.
select 'documents: value + range guards (expect 4)',
       string_agg(conname, ', ' order by conname)
from pg_constraint
where conrelid = 'public.stock_documents'::regclass
  and conname in ('stock_documents_discount_kind_check',
                  'stock_documents_transport_paid_to_check',
                  'stock_documents_payment_method_check',
                  'stock_documents_money_nonneg_check')
union all
select 'movements: value + range guards (expect 2)',
       string_agg(conname, ', ' order by conname)
from pg_constraint
where conrelid = 'public.stock_movements'::regclass
  and conname in ('stock_movements_line_discount_kind_check',
                  'stock_movements_line_money_nonneg_check')
union all
-- ⚠️ The check that catches a failed DROP. A new parameter makes an overload,
-- and two copies mean every call is ambiguous from now on.
select 'post_stock_document: copies (expect 1)',
       count(*)::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'post_stock_document'
union all
select 'post_stock_document: money reaches the insert (expect 1 and 1)',
       ((length(p.prosrc) - length(replace(p.prosrc, 'p_payment_method)', '')))
        / length('p_payment_method)'))::text
       || ' and ' ||
       ((length(p.prosrc) - length(replace(p.prosrc, 'line_discount_value)', '')))
        / length('line_discount_value)'))::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'post_stock_document'
union all
-- ⚠️ The reversal copies an EXPLICIT column list, so a column it does not name
-- is dropped by every reversal in silence.
select 'reverse_stock_document: copies the three (expect 3)',
       (((length(p.prosrc) - length(replace(p.prosrc, 'm.entered_unit_price', '')))
         / length('m.entered_unit_price'))
      + ((length(p.prosrc) - length(replace(p.prosrc, 'm.line_discount_kind', '')))
         / length('m.line_discount_kind'))
      + ((length(p.prosrc) - length(replace(p.prosrc, 'm.line_discount_value', '')))
         / length('m.line_discount_value')))::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'reverse_stock_document'
union all
-- Rewriting a function rewrites it whole, and every property not restated is
-- at risk. SECURITY INVOKER is the default and therefore invisible in our text.
select 'both functions: security_definer (expect false, false)',
       string_agg(p.proname || '=' || p.prosecdef, ', ' order by p.proname)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('post_stock_document', 'reverse_stock_document')
union all
-- ⚠️ Both functions were rewritten, so the eighteen Arabic hints are exposed
-- again. This is what 048 measured and 049 repaired -- it is cheaper to ask
-- than to find out from a screen.
select 'arabic hints intact (expect 18 and 0 english)',
       count(*)::text || ' hints, '
       || count(*) filter (where m[1] !~ '[ء-ي]')::text || ' english'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral regexp_matches(p.prosrc, 'using hint = ''([^'']+)''', 'g') as m
where n.nspname = 'public'
  and p.proname in ('post_stock_document', 'post_stocktake',
                    'transfer_stock', 'reverse_stock_document');

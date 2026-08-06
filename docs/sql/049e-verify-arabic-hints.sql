-- ==========================================================================
-- Verify the restore: one query, four rows, everything visible at once.
--
-- READ ONLY. Run it after 049a..049d.
--
-- EXPECTED
--   post_stock_document      hints 6   still_english 0
--   post_stocktake           hints 3   still_english 0
--   transfer_stock           hints 6   still_english 0
--   reverse_stock_document   hints 3   still_english 0
--
-- Eighteen in total, and the count is measured from the script texts rather
-- than estimated. Any non-zero in still_english means a CREATE OR REPLACE did
-- not land, or landed translated again.
--
-- `texts` is there to be READ, not only counted: still_english = 0 says the
-- strings contain Arabic letters, it does not say the sentences are the right
-- ones. The four blocks below the query are what they should read.
-- ==========================================================================

select p.proname,
       count(*) as hints,
       count(*) filter (where m[1] !~ '[ء-ي]') as still_english,
       string_agg(m[1], '  |  ') as texts
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral regexp_matches(p.prosrc, 'using hint = ''([^'']+)''', 'g') as m
where n.nspname = 'public'
  and p.proname in ('post_stock_document', 'post_stocktake',
                    'transfer_stock', 'reverse_stock_document')
group by p.proname
order by p.proname;

-- What `texts` should contain, per function:
--
-- post_stock_document (6)
--   التحويل والعكس والجرد لهم دوال مستقلة
--   المستند بلا سطور
--   المستودع غير موجود
--   منتج بالمستند غير موجود
--   سطر بكمية صفر
--   سعر الشراء إجباري بالتوريد
--
-- post_stocktake (3)
--   المستودع غير موجود
--   منتج بالمستند غير موجود
--   العدد لازم يكون صفرًا أو أكبر
--
-- transfer_stock (6)
--   مستودع المصدر والوجهة واحد
--   المستند بلا سطور
--   مستودع المصدر غير موجود
--   مستودع الوجهة غير موجود
--   منتج بالمستند غير موجود
--   سطر بكمية صفر
--
-- reverse_stock_document (3)
--   المستند غير موجود
--   لا يُعكس مستند عكسي
--   المستند معكوس سابقًا

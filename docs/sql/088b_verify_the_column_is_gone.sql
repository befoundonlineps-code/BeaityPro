-- ٠٨٨ب — التحقّق من ٠٨٨: العمودُ ذهب، وجدولُ الربط هو الجواب الوحيد
--
-- 🔴 قراءةٌ خالصة، بملفٍّ مستقلٍّ عن ٠٨٨ — لأن استعلامًا يفشل في معاملة الإسقاط
-- يُرجعه ويُبلّغ عن نفسه هو (البند ١).
--
-- ⚠️ **والسؤالُ يُطرح على الفئة كلِّها ثمّ يُصفّى بالعين** (§4ب): القسم A يسرد
-- **كلَّ** أعمدة `product_categories` لا يسأل عن `storage_id` وحده. وسؤالٌ ضيّق
-- عن اسمٍ غائبٍ يرجع صفرَ صفوفٍ **سواءٌ ذهب العمودُ أو أُخطئ في تهجئته** —
-- وهي §1ج بعينها: «ما في» و«ما سألت» يتطابقان في المخرَج.
--
-- المتوقَّع: سبعةُ أعمدة، ولا واحدَ منها `storage_id`.

select
  'A. كلُّ أعمدة product_categories — تُصفّى بالعين'::text as section,
  c.column_name::text                                     as name,
  c.data_type::text                                       as detail,
  c.is_nullable::text                                     as extra,
  coalesce(c.domain_name::text, '—')                      as more
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'product_categories'

union all

-- ⚠️ **وكلُّ قيود الجدول، لا `contype` بعينه** — المفتاحُ المركّب الذي أضافه
-- ٠٨٥ يجب أن يكون ذهب مع العمود. وسؤالٌ عن `contype='f'` وحدَه يسكت عن أيّ
-- شيءٍ رابعٍ بقي.
select
  'B. كلُّ قيود product_categories'::text,
  con.conname::text,
  con.contype::text,
  pg_get_constraintdef(con.oid)::text,
  '—'::text
from pg_constraint con
where con.conrelid = 'public.product_categories'::regclass

union all

select
  'C. كلُّ فهارس product_categories'::text,
  i.relname::text,
  pg_get_indexdef(i.oid)::text,
  '—'::text,
  '—'::text
from pg_index x
join pg_class i on i.oid = x.indexrelid
where x.indrelid = 'public.product_categories'::regclass

union all

-- 🔴 شاهدُ الصدق: جدولُ الربط قائمٌ ويحمل صفوفًا. فلو رجع القسم A بلا
-- `storage_id` **و**رجع هذا صفرًا، لكان السؤالُ «هل الاستعلامُ يرى شيئًا
-- أصلًا؟» مفتوحًا. ظهورُ الروابط يغلقه.
select
  'D. شاهدُ الصدق — جدولُ الربط هو الجواب الآن'::text,
  'storage_categories'::text,
  ('صفوف: ' || (select count(*) from public.storage_categories)::text),
  ('منها بذرةٌ أولى: ' || (select count(*) from public.storage_categories where seeded)::text),
  ('وقرارُ إنسان: ' || (select count(*) from public.storage_categories where not seeded)::text)

order by 1, 2;

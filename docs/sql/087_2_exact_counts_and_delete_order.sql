-- ٠٨٧_٢ — العدُّ الدقيق، وترتيبُ الحذف مشتقًّا لا مُتذكَّرًا
--
-- 🔴 استعلامُ قراءةٍ خالص — **جملةُ `select` واحدة، ولا DDL ولا جدولٌ مؤقّتٌ ولا
-- كتابةُ صفٍّ واحد.** والعدُّ الدقيق لمجموعةٍ من الجداول تُكتشَف وقتَ التنفيذ
-- يجري بـ`query_to_xml`، فلا حاجةَ لجدولٍ مؤقّتٍ يُوقع الملفَّ تحت البند ١
-- (ومقيس: حارسُ `sqlVerificationShape` يصنّف `create temp table` بـ`ddl`).
--
-- ⚠️ **ولا أمرَ حذفٍ هنا.** أمرُ المسح يُكتب بعد مراجعة مخرَج هذا الملفّ.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 السطرُ الأهمّ في الملفّ كلِّه: قيدٌ على الترتيب لا يعرفه أيُّ مفتاحٍ أجنبيّ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `refuse_unlinking_stocked_folder` مُشغِّلُ **BEFORE DELETE على
-- `storage_categories`**، ويقرأ `product_balances`. فحذفُ صفٍّ من جدول الربط
-- **يُرفَض ما دام للمستودع رصيدٌ غيرُ صفريّ** من منتجات ذلك المجلّد أو أيٍّ من
-- أبنائه.
--
-- ⇒ **`stock_movements` تُفرَّغ قبل `storage_categories`، لا بعدها.**
--
-- ⚠️ **وهذا القيدُ غيرُ مرئيٍّ في غرافِ المفاتيح الأجنبيّة إطلاقًا.** ترتيبُ حذفٍ
-- مشتقٌّ من المفاتيح وحدَها — وهو ما يفعله كلُّ من يرتّب حذفًا — **يضع الجدولين
-- في أيّ ترتيب، ثمّ يُرفض المسحُ برسالةٍ عن «بضاعة» في سكربتِ تصفير.** القسم D
-- أدناه يُظهره، ولذلك هو موجود.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 والثلاثةَ عشرَ جدولًا مُدَّعًى عليها لا مصدرٌ للحقيقة
-- ═══════════════════════════════════════════════════════════════════════════
--
-- وصلتني قائمةُ الجداول **روايةً** لا مخرَجًا. فهي هنا **مُدخَلٌ يُقارَن**، لا
-- أساسٌ يُبنى عليه: القسم C يضعها بمواجهة ما يكتشفه الاستعلام من الكتالوج،
-- **ويسمّي الفرقَ في الاتجاهين** — ما اكتُشف ولم يُسمَّ، وما سُمّي ولم يُكتشَف.
--
-- ⚠️ والاتجاه الأوّل هو الخطر: **قائمةٌ مكتوبةٌ بيدٍ تفشل مفتوحةً** — تجد ما
-- وُضع فيها وتسكت عن كلّ ما عداه بنفس نبرة النجاح. ٠٧١ سأل عن خمسة جداول وفاته
-- `stock_fine_lines`. **وسكربتُ تصفيرٍ يفوته جدولٌ يترك النظامَ نصفَ مصفَّر،
-- وهي أسوأُ حالةٍ من الاثنتين** — لا صفرٌ نظيف ولا بياناتٌ متماسكة.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ وما لا يُثبته
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `auth.uid()` فاضيةٌ بالمحرّر و**RLS متجاوَزةٌ بالكامل**، فالأعدادُ أدناه أعدادُ
-- صفوف القاعدة كلِّها لا ما يراه صالون. وهذا **مقصودٌ هنا** — التصفيرُ يمسّ
-- القاعدة لا صالونًا — لكنّه يُقال كي لا يُقرأ المخرَجُ أضيقَ مما هو.

with recursive

targets as (
  select 'public.products'::regclass           as oid
  union all select 'public.storages'::regclass
  union all select 'public.product_categories'::regclass
),

fk as (
  select con.conname::text as name, con.conrelid as child,
         con.confrelid as parent, con.confdeltype as del
  from pg_constraint con
  where con.contype = 'f' and con.connamespace = 'public'::regnamespace
),

closure as (
  select f.child, f.parent, f.name, f.del, 1 as depth,
         (f.parent::regclass::text || ' ← ' || f.child::regclass::text) as path
  from fk f join targets t on t.oid = f.parent
  union all
  select f.child, f.parent, f.name, f.del, c.depth + 1,
         (c.path || ' ← ' || f.child::regclass::text)
  from fk f join closure c on f.parent = c.child
  -- موقفان مستقلّان — و`product_categories.parent_id` تشير إلى جدولها نفسه،
  -- فالدائرةُ حالةٌ قائمة.
  where c.depth < 6 and position(f.child::regclass::text in c.path) = 0
),

-- كلُّ جدولٍ يمسّه التصفير: الأهدافُ الثلاثة وكلُّ من تعلّق بها.
-- 🔴 **مكتشَفٌ من الكتالوج، لا مكتوبٌ بيد.**
affected as (
  select t.oid as rel from targets t
  union
  select c.child from closure c
),

-- أعمقُ موضعٍ ظهر فيه كلُّ جدول. الأعمقُ يُحذف أوّلًا: ابنٌ قبل أبيه.
depth_of as (
  select a.rel,
         coalesce((select max(c.depth) from closure c where c.child = a.rel), 0) as depth
  from affected a
),

-- 🔴 العدُّ الدقيق. `query_to_xml` تنفّذ عدًّا لكلّ جدولٍ اكتُشف — فلا قائمةَ
-- جداولٍ مكتوبةٌ بيد ولا تقديرَ `reltuples`.
counted as (
  select
    d.rel,
    d.depth,
    (xpath(
      '/row/c/text()',
      query_to_xml(
        format('select count(*) as c from %s', d.rel::regclass::text),
        false, true, ''
      )
    ))[1]::text::bigint as rows
  from depth_of d
),

-- الادّعاء الواصل روايةً — يُقارَن، ولا يُبنى عليه.
claimed(name) as (
  values ('storages'), ('product_categories'), ('products'),
         ('stock_documents'), ('stock_movements'),
         ('stocktake_sessions'), ('stocktake_counts'),
         ('stock_fines'), ('stock_fine_lines'),
         ('product_order_lines'), ('product_set_components'),
         ('storage_categories'), ('storage_responsibles')
)

select
  'A. العدُّ الدقيق — لكلّ جدولٍ اكتُشف'::text as section,
  c.rel::regclass::text                        as table_name,
  c.rows::text                                 as exact_rows,
  ('عمق ' || c.depth::text)::text              as depth,
  case when c.rows = 0 then '✅ فاضٍ أصلًا' else '—' end::text as note
from counted c

union all

-- 🔴 ترتيبُ الحذف مشتقًّا: الأعمقُ أوّلًا، لأن الابنَ يُحذف قبل أبيه.
-- ⚠️ **وهذا ترتيبُ المفاتيح وحدَه** — القسم D يضيف قيدًا لا تعرفه المفاتيح.
select
  'B. ترتيبُ الحذف المشتقّ (المفاتيح وحدها)'::text,
  lpad((row_number() over (order by c.depth desc, c.rel::regclass::text))::text, 2, '0'),
  c.rel::regclass::text,
  ('عمق ' || c.depth::text || '  ·  صفوف: ' || c.rows::text),
  '—'::text
from counted c

union all

-- اكتُشف ولم يُسمَّ — الاتجاه الخطر.
select
  '⛔ C1. اكتُشف ولم يُذكَر بالقائمة الواصلة'::text,
  c.rel::regclass::text,
  c.rows::text,
  'لازم يُضاف للتصفير أو يُستثنى بقرارٍ مكتوب'::text,
  '—'::text
from counted c
where c.rel::regclass::text not in (select 'public.' || name from claimed)
  and replace(c.rel::regclass::text, 'public.', '') not in (select name from claimed)

union all

-- سُمّي ولم يُكتشَف — إمّا اسمٌ غلط وإمّا جدولٌ غيرُ مرتبطٍ فعلًا.
select
  '⚠️ C2. ذُكر بالقائمة ولم يظهر بالاكتشاف'::text,
  cl.name::text,
  case when to_regclass('public.' || cl.name) is null
       then '⛔ ما في جدولٌ بهذا الاسم إطلاقًا'
       else 'موجودٌ بس ما بيتعلّق بالأهداف بمفتاحٍ أجنبيّ' end::text,
  '—'::text,
  '—'::text
from claimed cl
where 'public.' || cl.name not in (select c.rel::regclass::text from counted c)

union all

-- 🔴 القسم الذي يمنع الرفض: أيُّ مُشغِّلٍ سينطلق على الحذف، وعلى أيّ جدول.
select
  'D. مشغّلاتٌ رح تنطلق على الحذف — قيدُ ترتيبٍ فوق المفاتيح'::text,
  cl.relname::text,
  tg.tgname::text,
  case when tg.tgenabled = 'D' then '⛔ معطَّل — ما بينطلق' else '⚠️ مفعَّل' end::text,
  pg_get_triggerdef(tg.oid)::text
from pg_trigger tg
join pg_class cl on cl.oid = tg.tgrelid
join pg_namespace n on n.oid = cl.relnamespace
where not tg.tgisinternal
  and n.nspname = 'public'
  -- tgtype bit 3 (القيمة 8) = DELETE
  and (tg.tgtype & 8) <> 0

union all

-- حوافُّ CASCADE مسمّاةً وحدَها: هي الوحيدة التي تحذف بصمت.
select
  'E. حوافُّ CASCADE — بتحذف بلا ما تقول'::text,
  c.child::regclass::text,
  c.parent::regclass::text,
  c.name::text,
  c.path::text
from closure c
where c.del = 'c'

union all

select
  'F. شاهدُ الصدق — الأعدادُ مجتمعةً'::text,
  'الإجمالي'::text,
  (
    'جداول متأثّرة: ' || (select count(*) from counted)::text
    || '  ·  المذكورة بالقائمة: ' || (select count(*) from claimed)::text
    || '  ·  حواف CASCADE: ' || (select count(*) from closure where del = 'c')::text
  )::text,
  ('مجموعُ الصفوف اللي رح تنمسح: ' || (select coalesce(sum(rows), 0) from counted)::text)::text,
  ('مشغّلاتُ حذفٍ مفعّلة: ' || (
     select count(*) from pg_trigger tg
     join pg_class c2 on c2.oid = tg.tgrelid
     join pg_namespace n2 on n2.oid = c2.relnamespace
     where not tg.tgisinternal and n2.nspname = 'public'
       and (tg.tgtype & 8) <> 0 and tg.tgenabled <> 'D'
   )::text)::text

order by 1, 2, 3;

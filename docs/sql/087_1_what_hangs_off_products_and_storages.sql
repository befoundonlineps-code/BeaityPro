-- ٠٨٧_١ — شو بيتعلّق بـ`products` و`storages` و`product_categories`
--
-- 🔴 استعلامُ قراءةٍ خالص. ولا DDL ولا كتابةَ صفٍّ واحد. **ولا أمرَ حذفٍ هنا
-- إطلاقًا** — أمرُ المسح يُكتب بعد مراجعة مخرَج هذا الملفّ، لا قبلها.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 اقرأ هذا قبل أيّ شيء: ما في تراجُع
-- ═══════════════════════════════════════════════════════════════════════════
--
-- المسحُ المطلوب **لا يُستدرَك**. والمالكُ بلا صلاحياتٍ إداريّة، فما في
-- `pg_dump` ولا استرجاعٌ من عندنا. ⇒ **قبل أيّ حذف: تأكَّد إن في نسخةٌ
-- احتياطيّةٌ أو نقطةُ استرجاعٍ (PITR) بلوحة Supabase**، واقرأ تاريخَها بعينك.
-- «في باكْأب أكيد» جملةٌ عن الظنّ، و«آخر نسخة: أمس ٢:١٥» جملةٌ عن الواقع.
--
-- ⚠️ والسكربتُ هذا ما بيقدر يفحص وجودَ النسخة — خارجَ القاعدة تمامًا. **فهذا
-- السطرُ هو كلُّ ما نملكه، ولذلك مكتوبٌ في أوّل الملفّ لا في آخره.**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 والسؤالُ الحقيقيّ ليس «وين المنتجات» — بل «شو بينكسر لمّا تروح»
-- ═══════════════════════════════════════════════════════════════════════════
--
-- كلُّ مفتاحٍ أجنبيٍّ يشير إلى هذه الجداول يتصرّف بواحدةٍ من طريقتين، **وهما
-- ضدّان تمامًا:**
--
--   RESTRICT / NO ACTION   بيمنع الحذف ⇒ **عطلٌ صاخب**، بتشوفه وبترتّب حاله
--   CASCADE                بيحذف الأبناء معه ⇒ **صمتٌ تامّ**، بتروح صفوفٌ
--                          ما كنت ناوي عليها ولا سطرَ بيقول
--
-- ⚠️ **والتاني هو الخطر، والأوّل هو الإزعاج.** فالعمودُ `on_delete` أدناه هو
-- أهمُّ عمودٍ في المخرَج كلِّه — اقرأه سطرًا سطرًا قبل أيّ شيء آخر.
--
-- ⚠️ **والقيدُ الذي بنيناه للتوّ داخلٌ في هذا:**
-- `product_categories_storage_id_salon_id_fkey` مكتوبٌ `ON DELETE RESTRICT`
-- (٠٨٥) ⇒ **حذفُ مستودعٍ رح ينرفض ما دام في مجلّدٌ مربوطٌ فيه.** فترتيبُ المسح
-- بيلزمه يبدأ من المجلّدات أو يفكّ الربطَ أوّلًا، **وهاد بينشاف بالمخرَج لا
-- بالتذكُّر.**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 شاهدُ الصدق — مبنيٌّ بالسؤال (§1ج · §4ب)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- الأقسامُ لا تسأل عن «الجداول التي أظنّها مرتبطة» — **قائمةٌ مكتوبةٌ بيدٍ تجد
-- ما وُضع فيها وتسكت عن كلّ ما عداه بنفس نبرة النجاح** (٠٧١ سأل عن خمسة وفاته
-- `stock_fine_lines`).
--
--   القسم A   يمشي على **كلّ** مفاتيح المخطّط الأجنبيّة ويطوي السلسلة بنفسه،
--             فالجداولُ تُكتشَف ولا تُذكَر. **ولا اسمَ جدولٍ واحدٍ مكتوبٌ فيه
--             غير الأهداف الثلاثة**، وهي السؤالُ نفسُه لا مرشِّحٌ عليه.
--   القسم C   **كلُّ** المشغّلات غير الداخليّة في `public`، بلا تصفيةٍ باسم
--             جدول — بالحرف كما نصّت §1ج. وشاهدُه إننا نعرف اثنين موجودَين
--             (`refuse_unlinking_stocked_folder` · `freeze_consignment_after_use`)
--             ⇒ **فظهورُهما يثبت إن الاستعلامَ يرى المشغّلاتِ المكتوبةَ بيد،
--             وعندها أيُّ غيابٍ خبرٌ لا صمت.**
--   القسم G   الأعدادُ مجتمعةً، فيُقرأ كلُّ قسمٍ فارغٍ مقابل إجماليٍّ معروف.
--
-- ⚠️ **وحلقةُ A لها موقفان مستقلّان، لأنّ `product_categories.parent_id` تشير
-- إلى جدولها نفسه** — أي أنّ الطيَّ يمشي في دائرةٍ ما لم يُوقَف: العمقُ محدودٌ
-- بستّة، **و**الجدولُ الذي مرّ في المسار لا يُعاد. حذفُ أحدهما يترك الآخر ماسكًا.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ وما لا يُثبته
-- ═══════════════════════════════════════════════════════════════════════════
--
-- محرّرُ SQL ما بيحمل JWT، فـ`auth.uid()` فاضيةٌ فيه و**RLS متجاوَزةٌ بالكامل**.
-- ⇒ القسم E بيسرد سياساتِ الحذف الموجودة، **وما بيثبت إنها بتُطبَّق على أحد** —
-- وأهمُّ من ذلك: **الحذفُ من المحرّر بيتخطّاها كلَّها**. فغيابُ سياسةِ حذفٍ عن
-- جدولٍ ما بيحميه من سكربتٍ بينشغّل هون؛ بيحمي العميلَ وحده.
--
-- ⚠️ **والأحجامُ في القسم F تقديرٌ لا عدّ** (`reltuples` من المخطِّط، وبتكون
-- `-1` لجدولٍ ما انعمل عليه `ANALYZE` قطّ). **العدُّ الدقيق في ٠٨٧_٢** — بملفٍّ
-- مستقلٍّ لأنه بيلزمه جدولًا مؤقّتًا، وخلطُ إنشاءِ جدولٍ مع استعلامٍ بنفس الملفّ
-- بيوقعه تحت البند ١ (ومقيس: حارسُ `sqlVerificationShape` بيصنّف
-- `create temp table` بـ`ddl`).

with recursive

-- الأهدافُ الثلاثة: سؤالُ المالك حرفيًّا، ومعها المجلّداتُ لأنها صارت طرفًا
-- في الشبكة بـ٠٨٥ ولأنها تُمسح معها.
targets as (
  select 'public.products'::regclass           as oid, 'products'::text           as label
  union all
  select 'public.storages'::regclass,                  'storages'::text
  union all
  select 'public.product_categories'::regclass,        'product_categories'::text
),

-- 🔴 **كلُّ** مفاتيح المخطّط الأجنبيّة، بلا تصفيةٍ باسم جدول.
fk as (
  select
    con.conname::text as name,
    con.conrelid      as child,
    con.confrelid     as parent,
    con.confdeltype   as del,
    pg_get_constraintdef(con.oid)::text as def
  from pg_constraint con
  where con.contype = 'f'
    and con.connamespace = 'public'::regnamespace
),

-- الطيُّ: مين بيشير للأهداف، ومين بيشير لهدولك، وهكذا.
closure as (
  select
    f.child, f.parent, f.name, f.del, f.def,
    1 as depth,
    t.label as root,
    (f.parent::regclass::text || ' ← ' || f.child::regclass::text) as path
  from fk f
  join targets t on t.oid = f.parent

  union all

  select
    f.child, f.parent, f.name, f.del, f.def,
    c.depth + 1,
    c.root,
    (c.path || ' ← ' || f.child::regclass::text)
  from fk f
  join closure c on f.parent = c.child
  -- ⚠️ موقفان مستقلّان: عمقٌ محدود، وجدولٌ مرّ لا يُعاد. حذفُ أحدهما يُبقي
  -- الطيَّ منتهيًا، وحذفُهما معًا يعلّقه — و`product_categories.parent_id`
  -- تشير إلى جدولها نفسه، فالدائرةُ حالةٌ قائمةٌ لا نظريّة.
  where c.depth < 6
    and position(f.child::regclass::text in c.path) = 0
)

select
  'A. مين بيتعلّق بالأهداف — والسلسلةُ مطويّةٌ لآخرها'::text as section,
  (c.root || '  ·  عمق ' || c.depth::text)::text             as name,
  c.child::regclass::text                                    as detail,
  case c.del
    when 'a' then 'NO ACTION — بيمنع الحذف (الافتراضيّ)'
    when 'r' then 'RESTRICT — بيمنع الحذف'
    when 'c' then '⚠️ CASCADE — بيحذف الأبناء بصمت'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
    else 'غير معروف: ' || c.del::text
  end::text                                                  as on_delete,
  (c.name || '   |   ' || c.path)::text                      as extra
from closure c

union all

-- شو بيشيروا الأهدافُ هم إليه — للسياق، ولأن مسحَ الأبناء بيلزمه يعرف الآباء.
select
  'B. المفاتيحُ الخارجةُ من الأهداف نفسها'::text,
  f.child::regclass::text,
  f.parent::regclass::text,
  f.def,
  f.name
from fk f
join targets t on t.oid = f.child

union all

-- 🔴 §1ج بالحرف: بلا `relname` وبلا شكّ. وشاهدُ الصدق تحت.
select
  'C. كلُّ المشغّلات غير الداخليّة في public'::text,
  c.relname::text,
  tg.tgname::text,
  case when tg.tgenabled = 'D' then '⛔ معطَّل' else 'مفعَّل' end::text,
  pg_get_triggerdef(tg.oid)::text
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not tg.tgisinternal
  and n.nspname = 'public'

union all

-- شاهدُ الصدق للقسم C: اثنان نعرفهما بالاسم. ظهورُهما = الاستعلامُ يرى
-- المشغّلاتِ المكتوبةَ بيد، فغيابُ غيرِهما خبرٌ لا صمت.
select
  'D. شاهدُ الصدق للقسم C'::text,
  needle.want::text,
  case when exists (
    select 1 from pg_trigger tg
    join pg_class c2 on c2.oid = tg.tgrelid
    join pg_namespace n2 on n2.oid = c2.relnamespace
    where not tg.tgisinternal and n2.nspname = 'public' and tg.tgname like '%' || needle.want || '%'
  ) then '✅ ظهر — فالقسم C بيشوف' else '⛔ ما ظهر — القسم C مشكوكٌ فيه' end::text,
  '—'::text,
  '—'::text
from (values ('refuse_unlinking_stocked_folder'), ('freeze_consignment_after_use')) as needle(want)

union all

-- سياساتُ RLS للجداول اللي طلعت بالطيّ — **تضييقٌ مشتقٌّ من الاستعلام لا
-- مكتوبٌ بيد**، وهذا هو الفرق. وكلُّ الأوامر لا `DELETE` وحده، فتُصفّى بالعين.
select
  'E. سياسات RLS على الجداول المتعلّقة — كلُّ الأوامر'::text,
  p.tablename::text,
  p.policyname::text,
  p.cmd::text,
  '—'::text
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in (
    select t.oid::regclass::text from targets t
    union
    select c.child::regclass::text from closure c
  )

union all

-- المناظيرُ اللي بتقرأ من الأهداف — مقروءةً من `pg_depend` لا بمطابقةِ نصّ.
select
  'F. المناظيرُ اللي بتعتمد على الأهداف'::text,
  v.relname::text,
  t.label::text,
  '—'::text,
  '—'::text
from pg_depend d
join pg_rewrite r on r.oid = d.objid
join pg_class v on v.oid = r.ev_class
join targets t on t.oid = d.refobjid
where v.relkind = 'v'
group by v.relname, t.label

union all

-- ⚠️ تقديرٌ لا عدّ. `-1` معناها ما انعمل `ANALYZE` قطّ. العدُّ الدقيق بـ٠٨٧_٢.
select
  'G. تقديرُ الأحجام (reltuples — تقدير، مش عدّ)'::text,
  c.relname::text,
  c.reltuples::bigint::text,
  '—'::text,
  '—'::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and (c.oid in (select t.oid from targets t) or c.oid in (select cl.child from closure cl))

union all

select
  'H. شاهدُ الصدق — الأعدادُ مجتمعةً'::text,
  'الإجمالي'::text,
  (
    'مفاتيح أجنبيّة بالمخطّط: ' || (select count(*) from fk)::text
    || '  ·  منها بالطيّ: ' || (select count(*) from closure)::text
    || '  ·  جداول متعلّقة: ' || (select count(distinct child) from closure)::text
  )::text,
  (
    'مشغّلات غير داخليّة: ' || (
      select count(*) from pg_trigger tg
      join pg_class c3 on c3.oid = tg.tgrelid
      join pg_namespace n3 on n3.oid = c3.relnamespace
      where not tg.tgisinternal and n3.nspname = 'public'
    )::text
  )::text,
  ('منها CASCADE: ' || (select count(*) from closure where del = 'c')::text)::text

order by 1, 2, 3;

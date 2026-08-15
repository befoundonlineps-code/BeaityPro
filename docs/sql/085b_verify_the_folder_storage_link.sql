-- ٠٨٥ب — التحقّق من ٠٨٥، بملفٍّ لا يقدر أن يتراجع عن شيء
--
-- 🔴 استعلامُ قراءةٍ خالص، ومنفصلٌ عن ٠٨٥ لسببٍ بنيويّ لا تنظيميّ: جملةُ تحقّقٍ
-- تفشل داخل معاملةِ الـDDL **تُسقط الـDDL معها**، وتُبلّغ عن فشلِها هي لا عن
-- التراجع الذي سبّبته. صار فعلًا بـ٠٥١ج: الدالّةُ لم تُحفظ والفحصُ قال «نجح».
--
-- يُشغَّل **بعد** ٠٨٥ ويُتوقَّع منه بالضبط:
--
--   A  صفٌّ واحد: `storage_id · uuid · YES` — والعدميّةُ هي القرار، لا سهو.
--   B  صفٌّ واحد: القيدُ المركّب بنصّه، وفيه `ON DELETE RESTRICT`.
--   C  صفٌّ واحد: الفهرس.
--   D  صفٌّ واحد: التعليقُ العربيّ مقروءًا راجعًا من القاعدة.
--   E  ثلاثةُ مجلّدات، وثلاثةٌ منها غيرُ مُسنَد — ⚠️ العمودُ وُلد فارغًا كلُّه،
--      وهذا هو المتوقَّع وليس نقصًا: لا شيء في القاعدة يعرف أيُّ مستودعٍ يخصّ
--      أيَّ مجلّد، فالإسنادُ فعلُ إنسانٍ من الشاشة.
--   F  سياساتُ `product_categories` و`storages` — ⚠️ **وهذا يحسم قراءةَ وثيقةٍ
--      بُني عليها اختيارُ `ON DELETE RESTRICT`**: إن لم تظهر سياسةُ `delete`
--      على `storages` فالمستودعُ غيرُ قابلٍ للحذف من العميل أصلًا، ويكون
--      الاعتراضُ على RESTRICT عن طريقٍ مسدود. وإن ظهرت، فالقرارُ يُعاد فتحُه.
--
-- ⚠️ وشاهدُ الصدق: القسمان A و B و F يقرأون **الفئةَ كاملة** لا المرشَّحَ
-- المتوقَّع — كلَّ أعمدة الجدول، وكلَّ قيوده، وكلَّ سياساته. فإن ظهرت `parent_id`
-- و`salon_id` (ونعرف أنهما هناك) فقد أثبت الاستعلامُ أنه يرى الجدول، وعندها
-- غيابُ `storage_id` خبرٌ لا صمت.

select
  'A. أعمدة product_categories كاملةً'::text as section,
  c.column_name::text                        as name,
  c.data_type::text                          as detail,
  c.is_nullable::text                        as extra
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'product_categories'

union all

select
  'B. قيود product_categories كاملةً'::text,
  con.conname::text,
  con.contype::text,
  pg_get_constraintdef(con.oid)::text
from pg_constraint con
where con.connamespace = 'public'::regnamespace
  and con.conrelid = 'public.product_categories'::regclass

union all

select
  'C. فهارس product_categories'::text,
  i.relname::text,
  pg_get_indexdef(i.oid)::text,
  '—'::text
from pg_index x
join pg_class i on i.oid = x.indexrelid
where x.indrelid = 'public.product_categories'::regclass

union all

-- 🔴 التعليقُ العربيُّ مقروءًا راجعًا. قاعدةُ المشروع: أيُّ نصٍّ يُودَع في
-- القاعدة يُقرأ من القاعدة بنفس الجولة — ولا اختبارَ في المستودع يمسك هذا
-- الصنف، لأن اختباراتنا تقرأ الملفّات لا القاعدة.
select
  'D. التعليق العربيّ راجعًا من القاعدة'::text,
  'storage_id'::text,
  coalesce(
    col_description('public.product_categories'::regclass, a.attnum),
    '⛔ لا تعليق'
  )::text,
  '—'::text
from pg_attribute a
where a.attrelid = 'public.product_categories'::regclass
  and a.attname = 'storage_id'
  and a.attnum > 0

union all

select
  'E. حالة الإسناد'::text,
  'product_categories'::text,
  count(*)::text || ' مجلّدًا',
  count(*) filter (where pc.storage_id is null)::text || ' غيرُ مُسنَد'
from public.product_categories pc

union all

-- 🔴 القسمُ الذي يحسم قراءةَ الوثيقة التي بُني عليها ON DELETE.
select
  'F. سياسات RLS — كاملةً، بلا تصفية بالأمر'::text,
  p.tablename::text || ' · ' || p.policyname::text,
  p.cmd::text,
  '—'::text
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in ('product_categories', 'storages')

order by 1, 2;

-- ⚠️ وما لا يُثبته: محرّرُ SQL يعمل بدور المالك و**RLS متجاوَزةٌ فيه بالكامل**.
-- فالقسم F يسرد السياساتِ الموجودة، **ولا يثبت أنها تُطبَّق على أحد** — إثباتُ
-- العزل يحتاج جلسةً بـJWT حقيقيّ، وهذا ليس مكانَها. من يقرأ النتيجةَ بعد شهر
-- سيظنّها أثبتت الاثنين.

-- ٠٨٤ — مسحٌ قبل ربط المجلّد بمستودع
--
-- 🔴 استعلامُ قراءةٍ خالص. ولا DDL، ولا كتابة، ولا شيء يمكن أن يسقط تغييرًا —
-- لأنه بالضبط الملفّ الذي **يقرّر شكل** التغيير الذي يليه (٠٨٥).
--
-- القاعدةُ البنيويّة في CLAUDE.md: التحقّقُ الذي يمكن أن يُسقط التغيير لا يصلح
-- أن يعيش في معاملته. وهذا أبعد من ذلك — يسبقه بملفّ.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ما يُجيب عنه، وكلُّ سؤالٍ منه يغيّر السطر الذي يُكتب في ٠٨٥
-- ═══════════════════════════════════════════════════════════════════════════
--
--   ١. هل على `product_categories` عمودٌ اسمُه `storage_id` أصلًا؟
--      ⚠️ يُسأل ولا يُفترض. «غيابُ اسمٍ ليس غيابَ مفهوم» كلّفنا جولةً حين بُني
--      استنتاجٌ على `reversed_document_id` والعمودُ موجودٌ باسم
--      `reverses_document_id`. فيُقرأ سردُ الأعمدة كاملًا لا يُبحث عن اسم.
--
--   ٢. هل على `storages` مفتاحٌ فريدٌ على `(salon_id, id)`؟
--      🔴 هذا هو السؤال الحاسم للشكل. المشروع يستعمل مفتاحًا أجنبيًّا **مركّبًا**
--      في `storages.owner_employee_id` تحديدًا كي لا يشير صفُّ صالونٍ إلى صفّ
--      صالونٍ آخر. ونفسُ الشكل هو الصحيح هنا — لكنه **يحتاج مفتاحًا فريدًا على
--      الطرف المشار إليه**، وبوستجرس يرفض `REFERENCES storages(salon_id, id)`
--      بلا واحد.
--      ⇒ إن وُجد: ٠٨٥ يكتب مفتاحًا مركّبًا. وإلّا: يكتب `REFERENCES storages(id)`
--        ويُسجَّل أن العزلَ يقوم على RLS وحدها في هذا العمود.
--
--   ٣. كم مجلّدًا موجودٌ اليوم، وكم مستودعًا؟
--      ليُقرأ حجمُ «البيانات القائمة» بدل تقديره. والقرارُ المكتوب:
--      `storage_id IS NULL` = **غيرُ مُسنَد**، ويظهر تحت «كل المستودعات» وحدها.
--
--   ٤. هل في الشجرة تعشيش أصلًا؟
--      ⚠️ لأن `foldersForStorage` بنى «العمود الفقريّ» — إبقاءَ الأصول التي
--      يتدلّى منها مجلّدٌ مُسنَد — وهو تعقيدٌ لا يظهر أثرُه إلا مع التعشيش.
--      إن كانت الشجرةُ مسطّحةً بالكامل فالبناءُ لحالةٍ لم تقع بعد، **وقولُ ذلك
--      أصدقُ من تركِه يُقرأ حلًّا لمشكلةٍ قائمة.**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ شاهدُ صدقٍ داخل الاستعلام (البند ١ج)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- «لا يوجد» و«لم أسأل» يتطابقان في المخرج الفارغ. فالقسمُ الأوّل يقرأ **كلّ**
-- أعمدة `product_categories` — لا عمودًا بعينه — و**كلّ** قيود `storages`، لا
-- المرشَّحة بنوعها. فإن ظهر `parent_id` و`is_active` (ونعرف أنهما هناك) فقد
-- أثبت الاستعلامُ أنه يرى الجدول، **وعندها غيابُ `storage_id` خبرٌ لا صمت.**
--
-- ⚠️ ولا تصفيةَ بـ`contype`. `contype='c'` سؤالٌ ضيّقٌ للكتالوج فوّت علينا نوعًا
-- مرّةً، و`join pg_class on oid = conrelid` أسقط قيدَ domain مرّةً أخرى — لأن
-- `conrelid = 0` عنده. تُقرأ الفئةُ كاملةً وتُصفّى بالعين.

-- ⚠️ كلُّ عمودٍ مُحوَّلٌ إلى `text` صراحةً، وهذا ليس تزيّدًا.
-- أعمدةُ `information_schema` أنواعُها مجالات (`sql_identifier`,
-- `character_data`) لا `text`، و`conname`/`relname` نوعُهما `name`. وحلُّ
-- الأنواع في `UNION` بين مجالٍ و`text` يفشل في بعض الإصدارات برسالة
-- «UNION types … cannot be matched» — **فيسقط الاستعلامُ كلُّه، ويكلّف جولةً
-- كاملة** لأن من يشغّله هو المالك وحده. التحويلُ الصريح يُلغي السؤال.
select
  'A. أعمدة product_categories كاملةً'::text as section,
  c.column_name::text                        as name,
  c.data_type::text                          as detail,
  c.is_nullable::text                        as extra_1,
  coalesce(c.domain_name::text, '—')         as extra_2,
  coalesce(c.column_default::text, '—')      as extra_3
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'product_categories'

union all

select
  'B. قيود storages كاملةً — بلا تصفية بالنوع'::text,
  con.conname::text,
  con.contype::text,
  pg_get_constraintdef(con.oid)::text,
  '—'::text,
  '—'::text
from pg_constraint con
where con.connamespace = 'public'::regnamespace
  and con.conrelid = 'public.storages'::regclass

union all

select
  'C. قيود product_categories كاملةً'::text,
  con.conname::text,
  con.contype::text,
  pg_get_constraintdef(con.oid)::text,
  '—'::text,
  '—'::text
from pg_constraint con
where con.connamespace = 'public'::regnamespace
  and con.conrelid = 'public.product_categories'::regclass

union all

select
  'D. فهارس storages — المفتاحُ الفريد قد يكون فهرسًا لا قيدًا'::text,
  i.relname::text,
  pg_get_indexdef(i.oid)::text,
  '—'::text, '—'::text, '—'::text
from pg_index x
join pg_class i on i.oid = x.indexrelid
where x.indrelid = 'public.storages'::regclass

union all

select
  'E. الأحجام'::text,
  'product_categories'::text,
  count(*)::text,
  count(*) filter (where pc.parent_id is not null)::text || ' منها مُعشَّش',
  '—'::text, '—'::text
from public.product_categories pc

union all

select
  'F. الأحجام'::text,
  'storages'::text,
  count(*)::text,
  count(*) filter (where s.is_active)::text || ' منها حيّ',
  '—'::text, '—'::text
from public.storages s

order by 1, 2;

-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ وما لا يُثبته هذا السكربت، مكتوبًا هنا كي لا يُقرأ أوسعَ مما هو
-- ═══════════════════════════════════════════════════════════════════════════
--
-- محرّرُ SQL يعمل بدور المالك و**RLS متجاوَزةٌ فيه بالكامل**. فالأعدادُ في
-- القسمين E و F هي أعدادُ الصفوف في القاعدة كلّها، لا ما يراه صالون. وهذا لا
-- يضرّ هنا — السؤالُ عن الشكل والحجم لا عن العزل — **لكنّ من يقرأ النتيجة
-- لاحقًا سيظنّها أثبتت الاثنين.**

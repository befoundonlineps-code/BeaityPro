-- ==========================================================================
-- 106b -- VERIFICATION ONLY. One SELECT, and it changes nothing.
--
-- ⚠️ **جملةٌ واحدة، لأن محرّرَ Supabase يعرض مجموعةَ النتائج الأخيرة وحدَها** —
-- ووقع الابتلاعُ مرّتين قبل هذا (٠٩٣ بأربع جمل، و٠٩٤ب بخمسة أقسام).
--
-- ⚠️ **ولا `::regclass` في أيّ موضع، وذلك مقصود:** التحويلُ يرفع
-- `42P01 relation does not exist` **لو لم يُنشأ الـview** — فيسقط التحقّقُ
-- كلُّه بخطأِ تحويلٍ بدل أن يقول `view_exists = 0`. ⇒ **والوصلُ على
-- `pg_class`/`pg_namespace` يجيب في الحالتين.**
--
-- ---------------------------------------------------------------------------
-- ما الذي يُقرأ، ولماذا كلٌّ منه
--
--   view_exists      هل وُجد أصلًا (لا `::regclass` — انظر أعلاه)
--   security_invoker 🔴 **الأهمّ.** غيابُها يعني أن الـview يعمل بصلاحيّة
--                    مالكه، **فيرى كلُّ صالونٍ غراماتِ كلّ صالون** — وفشلٌ
--                    صامتٌ تمامًا ما دام في القاعدة صالونٌ واحد
--   columns          سردُ الأعمدة كاملًا، **يُقرأ بالعين لا يُطابَق بعدد**:
--                    عددٌ متوقَّعٌ يمرّ على عمودٍ فُقد وآخرَ زِيد
--   arabic_comment   القراءةُ الراجعةُ للعربيّ المُودَع بـ106 — أُخِّرت إلى هنا
--                    لأن الحارسَ يمنع خلطَ DDL باستعلامٍ في ملفٍّ واحد
--   liveness_exists  🔴 **شاهدُ صدق:** الـview الجديد يقرأ من
--                    `stock_document_liveness`. **فلو غاب ذاك، لسقط الإنشاء
--                    أصلًا** — ووجودُه يقول إن ما نقرؤه له أساس
--
-- ⚠️ **وما لا يقيسه هذا الملفّ يُقال:** لا صفَّ في `stock_fines` اليوم (صفّرها
-- ٠٨٩)، **فالسلوكُ على بياناتٍ حقيقيّةٍ غيرُ مقيسٍ ولا يمكن قياسُه الآن.**
-- المقيسُ هنا **شكلُ الكائن وصلاحيّتُه ونصُّه**، لا نتيجتُه على صفّ.
-- ==========================================================================

select
  (select count(*)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_fine_voidness'
      and c.relkind = 'v')                                   as view_exists,

  (select coalesce(c.reloptions::text, '{}')
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_fine_voidness')                 as security_invoker,

  (select string_agg(a.attname, ' · ' order by a.attnum)
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_fine_voidness'
      and a.attnum > 0
      and not a.attisdropped)                                as columns,

  (select obj_description(c.oid, 'pg_class')
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_fine_voidness')                 as arabic_comment,

  (select count(*)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_document_liveness'
      and c.relkind = 'v')                                   as liveness_exists;

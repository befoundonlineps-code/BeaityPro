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
      and c.relkind = 'v')                                   as liveness_exists,

  -- 🔴 **الأربعةُ التالية أضافها المراجعُ بعد أن نفّذ الـview فعلًا** — صفٌّ في
  -- `stock_fines` بلا مقابلٍ في الحيويّة أعاد `is_void` عدمًا **بصمتٍ تامّ**.
  -- ⇒ **فما كان يُفترض في الترويسة صار يُقاس هنا.**

  -- ① العدُّ المباشر: صفرٌ اليوم بحكم الجدول الفارغ، **وحارسٌ حقيقيٌّ لحظةَ
  --   وجود أوّل صفّ.** `not exists` لا `join`، فلا تفرّعَ ولا عدٌّ مضاعف.
  (select count(*) from public.stock_fines f
    where not exists (
      select 1 from public.stock_document_liveness l
       where l.document_id = f.document_id and l.salon_id = f.salon_id
    ))                                                       as orphan_fines,

  -- ② تعريفُ الـview **من القاعدة لا من ملفّ ٠٧٩أ** — الشرط (أ): إسقاطٌ كامل
  --   بلا `where` يستثني مستندًا. **يُقرأ بالعين، ولا يُطابَق بنصٍّ متوقَّع.**
  (select pg_get_viewdef(c.oid, true)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_document_liveness')             as liveness_definition,

  -- ③ قيودُ `stock_fines` **كلُّها بلا تصفيةٍ بالنوع** — قاعدةُ «اقرأ الفئة
  --   كلَّها ثمّ صفِّ بعينك»، و`contype = 'f'` وحدَه أخفى نوعًا مرّةً من قبل.
  --   🔴 **والمطلوبُ رؤيتُه: هل `stock_fines_document_id_fkey` مركّبٌ على
  --   `(document_id, salon_id)`؟** مركّبٌ ⟶ ٠٦٠أ شُغّل والشرط (ب) قائم.
  --   بسيطٌ على `document_id` وحدَه ⟶ **لم يُشغَّل، واليتيمُ ممكن.**
  (select string_agg(con.conname || ': ' || pg_get_constraintdef(con.oid), '  |  '
                     order by con.conname)
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'stock_fines')  as fines_constraints,

  -- ④ وأعمدةُ `stock_fines` نفسِها — **لأن قائمةَ الأحدَ عشرَ في ١٠٦ كُتبت من
  --   قراءة ملفّ ٠٥٦أ لا من الكتالوج**، وهو عينُ «اسأل الكتالوج لا الذاكرة».
  --   ⚠️ **والـview لا ينكسر بعمودٍ فاته** — يصمت عنه، وهو الأسوأ.
  (select string_agg(a.attname, ' · ' order by a.attnum)
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'stock_fines'
      and a.attnum > 0 and not a.attisdropped)               as fines_columns;

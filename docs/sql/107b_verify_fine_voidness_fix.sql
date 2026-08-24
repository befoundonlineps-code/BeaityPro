-- ==========================================================================
-- 107b -- VERIFICATION ONLY. One SELECT, and it changes nothing.
--
-- ⚠️ **جملةٌ واحدة، لأن محرّرَ Supabase يعرض مجموعةَ النتائج الأخيرة وحدَها** —
-- ووقع الابتلاعُ مرّتين قبل هذا (٠٩٣ بأربع جمل، و٠٩٤ب بخمسة أقسام).
--
-- ⚠️ **ولا `::regclass` في أيّ موضع** — التحويلُ يرفع `42P01` لو غاب الكائن،
-- فيسقط التحقّقُ كلُّه بدل أن يقول `view_exists = 0`.
--
-- ⚠️ **وكتالوجٌ خالصٌ لا يقرأ صفًّا واحدًا من `stock_fines` ولا من الحيويّة** —
-- **وذلك مقصودٌ بعد حادثة ١٠٦ب:** عمودٌ واحدٌ يقرأ جدولًا حقيقيًّا أسقط ملفَّ
-- التحقّق كلَّه بـ`42P01` ومنع طبعَ الشاهد. ⇒ **فحصُ البيانات في ملفٍّ آخر.**
--
-- ---------------------------------------------------------------------------
-- 🔴 والعمودُ الحاسمُ هو `voidness_definition` — يُقرأ بالعين لا يُطابَق بنصّ
--
-- **المطلوبُ رؤيتُه فيه بالضبط:**
--
--   ✅ `(SELECT l.reversed_by_document_id IS NOT NULL FROM …) AS is_void`
--      ⟵ الشرطُ **داخل قائمة `select` الفرعيّة** — فـ«لا صفّ» يبقى عدمًا
--
--   ✗ `NOT (SELECT l.is_live FROM …)`             ⟵ ١٠٦ لم يُستبدل
--   ✗ `(SELECT l.reversed_by_document_id FROM …) IS NOT NULL`
--      ⟵ 🔴 **الشرطُ خرج من القوس** ⇒ الغرامةُ اليتيمةُ تُقرأ `false` بصمت.
--        **والفرقُ حرفان في الموضع، ولا يظهر في سرد الأعمدة ولا في نوعها.**
--
-- ⚠️ **و`pg_get_viewdef` يعيد صياغةَ ما كُتب** (يرفع الأسماءَ إلى حروفٍ كبيرة
-- ويضيف أقواسًا)، **فلا يُقارن نصًّا بنصّ** — يُقرأ ويُسأل: أين وقع `IS NOT NULL`؟
--
-- ---------------------------------------------------------------------------
-- ⚠️ وما لا يقيسه هذا الملفّ يُقال: السلوكَ على صفّ.
--
-- `stock_fines` فارغٌ (صفّره ٠٨٩)، **فلا صفَّ هنا يُقاس عليه شيء.** والحالاتُ
-- الستُّ في **`107c`، ولا تُشغَّل على قاعدة الإنتاج** — انظر ترويستَه.
-- ⇒ **وترتيبُ التشغيل عند المالك: `107` ثمّ `107b`. لا ثالثَ.**
-- ==========================================================================

select
  (select count(*)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_fine_voidness'
      and c.relkind = 'v')                                   as view_exists,

  -- 🔴 **الأهمّ بعد التعريف.** `create or replace view` يعيد كتابة الكائن
  -- كاملًا، **وخاصّيّةٌ لا تُذكر معرَّضة** — وضياعُها يعني أن كلَّ صالونٍ يرى
  -- غراماتِ كلّ صالون، **وفشلٌ صامتٌ تمامًا ما دام في القاعدة صالونٌ واحد.**
  (select coalesce(c.reloptions::text, '{}')
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_fine_voidness')                 as security_invoker,

  -- ⚠️ **الأعمدةُ بترتيبها** — التبديلُ في مكانه يوجب بقاءَ الاسم والنوع
  -- والترتيب. **يُقرأ بالعين ولا يُطابَق بعدد:** عددٌ متوقَّعٌ يمرّ على عمودٍ
  -- فُقد وآخرَ زِيد.
  (select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod),
                     ' · ' order by a.attnum)
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_fine_voidness'
      and a.attnum > 0
      and not a.attisdropped)                                as columns,

  -- 🔴 **التعريفُ المشحونُ نفسُه — وهو سببُ وجود هذا الملفّ.** انظر الترويسة.
  (select pg_get_viewdef(c.oid, true)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_fine_voidness')                 as voidness_definition,

  -- والقراءةُ الراجعةُ للعربيّ الذي أودعه ١٠٧ — قاعدةُ `CLAUDE.md`: أيُّ سكربتٍ
  -- يودع نصًّا عربيًّا يحمل `select` يقرأه راجعًا. **والمطلوبُ رؤيتُه: أن النصَّ
  -- يذكر الغلطَ ويقتبس تعليقَ ٠٧٩أ الإنجليزيّ**، لا أن يصمت عنه.
  (select obj_description(c.oid, 'pg_class')
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_fine_voidness')                 as arabic_comment,

  -- ⚠️ **وتعريفُ الحيويّة معه، لأنه المصدرُ الذي أُخطئ في قراءته.** المطلوبُ
  -- رؤيتُه: `(d.reverses_document_id IS NULL AND r.id IS NULL)` — **النصفان.**
  -- ⇒ **فيُقرأ التعريفان متجاورين، ويُرى بالعين أن الثاني لا ينفي الأوّل.**
  (select pg_get_viewdef(c.oid, true)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'stock_document_liveness')             as liveness_definition;

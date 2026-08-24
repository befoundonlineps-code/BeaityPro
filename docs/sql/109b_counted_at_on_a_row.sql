-- ==========================================================================
-- 109b -- CASES. Builds rows, measures them, and rolls every one of them back.
--
-- 🔴 **ليس في ترتيب تشغيل المالك.** يُنفَّذ عند المراجع أوّلًا، ثمّ يُرسَل —
-- **ولا يصل بشّار ملفٌّ لم يُترجَم قطّ.**
--
-- 🔴 **والترتيبُ شرطٌ لا تفضيل: `109` أوّلًا، ولا يُقرأ هذا قبل أن يؤكّد سردُه
-- الأوصافَ الأربعة** التي بُني عليها:
--
--     تسعةُ أعمدةٍ ولا `updated_at`              ⟵ وإلّا فـ`counted_at` ليس الختمَ الوحيد
--     `counted_at NOT NULL DEFAULT now()`       ⟵ وإلّا فالسؤالُ نفسُه يتغيّر
--     `unique (session_id, product_id)`         ⟵ وإلّا فلا `DO UPDATE` أصلًا
--     `started_by` يقبل العدم                    ⟵ وإلّا سقط بناءُ الجلسة أدناه
--
-- ⚠️ **وسببُ الشرط أنّ نسخةَ المراجعة تُبنى من وصفٍ، والوصفُ ليس كتالوجًا** —
-- **فـ`109` هو ما يقفل الفجوةَ بين ما وُصف وما هو قائم**، ونتيجةُ `109b` على
-- مخطّطٍ يخالف الأربعةَ تقيس شيئًا آخر بلا أن تقول.
--
-- ✅ **ولا يترك أثرًا حتى لو شُغّل على قاعدةٍ حقيقيّةٍ بالخطأ**، بنيويًّا لا
-- تحذيرًا: الإدراجاتُ داخل كتلةٍ فرعيّةٍ تنتهي بـ`raise exception`، **فتُلغى
-- كلُّها عند التقاط الاستثناء.** والناجي متغيّرُ PL/pgSQL وحدَه، و`set_config`
-- **بعد** الكتلة — قاعدةُ `CLAUDE.md` البند ١ب.
--
-- ---------------------------------------------------------------------------
-- 🔴 السؤال: هل يبقى ختمُ العدّ الأوّل على قيمة العدّ الثاني؟
--
-- `saveCount` تكتب `upsert` على `(session_id, product_id)` **بلا `counted_at`**
-- في الحمولة. **والافتراضُ لا يعمل إلّا عند الإدراج** ⇒ **فالمتوقَّع أن يتغيّر
-- الرقمُ ويبقى الختم.** ⚠️ **وهذا استنتاجٌ من قراءتين — المخطّط والحمولة — ولم
-- يُقَس على صفٍّ قطّ.** وهذا الملفُّ يقيسه.
--
-- ---------------------------------------------------------------------------
-- 🔴 و`now()` لا تصلح للقياس هنا، وذلك ليس تفصيلًا — بها يصير الفحصُ عاجزًا
--
-- **`now()` ثابتةٌ طوال المعاملة الواحدة.** ⇒ **فإدراجٌ ثمّ تحديثٌ في نفس الكتلة
-- يعطيان نفسَ الطابع الزمنيّ سواءٌ أُعيد تطبيقُ الافتراضِ أم لا** — **ويُقرأ
-- التطابقُ إثباتًا وهو صمت.** وهو عينُ «فحصٌ يعطي نفسَ الجواب بالحالتين».
--
-- ✅ **فالختمُ الأوّلُ يُكتب صراحةً بيومين مضيا** (`now() - interval '2 days'`)،
-- **ولا يُترك للافتراض.** ⇒ **فإن بقي بعد التحديث فهو ختمُ الأوّل قطعًا، وإن
-- صار اليومَ فالافتراضُ أُعيد تطبيقُه** — **وجوابان لا يلتبسان.**
--
-- 🔴 **والنسخةُ الساذجةُ بُنيت وقِيست، فسقطت — والرقمُ هو الحجّة:** ختمٌ أوّلٌ
-- بالافتراض، ثمّ `upsert` **يكتب `counted_at = now()` صراحةً** — أي **يُعيد
-- كتابةَ العمود قطعًا** — فأعطى:
--
--     moved = false     ⟵ **على عمودٍ أُعيدت كتابتُه للتوّ**
--
-- ⇒ **فهي لا تميّز «لم يُكتب» من «كُتب بنفس القيمة»** — **جوابٌ واحدٌ لحالتين،
-- فلا تفصل.** وهو البند ① حرفيًّا: قياسٌ على نوعٍ واحدٍ يُثبت الإمساكَ لا الفصل.
-- ✅ **وأُمسك في التصميم قبل الكتابة لا بعد الوقوع** — والنقيضُ بُني ليُقاس.
--
-- ⚠️ **وشكلُ التحديث منسوخٌ من سلوك PostgREST لا مخترَع:** `upsert` بحمولةٍ من
-- ستّة حقول تُترجَم إلى `on conflict … do update set` **لتلك الحقول وحدَها** —
-- فالجملةُ أدناه تحدّث `counted_base` ولا تذكر `counted_at`. **وهذا هو الادّعاء
-- المقيس؛ ولو غيّرت المكتبةُ سلوكَها يومًا لصار هذا الملفُّ يقيس شيئًا آخر.**
--
-- ---------------------------------------------------------------------------
-- الحالتان، وما يُتوقَّع
--
--   A  إدراجٌ بختمٍ عمرُه يومان، ثمّ `do update set counted_base` وحدَه
--      ⟶ 🔴 **المتوقَّع: `base` تغيّر و`stamp` لم يتغيّر** — أي العطلُ مؤكَّد
--      ⟶ ✅ **والنقيض:** لو تغيّر الختمُ فالدعوى ساقطةٌ والبندُ يُشطب
--
--   B  إدراجٌ بختمٍ عمرُه يومان، ثمّ `do update` **يذكر `counted_at` صراحةً**
--      ⟶ ✅ **المتوقَّع: الاثنان يتغيّران** — **وهو شاهدُ الصدق:** يُثبت أنّ
--        الكتلةَ **تقدر** أن تحرّك الختم، **فسكونُه في A سلوكٌ لا عجزُ قياس.**
--      ⚠️ **وبلا B يتطابق «الختمُ لا يتحرّك» و«قياسي لا يحرّك شيئًا».**
--
-- ⚠️ **والقيمُ الخامّةُ تُطبع كلُّها بجانب الحكم** — البند ③.
-- ==========================================================================

do $$
declare
  v_log     text := '';
  v_phase   text := 'بدء';
  v_salon   uuid;
  v_storage uuid;
  v_product uuid;
  v_sess    uuid;
  v_old     timestamptz;
  v_new     timestamptz;
  v_base    numeric;
begin
  begin
    -- ⚠️ صفوفٌ حقيقيّةٌ تُؤخذ كما هي، ولا مطابقةَ بالاسم (البند ٤).
    v_phase := 'اختيارُ مستودعٍ ومنتج';
    select st.salon_id, st.id into v_salon, v_storage
      from public.storages st order by st.id limit 1;
    select p.id into v_product
      from public.products p where p.salon_id = v_salon order by p.id limit 1;

    if v_salon is null or v_product is null then
      v_log := '💥 لا مستودعَ أو لا منتجَ في القاعدة — لا يمكن بناءُ الحالتين';
      raise exception 'ROLLBACK_MARKER';
    end if;

    v_phase := 'فتحُ جلسة';
    -- `started_by` يُترك عدمًا عمدًا: افتراضُه `auth.uid()` وهي فارغةٌ في
    -- المحرّر، والعمودُ يقبل العدم — فلا يزاحم هذا القياسَ بسؤالٍ آخر.
    insert into public.stocktake_sessions (salon_id, storage_id, started_by)
    values (v_salon, v_storage, null) returning id into v_sess;

    -- ── A: تحديثٌ لا يذكر counted_at ──────────────────────────────────────
    v_phase := 'A — إدراجٌ بختمٍ عمرُه يومان';
    insert into public.stocktake_counts
      (salon_id, session_id, product_id, counted_base, counted_at)
    values (v_salon, v_sess, v_product, 3, now() - interval '2 days');

    select counted_at into v_old
      from public.stocktake_counts
     where session_id = v_sess and product_id = v_product;

    v_phase := 'A — upsert بلا counted_at';
    insert into public.stocktake_counts
      (salon_id, session_id, product_id, counted_base)
    values (v_salon, v_sess, v_product, 75)
    on conflict (session_id, product_id)
      do update set counted_base = excluded.counted_base;

    select counted_at, counted_base into v_new, v_base
      from public.stocktake_counts
     where session_id = v_sess and product_id = v_product;

    v_log := v_log
      || 'A: base 3 ⟶ ' || v_base
      || ' | stamp ' || to_char(v_old, 'YYYY-MM-DD HH24:MI')
      || ' ⟶ ' || to_char(v_new, 'YYYY-MM-DD HH24:MI')
      || ' | moved=' || (v_new <> v_old)::text || '  (expect false)' || E'\n';

    -- ── B: تحديثٌ يذكر counted_at — شاهدُ الصدق ───────────────────────────
    v_phase := 'B — upsert يذكر counted_at';
    insert into public.stocktake_counts
      (salon_id, session_id, product_id, counted_base)
    values (v_salon, v_sess, v_product, 90)
    on conflict (session_id, product_id)
      do update set counted_base = excluded.counted_base,
                    counted_at   = now();

    select counted_at, counted_base into v_new, v_base
      from public.stocktake_counts
     where session_id = v_sess and product_id = v_product;

    v_log := v_log
      || 'B: base ⟶ ' || v_base
      || ' | stamp ⟶ ' || to_char(v_new, 'YYYY-MM-DD HH24:MI')
      || ' | moved=' || (v_new <> v_old)::text || '  (expect true)' || E'\n';

    raise exception 'ROLLBACK_MARKER';
  exception when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then
      -- 🔴 الطورُ يسبق الرمز — فيُقرأ «أين سقط» قبل «بماذا سقط».
      v_log := v_log || '💥 سقط في الطور [' || v_phase || '] — '
                     || sqlstate || ' — ' || sqlerrm;
    end if;
  end;

  -- ⚠️ بعد الكتلة لا داخلها: تراجعُ المعاملة الفرعيّة يمحو `set_config`.
  perform set_config('probe.result', v_log, false);
end $$;

-- 🔴 `, true` وليس بلا معامل: لو سقطت الكتلةُ **الخارجيّة** لَما ضُبط المعامل،
-- ورفعت الصيغةُ المفردة `unrecognized configuration parameter` **فوق** الخطأ
-- الحقيقيّ. **خطأُ الكتلة يجب أن يُقرأ، لا أن يُغطَّى بخطأِ قراءةِ نتيجتها.**
select current_setting('probe.result', true) as counted_at_on_a_row;

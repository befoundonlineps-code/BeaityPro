-- ==========================================================================
-- 109 -- VERIFICATION ONLY. One SELECT, and it changes nothing.
--
-- ⚠️ **جملةٌ واحدة، لأن محرّرَ Supabase يعرض مجموعةَ النتائج الأخيرة وحدَها.**
--
-- 🔴 **وكتالوجٌ خالصٌ لا يقرأ صفًّا واحدًا — وذلك فصلٌ بالنوع لا حذرٌ عامّ.**
-- فحصُ السلوك على صفّ في `109b` منفصلًا، **لأن قراءةَ جدولٍ حقيقيٍّ تُسقط الملفَّ
-- كلَّه بـ`42P01` إن غاب** وتمنع طبعَ الشاهد الذي يقول «هذا هو السبب» — وهي
-- حادثةُ ١٠٦ب/١٠٦ج بعينها. **والكتالوجيُّ أوّلًا، فجوابُه قد يُغني.**
--
-- ---------------------------------------------------------------------------
-- 🔴 لماذا يُسأل هذا أصلًا — ودعوى تُقاس لا تُصدَّق
--
-- **مقروءٌ من المستودع، لا مقيسًا من القاعدة:** `saveCount`
-- ([lib/stocktakeSessionIO.js](../../lib/stocktakeSessionIO.js):108-122) تكتب
-- **بـ`upsert` على `(session_id, product_id)`**، وحمولتُها ستّةُ حقولٍ **ليس
-- فيها `counted_at`**:
--
--     session_id · salon_id · product_id · counted_base ·
--     counted_entered_quantity · counted_entered_uom
--
-- ⇒ **والافتراضُ لا يعمل إلّا عند الإدراج** — فعدُّ منتجٍ مرّةً ثانية **يستبدل
-- الرقمَ ويُبقي ختمَ الأوّل.** ⚠️ **والصفُّ عندها يقول «٧٥» بختمِ لحظةِ «٣».**
--
-- 🔴 **ووزنُ هذا أثقلُ من عمودٍ غيرِ دقيق:** `stocktake_counts` **تسعةُ أعمدةٍ
-- ولا `updated_at` فيها** ⇒ **فـ`counted_at` هو الختمُ الزمنيُّ الوحيدُ
-- للجدول**، **وكذبُه ليس عمودًا يكذب بل السجلَّ الزمنيَّ كلَّه.**
-- ⚠️ **كانت مقروءةً من `054a`، وصارت مقيسةً (٢٤ آب ٢٠٢٦):** شغّل المالكُ هذا
-- الملفَّ فأعاد **`updated_at_anywhere = 0`** والسردَين غيرَ فارغين ⇒ **فالصفرُ
-- خبرٌ لا صمت.** **ووسمٌ يرفع الدعوى درجةً يحمل تاريخَه؛ ولا يُخفَّض إلى
-- «مقروء» بعد أن قِيس.**
-- ⚠️ **و`counted_at` تُقرأ فعلًا** — `fetchOpen` و`fetchCoverage` كلتاهما
-- تختارها، **فليست عمودًا نائمًا.**
--
-- ---------------------------------------------------------------------------
-- ما يُقرأ، ولماذا كلٌّ منه
--
--   counts_columns    **الأعمدةُ بأنواعها و`NOT NULL` و‏افتراضيّاتها.**
--                     🔴 **والافتراضيُّ يُقرأ بـ`pg_get_expr(adbin, adrelid)`** —
--                     **و١٠٦ب قرأ `attnotnull` ولم يقرأها، وتلك بقعتُه العمياء**
--                     التي وقع فيها عطلُ `attribution` (`23502`).
--                     **والمطلوبُ رؤيتُه: `counted_at … NOT NULL DEFAULT now()`،
--                     وألّا يكون في السرد `updated_at` ولا ما يشبهه.**
--   sessions_columns  **ومعها أعمدةُ الجلسة** — ⚠️ **ولأنّ الفئةَ تُقرأ كلُّها
--                     ثمّ تُصفّى بالعين** (البند ٤ب)، لا لأنّ فيها سؤالًا بعينه.
--                     🔴 **ويُتوقَّع أن يظهر `started_by … DEFAULT auth.uid()`**
--                     — **وهي أختُ `stock_documents.created_by` حرفًا**، وتعني
--                     أن كلَّ جلسةٍ تُفتح من محرّر SQL تحمل عدمًا.
--   counts_constraints **قيودُ الجدول كلُّها بلا تصفيةٍ بالنوع.** والمطلوبُ
--                     رؤيتُه: `stocktake_counts_one_per_product unique
--                     (session_id, product_id)` — **وهو ما يجعل العدَّ الثاني
--                     يستبدل الأوّلَ بدل أن يتراكم**، أي شرطُ الحالة المقيسة
--                     في `109b`. ⚠️ **و`contype::text` لو أُضيف يومًا** — نوعُه
--                     `"char"` وتسلسلُه نصًّا يرفع `operator is not unique`.
--   updated_at_anywhere **وسؤالٌ صريحٌ عن العمود بعينه في الجدولين** — فلا
--                     يُستدلّ على غيابه من سردٍ يُقرأ بالعين. **المتوقَّع: 0.**
--                     🔴 **وهذا شاهدُ الصدق مقلوبًا:** `counts_columns` أعلاه
--                     يجب أن يعود غيرَ فارغ — **فلو عاد الاثنان فارغَين لكان
--                     الاستعلامُ لا يرى الجدولَ أصلًا، و«لا عمود» و«لم أسأل»
--                     يتطابقان.**
--
-- ⚠️ **وما لا يقيسه هذا الملفّ يُقال:** لا يقيس السلوك. **يقول ما يسمح به
-- المخطّط، لا ما يفعله `DO UPDATE` بصفّ** — وذاك `109b`.
-- ==========================================================================

select
  (select string_agg(
            a.attname
              || ' ' || format_type(a.atttypid, a.atttypmod)
              || case when a.attnotnull then ' NOT NULL' else '' end
              || coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), ''),
            E'\n' order by a.attnum)
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
     left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relname = 'stocktake_counts'
      and a.attnum > 0 and not a.attisdropped)              as counts_columns,

  (select string_agg(
            a.attname
              || ' ' || format_type(a.atttypid, a.atttypmod)
              || case when a.attnotnull then ' NOT NULL' else '' end
              || coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), ''),
            E'\n' order by a.attnum)
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
     left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relname = 'stocktake_sessions'
      and a.attnum > 0 and not a.attisdropped)              as sessions_columns,

  (select string_agg(con.conname || ': ' || pg_get_constraintdef(con.oid),
                     E'\n' order by con.conname)
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'stocktake_counts')
                                                            as counts_constraints,

  -- المتوقَّع 0 — والعمودان أعلاه غيرُ فارغين هما ما يجعل هذا الصفرَ خبرًا.
  (select count(*)
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('stocktake_counts', 'stocktake_sessions')
      and a.attnum > 0 and not a.attisdropped
      and a.attname = 'updated_at')                         as updated_at_anywhere;

-- ═══════════════════════════════════════════════════════════════════════════
-- فحصٌ للقراءة فقط — هل نجا النصّ العربيّ المُودَع بالقاعدة؟
--
-- ⚠️ لا يكتب شيئًا إطلاقًا: خمس `select` ولا غير. آمنٌ بأي وقت وبأي عدد مرات.
--
-- ⚠️ **سببه ما ذكرتَه عن سكربت ٠٤٧: «مشكلة التشفير التي صارت مع سكربت ٤٣».**
--    وسكربت ٤٣ لم يودع تعليقاتٍ فحسب — أودع **أربع دوالّ فيها ثمانية عشر
--    `using hint = '…'` بالعربية**. وهذه ليست شروحًا للقارئ: هي **الدرجة
--    الثانية بسلّم رسائل الخطأ عندنا** (مفتاح مسمّى ← `hint` ← الجملة العامة)،
--    وتصل شاشة المستخدم كما هي.
--
--    **فإن تشوّهت، يرى المستخدم رموزًا مشوّشة بأسوأ لحظة** — ولا اختبار عندنا
--    يمسكها، لأن اختباراتنا تقرأ المستودع لا القاعدة.
--
-- ✅ ونعرف أن العربية تنجو **بجملة `comment on column`** — قرأتَها بنفسك بعد
--    ٠٤٦ وطابقت حرفًا بحرف. **والمجهول هو العربية داخل `$function$`**، وهي
--    المسار الذي مرّ به ٤٣.
-- ═══════════════════════════════════════════════════════════════════════════


-- ١. كل `hint` عربيّ بالدوالّ الأربع، ومعه حكمٌ آليّ لا بالعين.
--
--    `looks_arabic` يفحص وجود حرفٍ واحد بمدى الحروف العربية. **المتوقَّع:
--    ثمانية عشر صفًّا، كلّها `true`** — والرقم ١٨ مقيسٌ من نصّ السكربتات لا
--    مقدَّر. وأي `false` يعني نصًّا تشوّه.
--
--    ⚠️ ويُقرأ عمود `hint` بالعين أيضًا بعد الرقم: `true` تقول إن فيه حروفًا
--    عربية، ولا تقول إن الجملة سليمة.
--
-- ✅⚠️ **والنتيجة تشخيصية لا ثنائية، وهذا أنفع ما فيها:** الـ١٨ لم تُودَع
--    بتشغيلٍ واحد. ستّةٌ منها بـ`post_stock_document` وقد **أُعيد إيداعها
--    بسكربت ٠٤٧** (الذي شغّلتَه بتعليقات إنجليزية)، والاثنتا عشرة الباقية
--    بالدوالّ الثلاث الأخرى **ما زالت من تشغيل ٠٤٣**. فالقسمة تقول أيّ تشغيلٍ
--    تأثّر:
--
--      ١٨ سليمة              ⇒ لا مشكلة إطلاقًا، والتحفّظ كان زائدًا
--      ٦ سليمة و١٢ مشوّهة    ⇒ المشكلة بتشغيل ٤٣ وحده، والثلاث تُعاد
--      ١٨ مشوّهة             ⇒ المسار كلّه، ولا يُعاد شيء قبل حسم السبب
select p.proname,
       m[1] as hint,
       m[1] ~ '[ء-ي]' as looks_arabic
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral regexp_matches(p.prosrc, 'using hint = ''([^'']+)''', 'g') as m
where n.nspname = 'public'
  and p.proname in ('post_stock_document', 'post_stocktake',
                    'transfer_stock', 'reverse_stock_document')
order by p.proname;

-- ٢. وعدّها مجموعًا، ليُقارَن برقمٍ نعرفه. **المتوقَّع: ١٨ إجمالًا، وصفر
--    مشوّهة.**
select count(*) as total_hints,
       count(*) filter (where m[1] !~ '[ء-ي]') as broken_hints
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral regexp_matches(p.prosrc, 'using hint = ''([^'']+)''', 'g') as m
where n.nspname = 'public'
  and p.proname in ('post_stock_document', 'post_stocktake',
                    'transfer_stock', 'reverse_stock_document');

-- ٣. والتعليقات العربية على الأعمدة — الطريق الذي نعرف أنه نجا، يُثبَّت.
--    **المتوقَّع: صفّان، كلاهما `true`.**
select a.attname,
       col_description(a.attrelid, a.attnum) as comment,
       col_description(a.attrelid, a.attnum) ~ '[ء-ي]' as looks_arabic
from pg_attribute a
where a.attrelid = 'public.stock_movements'::regclass
  and a.attname in ('cost_is_estimated')
union all
select a.attname,
       col_description(a.attrelid, a.attnum),
       col_description(a.attrelid, a.attnum) ~ '[ء-ي]'
from pg_attribute a
where a.attrelid = 'public.stock_documents'::regclass
  and a.attname in ('supplier_doc_number');

-- ٤. وترميز القاعدة نفسه، للسجلّ. **المتوقَّع: UTF8.**
select pg_encoding_to_char(encoding) as database_encoding,
       datcollate, datctype
from pg_database
where datname = current_database();

-- ٥. ⚠️ والمشغّلان القديمان — نصّهما العربيّ سبق هذه الجلسة كلها، فهو خطّ
--    الأساس: إن كانا سليمين وحدهما فالمشكلة بما أودعناه نحن، وإن تشوّها معًا
--    فهي أقدم منّا. **المتوقَّع: نصٌّ عربيّ سليم بالاثنين.**
select p.proname,
       m[1] as hint,
       m[1] ~ '[ء-ي]' as looks_arabic
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral regexp_matches(p.prosrc, 'using hint = ''([^'']+)''', 'g') as m
where n.nspname = 'public'
  -- ⚠️ الأقواس ليست تزيينًا: بلاها يصير الشرط `(A and B) or C` بحكم الأسبقية،
  -- فيطابق دوالّ خارج المخطّط كلّه.
  and (p.prosrc like '%storage_not_empty%' or p.prosrc like '%consignment_locked%')
order by p.proname;

-- ═══════════════════════════════════════════════════════════════════════════
-- البند ٤٣ (الدرجة الرابعة بسلسلة التكلفة) + البند ٣٤ (عمود «مُقدَّرة»)
--
-- ⚠️ مُجهَّز ومعروض ولا يُشغَّل من طرفي — المالك ينفّذه بمحرّر SQL.
--
-- ⚠️ **ولا `RAISE EXCEPTION` يُنفَّذه هذا السكربت** — والصياغة مقصودة: فيه
--    ثمانية عشر `raise` **داخل نصوص الدوالّ**، وهي حروفٌ بين علامتَي
--    `$function$` لا جملٌ تُنفَّذ، ولا تنطلق إلا يوم تُستدعى الدالّة.
--    (وكانت هذه السطور تقول «ولا `RAISE EXCEPTION` بهذا الملف إطلاقًا» —
--    صحيحةً يوم كُتبت وكاذبةً بعد أن دخلت أربع دوالّ.)
--
--    والقاعدة نفسها قائمة: فيه DDL دائم، واستثناءٌ **يُنفَّذ** يُسقط المعاملة
--    كاملة **وبضمنها الـDDL فوقه** — فيبقى القديم حيًّا والفحص يقول «نجح».
--    فالتحقّق كله بـ`select` عادي بالآخر، ولا كتلة استثناء بأي موضع.
--
-- ⚠️ **ويُشغَّل كاملًا بدفعة واحدة، لا مقطّعًا.** الأجزاء كلها معاملة ضمنية
--    واحدة، فإمّا أن تصل كلها أو لا يصل شيء. **ولو شُغّل مقطّعًا فالجزء ١
--    أوّلًا وإلزامًا**: أجسام PL/pgSQL لا تُحلَّل عند الإنشاء، فدالّةٌ تُدرج
--    `cost_is_estimated` **تُنشَأ بنجاح** والعمود غير موجود، ثم **تفشل أول
--    استدعاء حقيقي** — بعد أن يكون كل شيء قد أُودع.
--
-- ✅ **أخفق بالمنتصف؟ شغّله كاملًا مرّةً أخرى — لا شيء فيه ذو اتّجاهٍ واحد.**
--    قُرئت جملُه واحدةً واحدة: `add column if not exists` · `comment on` ·
--    `create or replace view` · أربع `create or replace function` · وعشر
--    `select`. كلّها معادة التنفيذ بلا أثر، ولا واحدة تفشل بالتشغيل الثاني.
--    **والحالة النصفية التي تستحقّ التسمية:** العمود والـview و`post_stocktake`
--    وصلت و`post_stock_document` لا ⇒ **الشطب والإرجاع يكتبان `false`
--    افتراضيًّا حيث يجب `true`** — بلا خطأ وبلا سطرٍ يشتكي.
--
-- ⚠️ **ولا `do` بهذا الملف ولا جدول مؤقّت.** كان فيه مسبارٌ يقيس سلوك
--    `select … into`، ونُقل إلى سكربتٍ مستقلّ **يُشغَّل قبله**: هو الجملة
--    الوحيدة التي كانت تستطيع إسقاط المعاملة لسببٍ لا علاقة له بالتغيير،
--    **وهو أيضًا الوحيد الذي لا يحتاج من هذا السكربت شيئًا** — يقرأ
--    `stock_movements` كما هي. **والفحص الذي يملك حقّ النقض لا يقع بعد
--    التنفيذ.**
--
-- الحالة: ✅ **كامل — أربع دوالّ ونصوصها، ولا شيء ينتظر.**
--          الجزء ١ العمود والـview · ٢ `post_stocktake` · ٣أ
--          `post_stock_document` · ٣ب `transfer_stock` · ٣ج
--          `reverse_stock_document`.
--
-- والأربع `SECURITY INVOKER` وبلا `search_path` — فلا تحصين يُسقطه الاستبدال،
-- **وهذا مقروءٌ من نصوصها لا مفترَض.**
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- الجزء ١ — العمود والview
-- ───────────────────────────────────────────────────────────────────────────

-- عمودٌ يقول إن الرقم تقديرٌ لا ثمنٌ مدفوع.
--
-- ⚠️ ليش عمود جنبه ولا `unit_cost nullable`: `sum()` يتخطّى العدم ولا يبطل
-- فيه، فحركة بتكلفة NULL تخرج من البسط وتبقى بالمقام والمتوسّط ينخفض بصمت —
-- تسميم بأنظف صوره، وأخفى من الصفر لأن الصفر يُرى بالسطر والانخفاض لا يُرى.
--
-- ⚠️⚠️ **و`default false` يكتب على التاريخ جملةً لم يقرأها أحد.**
--
-- كان مكتوبًا هنا: «الحركات القائمة كلها غير مقدَّرة **بحكم التعريف** —
-- أسعارها كُتبت بيد إنسان أو حُسبت من متوسّط حقيقي». **وهذا ليس تعريفًا، هو
-- ادّعاءٌ عن ثمانية صفوف** — والقاعدة لا تعرف كيف نشأ أيٌّ منها، لأن العمود
-- الذي كان سيعرف يُضاف بهذه الجملة نفسها.
--
-- **وبجدول المالك اليوم ما قد ينقضه:** التحويل بـ`unit_cost = 0` (نصف
-- الـ`+75`). إن كان مصدره وقتها برصيدٍ غير موجب فالدرجة ٢ أعطته الصفر — أي
-- أنه **مقدَّرٌ بالتعريف الجديد**، وسيُختم «غير مقدَّر» إلى الأبد. **فأوّل ما
-- تعرضه الشاشة الجديدة: «٧٥ قطعة، قيمتها صفر، ونحن واثقون»** — وهي بعينها
-- الثقة الكاذبة التي بُني العمود لمنعها.
--
-- ⚠️ **والفحص ٤ عاجزٌ عن كشفها بنيويًّا** — انظر تعليقه بالتحقّق أدناه.
--
-- ✅ **فالترتيب: تُقرأ الصفوف الثمانية أوّلًا** (الفحص ٤ أدناه، سرد لا عدّاد)،
--    ثم:
--    • صادقةٌ كلها  ⇒ `default false` يبقى، **وهذا التعليق يُستبدل بجملةٍ
--      تقول «قُرِئت الثمانية بتاريخ كذا وكانت كلها كذلك»** — لا «بحكم التعريف».
--    • فيها ما يكذّبها ⇒ `update` واحد بعد هذه الجملة يضع `true` على
--      المعلومات **بالاسم**. ثمانية صفوف وبيانات تجربة: الكلفة صفرٌ اليوم،
--      وغير قابلة للاستدراك بعد شهر.
--
-- ⚠️⚠️ **وعكسُ التحويل (السكربت ٠٤٤) لا يُغلق هذا السؤال — يُخفّفه فقط.**
--    بعد العكس تتقابل حركات التحويل الأربع فيعود المستودعان إلى صفر، **فلا
--    أثر لها على رصيدٍ ولا على متوسّطٍ ولا على شارة.** أي أن الادّعاء يصير
--    **بلا عاقبة، لا أن يصير صادقًا** — والفرق يُقال لأن:
--
--    **سلسلة التكلفة تقرأ الحركات لا الأرصدة، والحركة المعكوسة تبقى حركة.**
--    الدرجتان ٢ و٣ تبحثان بـ`where quantity_base > 0 order by created_at desc`
--    **بلا أي استثناء للمعكوس** — فالوارد `+75 @ 0` يبقى «آخر وارد» للمنتج
--    بالصالون **بعد عكسه**، لأن صفّ العكس عليه `−75` فلا يزاحمه.
--
--    **وهذه هي علّة البند ٥٨:** العكس هو العلاج الموصى به لتسميم السعر،
--    **والسعر المسموم يظلّ مرجعًا احتياطيًّا بعد أن يُعكَس المستند الذي حمله.**
--    فلا يُقال «العكس أغلق البند ٢»، ولا يُقال إنه أغلق البند ٥٣.
alter table stock_movements
  add column if not exists cost_is_estimated boolean not null default false;

-- ⚠️ الوصف أدناه صُحِّح بعد أول جرد حقيقي. الأول كان: «صحيح حين اشتُقّت
-- التكلفة من السلسلة بدل أن يُمليها إنسان» — **وهو خاطئ**، لأن الدرجة ١
-- مُشتقّةٌ من السلسلة والعلامة تبقى `false`. والفرق ليس تحسين صياغة: من يقرأ
-- الوصف القديم ويعدّل السلسلة يظنّ الدرجة ١ موسومة.
-- والتصحيح يُشغَّل بسكربتٍ مستقلّ (٠٤٦) لأن هذا الوصف **موجودٌ بالقاعدة الآن**.
comment on column stock_movements.cost_is_estimated is
  'صحيح حين نزلت سلسلة التكلفة تحت درجتها الأولى: أي حين لم يكن بهذا المستودع رصيدٌ موجب يُشتقّ منه متوسّط، فأُخذ الرقم من آخر وارد أو من مستودعٍ آخر أو من السعر الاسميّ أو انتهى صفرًا (الدرجات ٢–٥). وكاذب بثلاث طرق: سعرٌ أملاه إنسان بالتوريد أو الافتتاح (لا سلسلة أصلًا)، أو الدرجة ١ نفسها (متوسّط مرجّح من حركات حقيقية موجودة هنا)، أو نسخًا عن حركةٍ يعكسها مستند. علامة دائمة: لا نعيد حساب تكلفة مختومة (ADR-051).';


-- ⚠️⚠️ `with (security_invoker = true)` صريحةً — ولا تُشغَّل الجملة بدونها.
--
-- الـview القائم أُنشئ بها (الخطوة ٥ب)، وبدونها يعمل بصلاحية مالكه
-- **فيرى كل صالون مخزون كل صالون**. ولا أعرف يقينًا ما يفعله
-- `CREATE OR REPLACE VIEW` بخيارات الـview حين تُحذف الجملة — أتُحفَظ أم تعود
-- للافتراضي — **ولا حاجة لمعرفته**، لأن الكلفتين غير متكافئتين:
--
--   صريحة وهي محفوظة أصلًا  ⇒  سطرٌ زائد، بلا أثر
--   محذوفة وهي تُعاد للافتراضي ⇒  تسرّب أرصدة بين الصالونات
--
-- ⚠️ والفشل صامتٌ تمامًا عند صالونٍ واحد بقاعدة — لن يظهر مهما جُرّب. يظهر
-- يوم يوجد صالون ثانٍ، ولا شيء حينها يشير إلى هذا السطر.
--
-- والجديد عمودٌ واحد بالذيل.
--
-- ⚠️ **وموضعه آخر القائمة إلزامًا لا ترتيبًا.** `CREATE OR REPLACE VIEW` لا
-- يقبل إلا **إضافةً بالذيل**: تغييرُ اسم عمود قائم أو نوعه أو حذفُه أو
-- إقحامُ الجديد بينها يُرفَض بـ`cannot change name of view column`. فمن
-- «يرتّب» القائمة يومًا يكسر الجملة — وهذا أرحم احتمالَيه.
--
-- ⚠️⚠️ **وكان `bool_or(cost_is_estimated)` — وهو خطأ، أُوقف بالمراجعة قبل أن
-- يُشغَّل.** والعلّة أن `reverse_stock_document` **تنسخ العلامة مع الرقم**،
-- فبعد العلاج الذي تنصح به الشاشة نفسها — «اعكسه ثم سجّله بالسعر الحقيقي» —
-- تبقى بالمجموعة حركتان موسومتان و`bool_or` تظلّ `true` **إلى الأبد**:
--
--     +75 @ 0     مقدَّرة      ← وارد تحويل نزلت سلسلته
--     −75 @ 0     مقدَّرة      ← العكس، ينسخ الوصف كما ينسخ الرقم
--     +75 @ 6.6667 غير مقدَّرة ← إعادة التسجيل بالسعر الحقيقي
--     ⇒ الرصيد ٧٥ والمتوسّط ٦٫٦٦٦٧ صحيحان، والشارة باقية.
--
-- **فيصير الرقم صحيحًا والشاشة تقول «لا تثق به»** — فيتعلّم المالك تجاهل
-- الشارة. **وشارةٌ على كل شيء شارةٌ على لا شيء**، وهي الحجّة نفسها المكتوبة
-- بفقرة ② من `post_stock_document` أدناه. **كتبناها هناك ثم بنينا نقيضها هنا.**
--
-- ✅ **والسؤال الصحيح عن الكسر لا عن وجود صفّ موسوم:**
--    `avg = (S_real + S_est) / (Q_real + Q_est)` — والحركات المقدَّرة لا تغيّر
--    شيئًا **حين يكون `Q_est = 0` و`S_est = 0` معًا**. فالشارة نفيُ ذلك.
--
-- ⚠️ **وسؤال الكمّية وحدها لا يكفي، وهذا تصحيحٌ فوق المقترَح المُراجَع:** زوج
-- العكس يُلغي نفسه بالطرفين (نفس الكمّية بنفس التكلفة)، **لكن صرفًا مقدَّرًا
-- برصيدٍ غير موجب مع واردٍ مقدَّرٍ بنفس المقدار** (تحويل البند ٥٤) **يُلغي
-- الكمّية وحدها**، وتبقى تكلفتاهما المختلفتان أثرًا بالبسط:
--
--     −15 @ 10 مقدَّرة · +15 @ 30 مقدَّرة · +15 @ 50 حقيقية
--     Q_est = 0   ⇒ اختبار الكمّية وحدها يمسح الشارة
--     S_est = 300 ⇒ والمتوسّط المعروض ٧٠ والصادق ٥٠
--
-- **ومقيسٌ لا محتجًّا به:** الثلاثة جنبًا إلى جنب بـ
-- [test-utils/stockFixtures.test.js](../../test-utils/stockFixtures.test.js)،
-- باختبار اسمه «quantities that cancel while the value does not».
-- **وسؤال المجموعين لا يحتاج أي افتراض عن الطرق التي تُنتج صفًّا موسومًا.**
create or replace view public.product_balances
  with (security_invoker = true)
as
select
  salon_id,
  storage_id,
  product_id,
  sum(quantity_base) as balance_base,
  case when sum(quantity_base) > 0
       then sum(quantity_base * unit_cost) / sum(quantity_base)
       else null end as avg_cost,
  coalesce(sum(quantity_base) filter (where cost_is_estimated), 0) <> 0
  or coalesce(sum(quantity_base * unit_cost) filter (where cost_is_estimated), 0) <> 0
    as cost_has_estimate
from stock_movements
group by salon_id, storage_id, product_id;


-- ───────────────────────────────────────────────────────────────────────────
-- الجزء ٢ — `post_stocktake` كاملة
--
-- نصّها وصل بـ`pg_get_functiondef`، وهي `SECURITY INVOKER` (الافتراضي) وبلا
-- `search_path` — فما نخشى إسقاطه غير موجود فيها أصلًا. أدناه النصّ الأصلي
-- حرفًا بحرف + تلاتة تغييرات مسمّاة بتعليقاتها.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.post_stocktake(p_storage_id uuid, p_lines jsonb, p_employee_id uuid DEFAULT NULL::uuid, p_doc_date timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_salon_id uuid;
  v_doc_id   uuid;
  v_line     jsonb;
  v_pid      uuid;
  v_counted  numeric;
  v_balance  numeric;
  v_diff     numeric;
  v_cost     numeric;
  v_ids      uuid[];
  v_estimated boolean;                                    -- ① جديد
begin
  select salon_id into v_salon_id from storages where id = p_storage_id;
  if not found then
    raise exception 'storage_not_found' using hint = 'المستودع غير موجود';
  end if;
  if p_lines is not null and jsonb_array_length(p_lines) > 0 then
    select array_agg(distinct (l->>'product_id')::uuid)
      into v_ids from jsonb_array_elements(p_lines) l;
    perform 1 from products where id = any(v_ids) order by id for update;
    if (select count(*) from products where id = any(v_ids)) <> array_length(v_ids, 1) then
      raise exception 'product_not_found' using hint = 'منتج بالمستند غير موجود';
    end if;
  end if;
  insert into stock_documents (salon_id, doc_type, storage_id, employee_id, doc_date, note)
  values (v_salon_id, 'stocktake', p_storage_id, p_employee_id, p_doc_date, p_note)
  returning id into v_doc_id;
  for v_line in select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_pid     := (v_line->>'product_id')::uuid;
    v_counted := (v_line->>'counted_base')::numeric;
    if v_counted is null or v_counted < 0 then
      raise exception 'count_invalid' using hint = 'العدد لازم يكون صفرًا أو أكبر';
    end if;
    select coalesce(sum(quantity_base), 0) into v_balance
      from stock_movements
     where storage_id = p_storage_id and product_id = v_pid;
    v_diff := v_counted - v_balance;
    if v_diff = 0 then
      continue;
    end if;

    -- ② **العلامة هي نفي الدرجة ١ حرفيًّا، لا تمييزٌ بين «مُملاة» و«مُشتقّة».**
    --
    --    ⚠️ كان مكتوبًا هنا «ترتفع حين تُشتقّ التكلفة وتبقى منخفضة حين تُملى»
    --    — **وهو خاطئ ويناقض السطر الذي تحته**: الدرجة ١ مُشتقّةٌ من السلسلة
    --    (متوسّط مرجّح) والعلامة تبقى `false`. انكشف بأول جرد حقيقي: سطر نقصٍ
    --    على منتجٍ له تاريخ خرج `false` رغم أنه مستند جرد لا توريد.
    --
    --    والقاعدة الدقيقة: `false` حين يكون الرقم **ثمنًا دُفع فعلًا، أو
    --    متوسّط أثمانٍ دُفعت فعلًا لبضاعةٍ موجودةٍ هنا**. وما عدا ذلك بديلٌ عن
    --    ثمنٍ لم يستطع هذا المستودع أن يقدّمه — فيُوسَم.
    --
    --    ⚠️ وشرطٌ **واحد** يُقرأ مرّتين، لا شرطان متقابلان. كان
    --    `v_estimated := (v_balance <= 0)` فوق `if v_balance > 0` — نقيضان
    --    لازم يبقيا نقيضين إلى الأبد، وأحدهما يُعدَّل وحده يومًا فيصمت
    --    الخلاف. نفس علّة `hasKnownValue` بالضبط: خليّةٌ ومجموعٌ بشرطين
    --    تباعدا. فالنفي يُكتب مرّة، بـ`not`.
    v_estimated := (v_balance <= 0);

    if not v_estimated then
      -- الدرجة ١: متوسّط هذا المستودع
      select sum(quantity_base * unit_cost) / sum(quantity_base) into v_cost
        from stock_movements
       where storage_id = p_storage_id and product_id = v_pid;
    else
      -- الدرجة ٢: آخر وارد بهذا المستودع
      select unit_cost into v_cost
        from stock_movements
       where storage_id = p_storage_id and product_id = v_pid and quantity_base > 0
       order by created_at desc, id desc limit 1;

      -- ③ الدرجة ٣ (جديدة): **آخر وارد مسجَّل** لنفس المنتج بأي مستودع
      --    بالصالون. فوق السعر الاسميّ لا تحته: هذا رقمٌ دخل الدفتر بحركةٍ
      --    لها تاريخ ومستند، والاسميّ رقمٌ كتبه أحدهم بالكتالوج ولا يعرف أحد
      --    وحدته (البند ٣١). الفرق الوحيد عن الدرجة فوقها: بلا شرط المستودع.
      --
      --    ⚠️ **«مسجَّل» لا «ثمنٌ دُفع فعلًا» — والفرق ليس تحسينَ صياغة.**
      --    الاستعلام لا يشترط شيئًا عن مصدر الرقم: يأخذ آخر وارد أيًّا كان،
      --    **وقد يكون هو نفسه مقدَّرًا** (وارد تحويلٍ نزل سلسلته، أو تسوية
      --    جرد). وبيانات المالك تُظهرها اليوم — الـ`+75 @ 0` وارد، فالدرجة ٣
      --    ستجده وتأخذ صفرًا **ولا تصل الدرجتين ٤ و٥ إطلاقًا**، فينتشر الصفر
      --    عبر المستودعات بدل أن يبقى بمستودعه.
      --
      --    والمرشِّح الطبيعي `and not m.cost_is_estimated` بالدرجتين ٢ و٣،
      --    والعمود الذي يجعله ممكنًا يضيفه هذا السكربت. ⚠️ **ولا يُضاف اليوم**
      --    لأن التاريخ موسومٌ `false` افتراضًا، فالمرشِّح يقرأ الصفر القديم
      --    ثمنًا مؤكَّدًا **ويثبّته بدل أن يستبعده — أسوأ من غيابه**. فالترتيب
      --    إلزاميّ: يُحسم صدق التاريخ أوّلًا (الجزء ١)، ثم البند ٥٣.
      if v_cost is null then
        select m.unit_cost into v_cost
          from stock_movements m
         where m.salon_id = v_salon_id and m.product_id = v_pid and m.quantity_base > 0
         order by m.created_at desc, m.id desc limit 1;
      end if;

      -- الدرجة ٤: السعر الاسميّ
      if v_cost is null then
        select nominal_purchase_price into v_cost from products where id = v_pid;
      end if;

      -- الدرجة ٥: صفر
      v_cost := coalesce(v_cost, 0);
    end if;

    insert into stock_movements (salon_id, document_id, storage_id, product_id,
                                 employee_id, quantity_base, unit_cost,
                                 entered_quantity, entered_uom,
                                 cost_is_estimated)                -- ① جديد
    values (v_salon_id, v_doc_id, p_storage_id, v_pid, p_employee_id,
            v_diff, v_cost,
            (v_line->>'entered_quantity')::numeric,
            (v_line->>'entered_uom')::entry_uom,
            v_estimated);                                          -- ① جديد
  end loop;
  return v_doc_id;
end;
$function$;


-- ───────────────────────────────────────────────────────────────────────────
-- الجزء ٣أ — `post_stock_document` كاملة
--
-- نصّها وصل بـ`pg_get_functiondef` حرفًا بحرف، وهي `SECURITY INVOKER` وبلا
-- `search_path` — كأختها. أدناه الأصل + تلاتة تغييرات مسمّاة.
--
-- ⚠️⚠️ **والفخّ الذي حذّرتُ منه هنا كان فخّي أنا، لا فخّ الدالّة.** كتبتُ فوق
-- هذا الموضع أن `v_sum_qty` «يحمل ما تركته تكرارةٌ سابقة». والنصّ الكامل
-- يقول إن الدالّة **لا تقرؤه خارج الفرع الذي يكتبه إطلاقًا** — فلا شيء فيها
-- ليُصفَّر. الذي كان سيقرؤه عبر الفرعين هو **التعبير الذي اقترحتُه للعلامة**،
-- فاخترعتُ الخطر ثم اقترحتُ حارسًا له.
--
-- والعلاج ليس التصفير: **العلامة تُسنَد حيث تُعرَف، لا حيث تُجمَع.** الفرعان
-- متقابلان وكلٌّ يعرف جوابه بلا سؤال أحد، فسطرٌ داخل كلٍّ منهما يُلغي الحاجة
-- بدل أن يحرسها — **ولا تعبير يمتدّ عبر فرعين، ولا متغيّر يقرؤه فرعٌ لم
-- يكتبه، فلا شيء يبقى ليُصفَّر ولا ترتيب تقييمٍ يُعتمَد عليه.**
--
-- وهو نفس تمييز «الحارس كودٌ، والكود المكتوب عن علّةٍ معرَّضٌ لها»: التصفير
-- سطرٌ تحذفه إعادةُ تنظيمٍ صحيحة بلا أن يشتكي شيء، والإسناد داخل الفرع لا
-- يوجد فيه ما يُحذف.
--
-- ⚠️ ولا يُسحب هذا على `transfer_stock` قبل نصّها — قد تختلف بنيتها.
--
-- ✅ وثلاث حقائق أخرى قرأها النصّ الكامل، مسجَّلة لا معالَجة هنا:
--   • `entered_quantity` و`quantity_base` **يُنسخان مستقلَّين تمامًا** — لا
--     شيء بالقاعدة يربط أحدهما بالآخر. فثابتة `entered × factor = base`
--     تعيش بـ`stockLine` وبالتجهيزة وحدهما، ولا يمكن أن تعيش بـ`CHECK`
--     (المعامل على `products`، والقيد لا يضمّ). وهو أصل البند ٣٥ بنيويًّا.
--   • `p_doc_date` بلا حدٍّ أعلى — يؤكّد قرار البند ٣٩: الحرس عند المُدخَل.
--   • لا تتحقّق الدالّة أن المنتجات تخصّ صالون المستودع؛ تتّكل على RLS.
--     غير قابل للوصول اليوم (`useAuthSession` يحمل `salonId` واحدًا)، لكنه
--     اتّكالٌ لا فحص — والفرق يُقال.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.post_stock_document(p_doc_type stock_doc_type, p_storage_id uuid, p_lines jsonb, p_supplier_id uuid DEFAULT NULL::uuid, p_employee_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_doc_date timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_salon_id uuid;
  v_doc_id   uuid;
  v_line     jsonb;
  v_pid      uuid;
  v_qty      numeric;
  v_cost     numeric;
  v_sum_qty  numeric;
  v_ids      uuid[];
  v_estimated boolean;                                    -- ① جديد
begin
  if p_doc_type in ('transfer', 'reversal', 'stocktake') then
    raise exception 'wrong_function_for_doc_type'
      using hint = 'التحويل والعكس والجرد لهم دوال مستقلة';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'stock_document_empty' using hint = 'المستند بلا سطور';
  end if;
  select salon_id into v_salon_id from storages where id = p_storage_id;
  if not found then
    raise exception 'storage_not_found' using hint = 'المستودع غير موجود';
  end if;
  select array_agg(distinct (l->>'product_id')::uuid)
    into v_ids from jsonb_array_elements(p_lines) l;
  perform 1 from products where id = any(v_ids) order by id for update;
  if (select count(*) from products where id = any(v_ids)) <> array_length(v_ids, 1) then
    raise exception 'product_not_found' using hint = 'منتج بالمستند غير موجود';
  end if;
  insert into stock_documents (salon_id, doc_type, storage_id, supplier_id,
                               employee_id, appointment_id, doc_date, note)
  values (v_salon_id, p_doc_type, p_storage_id, p_supplier_id,
          p_employee_id, p_appointment_id, p_doc_date, p_note)
  returning id into v_doc_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_pid := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'quantity_base')::numeric;
    if v_qty is null or v_qty = 0 then
      raise exception 'stock_line_zero' using hint = 'سطر بكمية صفر';
    end if;
    if p_doc_type in ('supply', 'opening') then
      v_cost := (v_line->>'unit_cost')::numeric;
      if v_cost is null or v_cost < 0 then
        raise exception 'unit_cost_required' using hint = 'سعر الشراء إجباري بالتوريد';
      end if;

      -- ② **الطريق الثاني إلى `false`: لا سلسلة تُستدعى هنا أصلًا.** الرقم
      --    ثمنٌ أملاه إنسان بالشاشة، لا شيء يخمّنه — فلا درجة تنزل ولا علامة
      --    ترتفع. ووسمُه «مقدَّرة» يقلب المعنى: يصير أغلب الحركات موسومًا،
      --    **وشارةٌ على كل شيء شارةٌ على لا شيء**، فتضيع كما تضيع بغيابها.
      --
      --    ⚠️ وهذا هو سبب عدم صلاحية صياغة «مُملاة مقابل مُشتقّة»: هي تصف
      --    هذا الفرع وحده، وتكذب على الفرع الآخر حيث الدرجة ١ مشتقّةٌ وغير
      --    موسومة. طريقان إلى `false` لا طريقٌ واحد، وثالثٌ بالنسخ عند العكس.
      v_estimated := false;
    else
      select sum(quantity_base) into v_sum_qty
        from stock_movements
       where storage_id = p_storage_id and product_id = v_pid;

      -- ② والفرع الآخر يعرف جوابه كذلك، بشرطٍ **واحد يُقرأ مرّتين** لا
      --    بشرطين متقابلين يتباعدان يوم يُعدَّل أحدهما وحده.
      v_estimated := (coalesce(v_sum_qty, 0) <= 0);

      if not v_estimated then
        -- الدرجة ١: متوسّط هذا المستودع
        select sum(quantity_base * unit_cost) / sum(quantity_base) into v_cost
          from stock_movements
         where storage_id = p_storage_id and product_id = v_pid;
      else
        -- الدرجة ٢: آخر وارد بهذا المستودع
        select unit_cost into v_cost
          from stock_movements
         where storage_id = p_storage_id and product_id = v_pid and quantity_base > 0
         order by created_at desc, id desc
         limit 1;

        -- ③ الدرجة ٣ (جديدة): آخر وارد لنفس المنتج بأي مستودع بالصالون.
        --    نفس الدرجة الجديدة بـ`post_stocktake` حرفًا وموضعًا — فوق السعر
        --    الاسميّ لا تحته. ⚠️ **وإضافتها لواحدة دون الأخرى هي الخطأ**:
        --    يصير المنتج الواحد يُقوَّم برقمين حسب الباب الذي دخل منه، وهو
        --    بعينه صنف التباعد الذي نطارده.
        --    ⚠️ **«مسجَّل» لا «ثمنٌ دُفع»** — والقيد `and not
        --    m.cost_is_estimated` مؤجَّلٌ بترتيبٍ إلزاميّ (البند ٥٣). الحجّة
        --    كاملةً عند نظيرتها بـ`post_stocktake` أعلاه.
        if v_cost is null then
          select m.unit_cost into v_cost
            from stock_movements m
           where m.salon_id = v_salon_id and m.product_id = v_pid and m.quantity_base > 0
           order by m.created_at desc, m.id desc
           limit 1;
        end if;

        -- الدرجة ٤: السعر الاسميّ
        if v_cost is null then
          select nominal_purchase_price into v_cost from products where id = v_pid;
        end if;

        -- الدرجة ٥: صفر
        v_cost := coalesce(v_cost, 0);
      end if;
    end if;
    insert into stock_movements (salon_id, document_id, storage_id, product_id,
                                 employee_id, quantity_base, unit_cost,
                                 entered_quantity, entered_uom,
                                 cost_is_estimated)                -- ① جديد
    values (v_salon_id, v_doc_id, p_storage_id, v_pid, p_employee_id,
            v_qty, v_cost,
            (v_line->>'entered_quantity')::numeric,
            (v_line->>'entered_uom')::entry_uom,
            v_estimated);                                          -- ① جديد
  end loop;
  return v_doc_id;
end;
$function$;


-- ───────────────────────────────────────────────────────────────────────────
-- الجزء ٣ب — `transfer_stock` كاملة
--
-- نصّها وصل بـ`pg_get_functiondef`، `SECURITY INVOKER` وبلا `search_path` —
-- فالأربع متّسقة. تغييران فقط: العلامة، والدرجة الجديدة.
--
-- ودليل حاجتها بيانات المالك نفسها: تحويله ختم `unit_cost = 0` لأن السلسلة
-- نزلت درجاتها. **فبلا العلامة، كل تحويل من مستودعٍ بلا وارد يُنتج رقمًا
-- مقدَّرًا صامتًا** — وهو أشيع مسار للتقدير بعد الجرد.
--
-- ⚠️ **والعلامة تُوضع مرّة وتُقرأ للحركتين معًا**: الصادرة والواردة وجهان
-- لقرارٍ واحد عن التكلفة، فالمقابل يرث وصف مصدره كما يرث رقمه. ولو حُسبت
-- لكلٍّ على حدة لأمكن أن تختلفا وهما نصفا سطر واحد.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.transfer_stock(p_from_storage_id uuid, p_to_storage_id uuid, p_lines jsonb, p_employee_id uuid DEFAULT NULL::uuid, p_doc_date timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_salon_id uuid;
  v_doc_id   uuid;
  v_line     jsonb;
  v_pid      uuid;
  v_qty      numeric;
  v_cost     numeric;
  v_sum_qty  numeric;
  v_ids      uuid[];
  v_estimated boolean;                                    -- ① جديد
begin
  if p_from_storage_id = p_to_storage_id then
    raise exception 'transfer_same_storage' using hint = 'مستودع المصدر والوجهة واحد';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'stock_document_empty' using hint = 'المستند بلا سطور';
  end if;
  select salon_id into v_salon_id from storages where id = p_from_storage_id;
  if not found then
    raise exception 'storage_not_found' using hint = 'مستودع المصدر غير موجود';
  end if;

  -- ⚠️ الوجهة تُفحَص وجودًا فقط، بلا `salon_id`. **والحماية قائمة، لكنها ليست
  --    هنا:** الدالّة `SECURITY INVOKER`، فـRLS تجعل مستودع صالونٍ آخر غير
  --    مرئيّ أصلًا ⇒ `not found` ⇒ `storage_not_found`.
  --    **فـ`SECURITY INVOKER` جزءٌ من الحماية لا تفصيلُ توقيع** — ومن يجعلها
  --    `SECURITY DEFINER` يومًا لسببٍ يبدو وجيهًا يُسقط العزل بلا أن يمسّ
  --    سطرًا يبدو أمنيًّا، فتصير الحركة قابلةً للكتابة بصالونٍ وبمستودعٍ من
  --    صالونٍ آخر. أختُ `security_invoker` على الـview: خاصيّةٌ لا تُذكَر
  --    فتُنسى فتُزال.
  perform 1 from storages where id = p_to_storage_id;
  if not found then
    raise exception 'storage_not_found' using hint = 'مستودع الوجهة غير موجود';
  end if;
  select array_agg(distinct (l->>'product_id')::uuid)
    into v_ids from jsonb_array_elements(p_lines) l;
  perform 1 from products where id = any(v_ids) order by id for update;
  if (select count(*) from products where id = any(v_ids)) <> array_length(v_ids, 1) then
    raise exception 'product_not_found' using hint = 'منتج بالمستند غير موجود';
  end if;
  insert into stock_documents (salon_id, doc_type, storage_id, to_storage_id,
                               employee_id, doc_date, note)
  values (v_salon_id, 'transfer', p_from_storage_id, p_to_storage_id,
          p_employee_id, p_doc_date, p_note)
  returning id into v_doc_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_pid := (v_line->>'product_id')::uuid;
    v_qty := abs((v_line->>'quantity_base')::numeric);
    if v_qty is null or v_qty = 0 then
      raise exception 'stock_line_zero' using hint = 'سطر بكمية صفر';
    end if;
    select sum(quantity_base) into v_sum_qty
      from stock_movements
     where storage_id = p_from_storage_id and product_id = v_pid;

    -- ① شرطٌ واحد يُقرأ مرّتين، كأختيها.
    v_estimated := (coalesce(v_sum_qty, 0) <= 0);

    if not v_estimated then
      -- الدرجة ١: متوسّط مستودع المصدر
      select sum(quantity_base * unit_cost) / sum(quantity_base) into v_cost
        from stock_movements
       where storage_id = p_from_storage_id and product_id = v_pid;
    else
      -- الدرجة ٢: آخر وارد بمستودع المصدر
      select unit_cost into v_cost
        from stock_movements
       where storage_id = p_from_storage_id and product_id = v_pid and quantity_base > 0
       order by created_at desc, id desc limit 1;

      -- ② الدرجة ٣ (جديدة): **آخر وارد مسجَّل** لنفس المنتج بأي مستودع
      --    بالصالون. الثالثة من ثلاث — والدرجة نفسها بالمواضع الثلاثة أو لا
      --    تُضاف. ⚠️ و«مسجَّل» لا «ثمنٌ دُفع»: القيد `and not
      --    m.cost_is_estimated` مؤجَّلٌ بترتيبٍ إلزاميّ (البند ٥٣)، والحجّة
      --    كاملةً عند نظيرتها بـ`post_stocktake`.
      --    ⚠️ **وهذه الدالّة بالذات هي التي تُنتج الصفّ الذي تلتقطه الدرجة ٣**
      --    حين يكون المصدر فارغًا (البند ٥٤) — فهي طرفا الحلقة معًا.
      if v_cost is null then
        select m.unit_cost into v_cost
          from stock_movements m
         where m.salon_id = v_salon_id and m.product_id = v_pid and m.quantity_base > 0
         order by m.created_at desc, m.id desc limit 1;
      end if;

      -- الدرجة ٤: السعر الاسميّ
      if v_cost is null then
        select nominal_purchase_price into v_cost from products where id = v_pid;
      end if;

      -- الدرجة ٥: صفر
      v_cost := coalesce(v_cost, 0);
    end if;
    insert into stock_movements (salon_id, document_id, storage_id, product_id,
                                 employee_id, quantity_base, unit_cost,
                                 entered_quantity, entered_uom,
                                 cost_is_estimated)                     -- ① جديد
    values
      (v_salon_id, v_doc_id, p_from_storage_id, v_pid, p_employee_id, -v_qty, v_cost,
       (v_line->>'entered_quantity')::numeric, (v_line->>'entered_uom')::entry_uom,
       v_estimated),                                                    -- ① جديد
      (v_salon_id, v_doc_id, p_to_storage_id,   v_pid, p_employee_id,  v_qty, v_cost,
       (v_line->>'entered_quantity')::numeric, (v_line->>'entered_uom')::entry_uom,
       v_estimated);                                                    -- ① جديد
  end loop;
  return v_doc_id;
end;
$function$;


-- ───────────────────────────────────────────────────────────────────────────
-- الجزء ٣ج — `reverse_stock_document` كاملة
--
-- ⚠️ **قاعدة مختلفة عن الثلاث: تنسخ ولا تحسب.** لا سلسلة فيها، ولا درجة
-- جديدة تُضاف إليها، **وتغييرها كلمتان**: العمود بقائمة الإدراج، والحقل
-- بجملة `select` — لأنها `insert … select` من الأصل أساسًا.
--
-- والسبب أن العكس **ليس قرارًا جديدًا عن التكلفة، هو نقيض قرارٍ اتُّخذ**،
-- فيرث وصفه كما يرث رقمه. وإعادةُ الحساب تكذب باتجاهين: عكسُ حركةٍ مقدَّرة
-- يُنتج حركةً تبدو مؤكَّدة، وعكسُ حركةٍ مؤكَّدة قد ينزل السلسلة وقتها فيُنتج
-- «مقدَّرة» عن رقمٍ منسوخٍ حرفًا.
--
-- ✅ وثلاث حقائق قرأها النصّ، مسجَّلة لا معالَجة هنا:
--   • **`reverses_document_id` موجود** — والعكس يشير لأصله، لا الأصل لعاكسه.
--     فسؤال «هل عُكِست؟» يُطرح على المجموعة **لأن هذا اتّجاه العمود الصحيح**،
--     لا لأن العمود غائب. (وكنتُ سجّلتُه غائبًا — بحثتُ عن
--     `reversed_document_id` بحرفين مختلفين.)
--   • **`supplier_id` و`appointment_id` لا يُنسخان للمستند العكسي.** فعكسُ
--     توريدٍ لا يظهر بدفتر المورّد يوم يُبنى (البند ٥٠ وأخوه).
--   • **مستندٌ عكسيّ بلا حركات ممكن فعلًا** — حين يكون الأصل جردًا طابق كلّه
--     (`v_ids` عدمٌ، والـ`insert … select` يدرج صفرًا). وهي حالة البند ٤٤
--     بعينها. ⚠️ والتصحيح الذي تلقّيتُه سابقًا («العكس الحقيقي يكتب حركة»)
--     **يبقى صحيحًا للحالة العاديّة** — الخطأ كان أن تجهيزتي بلا حركات لم
--     تكن مأخوذة من هذا الطريق، لا أن الشكل مستحيل.
--
-- 🔴 **وفحصٌ ترتيبيّ يستحقّ سؤالًا مستقلًّا (لا يُعالَج بهذا السكربت):**
--    فحص `already_reversed` يقع **قبل** `for update`، لا بعده. فمعاملتان
--    متزامنتان تقرآن «غير معكوس» ثم تُدرجان — **والمستند يُعكس مرّتين.**
--    وأشدّ ما فيه أن الموديول لا يملك علاجًا: `cannot_reverse_a_reversal`
--    يمنع عكسَ العكس، وADR-051 يمنع تعديل الصفوف — فلا يبقى إلا تسوية جرد.
--    والحسم استعلامٌ واحد، وهو بآخر الملف (فحص ٩).
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reverse_stock_document(p_document_id uuid, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_src     stock_documents;
  v_doc_id  uuid;
  v_ids     uuid[];
begin
  select * into v_src from stock_documents where id = p_document_id;
  if not found then
    raise exception 'stock_document_not_found' using hint = 'المستند غير موجود';
  end if;
  if v_src.doc_type = 'reversal' then
    raise exception 'cannot_reverse_a_reversal' using hint = 'لا يُعكس مستند عكسي';
  end if;
  perform 1 from stock_documents where reverses_document_id = p_document_id;
  if found then
    raise exception 'already_reversed' using hint = 'المستند معكوس سابقًا';
  end if;
  select array_agg(distinct product_id) into v_ids
    from stock_movements where document_id = p_document_id;
  perform 1 from products where id = any(v_ids) order by id for update;
  insert into stock_documents (salon_id, doc_type, storage_id, to_storage_id,
                               employee_id, reverses_document_id, doc_date, note)
  values (v_src.salon_id, 'reversal', v_src.storage_id, v_src.to_storage_id,
          v_src.employee_id, p_document_id, now(), p_note)
  returning id into v_doc_id;

  -- ① الكلمتان: العمود بالقائمة، والحقل بـ`select`. **نسخٌ لا حساب.**
  insert into stock_movements (salon_id, document_id, storage_id, product_id,
                               employee_id, quantity_base, unit_cost,
                               entered_quantity, entered_uom,
                               cost_is_estimated)
  select v_src.salon_id, v_doc_id, m.storage_id, m.product_id, m.employee_id,
         -m.quantity_base, m.unit_cost, m.entered_quantity, m.entered_uom,
         m.cost_is_estimated
    from stock_movements m
   where m.document_id = p_document_id;
  return v_doc_id;
end;
$function$;


-- ───────────────────────────────────────────────────────────────────────────
-- الجزء ٤ — تصحيح الأربعة التي يكذب عليها `default false`
--
-- ✅ **قُرئت العشرة صفوف ووُزنت كلٌّ منها بمنطق دالّتها وقت كتابتها**، فصار
-- الجواب أربعة صفوف بأعيانها لا ستّة ولا عشرة:
--
--   ١،٢  توريد مسموم @0        `v_estimated=false` للتوريد دائمًا  ✅ صادق
--   ٥،٦  عكسهما                نسخٌ عن ١،٢                          ✅ صادق
--   ٧،٨  توريد مصحَّح @50 و@100  إنسانٌ أملاها                        ✅ صادق
--   ٣،٤  التحويل ±75 @0        رصيد المصدر صفر ⇒ `true`            ❌ كاذب
--   ٩،١٠ عكسه                  نسخٌ عن ٣،٤ ⇒ `true`                ❌ كاذب
--
-- ⚠️ **والتوريد المسموم صادقٌ عليه `false` وهو خطأ — والتمييز هو العمود كلّه.**
-- خطأٌ أملاه إنسان ليس تقديرًا: أحدهم كتب سعرًا ومرّرت الشاشة فراغًا كصفر،
-- **ولم يخمّن أحد**. ووسمُه يضع الشارة على الحالة العاديّة فيفرغها من معناها.
--
-- ⚠️ **ولا يُبنى على أن الشارة لا تظهر عليها اليوم.** الأربعة تتقابل داخل كل
-- مستودع (٣ مع ٩، و٤ مع ١٠) فالكمّية والقيمة المقدَّرتان صفرٌ بكل مجموعة —
-- **فالشارة `false` سواءً وُسمت أو لم تُوسم. مصادفةٌ حسابية لا دليل.**
-- **والذي يهمّ البند ٥٨:** سطرا ٣ و١٠ يبقيان «آخر وارد موجب بتكلفة صفر»
-- بمستودعيهما، **فيوم يُضاف مرشِّح البند ٥٣ تتوقّف فعّاليته كلها على صدق هذا
-- الوسم** — ولو بقي `false` قُرئ الصفر ثمنًا مؤكَّدًا ومرّ من المرشِّح،
-- **فأبطل البند ٥٣ على أوّل منتجٍ يحتاجه.**
--
-- ⚠️⚠️ **وشرط `count = 1` ليس زينةً — هو ما يجعل المعيار صادقًا.**
-- «كل حركة تحويل مقدَّرة» **كاذبٌ كقاعدة عامّة**: تحويلٌ من مستودعٍ برصيدٍ
-- موجب غير مقدَّر أصلًا. وهو صادقٌ هنا **لأن بقاعدة المالك تحويلًا واحدًا
-- وحيدًا، مقيسًا**. فبلا الشرط يصير هذا السطر قنبلةً موقوتة: **السكربت
-- موصوفٌ بأنه معاد التشغيل**، وأول إعادة تشغيل بعد تحويلٍ سليم تسمه بالخطأ.
-- **فالشرط يجعله يطابق صفر صفوف بدل أن يفسد** — يفشل مغلقًا، والفحص ١١ يُظهر
-- أنه لم يُطبَّق بدل أن يمرّ صامتًا.
--
-- ✅ ومعادُ التشغيل بذاته: وضعُ `true` على `true` لا أثر له.
-- ───────────────────────────────────────────────────────────────────────────

update stock_movements m
set cost_is_estimated = true
where (select count(*) from stock_documents where doc_type = 'transfer') = 1
  and exists (
    select 1 from stock_documents d
    where d.id = m.document_id
      and (
        d.doc_type = 'transfer'
        or (d.doc_type = 'reversal' and exists (
          select 1 from stock_documents o
          where o.id = d.reverses_document_id and o.doc_type = 'transfer'
        ))
      )
  );


-- ───────────────────────────────────────────────────────────────────────────
-- التحقّق — بعد الأجزاء كلها
--
-- ⚠️ **وحدُّه يُقال: هذه الفحوص تجري داخل المعاملة نفسها**، فهي تصف ما تراه
--    المعاملة عن نفسها لا ما أُودع. لو أخفق شيءٌ بعدها فكل ما «أكّدته» يرتدّ
--    معه. **وقراءتها تُقرأ بعد أن يقول المحرّر إن التنفيذ نجح، لا قبله.**
--
-- ⚠️ **وأوّل ما يُقرأ من المخرجات هو الفحص ٨** — لأنه وحده يستطيع أن يُبطل
--    الأربع دوالّ معًا.
-- ───────────────────────────────────────────────────────────────────────────

-- ١. العمود موجود بنوعه وقيده
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'stock_movements' and column_name = 'cost_is_estimated';

-- ٢. ⚠️⚠️ والصلاحية — تُقرأ لا تُفترَض. المتوقَّع: {security_invoker=true}
--    التحقّق الذي يسرد الأعمدة وحدها يقول «الشكل سليم» عن view قد يكون فتح
--    كل شيء.
select relname, reloptions
from pg_class
where relnamespace = 'public'::regnamespace and relname = 'product_balances';

-- ٣. والview صار يرجّع العمود الجديد
select column_name
from information_schema.columns
where table_name = 'product_balances'
order by ordinal_position;

-- ٤. 🔴 **سردٌ يُقرأ بالعين، لا عدّادٌ يُقارَن — والفرق هو البند كلّه.**
--
--    كان هنا `select count(*) … where cost_is_estimated` والمتوقَّع صفر.
--    **وهو فحصٌ لا يمكن أن يفشل:** الجواب صفرٌ بحكم `default false` نفسه لا
--    بحكم الحقيقة، فهو يتحقّق أن بوستجرس نفّذ `default` — وهذا مضمون — لا أن
--    الادّعاء عن الصفوف صحيح. **وفحصٌ لا يمكن أن يفشل ليس فحصًا.**
--
--    وهو أخو «لم يُقَس ليس غير موجود» معكوسًا: **`false` مكتوبةٌ افتراضًا
--    ليست `false` مقيسة.**
--
--    فالصواب هنا حكمُ إنسانٍ لا رقمٌ متوقَّع: تُقرأ الصفوف صفًّا صفًّا، ويُسأل
--    عن كلٍّ منها «من أين جاء سعره؟». **والوارد بتكلفة صفر هو المشتبَه به
--    الأول** (البند ٢ بمراجعة السكربت).
select m.id, d.doc_type, m.storage_id, m.product_id,
       m.quantity_base, m.unit_cost, m.cost_is_estimated, m.created_at
from stock_movements m
left join stock_documents d on d.id = m.document_id
order by m.created_at, m.id;

-- ٥. ولا صفّ رصيد موسوم بعد — خطّ الأساس الذي يُقارَن به أول جرد يمرّ
--    بالدرجة الجديدة.
select count(*) as balance_rows_flagged
from product_balances
where cost_has_estimate;

-- ٦. وكلٌّ من الأربع وحدها بالقاعدة، بلا overload. **أربعة صفوف، كلٌّ بـ١** —
--    وأي ٢ يعني نسختين بتوقيعين والاستدعاء صار غامضًا (القانون ٥).
select p.proname, count(*) as copies
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('post_stocktake', 'post_stock_document',
                    'transfer_stock', 'reverse_stock_document')
group by p.proname;

-- ٧. والتغيير وصل الجسم فعلًا — لا وجود الدالّة (القانون ٢: `count(*)` عاجز
--    بنيويًّا عن رؤية إصلاحٍ انرجع، فالقديمة بنفس الاسم والتوقيع).
--    **المتوقَّع ١ لكلٍّ من الأربع.**
--    ⚠️ والبحث على `cost_is_estimated)` **بقوسها** لا على الاسم وحده: أي
--    تعليق يُكتب لاحقًا فوق السطر ويذكر الاسم يزيد العدّاد واحدًا ويكذب —
--    والقوس لا يظهر إلا بقائمة أعمدة الإدراج. نفس فخّ القانون ٢ بالضبط.
--    ⚠️⚠️ **والصلاحية تُقرأ هنا كذلك، لا تُفترَض** — `prosecdef` يجب أن يبقى
--    `false` بالأربع. الاستبدال يعيد كتابة الكائن كاملًا، **وسطرٌ يقول
--    `SECURITY INVOKER` غائبٌ من نصوصنا لأنه الافتراضي**، فلو نُسخ يومًا من
--    دالّةٍ محصَّنة انقلب المعنى بلا أن يشتكي شيء.
select p.proname,
       p.prosecdef as security_definer_expect_false,
       p.proconfig as search_path_expect_null,
       (length(p.prosrc) - length(replace(p.prosrc, 'cost_is_estimated)', '')))
       / length('cost_is_estimated)') as insert_column_mentions
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('post_stocktake', 'post_stock_document',
                    'transfer_stock', 'reverse_stock_document');

-- ٨. ✅ **انتقل إلى سكربتٍ مستقلّ يُشغَّل قبل هذا** — مسبار سلوك
--    `select … into` عند صفر صفوف. لسببين:
--
--    ① **لا يحتاج من هذا السكربت شيئًا** (لا العمود ولا الـview ولا الدوالّ)
--      ويملك حقّ نقضها جميعًا. وفحصٌ يملك النقض لا يقع بعد التنفيذ — وإلا
--      كانت «⛔ أوقف كل شيء» جملةً غير قابلة للتنفيذ حين تُقرأ.
--    ② **`do $$` كان الجملة الوحيدة هنا القادرة على إسقاط المعاملة لسببٍ لا
--      علاقة له بالتغيير** — ولو أخفق وهو آخر شيء، ارتدّ معه كل ما فوقه وقد
--      بدا ناجحًا. **فالجملة الوحيدة القادرة على إلغاء التغيير كانت الوحيدة
--      التي لا تخصّه.**
--
--    فلا `do` بهذا الملف ولا جدول مؤقّت، ولا شيء فيه غير DDL و`select`.

-- ٩. 🔴 **سؤالٌ مستقلّ عن هذا السكربت، وحسمُه سطر:** هل على
--    `reverses_document_id` قيدُ تفرّد؟
--
--    فحص `already_reversed` بـ`reverse_stock_document` يقع **قبل**
--    `for update` لا بعده، فمعاملتان متزامنتان تقرآن «غير معكوس» ثم تُدرجان.
--    ولو لم يوجد القيد، **يُعكس المستند مرّتين ويرتدّ الرصيد ضعف الفرق** —
--    ولا علاج بالموديول: `cannot_reverse_a_reversal` يمنع عكسَ العكس،
--    وADR-051 يمنع تعديل الصفوف، فلا يبقى إلا تسوية جرد.
--
--    ⚠️ **ولا يُقرأ `indisunique` وحده — يُقرأ التعريف كاملًا.** فهرسٌ فريد
--    على `(salon_id, reverses_document_id)` يعطي `indisunique = true` **ولا
--    يمنع السباق إطلاقًا**، لأن التفرّد حينها على الزوج لا على العمود.
--    فـ`pg_get_indexdef` لا حقلٌ منطقيّ — **وهو عين درس `security_invoker`:
--    سردُ الشكل يقول «سليم» عن شيء قد يكون مفتوحًا.**
--
--    **المطلوب حرفيًّا: `UNIQUE INDEX … ON … (reverses_document_id)` بعمود
--    واحد** ⇒ الفجوة مسدودة والسباق يفشل بـ`23505`.
--    **أي شيء آخر (أو لا صفّ) ⇒ البند ٥١ مفتوح، وقراره للمالك — ولا يُنفَّذ
--    من هنا.**
--
--    ✅ وتفصيلةٌ تُطمئن حين يُتَّخذ القرار: `unique` ببوستجرس يقبل العدم
--    متكرّرًا، **فقيدٌ على هذا العمود لا يمسّ المستندات غير العكسية إطلاقًا**
--    (كلّها `NULL`) — بلا شرطٍ جزئيّ ولا تعقيد.
select i.relname as index_name,
       ix.indisunique,
       pg_get_indexdef(i.oid) as definition_read_this_not_the_flag
from pg_index ix
join pg_class i on i.oid = ix.indexrelid
join pg_class t on t.oid = ix.indrelid
where t.relname = 'stock_documents'
  and pg_get_indexdef(i.oid) like '%reverses_document_id%';

-- ١١. ⚠️ **وأثر الجزء ٤ يُقرأ سطرًا سطرًا — لأن `update` لا يقول كم أصاب.**
--     **المتوقَّع: أربعة صفوف `true`، كلّها من مستند التحويل أو من عكسه، ولا
--     صفّ توريدٍ بينها.** ولو رجعت صفرًا فشرط `count = 1` منع التنفيذ — أي
--     أن بالقاعدة تحويلًا ثانيًا، **والمعيار لم يعد صالحًا فيُعاد التفكير فيه
--     لا يُجبَر.**
select m.id, d.doc_type, o.doc_type as reverses_type,
       m.quantity_base, m.unit_cost, m.cost_is_estimated
from stock_movements m
left join stock_documents d on d.id = m.document_id
left join stock_documents o on o.id = d.reverses_document_id
where m.cost_is_estimated
order by m.created_at, m.id;

-- ١٢. والعمود نفسه — يُسرَد لأن غيابه سُجِّل مرّةً وهو موجود. **بحثٌ بالمفهوم
--     لا بالاسم:** كل عمود `uuid` بـ`stock_documents` يشير إلى نفس الجدول.
--     البحث بالاسم يفشل مفتوحًا — يعطي «لا شيء» ويبدو حاسمًا.
select a.attname, format_type(a.atttypid, a.atttypmod) as type,
       cf.relname as references_table
from pg_attribute a
join pg_class c on c.oid = a.attrelid
left join pg_constraint fk on fk.conrelid = c.oid and a.attnum = any(fk.conkey)
                          and fk.contype = 'f'
left join pg_class cf on cf.oid = fk.confrelid
where c.relname = 'stock_documents' and a.attnum > 0 and not a.attisdropped
order by a.attnum;


-- ───────────────────────────────────────────────────────────────────────────
-- الملخّص — **آخر جملة بالملف عمدًا**
--
-- ⚠️ ما يعرضه محرّر Supabase حين تُرسَل جملٌ متعدّدة بدفعة واحدة — كلّ النتائج
--    أم الأخيرة وحدها — **لم يُقَس، ولا يُبنى عليه**. ولو كانت الأخيرة وحدها
--    لجرت تسعة فحوص لا يراها أحد، **وقُرئ العاشر فبدا أن كل شيء تمّ**.
--
-- ✅ والعلاج شكلٌ لا يعتمد على السلوك المجهول بدل قياسه: **نتيجةٌ واحدة، سطرٌ
--    لكل فحص، وهي آخر ما يُنفَّذ**. وهي «اكتب الشكل لا القائمة» مطبَّقةً على
--    الفحوص نفسها.
--
-- والتفصيل يبقى فوق: الفحوص ١ و٣ و٤ و٦ و٧ و٩ و١٠ ترجّع صفوفًا تُقرأ بالعين،
-- **وهذا الملخّص يقول أيّها يحتاج نظرًا** لا يغني عنها.
-- ───────────────────────────────────────────────────────────────────────────

select 'view: security_invoker' as check_name,
       coalesce((select reloptions::text from pg_class
                  where relnamespace = 'public'::regnamespace
                    and relname = 'product_balances'), '(بلا خيارات ⛔)') as result
union all
select 'view: cost_has_estimate exists',
       coalesce((select 'yes' from information_schema.columns
                  where table_name = 'product_balances'
                    and column_name = 'cost_has_estimate'), 'MISSING ⛔')
union all
select 'column: cost_is_estimated',
       coalesce((select data_type || ' / nullable=' || is_nullable || ' / default=' || coalesce(column_default, '∅')
                   from information_schema.columns
                  where table_name = 'stock_movements'
                    and column_name = 'cost_is_estimated'), 'MISSING ⛔')
union all
select 'functions: copies (expect 4×1)',
       (select string_agg(proname || '=' || c, ', ' order by proname)
          from (select p.proname, count(*) as c
                  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public'
                   and p.proname in ('post_stocktake', 'post_stock_document',
                                     'transfer_stock', 'reverse_stock_document')
                 group by p.proname) s)
union all
select 'functions: security_definer (expect all false)',
       (select string_agg(p.proname || '=' || p.prosecdef, ', ' order by p.proname)
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('post_stocktake', 'post_stock_document',
                             'transfer_stock', 'reverse_stock_document'))
union all
select 'functions: insert carries the column (expect all 1)',
       (select string_agg(p.proname || '='
               || ((length(p.prosrc) - length(replace(p.prosrc, 'cost_is_estimated)', '')))
                   / length('cost_is_estimated)'))::text, ', ' order by p.proname)
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('post_stocktake', 'post_stock_document',
                             'transfer_stock', 'reverse_stock_document'))
union all
-- ⚠️ العدد المتوقَّع ٤ بعد الجزء ٤، **وصفرٌ يعني أن شرط `count = 1` منع
--    التنفيذ لا أن كل شيء نظيف** — فالرقم وحده لا يفرّق بينهما. الفحص ١١
--    يفرّق، لأنه يسمّي الصفوف ومستنداتها.
select 'movements flagged (expect 4 — but read check 11, not this)',
       (select count(*)::text from stock_movements where cost_is_estimated)
union all
select 'part 4 criterion still valid? (transfers must be exactly 1)',
       (select count(*)::text || ' transfer document(s)'
          from stock_documents where doc_type = 'transfer')
union all
select 'balance rows flagged',
       (select count(*)::text from product_balances where cost_has_estimate)
union all
select 'reverses_document_id: unique index? (item 51)',
       coalesce((select string_agg(pg_get_indexdef(i.oid), ' | ')
                   from pg_index ix
                   join pg_class i on i.oid = ix.indexrelid
                   join pg_class t on t.oid = ix.indrelid
                  where t.relname = 'stock_documents'
                    and pg_get_indexdef(i.oid) like '%reverses_document_id%'),
                'no index — البند ٥١ مفتوح');

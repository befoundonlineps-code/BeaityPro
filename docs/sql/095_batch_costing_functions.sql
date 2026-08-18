-- ==========================================================================
-- ٠٩٥ — محرّكُ تكلفة الدفعة. **تغييرٌ فقط، ولا `select` في هذا الملفّ.**
--       والتحقّقُ هو ٠٩٥ب، بملفٍّ مستقلّ.
--
-- 🔴 مُجهَّزٌ ولم أشغّله. المالكُ ينفّذه بيده بعد مراجعته.
-- ترتيبُ التشغيل: ٠٩٤ ✅ ⟵ ٠٩٤ج ✅ ⟵ **٠٩٥ (هذا)** ⟵ ٠٩٥ب.
--
-- ⚠️ **و`auth.uid()` فارغةٌ في المحرّر، وRLS متجاوَزةٌ هناك بالكامل.** فنجاحُ
-- هذا السكربت يثبت أن الدوالَّ حُفظت — **ولا يثبت شيئًا عن العزل، ولا أنها
-- تعمل.** PL/pgSQL يخزّن الجسمَ نصًّا ويخطّط كلَّ جملةٍ **عند أوّل تنفيذ**،
-- فدالّةٌ تُنشأ بنجاحٍ وتفشل أوّلَ استدعاء.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 مبنيٌّ على النصّ الحيّ (٠٩٥أ٢)، لا على ملفّات المستودع — ومقيسٌ لماذا
--
-- الأجسامُ الأربعةُ المنشورةُ **تختلف عن ملفّاتنا بالتعليقات**: المنشورُ
-- إنجليزيُّ التعليقات، و٠٥١ب/٠٤٩ج عندنا عربيّاها بعلامات «① جديد». والكودُ
-- التنفيذيُّ واحدٌ في الحالتين، **لكن `prosrc` يحفظ التعليقاتِ جزءًا من الجسم**
-- — فبناءٌ عن ملفّاتنا كان يستبدل تعليقاتِ القاعدة بلا سطرٍ يقول ذلك.
--
-- ⇒ **كلُّ سطرٍ لم يُقصَد تغييرُه منقولٌ حرفًا من مخرَج ٠٩٥أ٢**، بتعليقاته
-- الإنجليزيّة كما هي. **والعربيُّ الجديدُ يظهر عند المُضاف وحدَه**، فيقرأ
-- المراجعُ التغييرَ من لون التعليق.
--
-- ✅ **ولا `SECURITY DEFINER` ولا `SET search_path` على أيٍّ من الأربع** —
-- مقيسٌ بـ٠٩٥أ ومؤكَّدٌ من المالك. **فغيابُهما هنا مقصودٌ لا منسيّ**، وإضافتُهما
-- كانت ستكون تغييرَ صلاحيّاتٍ مهرَّبًا مع ميزة.
--
-- ✅ **ولا `DROP FUNCTION`:** التواقيعُ الأربعةُ لم تتغيّر — لا معاملَ زِيد ولا
-- نوعَ بُدِّل — فـ`CREATE OR REPLACE` استبدالٌ لا `overload` (البند ٥).
--
-- ---------------------------------------------------------------------------
-- 🔴 ستّةُ كائناتٍ لا أربعة — وهذا توسيعٌ للنطاق يُعلَن ولا يُهرَّب
--
-- المعتمَدُ «الدوالُّ الأربع». وأضفتُ **دالّتين مساعدتين**:
--
--   open_estimated_lot     سلّمُ التقدير (الدرجات ٢–٥) ⟵ دفعةٌ مقدَّرة
--   draw_stock_from_lots   السحبُ FIFO ⟵ شرائحُ، وتُنشئ المقدَّرةَ عند النقص
--
-- ⚠️ **والسببُ هو العلّةُ التي وُجدت هذه الجولةُ كلُّها لأجلها:** سلّمُ التقدير
-- **مكرَّرٌ اليوم شبهَ حرفيٍّ في ثلاث دوالّ** — وهو ما قاسه المالكُ بنفسه في
-- النصّ الحيّ. فنسخُه مرّةً رابعةً وخامسةً بجوار منطقِ FIFO **يضاعف الازدواج
-- بدل أن ينهيه**، و«حارسٌ لا يُقرأ إلّا في موضعٍ من ثلاثة» هو بالضبط شكلُ
-- الأعطال التي يلاحقها هذا المشروع.
--
-- ⇒ **السلّمُ الآن نصٌّ واحدٌ في مكانٍ واحد.** والمناداةُ ثلاثُ مرّات.
--
-- ⚠️ **وليستا ميزةً جديدة:** لا تفعلان شيئًا لم تكن الدوالُّ الأربعُ تفعله؛
-- هما **الجسمُ نفسُه مرفوعًا من ثلاثة مواضعَ إلى واحد.**
--
-- ⚠️ **وليستا `SECURITY DEFINER`** كأخواتهما: تعملان بصلاحيّة المنادي وتمرّان
-- من `stock_lots_insert` و`stock_lots_select` — **فلا طريقَ جديدٌ للكتابة
-- يُفتح بهما.**
--
-- ---------------------------------------------------------------------------
-- 🔴 التزامنُ — القفلُ المطلوبُ قائمٌ، وقفلُ الدفعة **غيرُ ممكن**
--
-- قرارُ المالك: «قفلُ صفٍّ يمنع عمليّتين متزامنتين من سحب نفس رصيد الدفعة».
--
-- ⚠️ **وقفلٌ على `stock_lots` مرفوضٌ من طريقين بعد ٠٩٤ج:** `SELECT … FOR UPDATE`
-- **يطبّق `USING` الخاصّةَ بـ`UPDATE`** تحت RLS (مسجَّلٌ بـ`PROJECT_HANDOFF:563`)،
-- و٠٩٤ج سحب منحةَ `UPDATE` **ولا سياسةَ `update` على الجدول أصلًا.**
--
-- ✅ **والقفلُ المقصودُ موجودٌ ويكفي:** الدوالُّ الثلاثُ تنفّذ أصلًا
--
--     perform 1 from products where id = any(v_ids) order by id for update;
--
-- **قبل أيِّ قراءةٍ للمتبقّي.** فعمليّتان على نفس المنتج تتسلسلان على صفّ
-- المنتج، **والثانيةُ تقرأ المتبقّيَ بعد التزام الأولى** — وهو عينُ المطلوب.
-- والدفعاتُ مقسَّمةٌ بالمنتج، فلا تنافسَ بين منتجين.
--
-- ⇒ **لم يُضَف قفلٌ، ولم يُحذف قفل.** وهذا السطرُ يوثّق القائمَ بوصفه آليّةَ
-- التزامن كي لا يُقرأ لاحقًا «لا قفلَ هنا».
--
-- ---------------------------------------------------------------------------
-- القراراتُ الخمسةُ كما وردت، ومواضعُها
--
--   ① سطرٌ يستهلك دفعتين ⟵ حركتان منفصلتان، كلٌّ بثمن دفعتها
--   ② المتبقّي مشتقٌّ لا مخزَّن: `sum(quantity_base) where lot_id = …`
--   ③ إطارُ المُدخَل على **الشريحة الأولى وحدَها**، والباقي `null`
--   ④ لا دفعةَ حقيقيّة ⟵ دفعةٌ مقدَّرةٌ بسلّم الدرجات ٢–٥، `estimated = true`
--   ⑤ النقلُ: **رقمُ السعر يُنسخ، والدفعةُ سجلٌّ منفصلٌ تمامًا** (id جديد)
--
-- ---------------------------------------------------------------------------
-- 🔴 والغرامةُ تُلمَس — بتصريحٍ صريحٍ من المالك، وبسببٍ مقيس
--
-- `stock_fine_lines_one_per_product unique (fine_id, product_id)` (٠٥٦أ:٢٢٧)
-- **يرفض سطرَ غرامةٍ لكلّ حركة** بعد الانقسام. فصار الإدراجُ **مجمَّعًا بالمنتج**:
-- `shortage_base` مجموعُ الكمّيّات، و`unit_value` متوسّطُها المرجَّح.
--
-- ⚠️ **والمزجُ يقع في الغرامة وحدَها، ولا يمسّ السجلّ:** `stock_movements` يبقى
-- دفعةً دفعةً بأسعارٍ مضبوطة. **والغرامةُ مطالبةُ إنسانٍ بمبلغٍ واحدٍ عن منتج**،
-- لا بيانٌ عن قيمة كلّ دفعة.
--
-- ⚠️ **وما عدا هذا الإدراجِ لم يُمسّ من منطق الغرامة حرفٌ واحد:** شرطُ الوجود ·
-- قراءةُ السياسة · تفريعُ `professional` · حصرُ المسؤولين · الرموزُ الثلاثة ·
-- `role_at_resolution` · وسباقُ القراءة الثانية الموصوفُ بالتعليق — **كلُّها
-- منقولةٌ حرفًا من النصّ الحيّ.**
--
-- ---------------------------------------------------------------------------
-- ⚠️ افتراضان لم يُنَصّ عليهما، مكتوبان كي يُرَدّا إن كانا خطأً
--
--   ⓐ **`received_at` لدفعة الوجهة في النقل = `p_doc_date`** (تاريخُ مستند
--     النقل) لا `received_at` دفعةِ المصدر. **القرارُ نصَّ على السعر وحدَه**،
--     ووصفُ العمود يقول «كما كتبه إنسانٌ على المستند (`doc_date`)». ⚠️ **والأثرُ
--     أن بضاعةً قديمةً منقولةً اليوم تصير الأحدثَ في وجهتها.**
--
--   ⓑ **`cost_is_estimated` يُنسخ من دفعة المصدر إلى دفعة الوجهة** — على سابقة
--     العكس: «الوصفُ يُورَّث مع الرقم».
--
-- ⚠️ **ولم يُغيَّر ما لم يُطلَب، وأذكر ما رأيتُه ولم ألمسه:** توريدٌ بكمّيّةٍ
-- سالبة يُنشئ دفعةً مسحوبةً سلفًا. **قائمٌ اليوم ولا يزيده هذا الملفُّ سوءًا**،
-- ولا رفضَ له في أيِّ طبقة — وهو خارج نطاق التكلفة فتُرك.
-- ==========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- ① سلّمُ التقدير — نصٌّ واحدٌ بدل ثلاثة
-- ═══════════════════════════════════════════════════════════════════════════
--
-- منقولٌ من الدرجات ٢–٥ في النصّ الحيّ **بلا تغييرٍ في الترتيب ولا في شرطٍ**:
--
--   ٢. آخرُ ثمنِ حركةٍ موجبةٍ لهذا المنتج **في هذا المستودع**
--   ٣. وإلّا آخرُ ثمنِ حركةٍ موجبةٍ له **في أيّ مستودعٍ بهذا الصالون**
--   ٤. وإلّا `nominal_purchase_price` من كتالوج المنتج
--   ٥. وإلّا صفر
--
-- 🔴 **والدرجةُ ١ سقطت، وهي كلُّ الغرض:** كانت «متوسّطًا مرجَّحًا لحركات هذا
-- المستودع» — **وهي المتوسّطُ الممزوجُ نفسُه الذي يلغيه هذا المحرّك.** فما
-- بقي من السلّم هو ما يُستعمل حين **لا دفعةَ يُسحب منها أصلًا**.
--
-- ⚠️ **ولذلك صار مكتوبًا مرّةً واحدة:** كان مكرَّرًا شبهَ حرفيٍّ في ثلاثٍ،
-- **وفرقُ حرفٍ بين نسختين منه لا يُكتشف إلّا بعد أن يختم أرقامًا.**
create or replace function public.open_estimated_lot(
  p_salon_id    uuid,
  p_storage_id  uuid,
  p_product_id  uuid,
  p_document_id uuid,
  p_doc_date    timestamptz
)
 returns uuid
 language plpgsql
as $function$
declare
  v_cost   numeric;
  v_lot_id uuid;
begin
  -- الدرجة ٢
  select m.unit_cost into v_cost
    from public.stock_movements m
   where m.salon_id = p_salon_id
     and m.storage_id = p_storage_id
     and m.product_id = p_product_id
     and m.quantity_base > 0
   order by m.created_at desc, m.id desc
   limit 1;

  -- الدرجة ٣
  if v_cost is null then
    select m.unit_cost into v_cost
      from public.stock_movements m
     where m.salon_id = p_salon_id
       and m.product_id = p_product_id
       and m.quantity_base > 0
     order by m.created_at desc, m.id desc
     limit 1;
  end if;

  -- الدرجة ٤
  if v_cost is null then
    select p.nominal_purchase_price into v_cost
      from public.products p
     where p.id = p_product_id and p.salon_id = p_salon_id;
  end if;

  -- الدرجة ٥
  v_cost := coalesce(v_cost, 0);

  -- ⚠️ حارسٌ جديد، وسببُه قيدٌ جديد: `stock_lots_unit_cost_check` يرفض السالب،
  -- **بينما الحركةُ كانت تقبله.** فبلا هذا السطر يسقط الترحيلُ كلُّه بـ`23514`
  -- خامًّا لا يقول للقارئ أيَّ منتجٍ ولا أيَّ حقلٍ يصلح.
  if v_cost < 0 then
    raise exception 'estimated_cost_negative'
      using hint = 'السعر الاسمي لهذا المنتج سالب، فما بينفع يصير أساسًا لتكلفة مقدَّرة. تصحيح السعر بنافذة المنتج، وبعدها إعادة المحاولة.';
  end if;

  insert into public.stock_lots (salon_id, storage_id, product_id, source_document_id,
                                 unit_cost, cost_is_estimated, received_at)
  values (p_salon_id, p_storage_id, p_product_id, p_document_id,
          v_cost, true, p_doc_date)
  returning id into v_lot_id;

  return v_lot_id;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ② السحبُ FIFO — الأقدمُ أوّلًا، شريحةً لكلّ دفعة
-- ═══════════════════════════════════════════════════════════════════════════
--
-- تُرجع صفًّا لكلّ دفعةٍ سُحب منها. **والمنادي يكتب الحركات**، لأن ما يكتبه
-- يختلف بين الدوالّ الثلاث (إطارُ المُدخَل · المجّانيّ · حركتا النقل) بينما
-- السحبُ واحد.
--
-- ⚠️ **الترتيبُ `(received_at, created_at, id)` تامٌّ عمدًا:** دفعتان بنفس
-- اليوم تتساويان بـ`received_at` وحدَه، **وترتيبٌ غيرُ تامٍّ يعطي قراءتين
-- مختلفتين لنفس السؤال.**
--
-- ⚠️ **والمتبقّي مجموعُ حركاتٍ لا عمودٌ يُقرأ** (ADR-051): الداخلُ موجبٌ
-- والخارجُ سالب، **فالعكسُ يصحّح المتبقّيَ من تلقاء نفسه** لأنه يكتب حركةً
-- بنفس `lot_id` بكمّيّةٍ معكوسة.
--
-- 🔴 **والنقصُ لا يُرفض — يُنشئ دفعةً مقدَّرة.** فمنتجٌ لم يُورَّد إلى هذا
-- المستودع قطُّ لا دفعةَ له يُشار إليها، **و`stock_movements.lot_id` هو
-- `NOT NULL`** — فبلا هذا الفرع تصير الحالةُ التي يخدمها السلّمُ اليومَ
-- **مستحيلةَ التسجيل**، وذلك تغييرُ سلوكٍ لم يقرّره أحد.
create or replace function public.draw_stock_from_lots(
  p_salon_id    uuid,
  p_storage_id  uuid,
  p_product_id  uuid,
  p_needed      numeric,
  p_document_id uuid,
  p_doc_date    timestamptz
)
 returns table (lot_id uuid, drawn numeric, unit_cost numeric, cost_is_estimated boolean)
 language plpgsql
as $function$
declare
  v_left numeric := p_needed;
  v_lot  record;
  v_rem  numeric;
  v_take numeric;
begin
  if p_needed is null or p_needed <= 0 then
    raise exception 'draw_quantity_invalid'
      using hint = 'الكمّية المسحوبة لازم تكون أكبر من صفر';
  end if;

  for v_lot in
    select l.id, l.unit_cost, l.cost_is_estimated
      from public.stock_lots l
     where l.salon_id   = p_salon_id
       and l.storage_id = p_storage_id
       and l.product_id = p_product_id
     order by l.received_at, l.created_at, l.id
  loop
    exit when v_left <= 0;

    select coalesce(sum(m.quantity_base), 0) into v_rem
      from public.stock_movements m
     where m.lot_id = v_lot.id;

    -- دفعةٌ استُنفدت أو انسحبت تحت الصفر: تُتخطّى ولا تُعالَج هنا.
    if v_rem <= 0 then
      continue;
    end if;

    v_take := least(v_rem, v_left);
    v_left := v_left - v_take;

    lot_id            := v_lot.id;
    drawn             := v_take;
    unit_cost         := v_lot.unit_cost;
    cost_is_estimated := v_lot.cost_is_estimated;
    return next;
  end loop;

  -- ما لم تغطِّه الدفعاتُ القائمة.
  if v_left > 0 then
    lot_id := public.open_estimated_lot(p_salon_id, p_storage_id, p_product_id,
                                        p_document_id, p_doc_date);
    select l.unit_cost into unit_cost from public.stock_lots l where l.id = lot_id;
    drawn             := v_left;
    cost_is_estimated := true;
    return next;
  end if;

  return;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ③ post_stock_document
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **التوريدُ والافتتاح:** الثمنُ يمليه إنسان ⟵ **دفعةٌ تُولد** ⟵ حركةٌ واحدة.
-- **وما عداهما:** سحبٌ FIFO ⟵ **حركةٌ لكلّ شريحة.**
--
-- ⚠️ والاتّجاهُ يُقرأ من إشارة الكمّية لا من نوع المستند: كمّيّةٌ موجبةٌ بمستندٍ
-- غيرِ توريديٍّ **دخولٌ بلا ثمنٍ مصرَّح** ⟵ دفعةٌ مقدَّرة. **وهي حالةٌ يقبلها
-- التوقيعُ اليومَ ولا يذكرها أحد**، فرفضُها هنا كان سيصير تغييرًا صامتًا.
CREATE OR REPLACE FUNCTION public.post_stock_document(p_doc_type stock_doc_type, p_storage_id uuid, p_lines jsonb, p_supplier_id uuid DEFAULT NULL::uuid, p_employee_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_doc_date timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text, p_supplier_doc_number text DEFAULT NULL::text, p_discount_kind text DEFAULT NULL::text, p_discount_value numeric DEFAULT NULL::numeric, p_transport_amount numeric DEFAULT NULL::numeric, p_transport_paid_to text DEFAULT NULL::text, p_paid_amount numeric DEFAULT NULL::numeric, p_payment_method text DEFAULT NULL::text)
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
  v_ids      uuid[];
  v_entered  numeric;
  v_bonus    numeric;
  v_lot_id   uuid;                                        -- ⟵ الدفعة
  v_slice    record;                                      -- ⟵ شريحةُ السحب
  v_first    boolean;                                     -- ⟵ إطارُ المُدخَل
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
  -- ⚠️ هذا هو قفلُ التزامن للدفعات كذلك، لا للمنتجات وحدَها: كلُّ قراءةٍ
  -- للمتبقّي تحته، فعمليّتان على نفس المنتج تتسلسلان هنا.
  perform 1 from products where id = any(v_ids) order by id for update;
  if (select count(*) from products where id = any(v_ids)) <> array_length(v_ids, 1) then
    raise exception 'product_not_found' using hint = 'منتج بالمستند غير موجود';
  end if;
  insert into stock_documents (salon_id, doc_type, storage_id, supplier_id,
                               employee_id, appointment_id, doc_date, note,
                               supplier_doc_number,
                               discount_kind, discount_value,
                               transport_amount, transport_paid_to,
                               paid_amount, payment_method)
  values (v_salon_id, p_doc_type, p_storage_id, p_supplier_id,
          p_employee_id, p_appointment_id, p_doc_date, p_note,
          p_supplier_doc_number,
          p_discount_kind, p_discount_value,
          p_transport_amount, p_transport_paid_to,
          p_paid_amount, p_payment_method)
  returning id into v_doc_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_pid := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'quantity_base')::numeric;
    if v_qty is null or v_qty = 0 then
      raise exception 'stock_line_zero' using hint = 'سطر بكمية صفر';
    end if;
    -- entered_quantity/bonus_quantity read ONCE here, so the value that is
    -- checked is the exact value that is stored -- not two separate reads of
    -- the same JSON that could in principle drift.
    v_entered := (v_line->>'entered_quantity')::numeric;
    v_bonus   := (v_line->>'bonus_quantity')::numeric;
    -- The line's shape is refused before its cost is ever computed.
    if v_bonus is not null then
      if p_doc_type not in ('supply', 'opening') then
        raise exception 'bonus_supply_only'
          using hint = 'البضاعة المجّانيّة تُسجَّل بالتوريد وحده';
      end if;
      if v_bonus < 0 then
        raise exception 'bonus_negative'
          using hint = 'الكمّية المجّانيّة لا تكون سالبة';
      end if;
      -- Protects the divisor, not the shape: a line's weight in the discount
      -- and freight split is (received - bonus) * price, and one negative
      -- weight corrupts every line's share, not only its own.
      if v_entered is null or v_bonus > v_entered then
        raise exception 'bonus_over_quantity'
          using hint = 'المجّانيّ جزءٌ من الكمّية المستلمة لا زيادةٌ عليها';
      end if;
    end if;

    if p_doc_type in ('supply', 'opening') then
      v_cost := (v_line->>'unit_cost')::numeric;
      if v_cost is null or v_cost < 0 then
        raise exception 'unit_cost_required' using hint = 'سعر الشراء إجباري بالتوريد';
      end if;

      -- 🔴 الدفعةُ تُولد هنا، وهذا هو الموضعُ الوحيدُ الذي يُملى فيه ثمنُها من
      -- إنسان. `received_at` من `p_doc_date` لا من `now()`: بضاعةٌ وصلت الأسبوع
      -- الماضي وسُجّلت اليوم أقدمُ من دفعة اليوم، **وتاريخُ الكتابة يقلب FIFO.**
      insert into public.stock_lots (salon_id, storage_id, product_id, source_document_id,
                                     unit_cost, cost_is_estimated, received_at)
      values (v_salon_id, p_storage_id, v_pid, v_doc_id, v_cost, false, p_doc_date)
      returning id into v_lot_id;

      insert into stock_movements (salon_id, document_id, storage_id, product_id,
                                   employee_id, quantity_base, unit_cost,
                                   entered_quantity, entered_uom,
                                   cost_is_estimated,
                                   entered_unit_price, line_discount_kind, line_discount_value,
                                   bonus_quantity, lot_id)
      values (v_salon_id, v_doc_id, p_storage_id, v_pid, p_employee_id,
              v_qty, v_cost,
              v_entered,
              (v_line->>'entered_uom')::entry_uom,
              false,
              (v_line->>'entered_unit_price')::numeric,
              v_line->>'line_discount_kind',
              (v_line->>'line_discount_value')::numeric,
              v_bonus, v_lot_id);

    elsif v_qty < 0 then
      -- 🔴 إخراج: شريحةٌ لكلّ دفعة، وحركةٌ لكلّ شريحة.
      v_first := true;
      for v_slice in
        select * from public.draw_stock_from_lots(
          v_salon_id, p_storage_id, v_pid, -v_qty, v_doc_id, p_doc_date)
      loop
        -- ⚠️ إطارُ المُدخَل ورفيقاتُه على الشريحة الأولى وحدَها: تكرارُهُ يجعل
        -- المجموعَ ضعفَ ما كُتب، وتقسيمُه يخترع رقمًا لم يكتبه أحد.
        insert into stock_movements (salon_id, document_id, storage_id, product_id,
                                     employee_id, quantity_base, unit_cost,
                                     entered_quantity, entered_uom,
                                     cost_is_estimated,
                                     entered_unit_price, line_discount_kind, line_discount_value,
                                     bonus_quantity, lot_id)
        values (v_salon_id, v_doc_id, p_storage_id, v_pid, p_employee_id,
                - v_slice.drawn, v_slice.unit_cost,
                case when v_first then v_entered end,
                case when v_first then (v_line->>'entered_uom')::entry_uom end,
                v_slice.cost_is_estimated,
                case when v_first then (v_line->>'entered_unit_price')::numeric end,
                case when v_first then v_line->>'line_discount_kind' end,
                case when v_first then (v_line->>'line_discount_value')::numeric end,
                case when v_first then v_bonus end,
                v_slice.lot_id);
        v_first := false;
      end loop;

    else
      -- دخولٌ بمستندٍ لا يحمل ثمنًا مصرَّحًا ⟵ دفعةٌ مقدَّرة، نفسُ آليّة فائض الجرد.
      v_lot_id := public.open_estimated_lot(v_salon_id, p_storage_id, v_pid,
                                            v_doc_id, p_doc_date);
      select l.unit_cost into v_cost from public.stock_lots l where l.id = v_lot_id;

      insert into stock_movements (salon_id, document_id, storage_id, product_id,
                                   employee_id, quantity_base, unit_cost,
                                   entered_quantity, entered_uom,
                                   cost_is_estimated,
                                   entered_unit_price, line_discount_kind, line_discount_value,
                                   bonus_quantity, lot_id)
      values (v_salon_id, v_doc_id, p_storage_id, v_pid, p_employee_id,
              v_qty, v_cost,
              v_entered,
              (v_line->>'entered_uom')::entry_uom,
              true,
              (v_line->>'entered_unit_price')::numeric,
              v_line->>'line_discount_kind',
              (v_line->>'line_discount_value')::numeric,
              v_bonus, v_lot_id);
    end if;
  end loop;
  return v_doc_id;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ④ transfer_stock
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🔴 **دفعةٌ جديدةٌ في الوجهة لكلّ شريحةٍ من المصدر** — قرارُ المالك: «النقل
-- يغيّر المكان فقط لا السعر، ومفهومُ الدفعة مرتبطٌ بمستودعٍ واحدٍ بعينه».
-- **فالرقمُ يُنسخ، والسجلُّ منفصلٌ تمامًا: `id` جديد، ولا إشارةَ لدفعة المصدر.**
--
-- ⚠️ **وحركتان لكلّ شريحةٍ لا لكلّ سطر**: سالبةٌ على دفعة المصدر، وموجبةٌ على
-- دفعة الوجهة الوليدة — **وثمنُهما واحد**، فالنقلُ لا يخلق قيمةً ولا يفنيها.
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
  v_ids      uuid[];
  v_slice    record;
  v_to_lot   uuid;
  v_first    boolean;
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
  perform 1 from storages where id = p_to_storage_id;
  if not found then
    raise exception 'storage_not_found' using hint = 'مستودع الوجهة غير موجود';
  end if;
  select array_agg(distinct (l->>'product_id')::uuid)
    into v_ids from jsonb_array_elements(p_lines) l;
  -- ⚠️ قفلُ التزامن للدفعات كذلك — انظر ترويسةَ الملفّ.
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

    v_first := true;
    for v_slice in
      select * from public.draw_stock_from_lots(
        v_salon_id, p_from_storage_id, v_pid, v_qty, v_doc_id, p_doc_date)
    loop
      -- الدفعةُ الوليدةُ في الوجهة: نفسُ الرقم، سجلٌّ آخر.
      -- ⚠️ `cost_is_estimated` يُنسخ كما يُنسخ الثمن — الوصفُ يُورَّث مع الرقم،
      -- على سابقة العكس. **والنقلُ لا يجعل ثمنًا مقدَّرًا ثمنًا معروفًا.**
      insert into public.stock_lots (salon_id, storage_id, product_id, source_document_id,
                                     unit_cost, cost_is_estimated, received_at)
      values (v_salon_id, p_to_storage_id, v_pid, v_doc_id,
              v_slice.unit_cost, v_slice.cost_is_estimated, p_doc_date)
      returning id into v_to_lot;

      insert into stock_movements (salon_id, document_id, storage_id, product_id,
                                   employee_id, quantity_base, unit_cost,
                                   entered_quantity, entered_uom,
                                   cost_is_estimated, lot_id)
      values
        (v_salon_id, v_doc_id, p_from_storage_id, v_pid, p_employee_id,
         - v_slice.drawn, v_slice.unit_cost,
         case when v_first then (v_line->>'entered_quantity')::numeric end,
         case when v_first then (v_line->>'entered_uom')::entry_uom end,
         v_slice.cost_is_estimated, v_slice.lot_id),
        (v_salon_id, v_doc_id, p_to_storage_id,   v_pid, p_employee_id,
           v_slice.drawn, v_slice.unit_cost,
         case when v_first then (v_line->>'entered_quantity')::numeric end,
         case when v_first then (v_line->>'entered_uom')::entry_uom end,
         v_slice.cost_is_estimated, v_to_lot);

      v_first := false;
    end loop;
  end loop;
  return v_doc_id;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ⑤ post_stocktake_session
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **العجزُ** سحبٌ FIFO ⟵ حركةٌ لكلّ شريحة. **والفائضُ** دفعةٌ مقدَّرةٌ ⟵ حركةٌ
-- واحدة. **وإطارُ المُدخَل يبقى `null, null` على الجميع** كما هو اليوم: العادُّ
-- كتب عددًا، والحركةُ فرقٌ مشتقٌّ منه — **ولا واحدٌ من الثلاثة (العدد · الفرق ·
-- ولا شيء) لا يدّعي شيئًا غيرَ صحيحٍ إلّا الثالث.**
--
-- 🔴 **وسطرُ الغرامةِ مجمَّعٌ بالمنتج** — القيدُ يرفض غيرَه. وما عداه من منطق
-- الغرامة منقولٌ حرفًا.
CREATE OR REPLACE FUNCTION public.post_stocktake_session(p_session_id uuid, p_employee_id uuid DEFAULT NULL::uuid, p_doc_date timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_salon_id   uuid;
  v_storage_id uuid;
  v_posted     uuid;
  v_doc_id     uuid;
  v_row        record;
  v_balance    numeric;
  v_diff       numeric;
  v_cost       numeric;
  v_ids        uuid[];
  v_slice      record;
  v_lot_id     uuid;
  -- ⑥ the fine. p_employee_id is who POSTS; v_charged_id is who PAYS, and they
  -- are different questions with different answers.
  v_kind         public.storage_kind;
  v_owner_id     uuid;
  v_fine_percent numeric;
  v_fine_basis   public.fine_basis;
  v_candidates   uuid[];
  v_charged_id   uuid;
  v_resolution   public.fine_resolution;
  v_role_text    text;
  v_fine_id      uuid;
begin
  -- ④ The session is the idempotency key, and `for update` is what makes it
  -- one: two posts at the same instant serialise here instead of both reading
  -- "not posted" and both writing a document.
  select salon_id, storage_id, document_id
    into v_salon_id, v_storage_id, v_posted
    from stocktake_sessions
   where id = p_session_id
     for update;
  if not found then
    raise exception 'session_not_found' using hint = 'جلسة الجرد غير موجودة';
  end if;
  if v_posted is not null then
    raise exception 'session_already_posted' using hint = 'هذا الجرد مُرحَّل من قبل';
  end if;
  -- ① The products come from the table now. Same lock, same ordering, same
  -- existence check as the canonical body.
  select array_agg(distinct product_id) into v_ids
    from stocktake_counts where session_id = p_session_id;
  if v_ids is not null and array_length(v_ids, 1) > 0 then
    perform 1 from products where id = any(v_ids) order by id for update;
    if (select count(*) from products where id = any(v_ids)) <> array_length(v_ids, 1) then
      raise exception 'product_not_found' using hint = 'منتج بالمستند غير موجود';
    end if;
  end if;
  insert into stock_documents (salon_id, doc_type, storage_id, employee_id, doc_date, note)
  values (v_salon_id, 'stocktake', v_storage_id, p_employee_id, p_doc_date, p_note)
  returning id into v_doc_id;
  -- Ordered so two runs of the same data take the products in the same
  -- sequence. It changes no result, and it makes a diff of two runs readable.
  for v_row in
    select id, product_id, counted_base
      from stocktake_counts
     where session_id = p_session_id
     order by product_id
  loop
    -- The table's CHECK already refuses a negative count and a null. Kept
    -- anyway, and not as decoration: a CHECK is one ALTER away from being
    -- dropped, and this costs one comparison per line.
    if v_row.counted_base is null or v_row.counted_base < 0 then
      raise exception 'count_invalid' using hint = 'العدد لازم يكون صفرًا أو أكبر';
    end if;
    select coalesce(sum(quantity_base), 0) into v_balance
      from stock_movements
     where storage_id = v_storage_id and product_id = v_row.product_id;
    v_diff := v_row.counted_base - v_balance;
    -- ② ⚠️ WRITTEN FOR EVERY COUNTED PRODUCT, BEFORE the zero-difference skip
    -- below. This is the record that the product was counted and what the
    -- database believed at that instant — the fact that does not exist today.
    -- It is also why it is written HERE and not at counting time: this is the
    -- balance the difference was computed from, under this lock, and with a
    -- resumable session the two moments can be days apart.
    update stocktake_counts
       set balance_at_post = v_balance
     where id = v_row.id;
    if v_diff = 0 then
      continue;
    end if;

    if v_diff < 0 then
      -- 🔴 عجزٌ: سحبٌ FIFO، حركةٌ لكلّ دفعة.
      for v_slice in
        select * from public.draw_stock_from_lots(
          v_salon_id, v_storage_id, v_row.product_id, - v_diff, v_doc_id, p_doc_date)
      loop
        -- ⑤ Explicit NULLs for the entered pair. The person typed a count and the
        -- movement is a difference derived from it; of the three possible answers
        -- (the count, the difference, neither) only neither makes no untrue claim.
        insert into stock_movements (salon_id, document_id, storage_id, product_id,
                                     employee_id, quantity_base, unit_cost,
                                     entered_quantity, entered_uom,
                                     cost_is_estimated, lot_id)
        values (v_salon_id, v_doc_id, v_storage_id, v_row.product_id, p_employee_id,
                - v_slice.drawn, v_slice.unit_cost,
                null, null,
                v_slice.cost_is_estimated, v_slice.lot_id);
      end loop;
    else
      -- 🔴 فائضٌ: بضاعةٌ لا سجلَّ لها، ولا مورّدَ ولا فاتورة ⟵ دفعةٌ مقدَّرة.
      v_lot_id := public.open_estimated_lot(v_salon_id, v_storage_id, v_row.product_id,
                                            v_doc_id, p_doc_date);
      select l.unit_cost into v_cost from public.stock_lots l where l.id = v_lot_id;

      insert into stock_movements (salon_id, document_id, storage_id, product_id,
                                   employee_id, quantity_base, unit_cost,
                                   entered_quantity, entered_uom,
                                   cost_is_estimated, lot_id)
      values (v_salon_id, v_doc_id, v_storage_id, v_row.product_id, p_employee_id,
              v_diff, v_cost,
              null, null,
              true, v_lot_id);
    end if;
  end loop;
  -- ⑥ ------------------------------------------------------------------------
  -- THE FINE. Only when this stocktake actually lost something: a shortage is a
  -- negative movement of this document, and nobody is fined for finding more.
  -- An absent fine row therefore means "nothing was short", which is exactly
  -- what stock_fines' own comment promises a reader.
  if exists (select 1 from stock_movements
              where document_id = v_doc_id and quantity_base < 0) then
    -- The policy, read at POSTING because that is the anchor, and read with
    -- salon_id as well as id: the composite key already makes another salon's
    -- storage unreferenceable, and a query that is correct on its own is
    -- correct after somebody edits the key.
    select s.kind, s.owner_employee_id, s.fine_percent, s.fine_basis
      into v_kind, v_owner_id, v_fine_percent, v_fine_basis
      from storages s
     where s.id = v_storage_id and s.salon_id = v_salon_id;
    -- ⚠️ `select ... into` over zero rows assigns NULL rather than leaving the
    -- variables alone, so without this the missing storage would arrive as a
    -- missing POLICY two lines below and be reported as the wrong thing.
    if not found then
      raise exception 'storage_not_found' using hint = 'مستودع الجرد غير موجود';
    end if;
    if v_fine_percent is null or v_fine_basis is null then
      raise exception 'fine_policy_missing'
        -- ⚠️ The sentence uses المصدر rather than الأمر, so it addresses nobody
        -- by gender — CLAUDE.md's rule for new text, and a hint IS new text:
        -- it reaches the screen verbatim. The named key wins over it anyway
        -- (products:stocktake.finePolicyMissing), because a key is translatable
        -- and this is Arabic living in the database.
        using hint = 'ما بينفع ترحيل الجرد وهذا المستودع بلا سياسة غرامة. تعيين نسبة الغرامة وأساسها بنافذة المستودع، وبعدها إعادة الترحيل.';
    end if;
    if v_kind = 'professional' then
      -- One owner, structurally. storages_owner_matches_kind_check makes the
      -- equivalence, so there is nothing to search and nothing to count.
      v_charged_id := v_owner_id;
      v_resolution := 'storage_owner';
      v_role_text  := null;
    else
      -- Everybody this storage makes answerable, by either route, counted once.
      select array_agg(distinct e.id) into v_candidates
        from employees e
       where e.salon_id = v_salon_id
         and exists (select 1 from storage_responsibles r
                      where r.storage_id = v_storage_id
                        and r.salon_id   = v_salon_id
                        and (r.employee_id = e.id or r.role = e.role));
      if coalesce(array_length(v_candidates, 1), 0) <> 1 then
        -- Zero and many are the same answer to "who pays" and different answers
        -- to "why not", so the row is written either way and says which.
        v_charged_id := null;
        v_role_text  := null;
        v_resolution := case when coalesce(array_length(v_candidates, 1), 0) = 0
                             then 'no_responsible'
                             else 'many_responsibles' end;
      else
        v_charged_id := v_candidates[1];
        if exists (select 1 from storage_responsibles r
                    where r.storage_id = v_storage_id
                      and r.salon_id   = v_salon_id
                      and r.employee_id = v_charged_id) then
          v_resolution := 'named_responsible';
          v_role_text  := null;
        else
          -- Her own role IS the role that resolved her: employees.role is a
          -- single NOT NULL column, so she holds exactly one and it must be one
          -- of the ticked ones for her to be here at all.
          --
          -- ⚠️ A SECOND READ, AND THE RACE IT OPENS IS NAMED HERE SO NOBODY HAS
          -- TO DIAGNOSE IT LATER. Raised in review. This row is not locked, and
          -- nothing protects her: the RESTRICT on storage_responsibles.
          -- employee_id only covers a NAMED responsible, and this branch is
          -- reached precisely because she is NOT named. If she is deleted
          -- between the candidate query and this line, `select ... into` over
          -- zero rows assigns NULL — so v_role_text goes null while resolution
          -- stays 'role_responsible', and
          -- stock_fines_role_text_matches_resolution_check refuses the row.
          --
          -- ⚠️ The failure is SAFE and MISLEADING, which is why it is written
          -- down: no wrong data is stored, the whole posting rolls back, and the
          -- message will read as a defect in this function when it is a rare
          -- race. It has been left as-is on the reviewer's call.
          --
          -- The alternative, if it ever earns its cost: read the role in the
          -- candidate query itself (a single-member candidate set has exactly
          -- one role, so an aggregate over it IS her role) — one snapshot, no
          -- second read, no race. Not done today because it makes the one query
          -- the fine's correctness rests on do two things, and this file's own
          -- constraint is that its logic be simple enough to be SEEN correct.
          select e.role::text into v_role_text
            from employees e where e.id = v_charged_id and e.salon_id = v_salon_id;
          v_resolution := 'role_responsible';
        end if;
      end if;
    end if;
    -- ⚠️ The id is generated rather than RETURNED: RETURNING would apply
    -- stock_fines_select, which is not the plain salon predicate, and would
    -- refuse a poster who is neither the fined employee nor a manager.
    v_fine_id := gen_random_uuid();
    insert into stock_fines (id, salon_id, document_id, storage_id, employee_id,
                             attribution, resolution, role_at_resolution,
                             fine_percent, fine_basis)
    -- attribution is written out although the column defaults to it: what is
    -- being claimed is the point of the row, and a default states it in a place
    -- nobody reading this function would look.
    values (v_fine_id, v_salon_id, v_doc_id, v_storage_id, v_charged_id,
            'posting', v_resolution, v_role_text,
            v_fine_percent, v_fine_basis);
    -- The lines come from the movements this function just wrote, not from a
    -- tally kept alongside the loop: one source, so the fine and the ledger
    -- cannot disagree about what was missing or what it was worth.
    --
    -- The sign is dropped here — a fine line means "this much was missing", and
    -- carrying the movement's minus would put one into every sum forever.
    --
    -- 🔴 ‏**مجمَّعٌ بالمنتج — و`stock_fine_lines_one_per_product` هو ما يفرضه.**
    -- العجزُ الواحدُ صار حركاتٍ عدّة، وسطرٌ لكلّ حركةٍ يعطي صفَّين بنفس
    -- `(fine_id, product_id)` فيرفضهما القيدُ بـ`23505` **ويسقط الترحيلَ كلَّه.**
    --
    -- ⚠️ **والمتوسّطُ المرجَّحُ هنا ليس تقديرًا:** بسطُه ومقامُه من تكاليف الدفعات
    -- المسحوبة فعلًا. **والمزجُ يقع في سطر الغرامة وحدَه**، و`stock_movements`
    -- يبقى دفعةً دفعةً بأسعارٍ مضبوطة — **لأن الغرامةَ «كم يدفع الموظّف» لا
    -- «قيمةُ كلّ دفعةٍ على حدة».**
    --
    -- ⚠️ والإشارتان تُلغيان بعضَهما: البسطُ والمقامُ سالبان معًا، فالناتجُ موجب.
    -- **و`- sum(quantity_base)` موجبٌ كذلك**، فيمرّ `stock_fine_lines_amounts_check`.
    --
    -- ⚠️ **والتجميعُ بأعمدة المنتج لا بـ`max()`**: الوصلُ ١:١ على المنتج فلا
    -- تنقسم المجموعةُ بها، **وهي أوضحُ من دالّةِ تجميعٍ مكتوبةٍ لتهريب عمود.**
    insert into stock_fine_lines (salon_id, fine_id, product_id,
                                  shortage_base, unit_value)
    select v_salon_id, v_fine_id, m.product_id,
           - sum(m.quantity_base),
           case v_fine_basis
             when 'purchase_price'
               then sum(m.quantity_base * m.unit_cost) / sum(m.quantity_base)
             -- ⚠️ nullif ON THE DIVISOR — AND IT IS DEAD CODE TODAY, PROVABLY.
             -- Keep it; do not read it as load-bearing.
             --
             -- The history matters more than the line. "units_per_package is
             -- CHECKed > 0" was asserted twice from DATABASE_DIAGRAM:528 and
             -- never read from the catalogue, so review demanded a measurement.
             -- 064_2 then answered:
             --
             --   products_units_per_package_check | c |
             --     CHECK ((units_per_package > (0)::numeric))
             --
             -- The document was telling the truth. 064_1 adds NOT NULL with
             -- default 1, and 064_3 found zero nulls, zero zeroes, zero
             -- negatives across seven products.
             --
             -- ⚠️ SO THE CLAIM THIS COMMENT USED TO MAKE WAS ITSELF UNMEASURED.
             -- It said zero was "reachable, not hypothetical" because
             -- productForm.js:200 sends Number('') === 0. That is true about the
             -- SCREEN and false about the COLUMN: the constraint refuses it with
             -- 23514 and no such row is ever stored. The divisor reads the
             -- column, and only the column. A comment written while correcting
             -- an unmeasured claim had become an unmeasured claim.
             --
             -- Both branches are now closed by measurement, not by argument:
             --   row present -> NOT NULL and > 0, so nullif never fires
             --   row absent  -> the LEFT JOIN already yields NULL, and the
             --                  division is NULL with or without nullif
             --
             -- ⚠️ It stays for one narrow reason only: the CHECK is one ALTER
             -- away from removal, and this costs a single comparison on a path
             -- that runs once per posting. That is insurance against a future
             -- schema change — NOT a guard against a value that can occur today.
             when 'sales_price'    then coalesce(p.package_price / nullif(p.units_per_package, 0), 0)
           end
      from stock_movements m
      -- ⚠️ LEFT, and the reason is the direction it fails in. An inner join
      -- drops a shortage line whose product it cannot see — a fine quietly
      -- SHORTER than the shortage, with nothing to read as the reason. A left
      -- join keeps the line and lets the price arrive NULL, which coalesce
      -- turns into the 0 that was already the decided answer for "no price".
      --
      -- Neither can happen today: stock_movements.product_id is RESTRICT so the
      -- row exists, and products' RLS is the plain salon predicate matching
      -- m.salon_id. The join is written for the direction it fails in anyway,
      -- because "cannot happen today" is the sentence this project has had to
      -- withdraw most often.
      left join products p on p.id = m.product_id and p.salon_id = m.salon_id
     where m.document_id = v_doc_id
       and m.quantity_base < 0
     group by m.product_id, p.package_price, p.units_per_package;
  end if;
  -- ③ ⚠️ LAST STATEMENT BEFORE THE RETURN, and that placement is the design.
  -- Until this runs the session is OPEN, so every update above touched counts
  -- belonging to an open session — which is what lets stocktake_counts' UPDATE
  -- policy be narrowed to open sessions later without the posting path failing
  -- at `0 rows affected`. Moving this line up would break that silently.
  update stocktake_sessions
     set document_id = v_doc_id
   where id = p_session_id;
  return v_doc_id;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ⑥ reverse_stock_document — سطرٌ في القائمة وسطرٌ في الـ`select`، وانتهى
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ✅ **ولا سلّمَ فيها ولا سحب.** العكسُ ينسخ `m.lot_id` كما ينسخ `m.unit_cost`،
-- **فترجع البضاعةُ إلى دفعتها هي بلا بحثٍ ولا توزيعٍ عكسيّ** — وهذه هي الفائدةُ
-- التي جعلت جدولَ الوصل بين الحركة والدفعة غيرَ لازمٍ أصلًا (٠٩٤).
--
-- ⚠️ **و`lot_id` لا يُنفى** كما لا يُنفى `unit_cost` ولا `entered_quantity`:
-- المنفيُّ هو `quantity_base` وحدَه، لأن البضاعةَ هي التي تتحرّك بالاتّجاه
-- الآخر. **والدفعةُ لا تنعكس — يُعاد إليها ما خرج منها.**
--
-- ⚠️ **وسطرٌ انقسم على دفعتين يُعكس شريحتين**، كلٌّ إلى دفعتها: `insert … select`
-- يمرّ على كلّ حركةٍ من المستند الأصليّ بلا تضييق، **فالانقسامُ يُورَّث مجّانًا.**
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
  insert into stock_movements (salon_id, document_id, storage_id, product_id,
                               employee_id, quantity_base, unit_cost,
                               entered_quantity, entered_uom,
                               cost_is_estimated,
                               entered_unit_price, line_discount_kind, line_discount_value,
                               bonus_quantity, lot_id)
  select v_src.salon_id, v_doc_id, m.storage_id, m.product_id, m.employee_id,
         -m.quantity_base, m.unit_cost, m.entered_quantity, m.entered_uom,
         m.cost_is_estimated,
         m.entered_unit_price, m.line_discount_kind, m.line_discount_value,
         m.bonus_quantity, m.lot_id
    from stock_movements m
   where m.document_id = p_document_id;
  return v_doc_id;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ⑦ الوصفُ المودَعُ بالقاعدة يتبع السلوك
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ **وصفٌ يصف سلوكًا يصير جزءًا منه لمّا يُشحَن** — وقعت هذه فعلًا بسكربت ٤٣
-- واحتاجت ٠٤٦ لتصحيحها. فالوصفُ القديم يقول إن التقدير «يقع في فائض الجرد
-- وحدَه»، **وصار له موضعان بعد قرار المالك.**
comment on column public.stock_lots.cost_is_estimated is
  'هل جاء السعرُ من ثمنٍ دُفع فعلًا. false = ثمنٌ أملاه إنسانٌ على مستند توريدٍ أو افتتاح، أو نسخةٌ منه انتقلت بنقلٍ بين مستودعين. true = بديلٌ اشتُقّ لأن لا ثمنَ كان متاحًا، ويقع في موضعين لا واحد: فائضُ الجرد (بضاعةٌ ظهرت بلا مورّدٍ ولا فاتورة)، وإخراجٌ لا تغطّيه دفعاتٌ قائمة (منتجٌ لم يُورَّد إلى هذا المستودع، أو خرج منه أكثرُ مما دخل) — والاثنان يمرّان على نفس السلّم: آخرُ ثمنٍ هنا، فآخرُ ثمنٍ بأيّ مستودع، فالسعرُ الاسميّ بالكتالوج، فصفر. ⚠️ ونفسُ معنى العمود على stock_movements بالضبط، لا معنًى ثانٍ.';

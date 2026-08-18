-- ==========================================================================
-- ١٠١ — **الإرجاعُ إلى مورّد لا يقدّر أبدًا** — حارسان لا واحد، مرآةُ الشطب:
--         `return_not_outgoing`  ⟵ الكمّيّةُ الموجبةُ تُرفَض
--         `insufficient_stock`   ⟵ التجاوزُ يُرفَض ولا يُقدَّر
--       تغييرٌ فقط، ولا `select` في هذا الملفّ. والتحقّقُ ١٠١ب.
--
-- 🔴 مُجهَّزٌ ولم أشغّله. المالكُ ينفّذه بيده بعد مراجعته.
-- ترتيبُ التشغيل: ٠٩٩ ✅ ⟵ ٠٩٩ب ✅ ⟵ **١٠١ (هذا)** ⟵ ١٠١ب.
--
-- ⚠️ **و`auth.uid()` فارغةٌ في المحرّر وRLS متجاوَزةٌ بالكامل** — فنجاحُ هذا
-- الملفّ يثبت الحفظَ بلا خطأٍ نحويّ **ولا شيءَ غيره.** والعزلُ مُثبَتٌ سلفًا
-- بـ٠٩٤ب، والسلوكُ يُقاس بـ١٠١ب.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- قرارُ صاحب النظام، ونصُّه محفوظٌ لأن الكودَ بُني عليه
--
-- «تُرفض تلقائيًا، بالضبط متل الشطب… مقتصرين حصرًا على
--  `p_doc_type = 'return_to_supplier'`، مع الفحص الصريح إنو الأنواع التلاتة
--  التانية ما زالت تقدّر متل ما هي.»
--
-- ⚠️ **والسؤالُ كان معلَّقًا وأنا حسمتُه في الكود قبل أن أطرحه** — كتبتُ في
-- `lib/returnGrid.js` أن الإرجاع يبقى مقدِّرًا **وثبّتُّه باختبار**، أي قدّمتُ
-- قرارًا أمرًا واقعًا. **هذا خطأُ إجراءٍ مسجَّلٌ هنا، والاختبارُ يُعكَس مع هذا
-- السكربت** كي لا يبقى فحصٌ يثبّت سلوكًا أُلغي.
--
-- ---------------------------------------------------------------------------
-- 🔴 ولماذا الرفضُ صحيحٌ — وما يفعله التقديرُ فعلًا، مقيسًا من ٠٩٥
--
-- `draw_stock_from_lots` عند النقص تنادي `open_estimated_lot`، **وهي تولّد
-- دفعةً بلا حركةِ دخولٍ إطلاقًا** (تُدرج في `stock_lots` وحدَها). ثمّ يكتب
-- المتصلُ عليها حركةً بـ`-v_left`.
--
--   ⇒ **دفعةٌ متبقّيها سالبٌ، بثمنٍ مخترَع.** وثلاثةُ آثارٍ تتبعها:
--
--     الرصيد  تطرح من رصيد المنتج **إلى الأبد**
--     FIFO    `if v_rem <= 0 then continue` ⟵ **غيرُ مرئيّةٍ لأيّ سحبٍ لاحق**
--     المال   ثمنٌ مخترَعٌ على **مستندٍ يحمل مطالبةً لمورّدٍ حقيقيّ**
--
-- **ولا تستطيع أن تعيد ما ليس موجودًا، كما لا تستطيع أن تتلفه.** والفرقُ يزيد
-- الإرجاعَ ثقلًا لا يخفّفه: **الشطبُ بلا طرفٍ مقابل، والإرجاعُ له مورّدٌ ورقمٌ
-- يُطالَب به.**
--
-- ⚠️ **والحجّةُ المضادّةُ التي تصحّ للبيع لا تصحّ هنا:** البيعُ يقدّر كي لا
-- يُحجَب زبونٌ واقفٌ أمامك، **والإرجاعُ لا أحدَ ينتظره** — وتصحيحُه (تسجيلُ
-- التوريد الناقص أوّلًا) رخيصٌ ومتاح. **ولذلك `sale` و`service_consumption`
-- تبقيان تقدّران بلا حرفٍ يتغيّر.**
--
-- ---------------------------------------------------------------------------
-- ✅ ولا `DROP FUNCTION` هنا — والفرقُ عن ٠٩٩ مقصود
--
-- ٠٩٩ **أضاف معاملًا** فصنع overload، فلزمه حذفٌ صريحٌ بالتوقيع الكامل (البند ٥
-- في `CLAUDE.md`). **وهذا يغيّر الجسمَ وحدَه والتوقيعُ حرفًا بحرفٍ كما هو** —
-- فـ`CREATE OR REPLACE` استبدالٌ حقيقيٌّ لا نسخةٌ ثانية.
--
-- ⚠️ **ومع ذلك `CREATE OR REPLACE` يصفّر كلَّ خاصّيّةٍ غيرِ مذكورة** — ونسخةُ
-- ٠٩٩ **بلا `SECURITY DEFINER` وبلا `search_path`** (مقيسٌ: صفرُ ذكرٍ لهما في
-- نصّها)، **فالترويسةُ هنا مطابقةٌ لها فلا يُفقد شيء.** و١٠١ب يقرأ الخاصّيّتين
-- راجعتين بدل أن يُفترض.
--
-- ---------------------------------------------------------------------------
-- والجسمُ مشتقٌّ آليًّا من ٠٩٩ بمرساتين، والفرقُ **مقيسٌ بـ`diff` لا مُدَّعًى**
--
--   ٦ أسطرٍ حُذفت  ⟵ أربعةُ تعليقاتٍ نُقلت · `if v_pick is null then` · سطرُ الرسالة
--   ٤٣ سطرًا أُضيف ⟵ الحارسان بتعليلهما · الشرطان · و`case` الرسالتين
--
-- ⚠️ **والرقمُ ٤٣ أُعيد قياسُه بعد إضافة الحارس الثاني، ولم يُنقَل.** كان ٢٤ في
-- النسخة السابقة، **وترويسةٌ تحمل عددًا صار قديمًا هي عينُ صنف «تعليقٌ صحيحٌ يومَ
-- كُتب يصير كذبًا بصمت».** والمحذوفاتُ بقيت الستَّ نفسَها — فالحارسُ إضافةٌ
-- خالصةٌ لا تمسّ سطرًا قائمًا.
--
-- ✅ **وكتلةُ الاستعلام مطابقةٌ حرفًا** (`select coalesce(sum(s.rem) …` بأسطرها
-- العشرة) — **مقيسٌ لا مقروءٌ بالعين**، وهي أخطرُ ما في الحارس: مجموعٌ على
-- الدفعات ذاتِ المتبقّي الموجب **وحدَها**، لأن السحبَ يتخطّى ما دونها.
--
-- ---------------------------------------------------------------------------
-- ✅ والفتحةُ التي سمّيتُها أُغلقت في نفس الدفعة — بقرار صاحب النظام
--
-- **سمّيتُها ولم أُصلحها**، وذلك كان الصواب: «لا أقرّره وحدي». **وجاء القرار:
-- سكّروها، بنفس حماية الشطب بالضبط.** فأُضيف `return_not_outgoing` مرآةً
-- لـ`write_off_not_outgoing`، **قبل فحص التوفّر لا بعده.**
--
-- 🔴 **والسببُ الذي يجعل إغلاقَها الآن أهمَّ من تركها:** شاشتُنا لا تنتج كمّيّةً
-- موجبةً اليوم (`returnLinesFromGrid` تُرسل السالبَ دائمًا) — **وحارسٌ قائمٌ على
-- «لا مُنادِيَ له اليوم» يسقط يومَ تتغيّر شاشةٌ أو ينادي الدالّةَ مكانٌ آخر.**
-- ⚠️ **وسقوطُه صامتٌ تمامًا**، لأن الناتجَ **دفعةٌ صحيحةُ الشكل بثمنٍ مخترَع** لا
-- خطأٌ يُرى.
--
-- ⚠️ **والشرطُ `v_qty < 0` في فحص التوفّر يبقى مكتوبًا رغم الحارس الجديد** —
-- **حارسٌ للشكل بعد أن صار المعنى محروسًا فوقه.** بلا وجودِه يُقرأ `- v_qty`
-- سالبًا على الموجب فيمرّ الفحصُ دائمًا، **وهو ما يجعل الملفَّ صحيحًا حتى لو
-- نُقل الحارسُ الأوّلُ يومًا أو أُعيد ترتيبُه.**
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.post_stock_document(p_doc_type stock_doc_type, p_storage_id uuid, p_lines jsonb, p_supplier_id uuid DEFAULT NULL::uuid, p_employee_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_doc_date timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text, p_supplier_doc_number text DEFAULT NULL::text, p_discount_kind text DEFAULT NULL::text, p_discount_value numeric DEFAULT NULL::numeric, p_transport_amount numeric DEFAULT NULL::numeric, p_transport_paid_to text DEFAULT NULL::text, p_paid_amount numeric DEFAULT NULL::numeric, p_payment_method text DEFAULT NULL::text, p_doc_number text DEFAULT NULL::text)
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
  v_lot_id   uuid;
  v_slice    record;
  v_first    boolean;
  v_pick     uuid;
  v_est      boolean;
  v_rem      numeric;
  v_avail    numeric;                                     -- ⟵ ٠٩٧: المتاحُ كلُّه
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
  -- ⚠️ هذا هو قفلُ التزامن للدفعات كذلك: كلُّ قراءةٍ للمتبقّي تحته، **وبضمنها
  -- فحصُ المتاح أدناه** — فعمليّتان على نفس المنتج تتسلسلان هنا ولا تقرآن
  -- إجماليًّا واحدًا ثمّ تسحبانه مرّتين.
  perform 1 from products where id = any(v_ids) order by id for update;
  if (select count(*) from products where id = any(v_ids)) <> array_length(v_ids, 1) then
    raise exception 'product_not_found' using hint = 'منتج بالمستند غير موجود';
  end if;
  insert into stock_documents (salon_id, doc_type, storage_id, supplier_id,
                               employee_id, appointment_id, doc_date, note,
                               supplier_doc_number,
                               discount_kind, discount_value,
                               transport_amount, transport_paid_to,
                               paid_amount, payment_method, doc_number)
  values (v_salon_id, p_doc_type, p_storage_id, p_supplier_id,
          p_employee_id, p_appointment_id, p_doc_date, p_note,
          p_supplier_doc_number,
          p_discount_kind, p_discount_value,
          p_transport_amount, p_transport_paid_to,
          p_paid_amount, p_payment_method, p_doc_number)
  returning id into v_doc_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_pid := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'quantity_base')::numeric;
    if v_qty is null or v_qty = 0 then
      raise exception 'stock_line_zero' using hint = 'سطر بكمية صفر';
    end if;
    v_entered := (v_line->>'entered_quantity')::numeric;
    v_bonus   := (v_line->>'bonus_quantity')::numeric;
    v_pick    := (v_line->>'lot_id')::uuid;

    if v_bonus is not null then
      if p_doc_type not in ('supply', 'opening') then
        raise exception 'bonus_supply_only'
          using hint = 'البضاعة المجّانيّة تُسجَّل بالتوريد وحده';
      end if;
      if v_bonus < 0 then
        raise exception 'bonus_negative'
          using hint = 'الكمّية المجّانيّة لا تكون سالبة';
      end if;
      if v_entered is null or v_bonus > v_entered then
        raise exception 'bonus_over_quantity'
          using hint = 'المجّانيّ جزءٌ من الكمّية المستلمة لا زيادةٌ عليها';
      end if;
    end if;

    -- ═══ ٠٩٧: شكلُ الشطب ومتاحُه، قبل أن تُقرأ دفعةٌ أو تُحسب كلفة ═══
    if p_doc_type = 'write_off' then
      -- ⚠️ **الشطبُ إخراجٌ دائمًا.** وبلا هذا السطر يقع الموجبُ بلا دفعةٍ في فرع
      -- «دخولٌ مقدَّر» فيفتح دفعةً مقدَّرةً باسم الشطب — نقضُ المبدأ كلِّه.
      if v_qty >= 0 then
        raise exception 'write_off_not_outgoing'
          using hint = 'الشطب بيطلّع بضاعة من المستودع، فالكمّية لازم تكون إخراجًا. مثال: شطب 3 قطع تالفة بيسجّل ناقص 3 لا زائد 3. الحل: إدخال البضاعة الداخلة بشاشة التوريد.';
      end if;
    end if;

    -- ═══ ١٠١: الإرجاعُ إخراجٌ دائمًا — مرآةُ الحارس أعلاه ═══
    --
    -- 🔴 **الفتحةُ التي سمّيتُها ولم أُغلقها، وأغلقها قرارُ صاحب النظام:** كمّيّةٌ
    -- موجبةٌ بمستند إرجاعٍ **تقع في فرع «دخولٌ مقدَّر» فتفتح دفعةً مقدَّرةً باسم
    -- الإرجاع** — عينُ ما منعه `write_off_not_outgoing` للشطب.
    --
    -- ⚠️ **وشاشتُنا لا تنتجها اليوم** (`returnLinesFromGrid` تُرسل السالبَ
    -- دائمًا) — **وهذا بالضبط سببُ إغلاقها الآن لا تركِها:** حارسٌ قائمٌ على
    -- «لا مُنادِيَ له اليوم» يسقط يومَ تتغيّر شاشةٌ أو ينادي الدالّةَ مكانٌ آخر،
    -- **وسقوطُه صامتٌ لأن الناتجَ دفعةٌ صحيحةُ الشكل بثمنٍ مخترَع.**
    --
    -- ⚠️ **ويقع قبل فحص التوفّر لا بعده**، فلا تبلغ الكمّيّةُ الموجبةُ ذلك الفحصَ
    -- أصلًا — وهو ما يجعل شرطَ `v_qty < 0` هناك حارسًا للشكل لا للمعنى.
    if p_doc_type = 'return_to_supplier' then
      if v_qty >= 0 then
        raise exception 'return_not_outgoing'
          using hint = 'الإرجاع بيطلّع بضاعة من المستودع للمورّد، فالكمّية لازم تكون إخراجًا. مثال: إرجاع 3 قطع بيسجّل ناقص 3 لا زائد 3. الحل: البضاعة الجاية من المورّد بتنسجّل بشاشة التوريد لا هون.';
      end if;
    end if;

    -- ═══ ١٠١: الشطبُ والإرجاعُ لا يقدّران عند النقص — والباقي يقدّر كما كان ═══
    --
    -- 🔴 **لا تستطيع أن تعيد ما ليس موجودًا**، كما لا تستطيع أن تتلفه. والفرقُ
    -- يزيد الإرجاعَ ثقلًا لا يخفّفه: **الشطبُ بلا طرفٍ مقابل، والإرجاعُ له مورّدٌ
    -- ورقمٌ يُطالَب به.**
    --
    -- ⚠️ **وما يفعله التقديرُ مقيسٌ من ٠٩٥:** `open_estimated_lot` تولّد دفعةً
    -- **بلا حركةِ دخول**، ثمّ يكتب المتصلُ عليها `-v_left` — **فتصير دفعةً
    -- متبقّيها سالبٌ بثمنٍ مخترَع.** وتطرح من رصيد المنتج إلى الأبد، **وتبقى
    -- غيرَ مرئيّةٍ لأيّ سحبٍ لاحق** (`if v_rem <= 0 then continue`).
    --
    -- ⚠️ **و`sale` و`service_consumption` تبقى تقدّر بلا حرفٍ يتغيّر** —
    -- البيعُ يقدّر كي لا يُحجَب زبونٌ واقفٌ أمامك، **والإرجاعُ لا أحدَ ينتظره.**
    --
    -- 🔴 **والشرطُ `v_qty < 0` لازمٌ لا زائد:** الشطبُ يرفض الموجبَ أعلاه بحارسه،
    -- **والإرجاعُ لا** — فبلا هذا الشرط يُقرأ `- v_qty` سالبًا فيمرّ الفحصُ دائمًا،
    -- وهو مرورٌ صحيحُ الشكل بلا معنى.
    if p_doc_type in ('write_off', 'return_to_supplier') then
      if v_qty < 0 and v_pick is null then
        select coalesce(sum(s.rem), 0) into v_avail
          from (
            select coalesce(sum(m.quantity_base), 0) as rem
              from public.stock_lots l
              left join public.stock_movements m on m.lot_id = l.id
             where l.salon_id   = v_salon_id
               and l.storage_id = p_storage_id
               and l.product_id = v_pid
             group by l.id
          ) s
         where s.rem > 0;

        if v_avail < (- v_qty) then
          raise exception 'insufficient_stock'
            using hint = case p_doc_type
              when 'write_off' then 'الكمّية أكبر من المتوفّر بهذا المستودع. الحل: إنقاصها لحدّ المتوفّر المعروض بعمود «المتوفّر». والشطب ما بيقدّر سعرًا لبضاعة مش موجودة — لهيك بيرفض بدل ما يخترع رقمًا.'
              else 'الكمّية أكبر من المتوفّر بهذا المستودع. الحل: إنقاصها لحدّ المتوفّر المعروض بعمود «المتوفّر». وما بينفع ترجّع للمورّد بضاعة مش موجودة عندك — لو فعلًا استلمتها، تسجيل التوريد أوّلًا وبعدها الإرجاع.'
            end;
        end if;
      end if;
    end if;

    if p_doc_type in ('supply', 'opening') then
      v_cost := (v_line->>'unit_cost')::numeric;
      if v_cost is null or v_cost < 0 then
        raise exception 'unit_cost_required' using hint = 'سعر الشراء إجباري بالتوريد';
      end if;

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

    elsif v_pick is not null then
      -- ═══ المسارُ الصريح — بلا تغييرٍ عن ٠٩٦ ═══
      if v_qty >= 0 then
        raise exception 'lot_pick_requires_issue'
          using hint = 'اختيار دفعة معناه سحب منها، فالكمّية لازم تكون إخراجًا. مثال: شطب 3 قطع من دفعة فيها 12. الحل: إدخال الكمّية بشاشة الشطب، والدخول للمخزون بيصير بشاشة التوريد لا هون.';
      end if;

      -- ⚠️ `if not found` لا `if v_cost is null`: دفعةٌ ثمنُها صفرٌ مشروعةٌ تمامًا
      -- (الدرجة ٥ تنتجها)، و`select … into` عند صفر صفوفٍ يُسنِد العدم.
      select l.unit_cost, l.cost_is_estimated
        into v_cost, v_est
        from public.stock_lots l
       where l.id         = v_pick
         and l.salon_id   = v_salon_id
         and l.storage_id = p_storage_id
         and l.product_id = v_pid;

      if not found then
        raise exception 'lot_not_in_storage'
          using hint = 'الدفعة المختارة مش لهذا المنتج بهذا المستودع. غالبًا الصفحة قديمة والبضاعة انتقلت أو انشطبت من جهاز تاني. الحل: تحديث الصفحة وإعادة اختيار الدفعة.';
      end if;

      select coalesce(sum(m.quantity_base), 0) into v_rem
        from public.stock_movements m
       where m.lot_id = v_pick;

      if v_rem < (- v_qty) then
        raise exception 'lot_insufficient'
          using hint = 'الكمّية أكبر من المتبقّي بهذه الدفعة. الحل: إنقاص الكمّية لحدّ المتبقّي المعروض بعمود «الدفعة»، أو تقسيم الشطب لسطرين — سطر لكل دفعة.';
      end if;

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
              v_est,
              (v_line->>'entered_unit_price')::numeric,
              v_line->>'line_discount_kind',
              (v_line->>'line_discount_value')::numeric,
              v_bonus, v_pick);

    elsif v_qty < 0 then
      -- 🔴 إخراجٌ تلقائيّ: شريحةٌ لكلّ دفعة، وحركةٌ لكلّ شريحة.
      --
      -- ⚠️ **والشطبُ يصل هنا وقد ثبت أن المتاح يكفي**، فلا يبلغ فرعَ النقص في
      -- `draw_stock_from_lots` أبدًا. **والأنواعُ الأخرى تبلغه وتُقدِّر كما كانت.**
      v_first := true;
      for v_slice in
        select * from public.draw_stock_from_lots(
          v_salon_id, p_storage_id, v_pid, -v_qty, v_doc_id, p_doc_date)
      loop
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
      -- دخولٌ بمستندٍ لا يحمل ثمنًا مصرَّحًا ⟵ دفعةٌ مقدَّرة.
      --
      -- ⚠️ **ولا يصله `write_off` أبدًا** — الحارسُ أعلاه يرفض الموجبَ باسمه.
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

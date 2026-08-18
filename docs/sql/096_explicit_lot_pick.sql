-- ==========================================================================
-- ٠٩٦ — اختيارُ الدفعة صراحةً. **تغييرٌ فقط، ولا `select` في هذا الملفّ.**
--       والتحقّقُ هو ٠٩٦ب، بملفٍّ مستقلّ.
--
-- 🔴 مُجهَّزٌ ولم أشغّله. المالكُ ينفّذه بيده بعد مراجعته.
-- ترتيبُ التشغيل: ٠٩٥ ✅ ⟵ ٠٩٥ب ✅ ⟵ **٠٩٦ (هذا)** ⟵ ٠٩٦ب.
--
-- ⚠️ **و`auth.uid()` فارغةٌ في المحرّر وRLS متجاوَزةٌ بالكامل** — فنجاحُ هذا
-- السكربت يثبت الحفظَ بلا خطأٍ نحويّ **ولا شيءَ غير ذلك**. والتخطيطُ يقع عند
-- أوّل تنفيذ (٠٩٦ب).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 دالّةٌ واحدةٌ تُلمس، وثلاثُ كائناتٍ لا تُمسّ
--
-- `open_estimated_lot` و`draw_stock_from_lots` و`transfer_stock` و
-- `post_stocktake_session` و`reverse_stock_document` **بلا حرفٍ واحدٍ يتغيّر** —
-- حدُّ المالك الثاني حرفيًّا: «أبقوا FIFO كما هو، وأضيفوا فرعًا للمسار الصريح».
--
-- ⇒ **و٠٩٥ب/ب و٠٩٥ب/ج تبقيان صالحتين بلا إعادة تشغيل**، لأن النقلَ والجردَ لا
-- يمرّان بهذا الفرع إطلاقًا.
--
-- ⚠️ **ولا `DROP FUNCTION`:** الدفعةُ تسافر **داخل `p_lines`** لا معاملًا جديدًا،
-- فالتوقيعُ لم يتغيّر و`CREATE OR REPLACE` استبدالٌ لا `overload` (البند ٥).
-- نفسُ ما فعله `bonus_quantity` في ٠٥١ب.
--
-- ---------------------------------------------------------------------------
-- 🔴 والشطبُ صار صريحًا بالكامل — قرارٌ مطلقٌ لا مشروط
--
-- **`write_off` بلا `lot_id` يُرفض دائمًا**، لا «يُرفض حين تنقص الدفعاتُ فقط».
-- والسببُ أن جوهرَ الشطب أن يسمّي إنسانٌ الدفعةَ التالفة: **الأقدمُ افتراضًا هو
-- اختيارٌ صريحٌ للأقدم، لا غيابُ اختيار.** فلا مسارَ ضمنيًّا للشطب بعد اليوم.
--
-- ⚠️ **وهذا يجعل التوفّرَ بنيويًّا لا حارسَ واجهةٍ يذوب:** الشاشةُ تُرسل الدفعة،
-- **والقاعدةُ ترفض ما يتجاوز متبقّيها** — فنداءٌ من مكانٍ آخرَ بعد سنةٍ يُرفض
-- كما تُرفض الشاشة. «لا تتّكل على غياب منادٍ اليوم» (قاعدةُ المراجع).
--
-- ---------------------------------------------------------------------------
-- ⚠️ والكمّيّةُ الموجبةُ للشطب مُغلقةٌ من طريقين، بلا رمزٍ خامس
--
--   شطبٌ موجبٌ **بلا** دفعة  ⟵ `write_off_needs_lot`
--   شطبٌ موجبٌ **بدفعة**     ⟵ `lot_pick_requires_issue`
--
-- **فلا يبقى له طريق.** وهذا أفضلُ من رمزٍ ثالثٍ يسمّي الحالة: الحالةُ تصير
-- **غيرَ ممكنة** بدل أن تكون **منتبَهًا لها** — وهو تمييزٌ مسجَّلٌ عندنا.
--
-- ---------------------------------------------------------------------------
-- 🔴 انحدارٌ يجب أن يعرفه مَن يعيد تشغيل ٠٩٥ب
--
-- **٠٩٥ب/أ و٠٩٥ب/د استعملا `write_off` لاختبار المسار الضمنيّ** (FIFO والتقدير)
-- **بلا `lot_id`** — لأنه أوّلُ قيمةٍ غيرِ مستثناةٍ في الـenum، لا لأنه المقصود.
--
-- **فبعد هذا الملفِّ تصير تلك الحالاتُ مرفوضةً لا مسحوبة**، وإعادةُ تشغيلهما كما
-- هما تُظهر حُمرًا **صحيحةً** عن محرّكٍ سليم. ⚠️ **ولا يُقرأ ذلك انحدارًا.**
--
-- ⇒ **٠٩٦ب يحمل انحدارَ المسار الضمنيِّ بنوعِ مستندٍ مُخرِجٍ آخر**، مشتقًّا من
-- `pg_enum` لا مسمًّى بيد. **وإن لم يوجد نوعٌ آخر، يقول ذلك بالاسم** — يعني أن
-- المسارَ الضمنيَّ للإخراج بلا مُنادٍ بعد اليوم، وتلك حقيقةٌ تُسجَّل لا تُخمَّن.
-- ==========================================================================

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
  v_lot_id   uuid;
  v_slice    record;
  v_first    boolean;
  v_pick     uuid;                                        -- ⟵ الدفعةُ المختارة
  v_est      boolean;                                     -- ⟵ وصفُها
  v_rem      numeric;                                     -- ⟵ ومتبقّيها
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

    -- ⟵ جديد: الدفعةُ تُقرأ مرّةً واحدةً هنا، كأخواتها، فالرقمُ الذي يفحصه
    -- الشرطُ هو الرقمُ الذي يُخزَّن.
    v_pick    := (v_line->>'lot_id')::uuid;

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

    -- ⟵ جديد: شكلُ الشطب يُرفض قبل أن تُقرأ دفعةٌ أو تُحسب كلفة.
    --
    -- ⚠️ **مطلقٌ لا مشروط**، ويُقرأ قبل فرع التوريد لأنه لا يخصّه: `write_off`
    -- لا يقع في `('supply','opening')` أبدًا.
    if p_doc_type = 'write_off' and v_pick is null then
      raise exception 'write_off_needs_lot'
        using hint = 'الشطب لازم يقول من أي دفعة توريد. مثال: عندك دفعتان من نفس الشامبو — وحدة وصلت بأول الشهر بسعر 5 وواحدة أمس بسعر 8، والتالفة وحدة منهما بعينها. الحل: اختيار الدفعة من عمود «الدفعة» بسطر الشطب.';
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

    elsif v_pick is not null then
      -- ═══ 🔴 المسارُ الصريح — جديدٌ كلُّه، ولا يمسّ ما تحته ═══
      --
      -- ⚠️ سحبٌ من دفعةٍ بعينها هو **إخراج**. و`lot_id` بكمّيّةٍ موجبةٍ لا معنًى
      -- له: الدخولُ يُنشئ دفعةً ولا يُشار به إلى واحدةٍ قائمة.
      if v_qty >= 0 then
        raise exception 'lot_pick_requires_issue'
          using hint = 'اختيار دفعة معناه سحب منها، فالكمّية لازم تكون إخراجًا. مثال: شطب 3 قطع من دفعة فيها 12. الحل: إدخال الكمّية بشاشة الشطب، والدخول للمخزون بيصير بشاشة التوريد لا هون.';
      end if;

      -- الدفعةُ لهذا الصالون وهذا المستودع وهذا المنتج — الثلاثةُ معًا.
      --
      -- ⚠️ **و`if not found` لا `if v_cost is null`**: دفعةٌ ثمنُها صفرٌ مشروعةٌ
      -- تمامًا (الدرجة ٥ من السلّم تنتجها)، **و`select … into` عند صفر صفوفٍ
      -- يُسنِد العدمَ** — فالفحصُ على القيمة يخلط «لا دفعة» بـ«دفعةٌ مجّانيّة».
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

      -- 🔴 المتبقّي **مجموعُ حركاتٍ لا عمود** (ADR-051)، ويُقرأ تحت قفل المنتج
      -- أعلاه — فعمليّتان على نفس المنتج لا تقرآنه معًا.
      select coalesce(sum(m.quantity_base), 0) into v_rem
        from public.stock_movements m
       where m.lot_id = v_pick;

      -- ⚠️ **رفضٌ لا تقدير** — وهو عكسُ ما يفعله المسارُ الضمنيُّ عند النقص،
      -- وذلك هو المقصود: الصريحُ يرفض، والضمنيُّ يقدّر.
      if v_rem < (- v_qty) then
        raise exception 'lot_insufficient'
          using hint = 'الكمّية أكبر من المتبقّي بهذه الدفعة. الحل: إنقاص الكمّية لحدّ المتبقّي المعروض بعمود «الدفعة»، أو تقسيم الشطب لسطرين — سطر لكل دفعة.';
      end if;

      -- حركةٌ واحدةٌ بثمن دفعتها. **ولا انقسامَ هنا**: السطرُ الصريحُ يخصّ دفعةً
      -- واحدة، وشطبٌ يعبر دفعتين يصل سطرين من الشاشة أصلًا — **فإطارُ المُدخَل
      -- كاملٌ على السطر، ولا شريحةَ ثانيةً تُنفى عنها.**
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

-- ==========================================================================
-- ⚠️ ولا `comment on` هنا: لم يتغيّر معنى عمودٍ واحد. `cost_is_estimated` على
-- الدفعة المسحوبة **يُنسخ كما هو** — سحبٌ صريحٌ من دفعةٍ مقدَّرةٍ يبقى مقدَّرًا،
-- على سابقة العكس: «الوصفُ يُورَّث مع الرقم».
-- ==========================================================================

-- ==========================================================================
-- ⚠️ أُضيف بعد التنفيذ. **ولا جملةَ SQL واحدةٍ فوق هذا السطر تغيّرت.**
--
-- 🔴 نطاقُ الفرع الصريح **أوسعُ من الشطب، وترويسةُ الملفِّ لا تقول ذلك**
--
-- شرطُ الفرع `elsif v_pick is not null` — **لا `p_doc_type = 'write_off'`.**
-- فأيُّ نوعِ مستندٍ مُخرِجٍ يمرّر `lot_id` يسلكه.
--
-- **والفرقُ بين الإلزام والإتاحة هو ما يجب أن يُقرأ:**
--
--   مُلزَمٌ به   `write_off` وحدَه — بلا دفعةٍ يُرفض مطلقًا
--   مُتاحٌ له    كلُّ مُخرِجٍ آخر — وFIFO يبقى افتراضَه إن لم يمرّرها
--
-- ✅ **وهذا مقصودٌ لا سهو، ومطابقٌ للحدّ الأوّل** («التغييرُ إضافيٌّ واختياريّ»):
-- النوعُ الذي لا يمرّر دفعةً يسلك المسارَ المُختبَرَ نفسَه بلا تغيير. **وهو ما
-- يجعل «إرجاعٌ إلى مورّد» يرث الآليّةَ يومَ يُبنى بلا لمس هذه الدالّة ثانيةً** —
-- ولا يبقى إلّا أن يُقرَّر هل يصير إلزاميًّا له كما صار للشطب.
--
-- ⚠️ **وكُتب هنا لأن الترويسةَ تقول «الشطبُ صار صريحًا بالكامل» وتصمت عن الباقي**
-- — فقارئٌ بعد سنةٍ يقرأ الصمتَ حصرًا، والشرطُ في الكود يقول غيرَه.
-- ==========================================================================

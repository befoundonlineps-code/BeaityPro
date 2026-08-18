-- ==========================================================================
-- ٠٩٧ — اختيارُ الدفعة **اختياريّ**، والشطبُ **لا يقدّر أبدًا**.
--       تغييرٌ فقط، ولا `select` في هذا الملفّ. والتحقّقُ ٠٩٧ب.
--
-- 🔴 مُجهَّزٌ ولم أشغّله. المالكُ ينفّذه بيده بعد مراجعته.
-- ترتيبُ التشغيل: ٠٩٦ ✅ ⟵ ٠٩٦ب ✅ ⟵ **٠٩٧ (هذا)** ⟵ ٠٩٧ب.
--
-- ⚠️ **و`auth.uid()` فارغةٌ في المحرّر وRLS متجاوَزة** — النجاحُ يثبت الحفظَ بلا
-- خطأٍ نحويّ ولا شيءَ غيره. والتخطيطُ عند أوّل تنفيذ (٠٩٧ب).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 تراجعٌ عن `write_off_needs_lot`، وسببُه يُكتب كي لا يُعاد اقتراحُه
--
-- ٠٩٦ جعل الشطبَ **مُلزَمًا** بدفعةٍ صريحة. **وذلك كان أوسعَ من نيّة المالك:**
-- طلب **إمكانيّةَ** اختيار الدفعة لأن التالفةَ قد لا تكون الأقدم — **لا فرضَ
-- الاختيار على كلّ شطب.**
--
-- ⚠️ **وأنا من اقترح الإلزام**، على مبدأ «لا تتّكل على غياب منادٍ اليوم» — وهو
-- مبدأٌ صحيحٌ **طُبِّق على السؤال الخطأ**: كان يحرس من *غياب* الاختيار، والمالكُ
-- يريد الغيابَ حالةً مشروعةً تُخدَم لا تُرفَض. **والسابقةُ المحسومةُ تُعاد على
-- شرط التطابق لا على تشابه الشكل.**
--
-- ---------------------------------------------------------------------------
-- 🔴 والمبدأُ الثابتُ الذي حلّ محلَّه: **`write_off` لا يفتح دفعةً مقدَّرةً أبدًا**
--
--   بدفعةٍ مختارة  ⟵ سحبٌ منها، ورفضٌ إن تجاوز متبقّيها  (`lot_insufficient`)
--   بلا دفعة       ⟵ توزيعٌ تلقائيٌّ FIFO، **ورفضٌ إن تجاوز الإجماليّ**
--                     (`insufficient_stock`) — **لا تقدير**
--
-- **فـ«التوفّرُ شرطٌ للشطب» محفوظٌ بالحالتين**، وهو ما تقوله المواصفةُ الأصليّة:
-- «منتجٌ ما صار عليه ولا عمليّةُ توريدٍ ما بقدر أعمل عليه شطب».
--
-- ⚠️ **والأنواعُ الأخرى بلا تغيير:** `return_to_supplier` و`sale` و
-- `service_consumption` تبقى FIFO **مع التقدير عند النقص** كما هي. فالفرقُ ليس
-- في الآليّة بل في **مَن يُسمح له بالتقدير** — والشطبُ وحدَه ممنوع.
--
-- ---------------------------------------------------------------------------
-- ⚠️ ولماذا فحصٌ مسبقٌ بدل معاملٍ على `draw_stock_from_lots`
--
-- المنعُ يقع **قبل** نداء الدالّة المساعدة، فلا تبلغ فرعَ النقص فيها أصلًا.
-- **و`draw_stock_from_lots` لا تُمسّ بحرف** — وهي مقيسةٌ بـ٠٩٥ب و٠٩٦ب، ومعاملٌ
-- جديدٌ عليها يغيّر توقيعَها ويُبطل ذلك القياس. **الحارسُ يُبنى حيث لا يكسر
-- المُثبَت.**
--
-- 🔴 **والمجموعُ على الموجب وحدَه، وهذا ليس تفصيلًا:** `draw_stock_from_lots`
-- **تتخطّى الدفعةَ التي متبقّيها ≤ صفر** (`if v_rem <= 0 then continue`). فدفعةٌ
-- متبقّيها `-5` بجانب أخرى `+10` تعطي مجموعًا خامًّا `5` **بينما السحبُ يقدر على
-- ١٠**. ⇒ فمجموعٌ على الكلّ **يرفض ما كانت الدالّةُ ستنجزه** — رفضٌ صحيحُ الشكل
-- كاذبُ المعنى.
--
-- ✅ **ويطابق هذا `availableForWriteOff` بالشاشة حرفًا** (`lib/lotPicker.js`
-- يصفّي `remaining > 0` قبل الجمع) — **فالرقمُ المعروضُ والرقمُ المُحتكَمُ إليه
-- واحدٌ بالبناء**، لا بالمصادفة.
--
-- ---------------------------------------------------------------------------
-- ⚠️ والكمّيّةُ الموجبةُ للشطب لزمها رمزٌ صريحٌ الآن
--
-- بـ٠٩٦ كانت مُغلقةً من طريقين (`write_off_needs_lot` أو `lot_pick_requires_issue`).
-- **وبسقوط الأوّل يصير شطبٌ موجبٌ بلا دفعةٍ يقع في فرع «دخولٌ مقدَّر»** — أي
-- **يفتح دفعةً مقدَّرةً باسم الشطب**، وهو نقضُ المبدأ كلِّه.
--
-- ⇒ `write_off_not_outgoing`، مقروءًا **قبل** كلّ شيء. وهذا ما حذّر منه المراجع
-- بنقطته الثالثة على ٠٩٦، **وكان مُغلقًا بالصدفة فصار مُغلقًا بالقصد.**
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

      -- 🔴 بلا دفعةٍ مختارة ⟵ توزيعٌ تلقائيّ، **لكن على مخزونٍ حقيقيٍّ وحدَه.**
      --
      -- ⚠️ **والمجموعُ على الدفعات ذاتِ المتبقّي الموجب فقط**، لأن السحبَ يتخطّى
      -- ما دونها — فمجموعٌ على الكلّ يرفض ما كانت الدالّةُ ستنجزه.
      if v_pick is null then
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
            using hint = 'الكمّية أكبر من المتوفّر بهذا المستودع. الحل: إنقاصها لحدّ المتوفّر المعروض بعمود «المتوفّر». والشطب ما بيقدّر سعرًا لبضاعة مش موجودة — لهيك بيرفض بدل ما يخترع رقمًا.';
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

-- ==========================================================================
-- ⚠️ و`write_off_needs_lot` لم يعد يُرفع من أيّ مسار — **ولا يُحذف مفتاحُه من
-- `RAISED_CODES`**: ٠٩٦ ما زال في `docs/sql` وهو سجلُّ ما نُفِّذ، وحارسُ
-- `raisedCodes.test.js` يقرأ المجلَّد فيطالب بجملته. **وجملةٌ لرمزٍ مات أرخصُ من
-- سجلٍّ يُعاد كتابته.**
-- ==========================================================================

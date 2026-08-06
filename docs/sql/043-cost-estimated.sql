-- ═══════════════════════════════════════════════════════════════════════════
-- البند ٤٣ (الدرجة الرابعة بسلسلة التكلفة) + البند ٣٤ (عمود «مُقدَّرة»)
--
-- ⚠️ مُجهَّز ومعروض ولا يُشغَّل من طرفي — المالك ينفّذه بمحرّر SQL.
--
-- ⚠️ ولا `RAISE EXCEPTION` بهذا الملف إطلاقًا: فيه DDL دائم، والاستثناء يُسقط
--    المعاملة كاملة **وبضمنها الـDDL فوقه** — فيبقى القديم حيًّا والفحص يقول
--    «نجح». التحقّق كله بـ`select` عادي بالآخر.
--
-- الحالة: الأجزاء ١ و٢ و٣أ كاملة. ٣ب ينتظر نصّ **دالّتين** لا تلاتة.
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
-- `not null default false`: الحركات القائمة كلها غير مقدَّرة بحكم التعريف —
-- أسعارها كُتبت بيد إنسان أو حُسبت من متوسّط حقيقي.
alter table stock_movements
  add column if not exists cost_is_estimated boolean not null default false;

comment on column stock_movements.cost_is_estimated is
  'صحيح حين اشتُقّت التكلفة من السلسلة بدل أن يُمليها إنسان. علامة دائمة على الحركة: لا نعيد حساب تكلفة مختومة (ADR-051).';


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
-- والجديد سطرٌ واحد: `bool_or(cost_is_estimated)`.
--
-- ⚠️ ومعناه أن صفّ الرصيد يبقى موسومًا ما دامت بتاريخه حركةٌ مقدَّرة **ولو
-- وردت بعدها عشر شحنات بأسعار حقيقية** — لأن المتوسّط يُشتقّ من كل الحركات،
-- فهو مقدَّرٌ جزئيًّا إلى الأبد. لزجة وصادقة: العكس هو المخرج الوحيد فعلًا،
-- وهو ما يقوله الشرح على الشاشة.
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
  bool_or(cost_is_estimated) as cost_has_estimate
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

    -- ② العلامة ترتفع حين تُشتقّ التكلفة، وتبقى منخفضة حين تُملى.
    --    بالجرد لا يملي أحدٌ سعرًا، فالفرع الأول وحده غير مقدَّر.
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

      -- ③ الدرجة ٣ (جديدة): آخر وارد لنفس المنتج بأي مستودع بالصالون.
      --    فوق السعر الاسميّ لا تحته، والفرق فرق نوع لا درجة: هذه ثمنٌ دُفع
      --    فعلًا وانسجّل، والاسميّ رقمٌ كتبه أحدهم بالكتالوج ولا يعرف أحد
      --    وحدته (البند ٣١). الفرق الوحيد عن الدرجة فوقها: بلا شرط المستودع.
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

      -- ② الاستثناء الوحيد بالنظام كلّه: رقمٌ **أملاه إنسان بالشاشة**، لا
      --    شيء يخمّنه — فالعلامة تبقى منخفضة. ووسمُه «مقدَّرة» يقلب المعنى:
      --    يصير أغلب الحركات موسومًا، **وشارةٌ على كل شيء شارةٌ على لا شيء**،
      --    فتضيع كما تضيع بغيابها. لا شرط هنا ولا متغيّر — الفرع يعرف جوابه.
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
-- الجزء ٣ب — دالّتان باقيتان، ⚠️ لا تُكتبان قبل وصول نصّهما
--
-- ⚠️ ولا تُشغَّل استعلامًا خاصًّا لهما — **الاستعلام مكتوب عندنا من قبل**،
--    برأس [docs/db-functions.sql](../db-functions.sql)، وهو يرجّع كل الدوالّ
--    دفعةً واحدة:
--
--   select string_agg(pg_get_functiondef(p.oid), E'\n\n' order by p.proname)
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.prokind in ('f', 'p')
--     and not exists (
--       select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
--     );
--
--    ⚠️ **ولقطة `db-functions.sql` تسبق موديول المخزون كلّه: ١٩ دالّة، وليس
--    فيها ولا واحدة من الأربع.** فتشغيله يفعل شيئين بمرّة — يسلّم النصّين
--    الباقيين، **ويصلح وثيقةً كانت تُقرأ على أنها صورة طبق الأصل عن القاعدة
--    وهي ناقصة موديولًا كاملًا.**
--
-- ① `transfer_stock` — تكتب حركتين بتكلفة من السلسلة نفسها. ودليلها بيانات
--    المالك: تحويله ختم `unit_cost = 0` لأن السلسلة نزلت درجاتها. فبلا
--    العلامة، كل تحويل من مستودعٍ بلا وارد يُنتج رقمًا مقدَّرًا صامتًا — وهو
--    أشيع مسار للتقدير بعد الجرد.
--    ⚠️ وتحتاج الدرجة الجديدة كذلك، للسبب نفسه: منتجٌ يُقوَّم برقمين حسب
--    الباب الذي دخل منه.
--
-- ② `reverse_stock_document` — ⚠️ **قاعدة مختلفة: تنسخ ولا تحسب.**
--    هي تنسخ `unit_cost` من الأصل (وهذا ما جعل شفاء التسميم صحيحًا حسابيًّا،
--    وقِسناه)، **فلتنسخ `cost_is_estimated` كذلك**.
--    وإعادة الحساب تكذب باتجاهين: عكسُ حركةٍ مقدَّرة يُنتج حركةً تبدو
--    مؤكَّدة، وعكسُ حركةٍ مؤكَّدة قد ينزل السلسلة وقتها فيُنتج «مقدَّرة» عن
--    رقمٍ منسوخٍ حرفًا. **والعكس ليس قرارًا جديدًا عن التكلفة — هو نقيض قرارٍ
--    اتُّخذ، فيرث وصفه كما يرث رقمه.**
--    ⚠️ ولا تُضاف لها الدرجة الجديدة إطلاقًا — هي لا تنزل السلسلة أصلًا.
-- ───────────────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────────────
-- التحقّق — بعد الأجزاء ١ و٢ و٣أ
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

-- ٤. وكل الحركات القائمة غير مقدَّرة — أسعارها كُتبت أو حُسبت فعلًا،
--    والافتراضي false. لو رجع أي صفّ هون فالافتراضي لم يُطبَّق كما يُظنّ.
select count(*) as estimated_rows_before_any_new_document
from stock_movements
where cost_is_estimated;

-- ٥. ولا صفّ رصيد موسوم بعد — خطّ الأساس الذي يُقارَن به أول جرد يمرّ
--    بالدرجة الجديدة.
select count(*) as balance_rows_flagged
from product_balances
where cost_has_estimate;

-- ٦. وكلٌّ من الدالّتين وحدها بالقاعدة، بلا overload. **الرقمان ١ و١** —
--    وأي ٢ يعني نسختين بتوقيعين والاستدعاء صار غامضًا (القانون ٥).
select p.proname, count(*) as copies
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('post_stocktake', 'post_stock_document')
group by p.proname;

-- ٧. والتغيير وصل الجسم فعلًا — لا وجود الدالّة (القانون ٢: `count(*)` عاجز
--    بنيويًّا عن رؤية إصلاحٍ انرجع، فالقديمة بنفس الاسم والتوقيع).
--    **المتوقَّع ١ لكلٍّ منهما.**
--    ⚠️ والبحث على `cost_is_estimated)` **بقوسها** لا على الاسم وحده: أي
--    تعليق يُكتب لاحقًا فوق السطر ويذكر الاسم يزيد العدّاد واحدًا ويكذب —
--    والقوس لا يظهر إلا بقائمة أعمدة الإدراج. نفس فخّ القانون ٢ بالضبط.
select p.proname,
       (length(p.prosrc) - length(replace(p.prosrc, 'cost_is_estimated)', '')))
       / length('cost_is_estimated)') as insert_column_mentions
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('post_stocktake', 'post_stock_document');

-- ٨. ⚠️ سؤالٌ يحكم صحّة الدرجات ٢→٣→٤ **بالدالّتين معًا**، ولم يُقَس بعد:
--    ماذا يفعل `select … into` حين لا يرجع صفًّا؟ التوثيق يقول «يُسنَد
--    العدم»، **وعليه بُنيت السلسلة كلّها** — فـ`if v_cost is null` هو ما
--    ينقلها للدرجة التالية.
--
--    ولو كان الجواب «يبقى على قيمته»، فخيبةُ البحث تترك **تكلفة المنتج
--    السابق من الحلقة** مختومةً على هذا المنتج — رقمٌ خاطئ، مقنع، ودائم،
--    ولا سطر يشتكي. فيُقاس مرّة، هنا، بدل أن يُفترض.
--
--    بلا DDL وبلا استثناء، وعلى الجدول الحقيقي بشكل السلسلة نفسه.
--    **المتوقَّع: `null-assigned ✓`.**
create temporary table if not exists probe_select_into (result text);
do $$
declare v_probe numeric;
begin
  v_probe := 999;
  select unit_cost into v_probe
    from stock_movements
   where product_id = '00000000-0000-0000-0000-000000000000'::uuid
   order by created_at desc, id desc
   limit 1;
  insert into probe_select_into
  values (case when v_probe is null
               then 'null-assigned ✓ — السلسلة تنزل درجاتها كما هو مقصود'
               else 'stale: ' || v_probe || ' ⛔ — أوقف كل شيء' end);
end $$;
select * from probe_select_into;

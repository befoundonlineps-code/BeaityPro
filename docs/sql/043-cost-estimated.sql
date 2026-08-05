-- ═══════════════════════════════════════════════════════════════════════════
-- البند ٤٣ (الدرجة الرابعة بسلسلة التكلفة) + البند ٣٤ (عمود «مُقدَّرة»)
--
-- ⚠️ مُجهَّز ومعروض ولا يُشغَّل من طرفي — المالك ينفّذه بمحرّر SQL.
--
-- ⚠️ ولا `RAISE EXCEPTION` بهذا الملف إطلاقًا: فيه DDL دائم، والاستثناء يُسقط
--    المعاملة كاملة **وبضمنها الـDDL فوقه** — فيبقى القديم حيًّا والفحص يقول
--    «نجح». التحقّق كله بـ`select` عادي بالآخر.
--
-- الحالة: الجزءان ١ و٢ كاملان. الجزء ٣ ينتظر نصّ تلات دوالّ.
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
    v_estimated := (v_balance <= 0);

    if v_balance > 0 then
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
-- الجزء ٣ — تلات دوالّ باقية، ⚠️ لا تُكتب قبل وصول نصّها
--
--   select p.proname, pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('post_stock_document', 'transfer_stock', 'reverse_stock_document');
--
-- ⚠️ تلاتة لا واحدة: كلّها تختم `unit_cost`، فكلّها تحتاج العمود.
--
-- ⚠️⚠️ فخٌّ بـ`post_stock_document` رُصد بقراءة نصّها، يُعالَج مع التعديل:
--    `v_sum_qty` مُعلَنٌ مرّة ويُسنَد **داخل فرع `else` وحده**. فبمستند توريد
--    لا يُسنَد إطلاقًا، ويحمل ما تركته تكرارةٌ سابقة من الحلقة.
--    والتعبير المقترح للعلامة آمنٌ **بالمصادفة** — الشرط الأول كاذب فتقصر
--    الدارة ولا يُقرأ المتغيّر أصلًا:
--
--      v_estimated := (p_doc_type not in ('supply','opening'))
--                     and coalesce(v_sum_qty, 0) <= 0;
--
--    **وأي إعادة ترتيب تكسره بصمت** — سطران بدل تعبير، أو قراءة `v_sum_qty`
--    أوّلًا. فيُصفَّر بأوّل الحلقة صراحةً (`v_sum_qty := null;`) بدل الاتّكال
--    على ترتيب التقييم. **نفس صنف «الطفرة العاجزة بنيويًّا»: يعمل اليوم لسببٍ
--    لا علاقة له بالنيّة.**
--
-- ① `post_stock_document` — وفيها **الاستثناء الوحيد**:
--    سطر التوريد الوارد تكلفته **رقمٌ كتبه إنسان بالشاشة**، لا شيء يخمّنه —
--    فعلامته تبقى منخفضة. ووسمُه «مقدَّرة» يقلب المعنى: يصير أغلب الحركات
--    موسومًا، **وشارةٌ على كل شيء شارةٌ على لا شيء**، فتضيع كما تضيع بغيابها.
--    وسطر الصرف بنفس الدالّة يمرّ بالسلسلة فعلامته ترتفع.
--    ⚠️ ولا أعرف بنيتها فلا أدري أتُستدعى السلسلة أصلًا للوارد — يُقاس عند
--    وصول النصّ، وإن استُدعيت بأي حال فهذا موضع التفريق بالاتجاه.
--
-- ② `transfer_stock` — تكتب حركتين بتكلفة من السلسلة نفسها. ودليلها بيانات
--    المالك: تحويله ختم `unit_cost = 0` لأن السلسلة نزلت درجاتها. فبلا
--    العلامة، كل تحويل من مستودعٍ بلا وارد يُنتج رقمًا مقدَّرًا صامتًا — وهو
--    أشيع مسار للتقدير بعد الجرد.
--
-- ③ `reverse_stock_document` — ⚠️ **قاعدة مختلفة: تنسخ ولا تحسب.**
--    هي تنسخ `unit_cost` من الأصل (وهذا ما جعل شفاء التسميم صحيحًا حسابيًّا،
--    وقِسناه)، **فلتنسخ `cost_is_estimated` كذلك**.
--    وإعادة الحساب تكذب باتجاهين: عكسُ حركةٍ مقدَّرة يُنتج حركةً تبدو
--    مؤكَّدة، وعكسُ حركةٍ مؤكَّدة قد ينزل السلسلة وقتها فيُنتج «مقدَّرة» عن
--    رقمٍ منسوخٍ حرفًا. **والعكس ليس قرارًا جديدًا عن التكلفة — هو نقيض قرارٍ
--    اتُّخذ، فيرث وصفه كما يرث رقمه.**
-- ───────────────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────────────
-- التحقّق — بعد الجزأين ١ و٢
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

-- ٦. و`post_stocktake` وحدها بالقاعدة، بلا overload
select count(*) as post_stocktake_count
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'post_stocktake';

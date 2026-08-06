-- ═══════════════════════════════════════════════════════════════════════════
-- المرحلة ٣ — `supplier_doc_number`: مرجعُ ورقةِ الطرف الآخر
--
-- ⚠️ مُجهَّز ومعروض ولا يُشغَّل من طرفي — المالك ينفّذه بمحرّر SQL.
-- ⚠️ ولا `RAISE` يُنفَّذه هذا السكربت، ولا `do`، ولا جدول مؤقّت.
-- ✅ ومعادُ التشغيل: `if not exists` و`drop … if exists` و`create or replace`.
--
-- ⚠️⚠️ **وهذا أكبر ممّا قدّرتُه لك، والتصحيح يُقال أوّلًا.** قلتُ «عمودٌ واحد
--    وتعليقه». والمقيس أن `post_stock_document` **تُدرج بقائمة أعمدةٍ صريحة**:
--
--      insert into stock_documents (salon_id, doc_type, storage_id, supplier_id,
--                                   employee_id, appointment_id, doc_date, note)
--
--    **فالعمود وحده غير قابلٍ للكتابة.** ولم أفحص هذا قبل أن أقدّر، وهو نفس
--    صنف «الوصف يقول أكثر ممّا يحمله المُرفَق».
--
-- ✅ **ودالّةٌ واحدة فقط تحتاج التعديل، لا أربع.** الرقم يخصّ نوعين لهما طرفٌ
--    خارجيّ (`supply` و`return_to_supplier`)، وكلاهما يمرّ من هنا. والتحويل
--    والجرد والعكس بلا طرفٍ خارجيّ، فلا معامل لها ولا حقل.
--
-- ✅ **والترحيل متوافقٌ للخلف، فيُشغَّل قبل شحن الكود بلا أثر:** المعامل الجديد
--    له `DEFAULT NULL`، والنداء الحاليّ يمرّره غائبًا فيأخذ العدم — **وهو
--    بالضبط معنى «لا مرجع خارجيّ».**
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- ١. العمود
--
-- `text` لا رقم، و`nullable` بلا قيد تفرّد — وكلاهما قرارٌ لا تساهل:
--
--   • **نصّ**: `01` و`A-7/2026` كلاهما رقم فاتورةٍ حقيقيّ، والصفر البادئ جزءٌ
--     من المرجع لا تنسيق.
--   • **بلا تفرّد**: مورّدان يُصدران `01` بنفس اليوم، ومورّدٌ يعيد إصدار فاتورةٍ
--     مصحّحةٍ بنفس الرقم. ⚠️ **وقيدُ التفرّد على ما يكتبه إنسان عن ورقةٍ أمامه
--     يفشل بأسوأ لحظة**: الموظّفة تكتب الرقم الصحيح فيُرفض، **فتكتب رقمًا
--     مخترعًا لتمرّ** — والحقل الذي وُجد ليطابق ورقتين يحمل كذبةً بصمت.
--     التنبيه بالشاشة يقول «مستندٌ آخر من نفس المورّد يحمل هذا الرقم» ولا يمنع.
--   • **بلا تعبئة رجعية**: المستندات القديمة تبقى `NULL`، لأن اختراع الأرقام
--     يصنع ادّعاءً عن أوراقٍ قد لا تكون موجودة. و`NULL` هنا معناها دقيق.
-- ───────────────────────────────────────────────────────────────────────────

alter table stock_documents
  add column if not exists supplier_doc_number text;

comment on column stock_documents.supplier_doc_number is
  'رقم المستند عند الطرف الآخر — فاتورة المورّد كما هي مكتوبة على ورقته، لا تسلسلٌ يصدره النظام. لهذا: نصّ لا رقم، واختياريّ (مورّد يسلّم بورقة بلا رقم أمرٌ عاديّ)، وبلا تفرّد (مورّدان يستعملان 01). ولهذا أيضًا لا يُقترح تلقائيًّا: اقتراحه اختراعُ مرجعٍ بدفترٍ لا نراه. يخصّ supply و return_to_supplier وحدهما — وما عداهما بلا طرفٍ خارجيّ.';


-- ───────────────────────────────────────────────────────────────────────────
-- ٢. التوقيع القديم يُحذف صراحةً
--
-- ⚠️ **إضافة معامل — ولو بـ`DEFAULT` — تصنع overload لا استبدالًا** (القانون ٥
--    بـCLAUDE.md). فتبقى نسختان بتوقيعين، ويصير النداء غامضًا. الحذف بالتوقيع
--    القديم **حرفًا بحرف**، والفحص ٣ أدناه يتأكّد أن العدد صار ١.
-- ───────────────────────────────────────────────────────────────────────────

drop function if exists public.post_stock_document(
  stock_doc_type, uuid, jsonb, uuid, uuid, uuid, timestamp with time zone, text);


-- ───────────────────────────────────────────────────────────────────────────
-- ٣. الدالّة بتوقيعها الجديد
--
-- ⚠️ **نصّها مأخوذٌ آليًّا من النسخة المُودَعة (سكربت ٠٤٣) لا مُعادَ كتابته**،
--    والفرق مقيسٌ بـ`diff`: **ثلاثة مواضع لا غير** — المعامل بالتوقيع، والعمود
--    بقائمة الإدراج، والقيمة بجملة `values`. ولا سطر آخر تحرّك.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.post_stock_document(p_doc_type stock_doc_type, p_storage_id uuid, p_lines jsonb, p_supplier_id uuid DEFAULT NULL::uuid, p_employee_id uuid DEFAULT NULL::uuid, p_appointment_id uuid DEFAULT NULL::uuid, p_doc_date timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text, p_supplier_doc_number text DEFAULT NULL::text)
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
                               employee_id, appointment_id, doc_date, note,
                               supplier_doc_number)
  values (v_salon_id, p_doc_type, p_storage_id, p_supplier_id,
          p_employee_id, p_appointment_id, p_doc_date, p_note,
          p_supplier_doc_number)
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
-- التحقّق — داخل المعاملة نفسها، فيُقرأ بعد أن يقول المحرّر «نجح»
-- ───────────────────────────────────────────────────────────────────────────

-- ١. العمود بنوعه وقابليّته للعدم. **المتوقَّع: text · YES · بلا افتراضي.**
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'stock_documents' and column_name = 'supplier_doc_number';

-- ٢. ⚠️ **ولا قيد تفرّد عليه — يُقرأ لا يُفترَض.** غيابُ القيد قرارٌ، وقرارٌ
--    غير مفحوصٍ ليس قرارًا. **المتوقَّع: صفر صفوف.**
select i.relname as index_name, pg_get_indexdef(i.oid) as definition
from pg_index ix
join pg_class i on i.oid = ix.indexrelid
join pg_class t on t.oid = ix.indrelid
where t.relname = 'stock_documents'
  and ix.indisunique
  and pg_get_indexdef(i.oid) like '%supplier_doc_number%';

-- ٣. ⚠️⚠️ **نسخةٌ واحدة لا نسختان** — هذا هو الفحص الذي يمسك فشل الحذف.
--    **المتوقَّع: صفٌّ واحد، `copies = 1`.** وأي ٢ يعني أن الـoverload بقي
--    والنداء صار غامضًا.
select p.proname, count(*) as copies,
       string_agg(pg_get_function_identity_arguments(p.oid), E'\n---\n') as signatures
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'post_stock_document'
group by p.proname;

-- ٤. والمعامل وصل الجسم فعلًا، والصلاحية لم تنقلب.
--    **المتوقَّع: `1` و`false` و`NULL`.**
select (length(p.prosrc) - length(replace(p.prosrc, 'p_supplier_doc_number)', '')))
       / length('p_supplier_doc_number)') as insert_value_mentions,
       p.prosecdef as security_definer_expect_false,
       p.proconfig as search_path_expect_null
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'post_stock_document';

-- ٥. والقديم كلّه بلا رقم — خطّ الأساس. **المتوقَّع: العدد صفر.**
select count(*) as documents_with_a_number
from stock_documents
where supplier_doc_number is not null;

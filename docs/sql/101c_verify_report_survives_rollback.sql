-- ==========================================================================
-- ١٠١ج — **يحلّ محلّ ١٠١ب.** نفسُ الأسئلة، وتبليغٌ ينجو من الإلغاء.
--
-- 🔴 **١٠١ب لم يفشل في القياس — فشل في إيصاله.** رجعت أوّلُ سبعةِ أعمدةٍ
-- صحيحةً (التوقيعُ والخاصّيّتان والحارسان في الجسم)، **وكلُّ أعمدة السلوك
-- فارغة** — لا نجاحٌ ولا فشلٌ ولا خطأ.
--
-- ⚠️ **والعطلُ في تصميمي أنا، لا في ١٠١.** وما ثبت من ١٠١ب يبقى ثابتًا:
-- `copies = 1` · `pronargs = 16` · لا `SECURITY DEFINER` ولا `search_path` ·
-- **والحارسان مقروءان من `prosrc`.** أي **١٠١ طُبِّق صحيحًا**، والذي لم يُقَس
-- هو السلوك.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 لماذا ضاعت الأرقام — استنتاجٌ من دلالاتٍ موثَّقة، **لا قياسٌ عندي**
--
-- لا بوستجرس محلّيًّا هنا، فما يلي **مقروءٌ من التوثيق ومتّسقٌ مع المخرَج**،
-- وليس مقيسًا. أقوله كذلك ولا أرفعه فوق قدره.
--
--   ١. `BEGIN … EXCEPTION … END` في PL/pgSQL **يفتح معاملةً فرعيّة.**
--   ٢. عند التقاط الاستثناء **تُلغى تلك المعاملةُ الفرعيّةُ كاملة.**
--   ٣. **وإعداداتُ الجلسة (GUC) معامَلاتيّةٌ هي الأخرى** — فتُلغى معها.
--
-- ⚠️ **و`is_local = false` لا يعني «ينجو من الإلغاء».** يعني «لا يقتصر على
-- هذه المعاملة **إن نجحت**» — والإلغاءُ يمحوه في الحالتين. **وهذا هو الفهمُ
-- الخاطئ الذي بُني عليه ١٠١ب.**
--
-- **والشاهدُ متّسق:** الكتلةُ الأولى لم ترفع استثناءً فنجت قيمُها السبع،
-- والثانيةُ رفعت `ROLLBACK_101B` فذهب كلُّ ما فيها — **وكلاهما بـ`false`.**
--
-- ---------------------------------------------------------------------------
-- ✅ والعلاجُ لا يتوقّف على صحّة هذا التشخيص
--
-- **المتغيّراتُ المحلّيّةُ لا تُلغى.** توثيقُ PL/pgSQL صريحٌ في ذلك: عند التقاط
-- الخطأ تُلغى تغييراتُ القاعدة **وتبقى قيمُ المتغيّرات كما كانت**. ومعالجُ
-- الاستثناء **يعمل بعد الإلغاء**، في النطاق المحيط.
--
--   ⇒ **كلُّ نتيجةٍ تُجمع في متغيّر، و`set_config` واحدةٌ داخل المعالج.**
--
-- ⚠️ **ولو كان تشخيصي خاطئًا لبقي العمودُ فارغًا ولعرفنا فورًا** — فشلٌ مرئيٌّ
-- لا جوابٌ خاطئٌ صامت. **وهذا شرطُ أيّ إصلاحٍ يُبنى على استنتاج.**
--
-- ---------------------------------------------------------------------------
-- ✅ ولا بيانات بقيت من ١٠١ب
--
-- **الإلغاءُ عمل** — وهو ما محا الأرقامَ نفسَه الذي محا الصفوف. فلا صالونَ
-- تجريبيٌّ ولا مستودعَ باقٍ، **ولا تنظيفَ مطلوبًا قبل هذا الملفّ.**
--
-- ---------------------------------------------------------------------------
-- عشرةُ أسئلةٍ، بترتيب الجسم — والتاسعُ هو شاهدُ الصدق
--
--   ١. التوقيعُ لم يُمسّ    `pronargs = 16`
--   ٢. الخاصّيّتان         لا `SECURITY DEFINER` ولا `search_path`
--   ٣. الحارسان في الجسم   `insufficient_stock` **و**`return_not_outgoing`
--   ٤. الإرجاعُ الزائدُ     يُرفَض بـ`insufficient_stock`
--   ٥. الإرجاعُ الكافي     ينجح — ورفضٌ شامل ليس نجاحًا
--   ٦. الكمّيّةُ الموجبةُ    تُرفَض بـ`return_not_outgoing`
--   ٧. المسارُ الصريحُ      يرفض بـ`lot_insufficient` **لا** بالرمز الجديد
--   ٨. الشطبُ الزائدُ       ما زال يُرفَض — ١٠١ لم يفكّ ٠٩٧
--   🔴 ٩. **`sale` و`service_consumption` ما زالتا تقدّران** — لو تسرّب
--          الحارسُ إليهما لبدا الرفضُ الشاملُ نجاحًا على ٤ و٦ و٨
--   ١٠. الثمنان منفصلان    `unit_cost = 5` بينما `entered_unit_price = 7`
--
-- ⚠️ **والحقولُ تُعدّ في المخرَج (`fields_expect_11`)** — ففكُّ نصٍّ بموضعٍ خاطئ
-- يعلن عن نفسه بدل أن يزيح الأعمدةَ كلَّها بصمت.
--
-- 🔴 ولا DDL في هذا الملفّ إطلاقًا، والمعاملةُ تُلغى كما في ١٠١ب.
-- ⚠️ و`auth.uid()` فارغةٌ وRLS متجاوَزة — فهذا يقيس الرفضَ والحساب لا العزل.
-- ==========================================================================

-- ── ١–٣: التوقيعُ والخاصّيّتان والحارسان. **بلا استثناء، فقيمُها تنجو.** ────
do $$
declare
  v_count int;
  v_args  int;
  v_sec   boolean;
  v_cfg   text[];
  v_src   text;
begin
  select count(*) into v_count
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'post_stock_document';

  select p.pronargs, p.prosecdef, p.proconfig, p.prosrc
    into v_args, v_sec, v_cfg, v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'post_stock_document'
   limit 1;

  perform set_config('t.copies', v_count::text, false);
  perform set_config('t.args',   coalesce(v_args::text, 'NULL'), false);
  perform set_config('t.secdef', coalesce(v_sec::text, 'NULL'), false);
  perform set_config('t.config', coalesce(array_to_string(v_cfg, ','), '(بلا)'), false);
  perform set_config('t.has_guard',
    (position('''write_off'', ''return_to_supplier''' in v_src) > 0)::text, false);
  perform set_config('t.has_qty_cond',
    (position('v_qty < 0 and v_pick is null' in v_src) > 0)::text, false);
  perform set_config('t.has_pos_guard',
    (position('return_not_outgoing' in v_src) > 0)::text, false);
end $$;

-- ── ٤–١٠: السلوك. **النتائجُ في متغيّرات، والتبليغُ في المعالج.** ──────────
do $$
declare
  v_salon    uuid;
  v_storage  uuid;
  v_cat      uuid;
  v_product  uuid;
  v_supplier uuid;
  v_doc      uuid;
  v_lot      uuid;
  v_avail    numeric;
  v_est_a    int;
  v_est_b    int;

  -- 🔴 **متغيّراتٌ لا إعداداتُ جلسة** — هذه لا تُلغى مع المعاملة الفرعيّة.
  r_avail    text := '';
  r_over     text := '';
  r_ok       text := '';
  r_pos      text := '';
  r_pick     text := '';
  r_wo       text := '';
  r_sale     text := '';
  r_svc      text := '';
  r_price    text := '';
  v_report   text := '';
begin
  insert into salons (name) values ('١٠١ج تجريبيّ') returning id into v_salon;
  insert into storages (salon_id, name) values (v_salon, 'مستودع ١٠١ج')
    returning id into v_storage;
  insert into product_categories (salon_id, name) values (v_salon, 'مجلّد ١٠١ج')
    returning id into v_cat;
  insert into suppliers (salon_id, name) values (v_salon, 'مورّد ١٠١ج')
    returning id into v_supplier;
  insert into products (salon_id, category_id, name, base_unit, units_per_package)
    values (v_salon, v_cat, 'منتج ١٠١ج', 'pcs', 1)
    returning id into v_product;

  -- توريدٌ حقيقيّ: ١٠ قطعٍ بثمن ٥.
  select public.post_stock_document(
    'supply', v_storage,
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'quantity_base', 10, 'unit_cost', 5,
      'entered_quantity', 10, 'entered_uom', 'package')),
    v_supplier
  ) into v_doc;

  select coalesce(sum(s.rem), 0) into v_avail
    from ( select coalesce(sum(m.quantity_base), 0) as rem
             from public.stock_lots l
             left join public.stock_movements m on m.lot_id = l.id
            where l.salon_id = v_salon and l.storage_id = v_storage
              and l.product_id = v_product
            group by l.id ) s
   where s.rem > 0;
  r_avail := v_avail::text;

  -- ٤: إرجاعٌ يتجاوز المتاح ⟵ يُرفَض
  begin
    perform public.post_stock_document(
      'return_to_supplier', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', -11,
        'entered_quantity', 11, 'entered_uom', 'package')),
      v_supplier);
    r_over := 'مرّ ✗';
  exception when others then
    -- 🔴 الرمزُ يُقرأ، ولا يكفي «رُفض»: رفضٌ لسببٍ آخرَ يبدو نجاحًا للفحص.
    r_over := sqlerrm;
  end;

  -- ٥: إرجاعٌ داخلَ المتاح ⟵ ينجح. **شاهدُ صدقٍ للرفض أعلاه.**
  begin
    perform public.post_stock_document(
      'return_to_supplier', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', -4,
        'entered_quantity', 4, 'entered_uom', 'package',
        'entered_unit_price', 7)),
      v_supplier);
    r_ok := 'نجح ✓';
  exception when others then
    r_ok := 'فشل ✗ — ' || sqlerrm;
  end;

  -- ٦: كمّيّةٌ موجبةٌ ⟵ `return_not_outgoing`. **الفتحةُ المُغلَقة.**
  begin
    perform public.post_stock_document(
      'return_to_supplier', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', 3,
        'entered_quantity', 3, 'entered_uom', 'package')),
      v_supplier);
    r_pos := 'مرّ ✗';
  exception when others then
    r_pos := sqlerrm;
  end;

  -- ٧: المسارُ الصريحُ يرفض بـ`lot_insufficient` لا بالرمز الجديد.
  select l.id into v_lot from public.stock_lots l
   where l.salon_id = v_salon and l.storage_id = v_storage
     and l.product_id = v_product
   order by l.received_at, l.created_at, l.id limit 1;

  begin
    perform public.post_stock_document(
      'return_to_supplier', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'lot_id', v_lot, 'quantity_base', -99,
        'entered_quantity', 99, 'entered_uom', 'package')),
      v_supplier);
    r_pick := 'مرّ ✗';
  exception when others then
    r_pick := sqlerrm;
  end;

  -- ٨: الشطبُ الزائدُ ما زال يُرفَض — ١٠١ لم يفكّ ٠٩٧.
  begin
    perform public.post_stock_document(
      'write_off', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', -99,
        'entered_quantity', 99, 'entered_uom', 'package')),
      null);
    r_wo := 'مرّ ✗';
  exception when others then
    r_wo := sqlerrm;
  end;

  -- 🔴 ٩: الأنواعُ الثلاثةُ ما زالت تقدّر — **شاهدُ صدق الفحص كلِّه.**
  -- **والقياسُ على ولادةِ دفعةٍ مقدَّرة، لا على «لم يرمِ».**
  select count(*) into v_est_a from public.stock_lots
   where salon_id = v_salon and cost_is_estimated;

  begin
    perform public.post_stock_document(
      'sale', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', -50,
        'entered_quantity', 50, 'entered_uom', 'package')),
      null);
    r_sale := 'نجح ✓';
  exception when others then
    r_sale := 'رُفض ✗ — ' || sqlerrm;
  end;

  begin
    perform public.post_stock_document(
      'service_consumption', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', -50,
        'entered_quantity', 50, 'entered_uom', 'package')),
      null);
    r_svc := 'نجح ✓';
  exception when others then
    r_svc := 'رُفض ✗ — ' || sqlerrm;
  end;

  select count(*) into v_est_b from public.stock_lots
   where salon_id = v_salon and cost_is_estimated;

  -- ١٠: الثمنان متجاوران ومنفصلان — الإرجاعُ الناجحُ كُتب بـ٧ والدفعةُ ٥.
  select coalesce(string_agg(
    'cost=' || m.unit_cost::text || ' entered=' || coalesce(m.entered_unit_price::text, 'NULL'),
    ' · '), '(ولا حركة)')
    into r_price
    from public.stock_movements m
    join public.stock_documents d on d.id = m.document_id
   where d.salon_id = v_salon and d.doc_type = 'return_to_supplier';

  -- ⚠️ **الفاصلُ متعدّدُ المحارف** كي لا يكسره نصُّ رسالةِ خطأ.
  v_report := r_avail
    || '~|~' || r_over
    || '~|~' || r_ok
    || '~|~' || r_pos
    || '~|~' || r_pick
    || '~|~' || r_wo
    || '~|~' || v_est_a::text
    || '~|~' || r_sale
    || '~|~' || r_svc
    || '~|~' || v_est_b::text
    || '~|~' || r_price;

  -- 🔴 الإلغاءُ — ويمحو الصفوفَ ولا يمحو `v_report`.
  raise exception 'ROLLBACK_101C';
exception when others then
  -- 🔴 **هنا، بعد الإلغاء، في النطاق المحيط.** وهذا هو الفرقُ كلُّه عن ١٠١ب.
  if sqlerrm <> 'ROLLBACK_101C' then
    v_report := v_report || '~|~FATAL=' || sqlerrm;
  end if;
  perform set_config('t.report', v_report, false);
end $$;

-- ── المخرَج ────────────────────────────────────────────────────────────────
--
-- ⚠️ **وعددُ الحقول معروضٌ أوّلًا:** فكٌّ بموضعٍ خاطئ **يزيح كلَّ عمودٍ بعده
-- بصمت**، وعدٌّ يخالف ١١ يعلن عن نفسه قبل أن يُقرأ رقمٌ في خانةٍ ليست له.
-- **و`< 11` يعني أن الكتلةَ سقطت قبل بناء التقرير**، والسببُ في `FATAL`.
select
  current_setting('t.copies',        true) as copies_expect_1,
  current_setting('t.args',          true) as pronargs_expect_16,
  current_setting('t.secdef',        true) as secdef_expect_false,
  current_setting('t.config',        true) as search_path_expect_none,
  current_setting('t.has_guard',     true) as guard_in_body_expect_true,
  current_setting('t.has_qty_cond',  true) as qty_condition_expect_true,
  current_setting('t.has_pos_guard', true) as return_not_outgoing_in_body_expect_true,

  array_length(string_to_array(coalesce(current_setting('t.report', true), ''), '~|~'), 1)
                                          as fields_expect_11,

  split_part(current_setting('t.report', true), '~|~',  1) as available_expect_10,
  split_part(current_setting('t.report', true), '~|~',  2) as return_over_expect_insufficient_stock,
  split_part(current_setting('t.report', true), '~|~',  3) as return_within_expect_success,
  split_part(current_setting('t.report', true), '~|~',  4) as return_positive_expect_return_not_outgoing,
  split_part(current_setting('t.report', true), '~|~',  5) as return_explicit_lot_expect_lot_insufficient,
  split_part(current_setting('t.report', true), '~|~',  6) as writeoff_over_expect_insufficient_stock,
  split_part(current_setting('t.report', true), '~|~',  7) as estimated_before_expect_0,
  split_part(current_setting('t.report', true), '~|~',  8) as sale_over_expect_success,
  split_part(current_setting('t.report', true), '~|~',  9) as service_over_expect_success,
  split_part(current_setting('t.report', true), '~|~', 10) as estimated_after_expect_2,
  split_part(current_setting('t.report', true), '~|~', 11) as cost_5_entered_7,
  split_part(current_setting('t.report', true), '~|~', 12) as fatal_expect_empty;

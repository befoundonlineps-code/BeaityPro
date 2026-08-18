-- ==========================================================================
-- ١٠١ب — التحقّقُ من ١٠١. **يُشغَّل بعده.**
--
-- 🔴 يُنشئ بياناتِ تجربةٍ ثمّ **يُلغي المعاملةَ كلَّها** — فلا يبقى منها صفّ.
-- ⚠️ **ولا DDL في هذا الملفّ إطلاقًا**، فالإلغاءُ لا يسحب معه تعريفًا (البند ١).
--
-- ⚠️ **و`auth.uid()` فارغةٌ وRLS متجاوَزة** — فهذا يقيس **الحسابَ والرفضَ**،
-- لا العزل. والعزلُ مُثبَتٌ بـ٠٩٤ب.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- عشرةُ أسئلةٍ لا واحد — والتاسعُ هو الذي يمنع الكارثة
--
--   ١. التوقيعُ لم يُمسّ    `pronargs = 16` و`p_doc_number` باقيان
--   ٢. الخاصّيّتان         **لا `SECURITY DEFINER` ولا `search_path`** — يُقرآن
--                          راجعَين، لا يُفترضان (البند ٢ و`CREATE OR REPLACE`)
--   ٣. الحارسان في الجسم   `insufficient_stock` **و**`return_not_outgoing` —
--                          وجودُ أحدِهما لا يعني الآخر
--   ٤. الإرجاعُ الزائدُ     **يُرفَض** بـ`insufficient_stock`
--   ٥. الإرجاعُ الكافي     **ينجح** — ورفضٌ شامل ليس نجاحًا
--   ٦. الكمّيّةُ الموجبةُ    **تُرفَض** بـ`return_not_outgoing` — الفتحةُ المُغلَقة
--   ٧. المسارُ الصريحُ      ما زال يرفض بـ`lot_insufficient` **لا** بالرمز الجديد
--   ٨. الشطبُ الزائدُ       ما زال يُرفَض — ١٠١ لم يفكّ ٠٩٧
--   🔴 ٩. **الأنواعُ الثلاثةُ ما زالت تقدّر** — وهذا شاهدُ صدق الفحص كلِّه:
--          لو تسرّب الحارسُ إليها لبدا الرفضُ الشاملُ نجاحًا على ٤ و٦ و٨
--   ١٠. الثمنان منفصلان    `unit_cost = 5` بينما `entered_unit_price = 7`
--
-- ⚠️ **والترتيبُ هنا هو ترتيبُ الجسم نفسُه، والعددُ أُعيد قياسُه** بعد إضافة
-- فحصَي المراجع — كان «سبعة» وصار عشرة. **وترويسةٌ تحمل عددًا صار قديمًا، أو
-- ترتيبًا يخالف ما تحته، هي الصنفُ الذي يلاحقه هذا المشروع.**
--
-- ⚠️ **والمخرَجُ `select` واحدٌ في الآخر**، لأن محرّر Supabase يعرض النتيجةَ
-- الأخيرةَ وحدَها، **و`raise notice` لا يظهر فيه إطلاقًا** — وهو ما أضاع مخرَجَ
-- ٠٩٠ب/C و٠٩١ من قبل. فكلُّ جوابٍ يُخزَّن بـ`set_config` ويُقرأ في النهاية.
--
-- 🔴 **والتوقيعُ يُقرأ قبل الكتلة الملغاة ويُطبَع بعدها**، فيبقى ظاهرًا لو سقط
-- التنفيذُ في المنتصف.
-- ==========================================================================

-- ── ١ و٢: التوقيعُ والخاصّيّتان، قبل أيّ كتابة ─────────────────────────────
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
  -- ⚠️ **يُقرأ راجعًا لا يُفترض:** `CREATE OR REPLACE` يصفّر كلَّ خاصّيّةٍ غيرِ
  -- مذكورة، **فـ«ما ذكرناها فما تغيّرت» استنتاجٌ لا قياس.**
  perform set_config('t.secdef', coalesce(v_sec::text, 'NULL'), false);
  perform set_config('t.config', coalesce(array_to_string(v_cfg, ','), '(بلا)'), false);
  -- 🔴 **ومعاملٌ موجودٌ لا يعني حارسًا مكتوبًا** (البند ٢): يُقرأ الجسمُ نفسُه.
  perform set_config('t.has_guard',
    (position('''write_off'', ''return_to_supplier''' in v_src) > 0)::text, false);
  perform set_config('t.has_qty_cond',
    (position('v_qty < 0 and v_pick is null' in v_src) > 0)::text, false);
  -- 🔴 **والحارسُ الثاني يُقرأ من الجسم كذلك** — وجودُ أحدِهما لا يعني الآخر.
  perform set_config('t.has_pos_guard',
    (position('return_not_outgoing' in v_src) > 0)::text, false);
end $$;

-- ── ٣–٧: السلوكُ الفعليّ، ثمّ إلغاءٌ كامل ──────────────────────────────────
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
  v_est      int;
begin
  -- صالونٌ ومستودعٌ ومجلّدٌ ومنتجٌ ومورّدٌ، كلُّها من هذا الملفّ.
  insert into salons (name) values ('١٠١ب تجريبيّ') returning id into v_salon;
  insert into storages (salon_id, name) values (v_salon, 'مستودع ١٠١ب')
    returning id into v_storage;
  insert into product_categories (salon_id, name) values (v_salon, 'مجلّد ١٠١ب')
    returning id into v_cat;
  insert into suppliers (salon_id, name) values (v_salon, 'مورّد ١٠١ب')
    returning id into v_supplier;
  insert into products (salon_id, category_id, name, base_unit, units_per_package)
    values (v_salon, v_cat, 'منتج ١٠١ب', 'pcs', 1)
    returning id into v_product;

  -- توريدٌ حقيقيٌّ: ١٠ قطعٍ بثمن ٥.
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
  perform set_config('t.avail', v_avail::text, false);

  -- ── ٤: إرجاعٌ يتجاوز المتاح ⟵ يُرفَض ────────────────────────────────────
  begin
    perform public.post_stock_document(
      'return_to_supplier', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', -11,
        'entered_quantity', 11, 'entered_uom', 'package')),
      v_supplier
    );
    perform set_config('t.ret_over', 'مرّ ✗ — والمفروض يُرفَض', false);
  exception when others then
    -- 🔴 **الرمزُ يُقرأ ولا يكفي «رُفض»:** رفضٌ لسببٍ آخرَ (منتجٌ مفقود، مستودعٌ
    -- مجهول) يبدو نجاحًا للفحص، **وهو أخطرُ من ✗ كاذبة.**
    perform set_config('t.ret_over', sqlerrm, false);
  end;

  -- ── ٥: إرجاعٌ داخلَ المتاح ⟵ ينجح. **شاهدُ صدقٍ للرفض أعلاه.** ─────────
  begin
    perform public.post_stock_document(
      'return_to_supplier', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', -4,
        'entered_quantity', 4, 'entered_uom', 'package',
        'entered_unit_price', 7)),
      v_supplier
    );
    perform set_config('t.ret_ok', 'نجح ✓', false);
  exception when others then
    perform set_config('t.ret_ok', 'فشل ✗ — ' || sqlerrm, false);
  end;

  -- ── ٦: كمّيّةٌ موجبةٌ بالإرجاع ⟵ `return_not_outgoing` ──────────────────
  --
  -- 🔴 **الفتحةُ التي أُغلقت بقرار المالك في نفس الدفعة.** وبلا الحارس تنجح
  -- هذه المحاولةُ **وتفتح دفعةً مقدَّرةً باسم الإرجاع** — أي تنجح صامتةً وتخترع
  -- ثمنًا، **وذلك أسوأُ من رفضٍ خاطئ.**
  begin
    perform public.post_stock_document(
      'return_to_supplier', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', 3,
        'entered_quantity', 3, 'entered_uom', 'package')),
      v_supplier
    );
    perform set_config('t.ret_pos', 'مرّ ✗ — والمفروض يُرفَض', false);
  exception when others then
    perform set_config('t.ret_pos', sqlerrm, false);
  end;

  -- ── ٧: المسارُ الصريحُ ما زال يرفض بـ`lot_insufficient` ─────────────────
  --
  -- ⚠️ **واقتراحُ المراجع، وقبلتُه لأنه يقيس تداخلًا لا يقيسه غيرُه:** الحارسُ
  -- الجديدُ محصورٌ بـ`v_pick is null`، **فلو تسرّب إلى المسار الصريح لعاد
  -- `insufficient_stock` مكان `lot_insufficient`** — رفضٌ صحيحٌ برمزٍ خاطئ،
  -- **والشاشةُ تعرض جملةً تقترح حلًّا لا يصلح.**
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
      v_supplier
    );
    perform set_config('t.ret_pick', 'مرّ ✗ — والمفروض يُرفَض', false);
  exception when others then
    perform set_config('t.ret_pick', sqlerrm, false);
  end;

  -- ── ٨: الشطبُ الزائدُ ما زال يُرفَض — ١٠١ لم يفكّ ٠٩٧ ──────────────────
  begin
    perform public.post_stock_document(
      'write_off', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', -99,
        'entered_quantity', 99, 'entered_uom', 'package')),
      null
    );
    perform set_config('t.wo_over', 'مرّ ✗ — و٠٩٧ يقول يُرفَض', false);
  exception when others then
    perform set_config('t.wo_over', sqlerrm, false);
  end;

  -- ── 🔴 ٩: الأنواعُ الثلاثةُ ما زالت تقدّر ────────────────────────────────
  --
  -- **وهذا شاهدُ صدق الفحص كلِّه.** لو تسرّب الحارسُ إليها لصار الرفضُ شاملًا،
  -- **ورفضٌ شاملٌ يقرأ ✓ على الأسئلة ٤ و٦ و٨ ويكون النظامُ مكسورًا.**
  --
  -- ⚠️ **والقياسُ على ولادةِ دفعةٍ مقدَّرةٍ لا على «لم يرمِ»:** نجاحُ النداء
  -- وحدَه لا يقول إن التقديرَ عمل.
  select count(*) into v_est from public.stock_lots
   where salon_id = v_salon and cost_is_estimated;
  perform set_config('t.est_before', v_est::text, false);

  begin
    perform public.post_stock_document(
      'sale', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', -50,
        'entered_quantity', 50, 'entered_uom', 'package')),
      null
    );
    perform set_config('t.sale_over', 'نجح ✓ (يقدّر)', false);
  exception when others then
    perform set_config('t.sale_over', 'رُفض ✗ — ' || sqlerrm, false);
  end;

  begin
    perform public.post_stock_document(
      'service_consumption', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product, 'quantity_base', -50,
        'entered_quantity', 50, 'entered_uom', 'package')),
      null
    );
    perform set_config('t.svc_over', 'نجح ✓ (يقدّر)', false);
  exception when others then
    perform set_config('t.svc_over', 'رُفض ✗ — ' || sqlerrm, false);
  end;

  select count(*) into v_est from public.stock_lots
   where salon_id = v_salon and cost_is_estimated;
  perform set_config('t.est_after', v_est::text, false);

  -- ── ٩: هل حُفظ `entered_unit_price` منفصلًا عن `unit_cost`؟ ─────────────
  --
  -- **الإرجاعُ الناجحُ أعلاه كُتب بثمنٍ ٧ والدفعةُ ثمنُها ٥.**
  perform set_config('t.split_price', (
    select coalesce(string_agg(
      'cost=' || m.unit_cost::text || ' entered=' || coalesce(m.entered_unit_price::text, 'NULL'),
      ' · '), '(ولا حركة)')
      from public.stock_movements m
      join public.stock_documents d on d.id = m.document_id
     where d.salon_id = v_salon and d.doc_type = 'return_to_supplier'
  ), false);

  -- 🔴 **إلغاءٌ كامل.** ولا DDL في هذا الملفّ فلا يُسحب تعريفٌ معه.
  raise exception 'ROLLBACK_101B';
exception when others then
  if sqlerrm <> 'ROLLBACK_101B' then
    perform set_config('t.fatal', sqlerrm, false);
  end if;
end $$;

-- ── المخرَجُ: `select` واحدٌ أخير ───────────────────────────────────────────
select
  current_setting('t.copies',      true) as copies_expect_1,
  current_setting('t.args',        true) as pronargs_expect_16,
  current_setting('t.secdef',      true) as secdef_expect_false,
  current_setting('t.config',      true) as search_path_expect_none,
  current_setting('t.has_guard',   true) as guard_in_body_expect_true,
  current_setting('t.has_qty_cond', true) as qty_condition_expect_true,
  current_setting('t.has_pos_guard', true) as return_not_outgoing_in_body_expect_true,
  current_setting('t.avail',       true) as available_expect_10,
  current_setting('t.ret_over',    true) as return_over_expect_insufficient_stock,
  current_setting('t.ret_ok',      true) as return_within_expect_success,
  current_setting('t.ret_pos',     true) as return_positive_expect_return_not_outgoing,
  current_setting('t.ret_pick',    true) as return_explicit_lot_expect_lot_insufficient,
  current_setting('t.wo_over',     true) as writeoff_over_expect_insufficient_stock,
  current_setting('t.est_before',  true) as estimated_lots_before_expect_0,
  current_setting('t.sale_over',   true) as sale_over_expect_success,
  current_setting('t.svc_over',    true) as service_over_expect_success,
  current_setting('t.est_after',   true) as estimated_lots_after_expect_2,
  current_setting('t.split_price', true) as cost_5_entered_7,
  current_setting('t.fatal',       true) as unexpected_error_expect_null;

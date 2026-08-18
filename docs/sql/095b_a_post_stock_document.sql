-- ==========================================================================
-- ٠٩٥ب/أ — هل تعمل `post_stock_document` على الدفعات فعلًا؟
--
-- 🔴 مُجهَّزٌ ولم أشغّله. **قراءةٌ بأثرٍ مُلغًى**: يكتب مستنداتٍ وحركاتٍ ودفعات،
-- **ثمّ يتراجع عنها كلِّها** بكتلةٍ داخليّة. لا يترك صفًّا واحدًا.
--
-- ⚠️ **و`auth.uid()` فارغةٌ في المحرّر وRLS متجاوَزةٌ بالكامل** — فهذا يقيس
-- **الحساب والتخطيط**، ولا يقول شيئًا عن العزل بين الصالونات. **ويُقال هنا كي
-- لا يُقرأ الأخضرُ على أنه أثبت الاثنين.**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 لماذا يُنادى الدوالُّ ولا تُقرأ نصوصُها
--
-- **PL/pgSQL يخزّن الجسمَ نصًّا ويخطّط كلَّ جملةٍ عند أوّل تنفيذ.** فنجاحُ ٠٩٥
-- أثبت أن الستّةَ حُفظت بلا خطأٍ نحويّ **ولا شيءَ غير ذلك**: فرعٌ لم يمرّ عليه
-- استدعاءٌ لم يُخطَّط، وقد يسقط أوّلَ مرّة. **فكلُّ فرعٍ يكتب عمودًا يُنفَّذ هنا.**
--
-- ---------------------------------------------------------------------------
-- البنية، ولماذا هي هكذا بالضبط
--
--   • **جملةُ `select` واحدة** في الملفّ كلِّه — محرّرُ Supabase يعرض مجموعةَ
--     النتائج الأخيرة وحدَها، **والابتلاعُ صامت**. وقعت مرّتين (٠٩٣ · ٠٩٤ب).
--   • **ولا `raise notice`** — مقيسٌ عند المالك أنها لا تصل إطلاقًا. **حارسٌ
--     اشتغل وما حدا شافه يساوي حارسًا ما اشتغل، والفرقُ أنك تظنّ أنك قِسْت.**
--   • **ولا `create temp table`** — تُصنَّف `ddl` فتقع تحت البند ١. التقريرُ
--     يُراكَم في متغيّر PL/pgSQL، **وهو وحدَه ما ينجو من تراجع الكتلة**، ثمّ
--     يُودَع بـ`set_config` **بعدها** لا داخلها.
--   • **ولا DDL هنا إطلاقًا**، فلا شيءَ يمكن أن يُمحى مهما كان هذا الملفُّ خطأً.
--
-- ---------------------------------------------------------------------------
-- ⚠️ التجهيزةُ مشتقّةٌ من القاعدة، ولا اسمَ مكتوبٌ بيد
--
--   • نوعُ مستند الإخراج **يُقرأ من `pg_enum`** — كلُّ قيمةٍ ليست من الخمسة
--     المعروفة. **`stock_doc_type` تسعُ قيمٍ ولا أعرف أسماءها**، وتخمينُ اسمٍ
--     هو الصنفُ الذي كلّف هذا المشروعَ أربعَ مرّات.
--   • و`entered_uom` كذلك من `pg_enum`.
--   • والمنتجُ والمستودعُ **زوجٌ لا دفعةَ له** — مشتقٌّ بـ`not exists`، فلا
--     تُفسد دفعاتٌ سابقةٌ ترتيبَ FIFO المقيس.
--
-- 🔴 **وشاهدُ الصدق يُطبع أوّلًا:** أسماءُ ما اختِير وعددُ ما وُجد. **فالمخرَجُ
-- الفارغُ أو `NO FIXTURE` خبرٌ لا نجاح** — وبدونه «مرّ الفحص» و«لم يجد ما يفحصه»
-- يبدوان متطابقين تمامًا (البند ١ج).
--
-- ---------------------------------------------------------------------------
-- المتوقَّع — ✓ على كلّ سطر
--
--   supply_lot        دفعةٌ واحدةٌ بثمنٍ ٥، غيرُ مقدَّرة، وحركةٌ واحدةٌ عليها
--   split             سطرٌ واحدٌ ⟵ **حركتان**: ١٠@٥ ثمّ ٣@٨
--   frames            إطارُ المُدخَل على الأولى وحدَها، والثانيةُ `null`
--   remaining         الدفعةُ الأولى ٠ والثانيةُ ٣ — **مجموعُ حركاتٍ لا عمود**
--   tier2             سحبٌ يتجاوز المتاح ⟵ دفعةٌ مقدَّرةٌ بثمن آخر توريدٍ هنا
--   tier4             منتجٌ بلا تاريخٍ إطلاقًا ⟵ السعرُ الاسميُّ من الكتالوج
-- ==========================================================================

do $$
declare
  v_log        text := '';
  v_salon      uuid;
  v_storage    uuid;
  v_pid        uuid;
  v_pid2       uuid;
  v_issue      text;
  v_uom        text;
  v_d1         uuid;
  v_d2         uuid;
  v_d3         uuid;
  v_d4         uuid;
  v_d5         uuid;
  v_lot1       uuid;
  v_lot2       uuid;
  v_tmp_lot    uuid;
  v_slices     text;
  v_n          int;
  v_cost       numeric;
  v_qty        numeric;
  v_est        boolean;
  v_nominal    numeric;
  v_first_ent  numeric;
  v_second_ent numeric;
begin
  begin
    -- ── التجهيزة، مشتقّةً ───────────────────────────────────────────────────
    select e.enumlabel::text into v_issue
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'stock_doc_type'
       and e.enumlabel not in ('transfer', 'reversal', 'stocktake', 'supply', 'opening')
     order by e.enumsortorder limit 1;

    select e.enumlabel::text into v_uom
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'entry_uom'
     order by e.enumsortorder limit 1;

    -- زوجٌ (منتج، مستودع) بنفس الصالون ولا دفعةَ له — فترتيبُ FIFO المقيس نظيف.
    select p.id, s.id, p.salon_id
      into v_pid, v_storage, v_salon
      from public.products p
      join public.storages s on s.salon_id = p.salon_id
     where not exists (select 1 from public.stock_lots l
                        where l.product_id = p.id and l.storage_id = s.id)
     order by p.id, s.id
     limit 1;

    -- منتجٌ ثانٍ **بلا أيّ حركةٍ في الصالون كلِّه** — هذا ما يُنزل السلّمَ إلى
    -- الدرجة ٤، والاشتقاقُ هو ما يضمن ذلك بدل أن نفترضه.
    select p.id, p.nominal_purchase_price
      into v_pid2, v_nominal
      from public.products p
     where p.salon_id = v_salon
       and p.id <> v_pid
       and not exists (select 1 from public.stock_movements m where m.product_id = p.id)
     order by p.id
     limit 1;

    v_log := v_log || format(
      'products=%s storages=%s | issue_type=%s uom=%s | pid=%s pid2=%s nominal=%s',
      (select count(*) from public.products),
      (select count(*) from public.storages),
      coalesce(v_issue, 'NONE'), coalesce(v_uom, 'NONE'),
      coalesce(v_pid::text, 'NONE'), coalesce(v_pid2::text, 'NONE'),
      coalesce(v_nominal::text, 'NONE'));

    if v_pid is null or v_storage is null or v_issue is null or v_uom is null then
      v_log := v_log || E'\n🔴 NO FIXTURE — لا زوجَ صالحًا أو لا قيمةَ enum. لم يُفحص شيء.';
      perform set_config('probe.result', v_log, false);
      return;
    end if;

    -- ── ١. التوريد يولّد دفعة ───────────────────────────────────────────────
    v_d1 := public.post_stock_document(
      'supply', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_pid, 'quantity_base', 10, 'unit_cost', 5,
        'entered_quantity', 10, 'entered_uom', v_uom)),
      null, null, null, now() - interval '2 days', 'probe-095b-a');

    select l.id, l.unit_cost, l.cost_is_estimated into v_lot1, v_cost, v_est
      from public.stock_lots l where l.source_document_id = v_d1;

    select count(*) into v_n from public.stock_lots where source_document_id = v_d1;
    v_log := v_log || format(E'\nsupply_lot   lots=%s cost=%s estimated=%s  %s',
      v_n, v_cost, v_est,
      case when v_n = 1 and v_cost = 5 and v_est = false then '✓' else '✗' end);

    -- ⚠️ **ولا `min(m.lot_id)` هنا، وقد كتبتُها أوّلَ مرّة:** بوستجرس لا يملك
    -- دالّةَ تجميعٍ ترتيبيّةً لـ`uuid` إطلاقًا — مسجَّلٌ عندنا منذ
    -- `mark_resource_units_out`. فالعدُّ جملةٌ والصفُّ جملةٌ أخرى.
    select count(*) into v_n from public.stock_movements m where m.document_id = v_d1;
    select m.lot_id, m.quantity_base into v_tmp_lot, v_qty
      from public.stock_movements m where m.document_id = v_d1 limit 1;
    v_log := v_log || format(E'\nsupply_move  moves=%s qty=%s lot_matches=%s  %s',
      v_n, v_qty, (v_tmp_lot = v_lot1),
      case when v_n = 1 and v_qty = 10 and v_tmp_lot = v_lot1 then '✓' else '✗' end);

    -- ── ٢. دفعةٌ ثانيةٌ أحدث ─────────────────────────────────────────────────
    v_d2 := public.post_stock_document(
      'supply', v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_pid, 'quantity_base', 6, 'unit_cost', 8,
        'entered_quantity', 6, 'entered_uom', v_uom)),
      null, null, null, now() - interval '1 day', 'probe-095b-a');
    select l.id into v_lot2 from public.stock_lots l where l.source_document_id = v_d2;

    -- ── ٣. سطرٌ واحدٌ يستهلك دفعتين ⟵ حركتان ────────────────────────────────
    v_d3 := public.post_stock_document(
      v_issue::stock_doc_type, v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_pid, 'quantity_base', -13,
        'entered_quantity', 13, 'entered_uom', v_uom)),
      null, null, null, now(), 'probe-095b-a');

    select count(*) into v_n from public.stock_movements where document_id = v_d3;
    v_log := v_log || format(E'\nsplit_count  moves=%s (expect 2)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    -- الأقدمُ أوّلًا، وبثمنِ دفعته هو — لا بمتوسّطٍ ممزوج. **والشرائحُ تُطبع
    -- خامًّا بجانب الحكم**: `✗` بلا الأرقام التي أنتجته يبدأ جولةَ تشخيصٍ كاملة.
    select string_agg(format('%s@%s', m.quantity_base, m.unit_cost), ' , '
                      order by m.unit_cost)
      into v_slices
      from public.stock_movements m where m.document_id = v_d3;
    v_log := v_log || format(E'\nsplit_raw    %s', coalesce(v_slices, 'NONE'));

    select count(*) into v_n
      from public.stock_movements m
     where m.document_id = v_d3
       and ((m.lot_id = v_lot1 and m.quantity_base = -10 and m.unit_cost = 5)
         or (m.lot_id = v_lot2 and m.quantity_base = -3  and m.unit_cost = 8));
    v_log := v_log || format(E'\nsplit_fifo   matching_slices=%s (expect 2: -10@5 on lot1, -3@8 on lot2)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    -- ── ٤. إطارُ المُدخَل على الشريحة الأولى وحدَها ──────────────────────────
    select m.entered_quantity into v_first_ent
      from public.stock_movements m where m.document_id = v_d3 and m.lot_id = v_lot1;
    select m.entered_quantity into v_second_ent
      from public.stock_movements m where m.document_id = v_d3 and m.lot_id = v_lot2;
    v_log := v_log || format(E'\nframes       first=%s second=%s (expect 13 , NULL)  %s',
      coalesce(v_first_ent::text, 'NULL'), coalesce(v_second_ent::text, 'NULL'),
      case when v_first_ent = 13 and v_second_ent is null then '✓' else '✗' end);

    -- ── ٥. المتبقّي مشتقٌّ لا مخزَّن ─────────────────────────────────────────
    v_log := v_log || format(E'\nremaining    lot1=%s lot2=%s (expect 0 , 3)  %s',
      (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot1),
      (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2),
      case when (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot1) = 0
            and (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2) = 3
           then '✓' else '✗' end);

    -- ── ٦. سحبٌ يتجاوز المتاح ⟵ دفعةٌ مقدَّرة، والدرجةُ ٢ هي التي تسعّرها ────
    -- المتبقّي ٣، والمطلوب ٥ — فشريحتان: ٣ من الدفعة الثانية، و٢ من مقدَّرة.
    -- وثمنُ المقدَّرة = آخرُ ثمنِ حركةٍ موجبةٍ في هذا المستودع = ٨.
    v_d4 := public.post_stock_document(
      v_issue::stock_doc_type, v_storage,
      jsonb_build_array(jsonb_build_object(
        'product_id', v_pid, 'quantity_base', -5,
        'entered_quantity', 5, 'entered_uom', v_uom)),
      null, null, null, now(), 'probe-095b-a');

    select count(*) into v_n from public.stock_movements where document_id = v_d4;
    select l.unit_cost, l.cost_is_estimated into v_cost, v_est
      from public.stock_lots l where l.source_document_id = v_d4;
    v_log := v_log || format(E'\ntier2        moves=%s est_lot_cost=%s estimated=%s (expect 2 , 8 , t)  %s',
      v_n, coalesce(v_cost::text, 'NONE'), coalesce(v_est::text, 'NONE'),
      case when v_n = 2 and v_cost = 8 and v_est then '✓' else '✗' end);

    -- ── ٧. منتجٌ بلا تاريخٍ إطلاقًا ⟵ الدرجة ٤ ───────────────────────────────
    if v_pid2 is null then
      v_log := v_log || E'\ntier4        SKIPPED — لا منتجَ ثانٍ بلا حركات. **لم يُقَس، لا «مرّ».**';
    else
      v_d5 := public.post_stock_document(
        v_issue::stock_doc_type, v_storage,
        jsonb_build_array(jsonb_build_object(
          'product_id', v_pid2, 'quantity_base', -4,
          'entered_quantity', 4, 'entered_uom', v_uom)),
        null, null, null, now(), 'probe-095b-a');

      select l.unit_cost, l.cost_is_estimated into v_cost, v_est
        from public.stock_lots l where l.source_document_id = v_d5;
      v_log := v_log || format(E'\ntier4        cost=%s nominal=%s estimated=%s  %s',
        coalesce(v_cost::text, 'NONE'), coalesce(v_nominal::text, 'NULL'), v_est,
        case when v_cost = coalesce(v_nominal, 0) and v_est then '✓' else '✗' end);
    end if;

    raise exception 'ROLLBACK_MARKER';
  exception when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then
      v_log := v_log || format(E'\n💥 %s — %s', sqlstate, sqlerrm);
    end if;
  end;

  -- ⚠️ بعد الكتلة لا داخلها: تراجعُ المعاملة الفرعيّة يمحو `set_config` كما
  -- يمحو الإدراج في جدولٍ مؤقّت. والمتغيّرُ وحدَه ينجو.
  perform set_config('probe.result', v_log, false);
end $$;

select current_setting('probe.result') as result;

-- ==========================================================================
-- ⚠️ أُضيف بعد التشغيل. **ولا جملةَ SQL واحدةٍ فوق هذا السطر تغيّرت** — الملفُّ
-- أعلاه هو بالحرف ما لُصق ونُفِّذ، وكلُّه أخضر.
--
-- 🔴 **لا يُعاد تشغيلُ هذا الملفِّ بعد ٠٩٦ — سيُظهر حُمرًا صحيحةً عن محرّكٍ سليم.**
--
-- التجهيزةُ اشتقّت نوعَ مستند الإخراج بأنه **أوّلُ قيمةٍ غيرِ مستثناةٍ** في
-- `stock_doc_type`، فوقع الاختيارُ على `write_off` — **بالترتيب لا بالقصد.**
-- والاختباراتُ الأربعةُ (`split` · `frames` · `tier2` · `tier4`) كلُّها تنادي
-- بذلك النوع **بلا `lot_id`**، أي على المسار الضمنيّ.
--
-- **و٠٩٦ يجعل `write_off` مشروطًا بدفعةٍ صريحةٍ مطلقًا**، فتلك النداءاتُ تُرفض
-- بـ`write_off_needs_lot` قبل أن تصل السلّمَ أو FIFO. ⚠️ **والرفضُ صحيح، والفحصُ
-- هو الذي تقادم** — لأنه اختار النوعَ بالترتيب لا بمعناه.
--
-- ⇒ **وانحدارُ المسار الضمنيِّ انتقل إلى ٠٩٦ب**، بنوعِ مستندٍ مُخرِجٍ آخر مشتقٍّ
-- من `pg_enum` باستثناء `write_off` معه. **وإن لم يوجد نوعٌ آخر فذلك يُطبع بالاسم**
-- لا يُستنتج: يعني أن الإخراجَ الضمنيَّ بلا مُنادٍ بعد ٠٩٦.
--
-- ⚠️ **ولم يُصحَّح هذا الملفُّ بمكانه** — «السكربتُ الذي اشتغل لا يُصلَّح بمكانه،
-- والملفُّ هو السجلُّ الوحيد لما لُصق فعلًا». نفسُ ما فُعل بـ٠٩٤ و٠٥٣أ.
-- ==========================================================================

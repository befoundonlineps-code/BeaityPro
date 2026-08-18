-- ==========================================================================
-- ٠٩٥ب/ج — الجردُ على الدفعات، **والغرامةُ هي السؤالُ الأثقل في ٠٩٥ كلِّه**
--
-- 🔴 مُجهَّزٌ ولم أشغّله. **أثرُه مُلغًى بالكامل.**
-- ⚠️ **و`auth.uid()` فارغةٌ وRLS متجاوَزة** — يقيس الحسابَ والتخطيط، لا العزل.
-- **البنيةُ وأسبابُها في ٠٩٥ب/أ.**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 هذا هو الملفُّ الذي يفشل أوّلًا لو كان تحليلُ الغرامة خطأً
--
-- `stock_fine_lines_one_per_product unique (fine_id, product_id)` (٠٥٦أ:٢٢٧)،
-- والجسمُ الحيُّ كان يكتب **سطرًا لكلّ حركة**. فعجزٌ يمتدّ على دفعتين ⟵ حركتان
-- ⟵ صفّان بنفس المفتاح ⟵ **`23505` يُسقط الترحيلَ كلَّه.**
--
-- **وهذا الملفُّ ينتج تلك الحالةَ بالضبط**: رصيدٌ من دفعتين، وعجزٌ يتجاوز الأولى.
-- **فلو بقي الإدراجُ على حاله لسقط هنا برمز `23505`، ولظهر بالسطر `💥`.**
--
-- ⚠️ **ولذلك لا يكفي أن يُقرأ «✓ fine_lines=1»:** يُقرأ معه أن **حركتَي العجز
-- كتبتا فعلًا** — سطرٌ واحدٌ عن عجزٍ لم ينقسم أصلًا يمرّ بلا أن يثبت شيئًا.
-- **والسطران معًا هما البيّنة، لا أحدُهما.**
--
-- ---------------------------------------------------------------------------
-- ⚠️ وسياسةُ الغرامة تُكتب هنا إن لم تكن موجودة — ويُعلَن ذلك
--
-- `fine_policy_missing` يرفض الترحيلَ عن مستودعٍ بلا `fine_percent`/`fine_basis`،
-- فبدون سياسةٍ لا يُقاس شيءٌ عن الغرامة إطلاقًا. **والكتابةُ داخل الكتلة الملغاة**،
-- فلا يبقى منها أثر — **ويُطبع هل كُتبت أم كانت موجودة**، كي لا يُقرأ الأخضرُ
-- على أنه قاس سياسةَ المالك وهو قاس سياسةً كتبها الفحصُ لنفسه.
--
-- ⚠️ **و`purchase_price` تحديدًا** لأنها الأساسُ الذي يجعل `unit_value` متوسّطًا
-- مرجَّحًا لتكاليف الدفعات — وهو الرقمُ المقصودُ بالقياس. و`sales_price` تقرأ
-- سعرَ الكتالوج ولا تمرّ على الدفعات إطلاقًا.
--
-- ---------------------------------------------------------------------------
-- المتوقَّع — ✓ على كلّ سطر
--
--   shortage     ‏-10@5 على الدفعة الأولى · ‏-3@8 على الثانية (حركتان)
--   fine_lines   **سطرٌ واحدٌ للمنتج** — لا سطرٌ لكلّ حركة
--   fine_qty     shortage_base = 13، موجبةً (الإشارةُ تُسقط)
--   fine_value   unit_value = (10×5 + 3×8) ÷ 13 = 74 ÷ 13 = **5.6923**
--   surplus      فائضٌ ⟵ دفعةٌ مقدَّرةٌ واحدة، `cost_is_estimated = true`
--   frames       إطارُ المُدخَل `null` على كلّ حركات الجرد بلا استثناء
-- ==========================================================================

do $$
declare
  v_log      text := '';
  v_salon    uuid;
  v_storage  uuid;
  v_pid      uuid;
  v_pid2     uuid;
  v_emp      uuid;
  v_uom      text;
  v_policy   text;
  v_sess     uuid;
  v_doc      uuid;
  v_fine     uuid;
  v_lot1     uuid;
  v_lot2     uuid;
  v_n        int;
  v_qty      numeric;
  v_val      numeric;
  v_slices   text;
begin
  begin
    select e.enumlabel::text into v_uom
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'entry_uom' order by e.enumsortorder limit 1;

    select p.id, s.id, p.salon_id
      into v_pid, v_storage, v_salon
      from public.products p
      join public.storages s on s.salon_id = p.salon_id
     where not exists (select 1 from public.stock_lots l
                        where l.product_id = p.id and l.storage_id = s.id)
     order by p.id, s.id
     limit 1;

    -- منتجٌ ثانٍ للفائض — **بلا حركاتٍ إطلاقًا**، فرصيدُه صفرٌ يقينًا وأيُّ عدٍّ
    -- موجبٍ فائضٌ خالص.
    select p.id into v_pid2
      from public.products p
     where p.salon_id = v_salon and p.id <> v_pid
       and not exists (select 1 from public.stock_movements m where m.product_id = p.id)
     order by p.id limit 1;

    select e.id into v_emp from public.employees e where e.salon_id = v_salon order by e.id limit 1;

    v_log := v_log || format('storage=%s pid=%s pid2=%s emp=%s uom=%s',
      coalesce(v_storage::text, 'NONE'), coalesce(v_pid::text, 'NONE'),
      coalesce(v_pid2::text, 'NONE'), coalesce(v_emp::text, 'NONE'), coalesce(v_uom, 'NONE'));

    if v_pid is null or v_storage is null or v_uom is null then
      v_log := v_log || E'\n🔴 NO FIXTURE — لم يُفحص شيء.';
      perform set_config('probe.result', v_log, false);
      return;
    end if;

    -- سياسةُ الغرامة: تُقرأ، وتُكتب إن غابت — والحالةُ تُعلَن.
    select case when s.fine_percent is null or s.fine_basis is null
                then 'WRITTEN BY PROBE' else 'ALREADY SET' end
      into v_policy from public.storages s where s.id = v_storage;
    update public.storages
       set fine_percent = coalesce(fine_percent, 10),
           fine_basis   = coalesce(fine_basis, 'purchase_price')
     where id = v_storage;
    v_log := v_log || format(E'\npolicy       %s', v_policy);

    -- رصيدٌ من دفعتين: ١٠@٥ ثمّ ٦@٨ = ١٦.
    v_lot1 := null;
    perform public.post_stock_document('supply', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 10,
        'unit_cost', 5, 'entered_quantity', 10, 'entered_uom', v_uom)),
      null, null, null, now() - interval '2 days', 'probe-095b-c');
    select l.id into v_lot1 from public.stock_lots l
     where l.product_id = v_pid and l.storage_id = v_storage and l.unit_cost = 5;

    perform public.post_stock_document('supply', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 6,
        'unit_cost', 8, 'entered_quantity', 6, 'entered_uom', v_uom)),
      null, null, null, now() - interval '1 day', 'probe-095b-c');
    select l.id into v_lot2 from public.stock_lots l
     where l.product_id = v_pid and l.storage_id = v_storage and l.unit_cost = 8;

    -- جلسةُ جرد: المعدودُ ٣ من رصيدٍ ١٦ ⟵ عجزٌ ١٣ يعبر الدفعتين.
    --
    -- 🔴 **صُحِّح بعد التشغيل: `started_by` يشير إلى `profiles` لا `employees`.**
    -- مُرِّر معرّفُ موظّفٍ فسقط بـ`23503` على `stocktake_sessions_started_by_fkey`،
    -- **والعمودُ `nullable` أصلًا** (مقيسٌ باستعلام تشخيصٍ عند المالك).
    --
    -- ⚠️ **والاسمُ هو ما ضلّل، وهذا البند ٤ب حرفيًّا:** `started_by` بجانب
    -- `employee_id` في نفس الموديول يُقرأ موظّفًا، **و`stocktakeSessionIO.js`
    -- يسرد العمودَ ولا يقول إلى أين يشير.** فقائمةُ الأعمدة أُخذت من الكود
    -- والوجهةُ افتُرضت من الاسم — **والكتالوجُ وحدَه كان يعرفها.**
    --
    -- ⚠️ **وقد سُمّي هذا الخطرُ بالرسالة المرافقة قبل التشغيل** («قائمةُ أعمدة
    -- الجدولين مأخوذةٌ من الكود لا من الكتالوج») — **وتسميةُ الصنف لم تمنع
    -- وقوعَه.** الإعلانُ عن مخاطرةٍ ليس بديلًا عن قراءةِ `pg_constraint`.
    --
    -- ✅ **و`null` هي الجوابُ الصحيح لا حيلةَ التفافٍ حول القيد:** الدالّةُ لا
    -- تقرأ «مَن بدأ الجلسة» في أيّ سطر، **و«مَن يُرحّل» يبقى موظّفًا حقيقيًّا**
    -- يُمرَّر بـ`v_emp` أدناه — وهما سؤالان مختلفان بجوابين مختلفين.
    insert into public.stocktake_sessions (salon_id, storage_id, started_by)
    values (v_salon, v_storage, null) returning id into v_sess;

    insert into public.stocktake_counts (salon_id, session_id, product_id, counted_base)
    values (v_salon, v_sess, v_pid, 3);

    if v_pid2 is not null then
      insert into public.stocktake_counts (salon_id, session_id, product_id, counted_base)
      values (v_salon, v_sess, v_pid2, 7);
    end if;

    v_doc := public.post_stocktake_session(v_sess, v_emp, now(), 'probe-095b-c');

    -- ── العجزُ منقسم ────────────────────────────────────────────────────────
    select string_agg(format('%s@%s', m.quantity_base, m.unit_cost), ' , ' order by m.unit_cost)
      into v_slices from public.stock_movements m
     where m.document_id = v_doc and m.product_id = v_pid;
    v_log := v_log || format(E'\nshortage_raw %s', coalesce(v_slices, 'NONE'));

    select count(*) into v_n
      from public.stock_movements m
     where m.document_id = v_doc and m.product_id = v_pid
       and ((m.lot_id = v_lot1 and m.quantity_base = -10 and m.unit_cost = 5)
         or (m.lot_id = v_lot2 and m.quantity_base = -3  and m.unit_cost = 8));
    v_log := v_log || format(E'\nshortage     matching=%s (expect 2)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    -- ── الغرامة ─────────────────────────────────────────────────────────────
    select f.id into v_fine from public.stock_fines f where f.document_id = v_doc;
    select count(*) into v_n from public.stock_fine_lines where fine_id = v_fine and product_id = v_pid;
    v_log := v_log || format(E'\nfine_lines   %s for this product (expect 1 — the constraint refuses 2)  %s',
      v_n, case when v_n = 1 then '✓' else '✗' end);

    select fl.shortage_base, fl.unit_value into v_qty, v_val
      from public.stock_fine_lines fl where fl.fine_id = v_fine and fl.product_id = v_pid;
    v_log := v_log || format(E'\nfine_qty     shortage_base=%s (expect 13, positive)  %s',
      coalesce(v_qty::text, 'NONE'), case when v_qty = 13 then '✓' else '✗' end);
    -- ⚠️ يُقارَن مقرَّبًا لأربع منازل — `unit_value` هو `numeric(14,4)`، ومقارنةُ
    -- كسرٍ غيرِ منتهٍ بلا تقريبٍ تفشل على رقمٍ صحيح.
    v_log := v_log || format(E'\nfine_value   unit_value=%s (expect 74/13 = %s)  %s',
      coalesce(v_val::text, 'NONE'), round(74.0 / 13.0, 4),
      case when round(coalesce(v_val, -1), 4) = round(74.0 / 13.0, 4) then '✓' else '✗' end);

    -- ── الفائض ──────────────────────────────────────────────────────────────
    if v_pid2 is null then
      v_log := v_log || E'\nsurplus      SKIPPED — لا منتجَ ثانٍ بلا حركات. **لم يُقَس، لا «مرّ».**';
    else
      select count(*) into v_n
        from public.stock_movements m
        join public.stock_lots l on l.id = m.lot_id
       where m.document_id = v_doc and m.product_id = v_pid2
         and m.quantity_base = 7 and m.cost_is_estimated and l.cost_is_estimated
         and l.source_document_id = v_doc;
      v_log := v_log || format(E'\nsurplus      matching=%s (expect 1: +7 on a new estimated lot)  %s',
        v_n, case when v_n = 1 then '✓' else '✗' end);
      -- ولا سطرَ غرامةٍ للفائض — لا يُغرَّم أحدٌ لأنه وجد أكثر.
      select count(*) into v_n from public.stock_fine_lines where fine_id = v_fine and product_id = v_pid2;
      v_log := v_log || format(E'\nsurplus_fine lines=%s (expect 0)  %s',
        v_n, case when v_n = 0 then '✓' else '✗' end);
    end if;

    -- ── إطارُ المُدخَل غائبٌ عن كلّ حركات الجرد ──────────────────────────────
    select count(*) into v_n from public.stock_movements
     where document_id = v_doc and (entered_quantity is not null or entered_uom is not null);
    v_log := v_log || format(E'\nframes       non_null=%s (expect 0 — a stocktake claims no typed frame)  %s',
      v_n, case when v_n = 0 then '✓' else '✗' end);

    raise exception 'ROLLBACK_MARKER';
  exception when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then
      v_log := v_log || format(E'\n💥 %s — %s', sqlstate, sqlerrm);
    end if;
  end;

  perform set_config('probe.result', v_log, false);
end $$;

select current_setting('probe.result') as result;

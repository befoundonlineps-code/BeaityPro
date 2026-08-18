-- ==========================================================================
-- ٠٩٦ب/أ — هل يعمل المسارُ الصريحُ فعلًا، وهل يعضّ رفوضُه الأربعة؟
--
-- 🔴 مُجهَّزٌ ولم أشغّله. **أثرُه مُلغًى بالكامل** — لا يترك صفًّا واحدًا.
-- ⚠️ **و`auth.uid()` فارغةٌ وRLS متجاوَزة** — يقيس الحسابَ والتخطيط، لا العزل.
-- **البنيةُ وأسبابُها في ٠٩٥ب/أ ولا تُعاد.**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 الاختبارُ الحاسم: تُختار **الأحدثُ الأغلى**، لا الأقدم
--
-- دفعتان: قديمةٌ بثمن ٥، وأحدثُ بثمن ٨. **والشطبُ يسمّي الثانية.**
--
-- **فلو تسرّب سطرٌ إلى فرع FIFO لأخذ الأولى وختم ٥** — والفرقُ يظهر رقمًا، لا
-- استثناءً. ⚠️ **ولهذا لا يكفي أن نعدّ الحركات:** حركةٌ واحدةٌ بثمن ٥ تعني
-- «مرّ الطلبُ وتُجوهل الاختيار»، وهي أسوأُ من رفض.
--
-- ⇒ **والثمنُ المختوم هو البيّنة، لا عددُ الصفوف.**
--
-- ---------------------------------------------------------------------------
-- ⚠️ وكلُّ رفضٍ يُجرَّب في كتلةٍ فرعيّةٍ خاصّةٍ به
--
-- الرفضُ يقع **بعد** أن تكتب الدالّةُ رأسَ المستند، فالكتلةُ الفرعيّةُ هي ما
-- يمحو ذلك الرأسَ اليتيم. **والمتغيّرُ وحدَه ينجو منها**، فيبقى السجلُّ.
--
-- 🔴 **ويُقرأ اسمُ الرفض لا وقوعُه فقط:** `sqlerrm` يُطبع خامًّا. فرفضٌ صحيحٌ
-- **بالرمز الخطأ** يمرّ على فحصٍ يسأل «هل فشل؟» ولا يمرّ على هذا — وهو الفرقُ
-- بين «الحارسُ عضّ» و«الحارسُ الذي أردناه عضّ».
--
-- ---------------------------------------------------------------------------
-- المتوقَّع — ✓ على كلّ سطر
--
--   explicit     ‏-4 @ **8** على الدفعة الأحدث · وإطارُ المُدخَل كاملٌ عليها
--   untouched    الدفعةُ الأقدمُ **لم تُمسّ**: ١٠ كما هي
--   boundary     متبقٍّ = مطلوبٌ بالضبط يمرّ ويُفرِغ إلى صفر
--   refuse×4     `lot_insufficient` · `lot_not_in_storage` ·
--                `write_off_needs_lot` · `lot_pick_requires_issue`
--   reversal     العكسُ يرجع إلى **تلك الدفعة بعينها**، ولا دفعةَ جديدة
-- ==========================================================================

do $$
declare
  v_log     text := '';
  v_salon   uuid;
  v_storage uuid;
  v_pid     uuid;
  v_pid2    uuid;
  v_uom     text;
  v_types   text;
  v_d1      uuid;
  v_d2      uuid;
  v_dx      uuid;
  v_rev     uuid;
  v_lot1    uuid;
  v_lot2    uuid;
  v_n       int;
  v_err     text;
begin
  begin
    -- شاهدُ الصدق: القيمُ التسعُ كلُّها، مقروءةً لا مسمّاةً بيد.
    select string_agg(e.enumlabel::text, ' · ' order by e.enumsortorder)
      into v_types
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'stock_doc_type';

    select e.enumlabel::text into v_uom
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'entry_uom' order by e.enumsortorder limit 1;

    select p.id, s.id, p.salon_id
      into v_pid, v_storage, v_salon
      from public.products p
      join public.storages s on s.salon_id = p.salon_id
     where not exists (select 1 from public.stock_lots l
                        where l.product_id = p.id and l.storage_id = s.id)
     order by p.id, s.id limit 1;

    select p.id into v_pid2
      from public.products p
     where p.salon_id = v_salon and p.id <> v_pid
     order by p.id limit 1;

    v_log := v_log || format('doc_types = %s', coalesce(v_types, 'NONE'));
    v_log := v_log || format(E'\nfixture      storage=%s pid=%s pid2=%s uom=%s',
      coalesce(v_storage::text, 'NONE'), coalesce(v_pid::text, 'NONE'),
      coalesce(v_pid2::text, 'NONE'), coalesce(v_uom, 'NONE'));

    if v_pid is null or v_uom is null then
      v_log := v_log || E'\n🔴 NO FIXTURE — لم يُفحص شيء.';
      perform set_config('probe.result', v_log, false);
      return;
    end if;

    -- دفعتان: الأقدمُ أرخص. **والأحدثُ هي التي ستُختار.**
    v_d1 := public.post_stock_document('supply', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 10,
        'unit_cost', 5, 'entered_quantity', 10, 'entered_uom', v_uom)),
      null, null, null, now() - interval '2 days', 'probe-096b-a');
    select l.id into v_lot1 from public.stock_lots l where l.source_document_id = v_d1;

    v_d2 := public.post_stock_document('supply', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 6,
        'unit_cost', 8, 'entered_quantity', 6, 'entered_uom', v_uom)),
      null, null, null, now() - interval '1 day', 'probe-096b-a');
    select l.id into v_lot2 from public.stock_lots l where l.source_document_id = v_d2;

    -- ── ١. الاختيارُ الصريحُ يتجاوز FIFO ───────────────────────────────────
    v_dx := public.post_stock_document('write_off', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', -4,
        'lot_id', v_lot2, 'entered_quantity', 4, 'entered_uom', v_uom)),
      null, null, null, now(), 'probe-096b-a');

    select count(*) into v_n
      from public.stock_movements m
     where m.document_id = v_dx
       and m.lot_id = v_lot2 and m.quantity_base = -4 and m.unit_cost = 8
       and m.entered_quantity = 4;
    v_log := v_log || format(E'\nexplicit     matching=%s (expect 1: -4@**8** on the NEWER lot, frame kept)  %s',
      v_n, case when v_n = 1 then '✓' else '✗' end);

    select count(*) into v_n from public.stock_movements where document_id = v_dx;
    v_log := v_log || format(E'\nno_split     moves=%s (expect 1 — an explicit line never splits)  %s',
      v_n, case when v_n = 1 then '✓' else '✗' end);

    -- 🔴 والأقدمُ لم تُمسّ. **لو أخذ FIFO لصارت ٦ هنا و٦ هناك، والمجموعُ صحيحًا.**
    v_log := v_log || format(E'\nuntouched    old=%s new=%s (expect 10 , 2)  %s',
      (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot1),
      (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2),
      case when (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot1) = 10
            and (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2) = 2
           then '✓' else '✗' end);

    -- ── ٢. الحدُّ: متبقٍّ = مطلوبٌ بالضبط ──────────────────────────────────
    begin
      perform public.post_stock_document('write_off', v_storage,
        jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', -2,
          'lot_id', v_lot2, 'entered_quantity', 2, 'entered_uom', v_uom)),
        null, null, null, now(), 'probe-096b-a');
      v_log := v_log || format(E'\nboundary     accepted, lot now %s (expect 0)  %s',
        (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2),
        case when (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2) = 0
             then '✓' else '✗' end);
    exception when others then
      v_log := v_log || format(E'\nboundary     REFUSED (%s) — ✗ الحدُّ يجب أن يمرّ', sqlerrm);
    end;

    -- ── ٣. الرفوضُ الأربعة، كلٌّ في كتلته ─────────────────────────────────
    begin
      perform public.post_stock_document('write_off', v_storage,
        jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', -1,
          'lot_id', v_lot2, 'entered_quantity', 1, 'entered_uom', v_uom)),
        null, null, null, now(), 'probe-096b-a');
      v_err := 'ACCEPTED';
    exception when others then v_err := sqlerrm;
    end;
    v_log := v_log || format(E'\nrefuse_over  %s (expect lot_insufficient)  %s',
      v_err, case when v_err = 'lot_insufficient' then '✓' else '✗' end);

    if v_pid2 is null then
      v_log := v_log || E'\nrefuse_alien SKIPPED — لا منتجَ ثانٍ. **لم يُقَس، لا «مرّ».**';
    else
      begin
        -- الدفعةُ موجودةٌ فعلًا، **لكنها لمنتجٍ آخر** — وهذه هي الحالةُ الحقيقيّة
        -- (شاشةٌ قديمة)، لا معرّفٌ عشوائيٌّ لا وجودَ له.
        perform public.post_stock_document('write_off', v_storage,
          jsonb_build_array(jsonb_build_object('product_id', v_pid2, 'quantity_base', -1,
            'lot_id', v_lot1, 'entered_quantity', 1, 'entered_uom', v_uom)),
          null, null, null, now(), 'probe-096b-a');
        v_err := 'ACCEPTED';
      exception when others then v_err := sqlerrm;
      end;
      v_log := v_log || format(E'\nrefuse_alien %s (expect lot_not_in_storage)  %s',
        v_err, case when v_err = 'lot_not_in_storage' then '✓' else '✗' end);
    end if;

    begin
      perform public.post_stock_document('write_off', v_storage,
        jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', -1,
          'entered_quantity', 1, 'entered_uom', v_uom)),
        null, null, null, now(), 'probe-096b-a');
      v_err := 'ACCEPTED';
    exception when others then v_err := sqlerrm;
    end;
    v_log := v_log || format(E'\nrefuse_nolot %s (expect write_off_needs_lot)  %s',
      v_err, case when v_err = 'write_off_needs_lot' then '✓' else '✗' end);

    begin
      perform public.post_stock_document('write_off', v_storage,
        jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 1,
          'lot_id', v_lot1, 'entered_quantity', 1, 'entered_uom', v_uom)),
        null, null, null, now(), 'probe-096b-a');
      v_err := 'ACCEPTED';
    exception when others then v_err := sqlerrm;
    end;
    v_log := v_log || format(E'\nrefuse_inbnd %s (expect lot_pick_requires_issue)  %s',
      v_err, case when v_err = 'lot_pick_requires_issue' then '✓' else '✗' end);

    -- ── ٤. العكسُ يرجع إلى تلك الدفعة بعينها ──────────────────────────────
    v_rev := public.reverse_stock_document(v_dx, 'probe-096b-a');
    select count(*) into v_n
      from public.stock_movements m
     where m.document_id = v_rev and m.lot_id = v_lot2
       and m.quantity_base = 4 and m.unit_cost = 8;
    v_log := v_log || format(E'\nreversal     matching=%s (expect 1: +4@8 back onto the SAME lot)  %s',
      v_n, case when v_n = 1 then '✓' else '✗' end);

    select count(*) into v_n from public.stock_lots where source_document_id = v_rev;
    v_log := v_log || format(E'\nno_new_lot   %s (expect 0)  %s',
      v_n, case when v_n = 0 then '✓' else '✗' end);

    v_log := v_log || format(E'\nrestored     old=%s new=%s (expect 10 , 4)  %s',
      (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot1),
      (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2),
      case when (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot1) = 10
            and (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2) = 4
           then '✓' else '✗' end);

    raise exception 'ROLLBACK_MARKER';
  exception when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then
      v_log := v_log || format(E'\n💥 %s — %s', sqlstate, sqlerrm);
    end if;
  end;

  perform set_config('probe.result', v_log, false);
end $$;

select current_setting('probe.result') as result;

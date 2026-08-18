-- ==========================================================================
-- ٠٩٦ب/ب — هل بقي المسارُ الضمنيُّ (FIFO والتقدير) كما كان بعد ٠٩٦؟
--
-- 🔴 مُجهَّزٌ ولم أشغّله. **أثرُه مُلغًى بالكامل.**
-- ⚠️ **و`auth.uid()` فارغةٌ وRLS متجاوَزة** — يقيس الحسابَ والتخطيط، لا العزل.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 لماذا لا يكفي أن نعيد تشغيل ٠٩٥ب/أ
--
-- ٠٩٥ب/أ اشتقّ نوعَ الإخراج بأنه **أوّلُ قيمةٍ غيرِ مستثناة**، فوقع على
-- `write_off` — **بالترتيب لا بالقصد.** و٠٩٦ جعل `write_off` مشروطًا بدفعةٍ
-- صريحةٍ مطلقًا، فتلك النداءاتُ تُرفض الآن **رفضًا صحيحًا**.
--
-- ⇒ **فالانحدارُ يُقاس بنوعٍ مُخرِجٍ آخر**، مشتقٍّ بنفس الطريقة **مع استثناء
-- `write_off` معها.**
--
-- ⚠️ **وقارنَ المالكُ ٠٩٦ بـ٠٩٥ بايتًا ببايت وقال إن الفروعَ الثلاثة مطابقة.**
-- **وهذا لا يُغني عن هذا الملفّ:** المطابقةُ النصّيّةُ تقول إن الكودَ لم يتغيّر،
-- **ولا تقول إنه ما زال يُخطَّط ويُنفَّذ** — وقد سبقه في الشرط فرعٌ جديدٌ يقرأ
-- `v_pick`، وتغيُّرُ الترتيب وحدَه كافٍ لابتلاع سطرٍ لو كان الشرطُ أوسعَ مما نظنّ.
--
-- > **فالنصُّ المطابقُ يُثبت عدمَ التحرير، والتنفيذُ يُثبت عدمَ الابتلاع.**
--
-- ---------------------------------------------------------------------------
-- 🔴 وإن لم يوجد نوعٌ مُخرِجٌ آخر، فذلك خبرٌ يُطبع بالاسم
--
-- يعني أن **الإخراجَ الضمنيَّ بلا مُنادٍ بعد ٠٩٦** — الفرعُ حيٌّ في الكود وما
-- من نوعِ مستندٍ يصل إليه. **وتلك حقيقةٌ تُسجَّل لا تُخمَّن**، وتُقرأ عندها
-- ٠٩٥ب/أ آخرَ قياسٍ صالحٍ لذلك الفرع.
--
-- ⚠️ **ولا تُسمَّى القيمةُ من تعليق ٠٤٤ العربيّ** («البيع والصرف») — تسميةُ قيمةِ
-- enum من نثرٍ هي الصنفُ الذي كلّف هذا المشروعَ أربعَ مرّات. **والقيمُ التسعُ
-- تُطبع كلُّها** فيُرى المشتَقُّ بجانب ما اشتُقَّ منه.
--
-- ---------------------------------------------------------------------------
-- المتوقَّع — ✓ على كلّ سطر
--
--   split        سطرٌ واحدٌ ⟵ **حركتان**: ١٠@٥ ثمّ ٣@٨
--   frames       إطارُ المُدخَل على الأولى وحدَها
--   tier2        سحبٌ يتجاوز المتاح ⟵ دفعةٌ مقدَّرةٌ بثمن آخر توريدٍ هنا (٨)
-- ==========================================================================

do $$
declare
  v_log     text := '';
  v_salon   uuid;
  v_storage uuid;
  v_pid     uuid;
  v_issue   text;
  v_uom     text;
  v_types   text;
  v_d1      uuid;
  v_d2      uuid;
  v_d3      uuid;
  v_d4      uuid;
  v_lot1    uuid;
  v_lot2    uuid;
  v_n       int;
  v_cost    numeric;
  v_est     boolean;
  v_slices  text;
begin
  begin
    select string_agg(e.enumlabel::text, ' · ' order by e.enumsortorder)
      into v_types
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'stock_doc_type';

    -- 🔴 نفسُ الاشتقاق، **مع `write_off` مستثنًى معها.**
    select e.enumlabel::text into v_issue
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'stock_doc_type'
       and e.enumlabel not in ('transfer', 'reversal', 'stocktake',
                               'supply', 'opening', 'write_off')
     order by e.enumsortorder limit 1;

    select e.enumlabel::text into v_uom
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'entry_uom' order by e.enumsortorder limit 1;

    v_log := v_log || format('doc_types = %s', coalesce(v_types, 'NONE'));
    v_log := v_log || format(E'\nderived      implicit_issue_type = %s',
      coalesce(v_issue, 'NONE'));

    if v_issue is null then
      -- ⚠️ **خبرٌ لا نجاح، ولا فشل.**
      v_log := v_log || E'\n🔴 لا نوعَ مُخرِجٍ غيرَ write_off ⇒ **المسارُ الضمنيُّ للإخراج بلا مُنادٍ بعد ٠٩٦.**'
                     || E'\n   الفرعُ حيٌّ بالكود ولا يصله نوعُ مستند، و٠٩٥ب/أ آخرُ قياسٍ صالحٍ له.';
      perform set_config('probe.result', v_log, false);
      return;
    end if;

    select p.id, s.id, p.salon_id
      into v_pid, v_storage, v_salon
      from public.products p
      join public.storages s on s.salon_id = p.salon_id
     where not exists (select 1 from public.stock_lots l
                        where l.product_id = p.id and l.storage_id = s.id)
     order by p.id, s.id limit 1;

    v_log := v_log || format(E'\nfixture      storage=%s pid=%s uom=%s',
      coalesce(v_storage::text, 'NONE'), coalesce(v_pid::text, 'NONE'),
      coalesce(v_uom, 'NONE'));

    if v_pid is null or v_uom is null then
      v_log := v_log || E'\n🔴 NO FIXTURE — لم يُفحص شيء.';
      perform set_config('probe.result', v_log, false);
      return;
    end if;

    v_d1 := public.post_stock_document('supply', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 10,
        'unit_cost', 5, 'entered_quantity', 10, 'entered_uom', v_uom)),
      null, null, null, now() - interval '2 days', 'probe-096b-b');
    select l.id into v_lot1 from public.stock_lots l where l.source_document_id = v_d1;

    v_d2 := public.post_stock_document('supply', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 6,
        'unit_cost', 8, 'entered_quantity', 6, 'entered_uom', v_uom)),
      null, null, null, now() - interval '1 day', 'probe-096b-b');
    select l.id into v_lot2 from public.stock_lots l where l.source_document_id = v_d2;

    -- ── الانقسامُ الضمنيّ: سطرٌ بلا `lot_id` ──────────────────────────────
    v_d3 := public.post_stock_document(v_issue::stock_doc_type, v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', -13,
        'entered_quantity', 13, 'entered_uom', v_uom)),
      null, null, null, now(), 'probe-096b-b');

    select string_agg(format('%s@%s', m.quantity_base, m.unit_cost), ' , ' order by m.unit_cost)
      into v_slices from public.stock_movements m where m.document_id = v_d3;
    v_log := v_log || format(E'\nsplit_raw    %s', coalesce(v_slices, 'NONE'));

    select count(*) into v_n
      from public.stock_movements m
     where m.document_id = v_d3
       and ((m.lot_id = v_lot1 and m.quantity_base = -10 and m.unit_cost = 5)
         or (m.lot_id = v_lot2 and m.quantity_base = -3  and m.unit_cost = 8));
    v_log := v_log || format(E'\nsplit        matching=%s (expect 2 — FIFO untouched)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    select count(*) into v_n from public.stock_movements
     where document_id = v_d3 and entered_quantity is not null;
    v_log := v_log || format(E'\nframes       non_null=%s (expect 1 — first slice only)  %s',
      v_n, case when v_n = 1 then '✓' else '✗' end);

    -- ── التقديرُ الضمنيُّ عند النقص ───────────────────────────────────────
    v_d4 := public.post_stock_document(v_issue::stock_doc_type, v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', -5,
        'entered_quantity', 5, 'entered_uom', v_uom)),
      null, null, null, now(), 'probe-096b-b');

    select count(*) into v_n from public.stock_movements where document_id = v_d4;
    select l.unit_cost, l.cost_is_estimated into v_cost, v_est
      from public.stock_lots l where l.source_document_id = v_d4;
    v_log := v_log || format(E'\ntier2        moves=%s est_lot_cost=%s estimated=%s (expect 2 , 8 , t)  %s',
      v_n, coalesce(v_cost::text, 'NONE'), coalesce(v_est::text, 'NONE'),
      case when v_n = 2 and v_cost = 8 and v_est then '✓' else '✗' end);

    raise exception 'ROLLBACK_MARKER';
  exception when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then
      v_log := v_log || format(E'\n💥 %s — %s', sqlstate, sqlerrm);
    end if;
  end;

  perform set_config('probe.result', v_log, false);
end $$;

select current_setting('probe.result') as result;

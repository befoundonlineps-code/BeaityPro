-- ==========================================================================
-- ٠٩٧ب — التوزيعُ التلقائيُّ للشطب، ورفوضُه، **وفحصُ الانحراف مع الشاشة**.
--
-- 🔴 مُجهَّزٌ ولم أشغّله. **أثرُه مُلغًى بالكامل** — لا يترك صفًّا واحدًا.
-- ⚠️ **و`auth.uid()` فارغةٌ وRLS متجاوَزة** — يقيس الحسابَ والتخطيط، لا العزل.
-- **البنيةُ وأسبابُها في ٠٩٥ب/أ.**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 يحلّ محلَّ فحص `write_off_needs_lot` في ٠٩٦ب/أ — الذي بطل بـ٠٩٧
--
-- ٠٩٦ب/أ قاس أن الشطبَ بلا دفعةٍ **يُرفض**. و٠٩٧ جعله **يُوزَّع**. فذلك الفحصُ
-- صار يقيس سلوكًا تراجعنا عنه، **ولا يُعاد تشغيلُه** — كما لا يُعاد ٠٩٥ب/أ.
--
-- ⚠️ **وباقي ٠٩٦ب/أ ما زال صالحًا** (الصريح · الحدّ · `lot_insufficient` ·
-- `lot_not_in_storage` · `lot_pick_requires_issue` · العكس)، **فلا يُلغى الملفُّ
-- كلُّه** — يُلغى فحصٌ واحدٌ منه ويُعوَّض هنا.
--
-- ---------------------------------------------------------------------------
-- 🔴 وفحصُ الانحراف — **النصفُ الآخرُ منه في `lib/writeOffGrid.test.js`**
--
-- الشاشةُ تعيد سيرَ FIFO بـJS لتعرض المبلغَ **قبل** التأكيد، وتلك نسخةٌ ثانيةٌ
-- من قاعدةٍ تعيش هنا. **ونسختان لسؤالٍ واحدٍ هما جوابان يتباعدان** ما لم يُقَس
-- تطابقُهما.
--
-- ⚠️ **والتجهيزةُ والأرقامُ المتوقَّعةُ هنا وهناك زوجٌ واحدٌ مكتوبٌ بيدٍ في موضعين**
-- — واحدٌ JS وواحدٌ SQL، ولا لغةَ تجمعهما. **فمَن غيّر واحدًا يغيّر الآخر**، وهذا
-- حدُّ ما يمكن بلوغُه بلا نداءٍ حيٍّ من الاختبار:
--
--   ١٠@٥ (أقدم) · ٦@٨ (أحدث) · المطلوب ١٣  ⟵ ١٠@٥ + ٣@٨ = **٧٤**
--   تاريخان متساويان، `created_at` يفصل     ⟵ الأبكرُ كتابةً أوّلًا ⟵ **٨٣**
--
-- ⚠️ **والحالةُ الثانية هي التي تنام:** فاصلُ التعادل لا أثرَ له يوم تختلف
-- التواريخ، **ويظهر يوم تصل دفعتان معًا** — فبلا قياسه يبقى الانحرافُ مؤجَّلًا
-- لا غائبًا.
--
-- ---------------------------------------------------------------------------
-- المتوقَّع — ✓ على كلّ سطر
--
--   auto_split   ١٣ بلا دفعة ⟵ حركتان: ‏-10@5 ثمّ ‏-3@8
--   auto_value   مجموعُ القيمة = **٧٤** — نفسُ رقم JS
--   tiebreak     تاريخان متساويان ⟵ **٨٣** — نفسُ رقم JS
--   no_estimate  ولا دفعةَ مقدَّرةٍ وُلدت عن أيِّ مستند شطب
--   refuse_over  تجاوزُ الإجماليّ ⟵ `insufficient_stock`
--   refuse_in    شطبٌ موجب ⟵ `write_off_not_outgoing`
--   others_keep  نوعٌ مُخرِجٌ آخرُ يتجاوز المتاح ⟵ **يقدّر ولا يُرفض**
-- ==========================================================================

do $$
declare
  v_log     text := '';
  v_salon   uuid;
  v_storage uuid;
  v_pid     uuid;
  v_pid2    uuid;
  v_issue   text;
  v_uom     text;
  v_d1      uuid;
  v_d2      uuid;
  v_dx      uuid;
  v_lot1    uuid;
  v_lot2    uuid;
  v_n       int;
  v_val     numeric;
  v_err     text;
  v_slices  text;
begin
  begin
    select e.enumlabel::text into v_issue
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'stock_doc_type'
       and e.enumlabel not in ('transfer', 'reversal', 'stocktake',
                               'supply', 'opening', 'write_off')
     order by e.enumsortorder limit 1;

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
       and not exists (select 1 from public.stock_lots l
                        where l.product_id = p.id and l.storage_id = v_storage)
     order by p.id limit 1;

    v_log := v_log || format('fixture      storage=%s pid=%s pid2=%s issue=%s uom=%s',
      coalesce(v_storage::text, 'NONE'), coalesce(v_pid::text, 'NONE'),
      coalesce(v_pid2::text, 'NONE'), coalesce(v_issue, 'NONE'), coalesce(v_uom, 'NONE'));

    if v_pid is null or v_uom is null then
      v_log := v_log || E'\n🔴 NO FIXTURE — لم يُفحص شيء.';
      perform set_config('probe.result', v_log, false);
      return;
    end if;

    -- ── التجهيزة: ١٠@٥ أقدم، ٦@٨ أحدث ─────────────────────────────────────
    v_d1 := public.post_stock_document('supply', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 10,
        'unit_cost', 5, 'entered_quantity', 10, 'entered_uom', v_uom)),
      null, null, null, now() - interval '2 days', 'probe-097b');
    select l.id into v_lot1 from public.stock_lots l where l.source_document_id = v_d1;

    v_d2 := public.post_stock_document('supply', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 6,
        'unit_cost', 8, 'entered_quantity', 6, 'entered_uom', v_uom)),
      null, null, null, now() - interval '1 day', 'probe-097b');
    select l.id into v_lot2 from public.stock_lots l where l.source_document_id = v_d2;

    -- ── ١. التوزيعُ التلقائيُّ بلا دفعة ────────────────────────────────────
    v_dx := public.post_stock_document('write_off', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', -13,
        'entered_quantity', 13, 'entered_uom', v_uom)),
      null, null, null, now(), 'probe-097b');

    select string_agg(format('%s@%s', m.quantity_base, m.unit_cost), ' , ' order by m.unit_cost)
      into v_slices from public.stock_movements m where m.document_id = v_dx;
    v_log := v_log || format(E'\nauto_raw     %s', coalesce(v_slices, 'NONE'));

    select count(*) into v_n
      from public.stock_movements m
     where m.document_id = v_dx
       and ((m.lot_id = v_lot1 and m.quantity_base = -10 and m.unit_cost = 5)
         or (m.lot_id = v_lot2 and m.quantity_base = -3  and m.unit_cost = 8));
    v_log := v_log || format(E'\nauto_split   matching=%s (expect 2)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    -- 🔴 القيمةُ المختومة — **الرقمُ الذي يجب أن تعرضه الشاشةُ قبل التأكيد.**
    select coalesce(sum(- m.quantity_base * m.unit_cost), 0) into v_val
      from public.stock_movements m where m.document_id = v_dx;
    v_log := v_log || format(E'\nauto_value   %s (expect 74 — نفسُ رقم writeOffGrid.test)  %s',
      v_val, case when v_val = 74 then '✓' else '✗' end);

    -- ── ٢. ولا دفعةَ مقدَّرةٍ وُلدت ────────────────────────────────────────
    --
    -- ⚠️ **وهذا هو المبدأُ كلُّه**: الشطبُ لا يقدّر. وفحصٌ يعدّ الحركاتِ وحدَها
    -- يمرّ على محرّكٍ يفتح دفعةً مقدَّرةً بصمتٍ ويوزّع منها.
    select count(*) into v_n from public.stock_lots where source_document_id = v_dx;
    v_log := v_log || format(E'\nno_estimate  lots_born=%s (expect 0)  %s',
      v_n, case when v_n = 0 then '✓' else '✗' end);

    -- ── ٣. فاصلُ التعادل: تاريخان متساويان ────────────────────────────────
    if v_pid2 is null then
      v_log := v_log || E'\ntiebreak     SKIPPED — لا منتجَ ثانٍ. **لم يُقَس، لا «مرّ».**';
    else
      -- الأبكرُ كتابةً هو ٦@٨ (يُورَّد أوّلًا)، فيُسحب أوّلًا: ٦×٨ + ٧×٥ = ٨٣.
      perform public.post_stock_document('supply', v_storage,
        jsonb_build_array(jsonb_build_object('product_id', v_pid2, 'quantity_base', 6,
          'unit_cost', 8, 'entered_quantity', 6, 'entered_uom', v_uom)),
        null, null, null, date_trunc('day', now()), 'probe-097b');
      perform public.post_stock_document('supply', v_storage,
        jsonb_build_array(jsonb_build_object('product_id', v_pid2, 'quantity_base', 10,
          'unit_cost', 5, 'entered_quantity', 10, 'entered_uom', v_uom)),
        null, null, null, date_trunc('day', now()), 'probe-097b');

      v_dx := public.post_stock_document('write_off', v_storage,
        jsonb_build_array(jsonb_build_object('product_id', v_pid2, 'quantity_base', -13,
          'entered_quantity', 13, 'entered_uom', v_uom)),
        null, null, null, now(), 'probe-097b');

      select coalesce(sum(- m.quantity_base * m.unit_cost), 0) into v_val
        from public.stock_movements m where m.document_id = v_dx;
      v_log := v_log || format(E'\ntiebreak     %s (expect 83 — created_at يفصل، نفسُ رقم JS)  %s',
        v_val, case when v_val = 83 then '✓' else '✗' end);
    end if;

    -- ── ٤. الرفوض ─────────────────────────────────────────────────────────
    begin
      perform public.post_stock_document('write_off', v_storage,
        jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', -99,
          'entered_quantity', 99, 'entered_uom', v_uom)),
        null, null, null, now(), 'probe-097b');
      v_err := 'ACCEPTED';
    exception when others then v_err := sqlerrm;
    end;
    v_log := v_log || format(E'\nrefuse_over  %s (expect insufficient_stock)  %s',
      v_err, case when v_err = 'insufficient_stock' then '✓' else '✗' end);

    begin
      perform public.post_stock_document('write_off', v_storage,
        jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 1,
          'entered_quantity', 1, 'entered_uom', v_uom)),
        null, null, null, now(), 'probe-097b');
      v_err := 'ACCEPTED';
    exception when others then v_err := sqlerrm;
    end;
    v_log := v_log || format(E'\nrefuse_in    %s (expect write_off_not_outgoing)  %s',
      v_err, case when v_err = 'write_off_not_outgoing' then '✓' else '✗' end);

    -- ── ٥. والأنواعُ الأخرى تبقى تقدّر ────────────────────────────────────
    --
    -- 🔴 **وهذا شاهدُ الصدق للفحص كلِّه:** لو رجع رفضًا لكان ٠٩٧ قد سرّب قاعدةَ
    -- الشطب إلى غيره — **والرفوضُ أعلاه كانت ستبدو ناجحةً وهي أوسعُ من نيّتها.**
    if v_issue is null then
      v_log := v_log || E'\nothers_keep  SKIPPED — لا نوعَ مُخرِجٍ آخر.';
    else
      begin
        v_dx := public.post_stock_document(v_issue::stock_doc_type, v_storage,
          jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', -99,
            'entered_quantity', 99, 'entered_uom', v_uom)),
          null, null, null, now(), 'probe-097b');
        select count(*) into v_n from public.stock_lots where source_document_id = v_dx;
        v_err := format('accepted, estimated_lots=%s', v_n);
      exception when others then v_err := 'REFUSED: ' || sqlerrm; v_n := -1;
      end;
      v_log := v_log || format(E'\nothers_keep  %s (expect accepted with 1 estimated lot)  %s',
        v_err, case when v_n = 1 then '✓' else '✗' end);
    end if;

    raise exception 'ROLLBACK_MARKER';
  exception when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then
      v_log := v_log || format(E'\n💥 %s — %s', sqlstate, sqlerrm);
    end if;
  end;

  perform set_config('probe.result', v_log, false);
end $$;

select current_setting('probe.result') as result;
-- ==========================================================================
-- ⚠️ أُضيف بعد التشغيل. **ولا جملةَ SQL واحدةٍ فوق هذا السطر تغيّرت.**
--
-- 🔴 `tiebreak` رجع أحمر — **والعطلُ في هذا الفحص، لا في المحرّك.**
--
-- الدفعتان تُنشآن هنا عبر `post_stock_document` **في نفس المعاملة**، و`now()`
-- مجمَّدةٌ داخلها — فـ`created_at` (افتراضُه `now()`) تساوى للدفعتين **كما تساوى
-- `received_at` بالتصميم**. فسقط الترتيبُ إلى `id` العشوائيّ، وأعطى ٧٤ لا ٨٣.
--
-- ✅ **والستّةُ الباقيةُ خضرٌ، و`auto_value = 74` يطابق رقمَ JS** — أي أن ترتيبَ
-- `received_at` الأساسيَّ مقيسٌ وسليم. **الذي لم يُقَس هو فاصلُ التعادل وحدَه.**
--
-- ⚠️ **وهو غيرُ قابلٍ للقياس عبر الدالّة إطلاقًا** داخل معاملةٍ واحدة — لا
-- بترتيبِ نداءٍ ولا بتأخير. ⇒ **٠٩٧ج يقيسه بإدراج الدفعتين مباشرةً** بـ
-- `created_at` مختلفٍ صراحةً.
--
-- ✅ **ولا أثرَ في الإنتاج:** توريدان منفصلان معاملتان منفصلتان، فـ`created_at`
-- يختلف والترتيبُ حتميٌّ قبل أن يُسأل `id`.
-- ==========================================================================

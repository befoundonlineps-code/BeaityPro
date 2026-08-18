-- ==========================================================================
-- ٠٩٥ب/د — العكسُ يعيد البضاعةَ إلى دفعتها هي
--
-- 🔴 مُجهَّزٌ ولم أشغّله. **أثرُه مُلغًى بالكامل.**
-- ⚠️ **و`auth.uid()` فارغةٌ وRLS متجاوَزة** — يقيس الحسابَ والتخطيط، لا العزل.
-- **البنيةُ وأسبابُها في ٠٩٥ب/أ.**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 هذا هو الفحصُ الذي يثبت أن جدولَ الوصل كان زائدًا فعلًا
--
-- التصميمُ الأوّل اقترح `stock_movement_lots`، لأن العكسَ لا يستطيع إرجاعَ
-- البضاعة إلى دفعاتها ما لم يُسجَّل ما استهلكه كلُّ سطر. **وقرارُ «سطرٌ يستهلك
-- دفعتين ⟵ حركتان» ألغى الحاجة** — والادّعاءُ الذي بُني عليه ٠٩٤ هو:
--
--   > «العكسُ ينسخ `m.lot_id` كما ينسخ `m.unit_cost`، **وينتهي الأمر**.»
--
-- **وهذا الملفُّ يجعله واقعةً مقيسةً بدل جملةٍ في ترويسة.**
--
-- ⚠️ **والبيّنةُ الحاسمةُ هي المتبقّي لا عددُ الحركات:** الرجوعُ إلى `10` و`6`
-- **بالضبط** لا يقع إلّا إذا ذهبت كلُّ شريحةٍ إلى دفعتها هي. لو ذهب العكسُ إلى
-- دفعةٍ واحدةٍ لكان المجموعُ الكلّيُّ صحيحًا تمامًا (١٦) **والتوزيعُ خطأً** —
-- رقمٌ متّسقٌ مع نفسه وغلط، وهو ما يلاحقه هذا المشروع.
--
-- ⇒ **فالمقيسُ لكلّ دفعةٍ على حدة، لا مجموعُهما.**
--
-- ---------------------------------------------------------------------------
-- المتوقَّع — ✓ على كلّ سطر
--
--   moves        حركتان بالعكس، بعدد شرائح الأصل
--   lots_copied  **معرّفا الدفعتين منسوخان** — لا دفعةَ جديدةٌ وُلدت
--   signs        الكمّيّةُ وحدَها منفيّة: ‏+10@5 و‏+3@8 (الثمنُ لم يُنفَ)
--   restored     المتبقّي رجع **١٠ و٦** — كلٌّ إلى دفعته، لا المجموعُ فقط
-- ==========================================================================

do $$
declare
  v_log     text := '';
  v_salon   uuid;
  v_storage uuid;
  v_pid     uuid;
  v_issue   text;
  v_uom     text;
  v_d1      uuid;
  v_d2      uuid;
  v_iss     uuid;
  v_rev     uuid;
  v_lot1    uuid;
  v_lot2    uuid;
  v_n       int;
  v_slices  text;
begin
  begin
    select e.enumlabel::text into v_issue
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'stock_doc_type'
       and e.enumlabel not in ('transfer', 'reversal', 'stocktake', 'supply', 'opening')
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

    v_log := v_log || format('storage=%s pid=%s issue_type=%s uom=%s',
      coalesce(v_storage::text, 'NONE'), coalesce(v_pid::text, 'NONE'),
      coalesce(v_issue, 'NONE'), coalesce(v_uom, 'NONE'));

    if v_pid is null or v_issue is null or v_uom is null then
      v_log := v_log || E'\n🔴 NO FIXTURE — لم يُفحص شيء.';
      perform set_config('probe.result', v_log, false);
      return;
    end if;

    v_d1 := public.post_stock_document('supply', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 10,
        'unit_cost', 5, 'entered_quantity', 10, 'entered_uom', v_uom)),
      null, null, null, now() - interval '2 days', 'probe-095b-d');
    select l.id into v_lot1 from public.stock_lots l where l.source_document_id = v_d1;

    v_d2 := public.post_stock_document('supply', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 6,
        'unit_cost', 8, 'entered_quantity', 6, 'entered_uom', v_uom)),
      null, null, null, now() - interval '1 day', 'probe-095b-d');
    select l.id into v_lot2 from public.stock_lots l where l.source_document_id = v_d2;

    -- إخراجٌ ينقسم على الدفعتين، ثمّ يُعكس.
    v_iss := public.post_stock_document(v_issue::stock_doc_type, v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', -13,
        'entered_quantity', 13, 'entered_uom', v_uom)),
      null, null, null, now(), 'probe-095b-d');

    v_rev := public.reverse_stock_document(v_iss, 'probe-095b-d');

    select count(*) into v_n from public.stock_movements where document_id = v_rev;
    v_log := v_log || format(E'\nmoves        %s (expect 2 — one per slice of the original)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    select string_agg(format('%s@%s', m.quantity_base, m.unit_cost), ' , ' order by m.unit_cost)
      into v_slices from public.stock_movements m where m.document_id = v_rev;
    v_log := v_log || format(E'\nraw          %s', coalesce(v_slices, 'NONE'));

    -- 🔴 الدفعتان **منسوختان**، ولا دفعةَ جديدةٌ وُلدت عن مستند العكس.
    select count(*) into v_n
      from public.stock_movements m
     where m.document_id = v_rev and m.lot_id in (v_lot1, v_lot2);
    v_log := v_log || format(E'\nlots_copied  on_original_lots=%s (expect 2)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    select count(*) into v_n from public.stock_lots where source_document_id = v_rev;
    v_log := v_log || format(E'\nno_new_lot   born_of_reversal=%s (expect 0)  %s',
      v_n, case when v_n = 0 then '✓' else '✗' end);

    -- الكمّيّةُ وحدَها منفيّة — الثمنُ منسوخٌ كما هو، وإلّا عاد الحاصلُ موجبًا
    -- على الطرفين ولم يُلغِ أحدُهما الآخر.
    select count(*) into v_n
      from public.stock_movements m
     where m.document_id = v_rev
       and ((m.lot_id = v_lot1 and m.quantity_base = 10 and m.unit_cost = 5)
         or (m.lot_id = v_lot2 and m.quantity_base = 3  and m.unit_cost = 8));
    v_log := v_log || format(E'\nsigns        matching=%s (expect 2: +10@5 , +3@8)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    -- ⚠️ **لكلّ دفعةٍ على حدة، والمجموعُ لا يُقبل بديلًا:** عكسٌ يذهب كلُّه إلى
    -- دفعةٍ واحدةٍ يعطي ١٦ إجمالًا — صحيحًا تمامًا وموزَّعًا خطأً.
    v_log := v_log || format(E'\nrestored     lot1=%s lot2=%s (expect 10 , 6)  %s',
      (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot1),
      (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2),
      case when (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot1) = 10
            and (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2) = 6
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

-- ==========================================================================
-- ⚠️ أُضيف بعد التشغيل. **ولا جملةَ SQL واحدةٍ فوق هذا السطر تغيّرت.**
--
-- 🔴 **لا يُعاد تشغيلُ هذا الملفِّ بعد ٠٩٦** — لنفس سبب ٠٩٥ب/أ: الإخراجُ الذي
-- يُعكَس هنا يُنادى بـ`write_off` **بلا `lot_id`**، و٠٩٦ يرفض ذلك مطلقًا.
--
-- ⚠️ **والمقيسُ هنا لا يبطل بذلك:** «العكسُ ينسخ `lot_id` ولا يُنشئ دفعة» خاصّيّةٌ
-- في `reverse_stock_document`، **و٠٩٦ لا يمسّها بحرف.** الذي تقادم هو **طريقُ
-- بناء الحالة**، لا الحالةُ ولا نتيجتُها.
--
-- ⇒ **ويُعاد قياسُها في ٠٩٦ب على المسار الصريح**، وهي حالةٌ أقوى: شطبٌ من دفعةٍ
-- مختارةٍ يُعكَس **إلى تلك الدفعة بعينها**.
-- ==========================================================================

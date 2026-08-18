-- ==========================================================================
-- ٠٩٧ج — فاصلُ التعادل في FIFO وحدَه: **دفعتان بنفس `received_at`.**
--
-- 🔴 مُجهَّزٌ ولم أشغّله. **أثرُه مُلغًى بالكامل.**
-- ⚠️ **و`auth.uid()` فارغةٌ وRLS متجاوَزة** — يقيس الحسابَ والتخطيط، لا العزل.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 لماذا ملفٌّ مستقلّ — وعطلُ ٠٩٧ب مقيسٌ لا مُعتذَرٌ عنه
--
-- ٠٩٧ب حاول قياسَ التعادل بإنشاء دفعتين عبر `post_stock_document` في نفس
-- الكتلة. **و`now()` مجمَّدةٌ داخل المعاملة الواحدة**، فـ`created_at` — افتراضُه
-- `now()` — تساوى للدفعتين **كما تساوى `received_at`**.
--
-- ⇒ **فسقط الترتيبُ إلى `id`**، وهو `uuid` عشوائيٌّ يتغيّر كلَّ تشغيل. فأعطى ٧٤
-- بدل ٨٣، **والحمرةُ كانت في الفحص لا في المحرّك.**
--
-- ⚠️ **والاستنتاجُ الأهمُّ ليس الرقم:** التعادلُ في `created_at` **غيرُ قابلٍ
-- للقياس عبر الدالّة إطلاقًا** داخل معاملةٍ واحدة — لا بترتيب النداءات ولا
-- بتأخيرٍ ولا بأيّ حيلة. **فالطريقُ الوحيدُ إدراجُ الدفعتين مباشرةً.**
--
-- ✅ **ولا أثرَ لهذا في الإنتاج:** عمليّتا توريدٍ منفصلتان معاملتان منفصلتان،
-- فـ`created_at` يختلف، **والترتيبُ حتميٌّ قبل أن يُسأل `id` أصلًا.**
--
-- ---------------------------------------------------------------------------
-- ⚠️ والتجهيزةُ مبنيّةٌ بيدٍ هنا، **خلافًا لقاعدتنا، وبسببٍ يُقال**
--
-- «بياناتُ الفحص تأتي من الدوالّ نفسها حيث أمكن» — **وهنا لا يمكن**، وهو بالضبط
-- ما أثبته فشلُ ٠٩٧ب. والمقيسُ هنا **ترتيبُ `draw_stock_from_lots` وحدَه**، لا
-- ولادةُ الدفعة — **فبناءُ الدفعتين بيدٍ لا يمسّ ما يُقاس.**
--
-- ⚠️ **والمستندُ مأخوذٌ من توريدٍ حقيقيّ** (`source_document_id` هو `NOT NULL`)،
-- فلا صفَّ يتيمٌ ولا قيدٌ يُلتفّ عليه.
--
-- ---------------------------------------------------------------------------
-- المتوقَّع
--
--   دفعتان بنفس `received_at`:  ٦@٨ كُتبت أوّلًا · ١٠@٥ كُتبت بعدها
--   وشطبُ ١٣ تلقائيًّا          ⟵ ٦×٨ + ٧×٥ = **٨٣**
--
-- 🔴 **و٧٤ هنا ليست «رقمًا آخر» بل الجوابُ المقلوب:** تعني أن الأرخصَ سُحب أوّلًا،
-- أي أن `created_at` لم يفصل — **وهو عينُ ما يحرسه هذا الفحص.**
-- ==========================================================================

do $$
declare
  v_log     text := '';
  v_salon   uuid;
  v_storage uuid;
  v_pid     uuid;
  v_uom     text;
  v_doc     uuid;
  v_dx      uuid;
  v_early   uuid;
  v_late    uuid;
  v_val     numeric;
  v_slices  text;
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
     order by p.id, s.id limit 1;

    v_log := v_log || format('fixture      storage=%s pid=%s uom=%s',
      coalesce(v_storage::text, 'NONE'), coalesce(v_pid::text, 'NONE'), coalesce(v_uom, 'NONE'));

    if v_pid is null or v_uom is null then
      v_log := v_log || E'\n🔴 NO FIXTURE — لم يُفحص شيء.';
      perform set_config('probe.result', v_log, false);
      return;
    end if;

    -- 🔴 المستندُ يُدرَج مباشرةً — **ولا يُنشَأ بنداء توريد، وهذا عطلٌ مقيس.**
    --
    -- أوّلُ مسوّدةٍ أنشأته بـ`post_stock_document('supply', …)` لتكون المرساةُ
    -- «حقيقيّة». **وذلك يولّد دفعةً ثالثةً لنفس المنتج** بـ`received_at` أقدمَ من
    -- الاثنتين المدروستين، **فيسحب منها FIFO أوّلًا**: ‏١@١ + ٦@٨ + ٦@٥ = **٧٩**
    -- لا ٨٣. **فصارت المرساةُ جزءًا ممّا تقيسه.**
    --
    -- ⚠️ **والأخطرُ أن `early_drawn = -6` كان يمرّ ✓ والمجموعُ خطأ** — يسأل عن
    -- **التوزيع** لا عن **المدى**. فشاهدُ صدقٍ سليمٌ لا يُغني عن مجموعٍ صحيح،
    -- **والاثنان معًا هما ما يُقرأ، لا أحدُهما.**
    --
    -- ✅ **والإدراجُ اليدويُّ متّسقٌ لا التفافًا:** الدفعتان مُدرَجتان بيدٍ أصلًا
    -- (وذلك مبرَّرٌ أعلاه)، **والمستندُ هنا يخدم المفتاحَ الأجنبيَّ وحدَه** —
    -- `source_document_id` هو `NOT NULL` ولا شيءَ في هذا الفحص يقرأ المستند.
    insert into public.stock_documents (salon_id, doc_type, storage_id, doc_date, note)
    values (v_salon, 'supply', v_storage, now() - interval '9 days', 'probe-097c')
    returning id into v_doc;

    -- ── الدفعتان: نفسُ `received_at`، و`created_at` يفصل ──────────────────
    insert into public.stock_lots (salon_id, storage_id, product_id, source_document_id,
                                   unit_cost, cost_is_estimated, received_at, created_at)
    values (v_salon, v_storage, v_pid, v_doc, 8, false,
            date_trunc('day', now()), now() - interval '2 hours')
    returning id into v_early;

    insert into public.stock_lots (salon_id, storage_id, product_id, source_document_id,
                                   unit_cost, cost_is_estimated, received_at, created_at)
    values (v_salon, v_storage, v_pid, v_doc, 5, false,
            date_trunc('day', now()), now() - interval '1 hour')
    returning id into v_late;

    -- ⚠️ وحركاتُ الدخول، وإلّا فالمتبقّي صفرٌ وتُطوى الدفعتان قبل أن تُرتَّبا.
    insert into public.stock_movements (salon_id, document_id, storage_id, product_id,
                                        quantity_base, unit_cost, cost_is_estimated, lot_id)
    values (v_salon, v_doc, v_storage, v_pid,  6, 8, false, v_early),
           (v_salon, v_doc, v_storage, v_pid, 10, 5, false, v_late);

    -- ── الشطبُ التلقائيّ ──────────────────────────────────────────────────
    v_dx := public.post_stock_document('write_off', v_storage,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', -13,
        'entered_quantity', 13, 'entered_uom', v_uom)),
      null, null, null, now(), 'probe-097c');

    select string_agg(format('%s@%s', m.quantity_base, m.unit_cost), ' , ' order by m.unit_cost)
      into v_slices from public.stock_movements m where m.document_id = v_dx;
    v_log := v_log || format(E'\ntiebreak_raw %s', coalesce(v_slices, 'NONE'));

    -- الأبكرُ كتابةً (٦@٨) يُسحب كاملًا، ثمّ ٧ من الأخرى: ٤٨ + ٣٥ = ٨٣.
    select coalesce(sum(- m.quantity_base * m.unit_cost), 0) into v_val
      from public.stock_movements m where m.document_id = v_dx;
    v_log := v_log || format(E'\ntiebreak     %s (expect 83 — و74 تعني أن created_at لم يفصل)  %s',
      v_val, case when v_val = 83 then '✓' else '✗' end);

    -- ⚠️ **وشاهدُ صدقٍ للفحص نفسِه:** لو سُحب من الأبكر ٦ كاملةً فقد رُتّبت أوّلًا.
    -- بلا هذا السطر يمرّ مجموعٌ صحيحٌ بتوزيعٍ خطأ.
    v_log := v_log || format(E'\nearly_drawn  %s (expect -6)  %s',
      (select coalesce(sum(quantity_base), 0) from public.stock_movements
        where document_id = v_dx and lot_id = v_early),
      case when (select coalesce(sum(quantity_base), 0) from public.stock_movements
                  where document_id = v_dx and lot_id = v_early) = -6 then '✓' else '✗' end);

    raise exception 'ROLLBACK_MARKER';
  exception when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then
      v_log := v_log || format(E'\n💥 %s — %s', sqlstate, sqlerrm);
    end if;
  end;

  perform set_config('probe.result', v_log, false);
end $$;

select current_setting('probe.result') as result;

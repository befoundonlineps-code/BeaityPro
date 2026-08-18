-- ==========================================================================
-- ٠٩٥ب/ب — هل تعمل `transfer_stock` على الدفعات فعلًا؟
--
-- 🔴 مُجهَّزٌ ولم أشغّله. **أثرُه مُلغًى بالكامل** — كتلةٌ داخليّةٌ تتراجع عن كلّ صفّ.
-- ⚠️ **و`auth.uid()` فارغةٌ وRLS متجاوَزة** — يقيس الحسابَ والتخطيط، لا العزل.
--
-- **البنيةُ وأسبابُها مشروحةٌ في ٠٩٥ب/أ ولا تُعاد هنا:** جملةُ `select` واحدة ·
-- لا `raise notice` · لا جدولَ مؤقّت · التقريرُ في متغيّرٍ ينجو من التراجع.
--
-- ---------------------------------------------------------------------------
-- 🔴 السؤالُ الذي يخصّ هذه الدالّة وحدَها
--
-- قرارُ المالك: **«النقل يغيّر المكان فقط لا السعر، والدفعةُ سجلٌّ منفصلٌ تمامًا
-- — id جديد، ولا إشارةَ لدفعة المصدر».** فالمقيسُ هنا شيئان معًا:
--
--   ① **الرقمُ يُنسخ** — ثمنُ دفعة الوجهة = ثمنُ شريحتها من المصدر بالضبط
--   ② **والسجلُّ لا يُنسخ** — `id` دفعةِ الوجهة **مختلفٌ** عن دفعة المصدر
--
-- ⚠️ **والثاني هو ما يسهل أن يمرّ**: نقلٌ يعيد استعمال `lot_id` المصدر يعطي
-- أرقامًا صحيحةً تمامًا اليوم، **وينهار يومَ يُسأل «كم بقي من هذه الدفعة في هذا
-- المستودع؟»** — لأن المتبقّي مجموعُ حركاتٍ على `lot_id`، فحركتا الخروج والدخول
-- تُلغيان بعضَهما ويبدو المستودعان فارغَين معًا.
--
-- ⚠️ **وحركتان لكلّ شريحةٍ لا لكلّ سطر:** سطرٌ يعبر دفعتين ⟵ **أربعُ حركات**.
--
-- ---------------------------------------------------------------------------
-- المتوقَّع — ✓ على كلّ سطر
--
--   moves        ٤ حركات (شريحتان × ساقان)
--   source       ‏-10@5 على الدفعة الأولى · ‏-3@8 على الثانية
--   destination  ‏+10@5 · ‏+3@8، **بدفعتين جديدتين في مستودع الوجهة**
--   distinct     معرّفاتُ دفعات الوجهة **لا تساوي** معرّفاتِ المصدر
--   frames       إطارُ المُدخَل على شريحةٍ واحدةٍ فقط (ساقاها معًا)
--   remaining    المصدر **٠ و٣** · الوجهة ١٣ (١٠+٣)
-- ==========================================================================

do $$
declare
  v_log     text := '';
  v_salon   uuid;
  v_from    uuid;
  v_to      uuid;
  v_pid     uuid;
  v_uom     text;
  v_d1      uuid;
  v_d2      uuid;
  v_dt      uuid;
  v_lot1    uuid;
  v_lot2    uuid;
  v_n       int;
  v_slices  text;
begin
  begin
    select e.enumlabel::text into v_uom
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'entry_uom' order by e.enumsortorder limit 1;

    -- مستودعان بنفس الصالون، ومنتجٌ لا دفعةَ له في أيٍّ منهما.
    select p.id, a.id, b.id, p.salon_id
      into v_pid, v_from, v_to, v_salon
      from public.products p
      join public.storages a on a.salon_id = p.salon_id
      join public.storages b on b.salon_id = p.salon_id and b.id <> a.id
     where not exists (select 1 from public.stock_lots l
                        where l.product_id = p.id and l.storage_id in (a.id, b.id))
     order by p.id, a.id, b.id
     limit 1;

    v_log := v_log || format('storages=%s | from=%s to=%s pid=%s uom=%s',
      (select count(*) from public.storages),
      coalesce(v_from::text, 'NONE'), coalesce(v_to::text, 'NONE'),
      coalesce(v_pid::text, 'NONE'), coalesce(v_uom, 'NONE'));

    if v_pid is null or v_to is null or v_uom is null then
      -- ⚠️ **خبرٌ لا نجاح.** مستودعٌ واحدٌ في القاعدة يجعل هذا الفحصَ غيرَ ممكن،
      -- **ولا يجعله ناجحًا** — والفرقُ بين «مرّ» و«لم يُسأل» هو ما يُقال هنا.
      v_log := v_log || E'\n🔴 NO FIXTURE — يلزم مستودعان بنفس الصالون ومنتجٌ بلا دفعات. لم يُفحص شيء.';
      perform set_config('probe.result', v_log, false);
      return;
    end if;

    -- دفعتان في المصدر، الأقدمُ أرخص، كي يُقرأ ترتيبُ FIFO من الأثمان.
    v_d1 := public.post_stock_document('supply', v_from,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 10,
        'unit_cost', 5, 'entered_quantity', 10, 'entered_uom', v_uom)),
      null, null, null, now() - interval '2 days', 'probe-095b-b');
    select l.id into v_lot1 from public.stock_lots l where l.source_document_id = v_d1;

    v_d2 := public.post_stock_document('supply', v_from,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 6,
        'unit_cost', 8, 'entered_quantity', 6, 'entered_uom', v_uom)),
      null, null, null, now() - interval '1 day', 'probe-095b-b');
    select l.id into v_lot2 from public.stock_lots l where l.source_document_id = v_d2;

    -- ١٣ تعبر الدفعتين.
    v_dt := public.transfer_stock(v_from, v_to,
      jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 13,
        'entered_quantity', 13, 'entered_uom', v_uom)),
      null, now(), 'probe-095b-b');

    select count(*) into v_n from public.stock_movements where document_id = v_dt;
    v_log := v_log || format(E'\nmoves        %s (expect 4)  %s',
      v_n, case when v_n = 4 then '✓' else '✗' end);

    select string_agg(format('%s:%s@%s', case when m.storage_id = v_from then 'src' else 'dst' end,
                             m.quantity_base, m.unit_cost), ' , ' order by m.storage_id, m.unit_cost)
      into v_slices from public.stock_movements m where m.document_id = v_dt;
    v_log := v_log || format(E'\nraw          %s', coalesce(v_slices, 'NONE'));

    select count(*) into v_n
      from public.stock_movements m
     where m.document_id = v_dt and m.storage_id = v_from
       and ((m.lot_id = v_lot1 and m.quantity_base = -10 and m.unit_cost = 5)
         or (m.lot_id = v_lot2 and m.quantity_base = -3  and m.unit_cost = 8));
    v_log := v_log || format(E'\nsource       matching=%s (expect 2)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    select count(*) into v_n
      from public.stock_movements m
      join public.stock_lots l on l.id = m.lot_id
     where m.document_id = v_dt and m.storage_id = v_to
       and l.storage_id = v_to and l.source_document_id = v_dt
       and ((m.quantity_base = 10 and m.unit_cost = 5 and l.unit_cost = 5)
         or (m.quantity_base = 3  and m.unit_cost = 8 and l.unit_cost = 8));
    v_log := v_log || format(E'\ndestination  matching=%s (expect 2)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    -- ② السجلُّ منفصل — والفحصُ يسأل عن **عدم** المساواة صراحةً.
    select count(*) into v_n
      from public.stock_lots l
     where l.source_document_id = v_dt and l.id not in (v_lot1, v_lot2);
    v_log := v_log || format(E'\ndistinct     new_lots=%s (expect 2, none reusing a source lot)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    select count(*) into v_n from public.stock_movements
     where document_id = v_dt and entered_quantity is not null;
    v_log := v_log || format(E'\nframes       non_null=%s (expect 2 — one slice, both legs)  %s',
      v_n, case when v_n = 2 then '✓' else '✗' end);

    -- 🔴 **صُحِّح بعد التشغيل: كان التوقُّعُ `0,0` والصوابُ `0,3`.** نقلُ ١٣ من
    -- ١٠+٦ يأخذ الدفعةَ الأولى كاملةً وثلاثةً من الثانية، **فتبقى فيها ٣.**
    --
    -- ⚠️ **والاتّجاهُ هو العطل، لا الرقم.** التوقُّعُ الخاطئ كان يُظهر ✗ على
    -- `transfer_stock` سليمة — وهذه تكلفةُ وقت. **والأخطرُ عكسُها: نقلٌ معطوبٌ
    -- يستنزف الدفعةَ الثانية كاملةً (٦ بدل ٣) كان يُعطي `0` فيُقرأ ✓.** فالحارسُ
    -- كان أعمى عن العطل الذي وُضع لأجله بالضبط.
    --
    -- ⚠️ **والرقمُ المطبوع كان صحيحًا طَوالَ الوقت** — الخطأُ في الحكم وحدَه،
    -- وهو ما يجعل «اقرأ الخامَّ بجانب الحكم» ليس تزيّدًا.
    --
    -- ⚠️ **ونفسُ الحسابِ كُتب صحيحًا في ٠٩٥ب/أ (`expect 0 , 3`)** — فالخللُ ليس
    -- جهلًا بالحساب بل توقُّعًا مكتوبًا بيدٍ نُسخ من سياقٍ وعُدِّل نصفَ تعديل.
    v_log := v_log || format(E'\nremaining    src=%s,%s  dst_total=%s (expect 0,3 and 13)  %s',
      (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot1),
      (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2),
      (select coalesce(sum(m.quantity_base), 0) from public.stock_movements m
        join public.stock_lots l on l.id = m.lot_id where l.storage_id = v_to),
      case when (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot1) = 0
            and (select coalesce(sum(quantity_base), 0) from public.stock_movements where lot_id = v_lot2) = 3
            and (select coalesce(sum(m.quantity_base), 0) from public.stock_movements m
                  join public.stock_lots l on l.id = m.lot_id where l.storage_id = v_to) = 13
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

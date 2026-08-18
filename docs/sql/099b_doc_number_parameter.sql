-- ==========================================================================
-- ٠٩٩ب — التحقّق من ٠٩٩. **قراءةٌ وتنفيذٌ بأثرٍ مُلغًى، وجملةُ `select` واحدة.**
--
-- 🔴 مُجهَّزٌ ولم أشغّله. آمنٌ وقابلٌ للتكرار — لا يترك صفًّا واحدًا.
-- ⚠️ **و`auth.uid()` فارغةٌ وRLS متجاوَزة** — يقيس التوقيعَ والكتابة، لا العزل.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 ثلاثةُ أسئلةٍ لا واحد، والأوّلُ وحدَه يخدع
--
--   ① **كم نسخة؟** ٠٩٩ يحذف ثمّ ينشئ. فنسختان تجعلان النداءَ غامضًا (البند ٥).
--
--   ② **وهل النسخةُ الباقيةُ هي الجديدة؟** ⚠️ **و`count = 1` وحدَه يصدق على
--      القديمة تمامًا:** لو فشل الإنشاءُ ورجعت المعاملةُ لبقيت الدالّةُ القديمةُ
--      حيّةً وحيدة، **والعدُّ يقول ١ ويبدو نجاحًا.** فيُقرأ **التوقيعُ نفسُه.**
--
--   ③ **وهل يصل الرقمُ إلى الصفّ؟** معاملٌ موجودٌ لا يعني عمودًا مكتوبًا —
--      **«افحص محتوى الدالّة لا وجودَها» (البند ٢)**، وهنا: افحص أثرَها لا
--      توقيعَها. فيُنشأ مستندٌ برقمٍ ويُقرأ راجعًا.
--
-- ⚠️ **وتُقرأ التحصيناتُ معها:** `CREATE OR REPLACE` يعيد كتابة كلّ خاصّيّة،
-- **و`DROP` ثمّ `CREATE` أشدّ** — فغيابُ `SECURITY DEFINER` و`search_path`
-- يُقاس ولا يُفترض، كما قاسه ٠٥٠ج و٠٩٥أ من قبل.
--
-- ---------------------------------------------------------------------------
-- المتوقَّع — ✓ على كلّ سطر
--
--   copies       ١ بالضبط
--   has_param    التوقيعُ يحمل `p_doc_number`
--   nargs        ١٦ معاملًا (كانت ١٥)
--   security     `prosecdef = false` و`proconfig` عدم
--   written      رقمٌ كُتب ثمّ قُرئ راجعًا **حرفًا بحرف**
--   optional     مستندٌ بلا رقمٍ يُحفظ، والعمودُ يبقى عدمًا لا نصًّا فارغًا
-- ==========================================================================

do $$
declare
  v_log     text := '';
  v_salon   uuid;
  v_storage uuid;
  v_pid     uuid;
  v_uom     text;
  v_doc     uuid;
  v_read    text;
  v_n       int;
  v_sig     text;
begin
  -- ── التوقيع: يُقرأ قبل أيّ تنفيذ ─────────────────────────────────────────
  select count(*),
         string_agg(pg_get_function_identity_arguments(p.oid), ' ‖ ')
    into v_n, v_sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'post_stock_document';

  v_log := v_log || format('copies       %s (expect 1)  %s',
    v_n, case when v_n = 1 then '✓' else '✗' end);

  v_log := v_log || format(E'\nhas_param    %s (expect t)  %s',
    coalesce((v_sig like '%p_doc_number text%')::text, 'NONE'),
    case when v_sig like '%p_doc_number text%' then '✓' else '✗' end);

  select p.pronargs into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'post_stock_document';
  v_log := v_log || format(E'\nnargs        %s (expect 16 — كانت 15)  %s',
    v_n, case when v_n = 16 then '✓' else '✗' end);

  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'post_stock_document'
     and p.prosecdef = false and p.proconfig is null;
  v_log := v_log || format(E'\nsecurity     definer=f config=null: %s (expect 1)  %s',
    v_n, case when v_n = 1 then '✓' else '✗' end);

  -- ── الأثر: رقمٌ يُكتب ويُقرأ راجعًا ─────────────────────────────────────
  begin
    select e.enumlabel::text into v_uom
      from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'entry_uom' order by e.enumsortorder limit 1;

    select p.id, s.id, p.salon_id into v_pid, v_storage, v_salon
      from public.products p
      join public.storages s on s.salon_id = p.salon_id
     order by p.id, s.id limit 1;

    if v_pid is null or v_uom is null then
      v_log := v_log || E'\nwritten      🔴 NO FIXTURE — التوقيعُ مقيسٌ والأثرُ لا.';
    else
      -- ⚠️ **رقمٌ فيه مسافةٌ ومحارفُ غيرُ لاتينيّة عمدًا:** العمودُ `text` بلا
      -- تحويل، **وفحصٌ برقمٍ لاتينيٍّ بسيطٍ يمرّ على عمودٍ يقصّ أو يطبّع.**
      v_doc := public.post_stock_document('supply', v_storage,
        jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 1,
          'unit_cost', 1, 'entered_quantity', 1, 'entered_uom', v_uom)),
        null, null, null, now(), 'probe-099b',
        null, null, null, null, null, null, null, 'شطب ٢٠٢٦/٧ أ');

      select d.doc_number into v_read from public.stock_documents d where d.id = v_doc;
      v_log := v_log || format(E'\nwritten      %s (expect: شطب ٢٠٢٦/٧ أ)  %s',
        coalesce(v_read, 'NULL'),
        case when v_read = 'شطب ٢٠٢٦/٧ أ' then '✓' else '✗' end);

      -- ── واختياريٌّ: بلا رقمٍ يُحفظ، والعمودُ عدمٌ لا نصٌّ فارغ ─────────────
      v_doc := public.post_stock_document('supply', v_storage,
        jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 1,
          'unit_cost', 1, 'entered_quantity', 1, 'entered_uom', v_uom)),
        null, null, null, now(), 'probe-099b');

      select d.doc_number into v_read from public.stock_documents d where d.id = v_doc;
      v_log := v_log || format(E'\noptional     %s (expect NULL — لا نصًّا فارغًا)  %s',
        coalesce('«' || v_read || '»', 'NULL'),
        case when v_read is null then '✓' else '✗' end);

      -- ⚠️ **والقيدُ يعضّ على الفراغ المكتوب** — وإلّا صار للفراغ تهجئتان.
      begin
        perform public.post_stock_document('supply', v_storage,
          jsonb_build_array(jsonb_build_object('product_id', v_pid, 'quantity_base', 1,
            'unit_cost', 1, 'entered_quantity', 1, 'entered_uom', v_uom)),
          null, null, null, now(), 'probe-099b',
          null, null, null, null, null, null, null, '   ');
        v_log := v_log || E'\nblank_check  ACCEPTED — ✗ القيدُ لا يعضّ';
      exception when others then
        v_log := v_log || format(E'\nblank_check  %s (expect 23514)  %s',
          sqlstate, case when sqlstate = '23514' then '✓' else '✗' end);
      end;
    end if;

    raise exception 'ROLLBACK_MARKER';
  exception when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then
      v_log := v_log || format(E'\n💥 %s — %s', sqlstate, sqlerrm);
    end if;
  end;

  v_log := v_log || format(E'\nsignature    %s', coalesce(v_sig, 'NONE'));
  perform set_config('probe.result', v_log, false);
end $$;

select current_setting('probe.result') as result;

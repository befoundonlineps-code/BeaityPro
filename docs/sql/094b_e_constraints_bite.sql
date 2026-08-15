-- ==========================================================================
-- ٠٩٤ب/هـ — هل تعضّ القيودُ فعلًا. **جملةُ `select` واحدة في آخره.**
--
-- 🔴 مُجهَّزٌ ولم أشغّله. يُشغَّل بعد ٠٩٤. **يكتب صفوفًا ويمحوها كلَّها.**
--
-- ⚠️ **ولا DDL فيه** — فمهما فشلت جملةٌ هنا، لا تغييرَ دائمًا يمكن أن تُسقطه.
--
-- ---------------------------------------------------------------------------
-- 🔴 النسخةُ الأولى من هذا القسم كانت خضراءَ كاذبة، والمالكُ كشفها
--
-- كانت تأخذ `v_doc` من `stock_documents` — **والجدولُ فارغٌ تمامًا** (مؤكَّدٌ
-- بـ٠٩٣)، فكانت `NULL` دائمًا. فما كان يُقاس:
--
--   negative_cost_refused=yes      ← ✓ **لسببٍ آخر**: العدمُ في `source_document_id`
--                                    رُفض قبل أن يُنظر إلى السعر السالب أصلًا
--   valid_lot_accepted=NO (23502)  ← المسارُ السليمُ **لم يُثبت قطّ**
--
-- ⚠️ **وشاهدُ الصدق هو ما كشفها**: لولا `valid_lot_accepted` لقُرئ القسمُ كلُّه
-- نجاحًا — ثلاثةُ رفضٍ متتالية على جدولٍ كان يرفض كلَّ شيء.
--
-- ⇒ **فالإصلاحُ ليس تخطّي المستند بل إنشاؤه.** «تفادي الحالة» يُبقي المسارَ
-- السليمَ غيرَ مُثبَت، وهو نصفُ الفحص لا نصفُ الراحة.
--
-- ---------------------------------------------------------------------------
-- ⚠️ وثانيةٌ من نفس الصنف، أشار إليها المالكُ ولم تكن قد ظهرت بعد
--
-- `movement_without_lot_refused` كان يُدرج حركةً **بلا `document_id` أيضًا**،
-- فربّما رُفضت لغيابه لا لغياب `lot_id`. **ورفضٌ صحيحٌ لسببٍ خاطئ يقرأ كصحيح.**
--
-- ⇒ **فكلُّ رفضٍ هنا يُسمّي سببَه**: `GET STACKED DIAGNOSTICS` تُرجع اسمَ القيد
-- أو اسمَ العمود، **فيصير الجوابُ «رُفض على `lot_id`» لا «رُفض».** وهو نفسُ
-- تمييزِ «قُل أيُّ طبقةٍ تمسكها» — الفرقُ بين دفاعٍ ومصادفة.
--
-- ---------------------------------------------------------------------------
-- المتوقَّع، مكتوبٌ قبل التشغيل
--
--   valid_lot=yes                      ← **الشاهد.** بدونه لا يعني ما بعده شيئًا
--   valid_movement=yes                 ← **شاهدُ الحركة**، للسبب نفسِه
--   negative_cost=23514/stock_lots_unit_cost_check
--   movement_no_lot=23502/lot_id       ← **باسم العمود، لا بالرمز وحدَه**
--   cross_salon=23503  أو  «صالونٌ واحد»
--   cleanup=ok
-- ==========================================================================

do $$
declare
  v_salon   uuid;
  v_other   uuid;
  v_storage uuid;
  v_product uuid;
  v_doc     uuid;
  v_lot     uuid;
  v_log     text := '';
  v_name    text;
begin
  select id into v_salon   from public.salons   order by id limit 1;
  select id into v_other   from public.salons   where id <> v_salon order by id limit 1;
  select id into v_storage from public.storages where salon_id = v_salon order by id limit 1;
  select id into v_product from public.products  where salon_id = v_salon order by id limit 1;

  if v_salon is null or v_storage is null or v_product is null then
    -- ⚠️ «تعذّر» تُقال ولا تُخلط بـ«سليم»: «ما قدرتُ أفحص» و«مفحوصٌ وسليم»
    -- جوابان مختلفان، وخلطُهما هو §1ج بعينه.
    perform set_config('probe.lots', 'تعذّر: يلزم صالونٌ ومستودعٌ ومنتجٌ واحدٌ على الأقلّ', false);
    return;
  end if;

  -- ① مستندٌ حقيقيٌّ مؤقّت — **يُنشأ ولا يُتفادى.**
  --
  -- ⚠️ وحذفُه في آخر الكتلة يعمل **لأن RLS متجاوَزةٌ في المحرّر وحدَه**:
  -- `stock_documents` بلا سياسةِ حذفٍ إطلاقًا، والمنعُ بنيويٌّ من التطبيق.
  insert into public.stock_documents (salon_id, doc_type, storage_id, doc_date, note)
  values (v_salon, 'supply', v_storage, now(), 'فحصُ ٠٩٤ب/هـ — يُمحى فورًا')
  returning id into v_doc;

  -- ② 🔴 الشاهد: دفعةٌ سليمةٌ كاملةٌ تُقبل.
  --
  -- **وهو أوّلُ ما يُجرَّب لا آخرُه**: ثلاثةُ رفضٍ على جدولٍ مغلقٍ أصلًا تبدو
  -- نجاحًا تامًّا، ولا شيءَ في المخرَج يفرّق.
  begin
    insert into public.stock_lots
      (salon_id, storage_id, product_id, source_document_id, unit_cost, received_at)
    values (v_salon, v_storage, v_product, v_doc, 12.3456, now())
    returning id into v_lot;
    v_log := v_log || 'valid_lot=yes ';
  exception when others then
    v_log := v_log || ('valid_lot=NO(' || sqlstate || ') ');
  end;

  -- ③ وشاهدُ الحركة: حركةٌ **بدفعتها** تُقبل.
  if v_lot is not null then
    begin
      insert into public.stock_movements
        (salon_id, document_id, storage_id, product_id, quantity_base, unit_cost, lot_id)
      values (v_salon, v_doc, v_storage, v_product, 1, 12.3456, v_lot);
      v_log := v_log || 'valid_movement=yes ';
    exception when others then
      v_log := v_log || ('valid_movement=NO(' || sqlstate || ') ');
    end;
  end if;

  -- ④ سعرٌ سالبٌ يُرفض — **ويُسمّى القيدُ الذي رفضه.**
  begin
    insert into public.stock_lots
      (salon_id, storage_id, product_id, source_document_id, unit_cost, received_at)
    values (v_salon, v_storage, v_product, v_doc, -1, now());
    v_log := v_log || 'negative_cost=NOT_REFUSED ';
  exception when others then
    get stacked diagnostics v_name = constraint_name;
    v_log := v_log || ('negative_cost=' || sqlstate || '/' || coalesce(v_name, '؟') || ' ');
  end;

  -- ⑤ حركةٌ بلا دفعة — **كاملةٌ في كلّ شيءٍ عداها**، فالرفضُ لا يحتمل سببًا آخر.
  begin
    insert into public.stock_movements
      (salon_id, document_id, storage_id, product_id, quantity_base, unit_cost)
    values (v_salon, v_doc, v_storage, v_product, 1, 1);
    v_log := v_log || 'movement_no_lot=NOT_REFUSED ';
  exception when others then
    get stacked diagnostics v_name = column_name;
    v_log := v_log || ('movement_no_lot=' || sqlstate || '/' || coalesce(v_name, '؟') || ' ');
  end;

  -- ⑥ دفعةٌ بمستودعِ صالونٍ آخر — المفتاحُ المركَّب يعمل.
  if v_other is null then
    v_log := v_log || 'cross_salon=غيرُ مفحوصٍ (صالونٌ واحد) ';
  else
    begin
      insert into public.stock_lots
        (salon_id, storage_id, product_id, source_document_id, unit_cost, received_at)
      values (v_other, v_storage, v_product, v_doc, 1, now());
      v_log := v_log || 'cross_salon=NOT_REFUSED ';
    exception when others then
      get stacked diagnostics v_name = constraint_name;
      v_log := v_log || ('cross_salon=' || sqlstate || '/' || coalesce(v_name, '؟') || ' ');
    end;
  end if;

  -- ⑦ التنظيف — من الأوراق إلى الجذر، **والعدُّ بعده هو الحارسُ الوحيد**
  -- لأن `DELETE 0` ينجح بصمت.
  delete from public.stock_movements where document_id = v_doc;
  delete from public.stock_lots      where source_document_id = v_doc;
  delete from public.stock_documents where id = v_doc;

  if exists (select 1 from public.stock_documents where id = v_doc)
     or exists (select 1 from public.stock_lots where source_document_id = v_doc) then
    v_log := v_log || 'cleanup=LEFTOVER ';
  else
    v_log := v_log || 'cleanup=ok ';
  end if;

  -- ⚠️ **بعد الكتلة الداخليّة لا داخلها.** تراجعُ المعاملة الفرعيّة يمحو
  -- `set_config` كما يمحو الإدراجَ في جدولٍ مؤقّت — والناجي متغيّرُ PL/pgSQL وحدَه.
  perform set_config('probe.lots', v_log, false);
end $$;

-- ⚠️ و`raise notice` **لا تُعرض في محرّر Supabase** — مقيسٌ عند المالك مرّتين
-- (٠٩٠ب و٠٩١)، فضاعت أرقامُ حارسَين اشتغلا. فكلُّ رقمٍ يصل إنسانًا ينزل بـ`select`.
select current_setting('probe.lots', true) as result;

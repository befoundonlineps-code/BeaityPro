-- ==========================================================================
-- ٠٩٤ب — تحقّقٌ فقط. لا يكتب شيئًا يبقى، ولا يقدر أن يُسقط تغييرًا.
--
-- 🔴 مُجهَّزٌ ولم أشغّله. يُشغَّل **بعد** ٠٩٤ وقبل ٠٩٥.
--
-- ⚠️ **و`auth.uid()` فارغةٌ في المحرّر، وRLS متجاوَزةٌ هناك.** فما يُقاس هنا
-- **وجودُ السياسات ونصُّها**، لا أنها تعزل فعلًا — ذلك لا يظهر إلّا من التطبيق
-- بجلسةٍ حقيقيّة، ويُقال هنا كي لا يُقرأ المخرَجُ على أنه أثبت الاثنين.
--
-- ⚠️ **وملفٌّ منفصلٌ لسببٍ بنيويّ:** استعلامُ تحقّقٍ يشارك معاملةَ التغيير يستطيع
-- — إن فشل لأيِّ سبب — أن يُسقط الـDDL الذي فوقه، وقد فعلها في ٠٥١ج.
--
-- ---------------------------------------------------------------------------
-- المتوقَّع، مكتوبٌ قبل التشغيل كي لا يُقرأ المخرَجُ بأثرٍ رجعيّ
--
--   A  ثمانيةُ أعمدةٍ على stock_lots، و`lot_id` على stock_movements بـNO
--   B  قيودُ stock_lots كلُّها — وفيها المفاتيحُ المركّبةُ الثلاثة والتفرّد
--   C  سياستان لا أكثر (select · insert)، ومنحتان لا أكثر
--   D  التعليقاتُ العربيّةُ الخمسةُ تعود مقروءة
--   E  القيودُ تعضّ فعلًا: أربعُ محاولاتٍ، كلُّها ترتدّ
-- ==========================================================================

-- A · الأعمدة.
--
-- ⚠️ ولا تقول شيئًا عن القيود — `information_schema.columns` تُرجع الاسمَ والنوعَ
-- والعدميّةَ والافتراضيّ **والقيدُ ليس في أيٍّ منها**. ولهذا القسمُ B موجود.
select
  'A · أعمدة stock_lots' as section,
  c.ordinal_position, c.column_name, c.data_type, c.is_nullable,
  coalesce(c.column_default, '—') as column_default
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'stock_lots'
order by c.ordinal_position;

select
  'A · عمود lot_id' as section,
  c.column_name, c.data_type, c.is_nullable,
  coalesce(c.column_default, '—') as column_default
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'stock_movements'
  and c.column_name = 'lot_id';

-- B · كلُّ قيود الجدولين — الفئةُ كاملةً ثمّ التصفيةُ بالعين.
--
-- ⚠️ لا `where conname = '…'`: سؤالٌ ضيّقٌ عن اسمٍ يرجع صفرًا **سواءٌ غاب القيدُ
-- أو أنشأه بوستجرس باسمٍ آخر** — والمشروعُ دفع ثمنَ هذا أربعَ مرّات.
select
  'B · القيود' as section,
  con.conrelid::regclass::text as on_table,
  con.conname, con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid in ('public.stock_lots'::regclass, 'public.stock_movements'::regclass)
order by con.conrelid::regclass::text, con.conname;

-- C · العزل: السياساتُ والمنَح.
--
-- 🔴 **والمتوقَّعُ غيابُ `update` و`delete` من الاثنين معًا.** الدفعةُ لا تتغيّر
-- بعد كتابتها — المتبقّي منها مشتقٌّ لا مخزَّن — فوجودُ أيٍّ منهما هنا خطأٌ لا
-- تشدّدٌ زائد.
select
  'C · السياسات' as section,
  p.policyname, p.cmd, p.roles::text, p.qual, p.with_check
from pg_policies p
where p.schemaname = 'public' and p.tablename = 'stock_lots'
order by p.policyname;

select
  'C · المنَح' as section,
  g.grantee, g.privilege_type
from information_schema.role_table_grants g
where g.table_schema = 'public' and g.table_name = 'stock_lots'
order by g.grantee, g.privilege_type;

-- D · القراءةُ الراجعةُ للنصّ العربيّ الذي أودعه ٠٩٤.
--
-- ⚠️ **بسيطةٌ لدرجة أنها لا تقدر أن تفشل.** والسؤالُ ليس «هل التعليقُ موجود» بل
-- **هل نجا العربيُّ شحنًا**: محرّرُ Supabase أوقعَ مشكلةَ تشفيرٍ مسّت التعليقات
-- في ٤٣، **ولا اختبارَ عندنا يمسك هذا الصنف** لأن اختباراتِنا تقرأ المستودعَ لا
-- القاعدة.
select
  'D · وصفُ الجدول' as section,
  left(obj_description('public.stock_lots'::regclass), 60) as first_60_chars;

select
  'D · أوصافُ الأعمدة' as section,
  a.attrelid::regclass::text as on_table,
  a.attname,
  left(col_description(a.attrelid, a.attnum), 45) as first_45_chars
from pg_attribute a
where (a.attrelid = 'public.stock_lots'::regclass
       and a.attname in ('unit_cost', 'cost_is_estimated', 'received_at'))
   or (a.attrelid = 'public.stock_movements'::regclass and a.attname = 'lot_id')
order by on_table, a.attname;

-- E · 🔴 هل تعضّ القيودُ فعلًا — لا هل هي مكتوبة.
--
-- **فحصٌ لا يستطيع أن يفشل ليس فحصًا.** وقراءةُ نصِّ القيد تثبت وجودَه لا عمله.
--
-- ⚠️ **والنتيجةُ تُبلَّغ بـ`select` لا بـ`raise notice`:** الأخيرةُ لا تُعرض في
-- محرّر Supabase — مقيسٌ عند المالك بـ٠٩٠ب و٠٩١، **فضاعت أرقامُ حارسَين اشتغلا.**
-- و`set_config` تُكتب **بعد** الكتلة الداخليّة لا داخلها، لأن تراجعَ المعاملة
-- الفرعيّة يمحوها كما يمحو الإدراجَ في جدولٍ مؤقّت.
do $$
declare
  v_salon    uuid;
  v_other    uuid;
  v_storage  uuid;
  v_product  uuid;
  v_doc      uuid;
  v_log      text := '';
begin
  select id into v_salon from public.salons order by id limit 1;
  select id into v_other from public.salons where id <> v_salon order by id limit 1;
  select id into v_storage from public.storages where salon_id = v_salon limit 1;
  select id into v_product from public.products  where salon_id = v_salon limit 1;
  select id into v_doc     from public.stock_documents where salon_id = v_salon limit 1;

  if v_salon is null or v_storage is null or v_product is null then
    -- ⚠️ «تعذّر» تُقال ولا تُخلط بـ«سليم»: «ما قدرتُ أفحص» و«مفحوصٌ وسليم»
    -- جوابان مختلفان، وخلطُهما هو §1ج بعينه.
    perform set_config('probe.lots', 'تعذّر: لا صالونَ أو لا مستودعَ أو لا منتجَ للفحص', false);
    return;
  end if;

  -- ١ · سعرٌ سالبٌ يُرفض.
  begin
    insert into public.stock_lots (salon_id, storage_id, product_id, source_document_id, unit_cost, received_at)
    values (v_salon, v_storage, v_product, v_doc, -1, now());
    v_log := v_log || 'negative_cost_refused=NO ';
  exception when others then v_log := v_log || 'negative_cost_refused=yes ';
  end;

  -- ٢ · مستودعُ صالونٍ آخرَ يُرفض — وهذا هو المفتاحُ المركَّب يعمل.
  if v_other is null then
    v_log := v_log || 'cross_salon=غيرُ مفحوصٍ (صالونٌ واحد) ';
  else
    begin
      insert into public.stock_lots (salon_id, storage_id, product_id, source_document_id, unit_cost, received_at)
      values (v_other, v_storage, v_product, v_doc, 1, now());
      v_log := v_log || 'cross_salon_refused=NO ';
    exception when others then v_log := v_log || 'cross_salon_refused=yes ';
    end;
  end if;

  -- ٣ · حركةٌ بلا دفعةٍ تُرفض.
  begin
    insert into public.stock_movements (salon_id, storage_id, product_id, quantity_base, unit_cost)
    values (v_salon, v_storage, v_product, 1, 1);
    v_log := v_log || 'movement_without_lot_refused=NO ';
  exception when others then v_log := v_log || 'movement_without_lot_refused=yes ';
  end;

  -- ٤ · ودفعةٌ سليمةٌ تُقبل — **وبدونها يمرّ القسمُ كلُّه على جدولٍ يرفض كلَّ شيء.**
  -- شاهدُ الصدق: الرفضُ الثلاثيُّ لا يعني شيئًا إن كان الجدولُ مغلقًا أصلًا.
  begin
    insert into public.stock_lots (salon_id, storage_id, product_id, source_document_id, unit_cost, received_at)
    values (v_salon, v_storage, v_product, v_doc, 1, now());
    v_log := v_log || 'valid_lot_accepted=yes ';
    -- ويُمحى فورًا: هذا فحصٌ لا بيانات.
    delete from public.stock_lots
     where salon_id = v_salon and storage_id = v_storage and product_id = v_product
       and unit_cost = 1 and created_at > now() - interval '1 minute';
  exception when others then v_log := v_log || ('valid_lot_accepted=NO (' || sqlstate || ') ');
  end;

  perform set_config('probe.lots', v_log, false);
end $$;

select 'E · هل تعضّ القيود' as section, current_setting('probe.lots', true) as result;

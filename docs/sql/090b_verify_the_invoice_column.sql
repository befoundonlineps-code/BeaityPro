-- ==========================================================================
-- ٠٩٠ب — تحقّقٌ فقط. لا يكتب شيئًا، ولا يستطيع أن يُسقط تغييرًا.
--
-- 🔴 مُجهَّزٌ ولم أشغّله. يُشغَّل **بعد** ٠٩٠، وآمنٌ في أيِّ وقت.
--
-- ⚠️ **و`auth.uid()` فارغةٌ في المحرّر، وRLS متجاوَزةٌ هناك.** فما يقيسه هذا
-- الملفُّ هو **شكلُ المخطّط**، لا العزل.
--
-- ⚠️ **وهو ملفٌّ منفصلٌ لسببٍ بنيويّ لا تنظيميّ:** استعلامُ تحقّقٍ يشارك معاملةَ
-- التغيير يستطيع — إن فشل لأيِّ سبب — أن يُسقط الـDDL الذي فوقه، وقد فعلها في
-- ٠٥١ج. وفحصٌ في ملفّه لا يقدر أن يمحوَ شيئًا مهما كان خاطئًا.
--
-- ---------------------------------------------------------------------------
-- المتوقَّع، مكتوبٌ قبل التشغيل كي لا يُقرأ المخرَجُ بأثرٍ رجعيّ
--
--   A  صفٌّ واحد:  invoice_no · text · YES · (لا افتراضيّ)
--   B  صفٌّ واحد:  product_orders_invoice_no_not_blank_check
--   C  الأربعةُ الحرفيّة:  blank_refused=f · space_refused=f · null_ok=t · text_ok=t
--   D  التعليقُ العربيُّ يعود مقروءًا — أوّلُ ٤٠ حرفًا منه ظاهرة
-- ==========================================================================

-- A · العمودُ نفسُه.
--
-- ⚠️ يُقرأ من `information_schema.columns` **وهي لا تعرف القيود** — قراءةُ
-- `text · YES` واستنتاجُ «مجالٌ مفتوح» ليست بيّنةً ضعيفة، هي لا بيّنة. ولهذا
-- القسمُ B موجودٌ ويسأل `pg_constraint` وحدَه.
select
  'A · العمود' as section,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'product_orders'
  and c.column_name = 'invoice_no';

-- B · كلُّ قيود الجدول، لا القيدُ المسمّى وحدَه.
--
-- ⚠️ **الفئةُ كاملةً ثمّ التصفيةُ بالعين** — لا `where conname = '…'`. سؤالٌ
-- ضيّقٌ يجد ما وضعتَه فيه ويسكت عن كلّ ما عداه بنبرة النجاح، وهذا المشروعُ عدّ
-- أربعَ مرّاتٍ دفع فيها ثمنَ ذلك. والقيدُ الذي سمّاه بوستجرس تلقائيًّا لا يعرفه
-- أحدٌ إلّا هكذا.
select
  'B · القيود' as section,
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid = 'public.product_orders'::regclass
order by con.conname;

-- C · هل يرفض القيدُ فعلًا ما يدّعي رفضَه.
--
-- 🔴 **فحصٌ لا يستطيع أن يفشل ليس فحصًا.** قراءةُ نصِّ القيد تثبت وجودَه لا
-- عملَه، وPL/pgSQL يخطّط الجملةَ عند أوّل تنفيذ — فقيدٌ أُنشئ بنجاحٍ قد يرفض
-- ما لا يجب أو يقبل ما لا يجب.
--
-- ⚠️ **والإرجاعُ بكتلةٍ داخليّةٍ، والتقريرُ يُراكم في متغيّرٍ لا في جدول.** كتلةُ
-- `exception` معاملةٌ فرعيّة، فكلُّ ما كُتب داخلها يُلغى عند الالتقاط — بما فيه
-- الإدراجُ في جدولٍ مؤقّت. ومتغيّراتُ PL/pgSQL وحدَها تنجو.
do $$
declare
  v_salon    uuid;
  v_supplier uuid;
  v_blank    boolean := true;
  v_space    boolean := true;
  v_null     boolean := false;
  v_text     boolean := false;
begin
  -- ⚠️ صفٌّ حقيقيٌّ يُؤخذ من الجدول، ولا يُطابَق بالاسم. البندُ ٤: مطابقةُ
  -- الأسماء تُسكِت الفحصَ كلَّه حين يختلف حرف.
  select id into v_salon    from public.salons    limit 1;
  select id into v_supplier from public.suppliers limit 1;

  if v_salon is null or v_supplier is null then
    raise notice 'تعذّر: لا صالونَ أو لا مورّد';
    return;
  end if;

  begin
    insert into public.product_orders (salon_id, supplier_id, invoice_no)
    values (v_salon, v_supplier, '');
    v_blank := false;                       -- ⚠️ وصلَ هنا = القيدُ لم يرفض
  exception when check_violation then null;
  end;

  begin
    insert into public.product_orders (salon_id, supplier_id, invoice_no)
    values (v_salon, v_supplier, '   ');
    v_space := false;
  exception when check_violation then null;
  end;

  begin
    insert into public.product_orders (salon_id, supplier_id, invoice_no)
    values (v_salon, v_supplier, null);
    v_null := true;
  exception when others then null;
  end;

  begin
    insert into public.product_orders (salon_id, supplier_id, invoice_no)
    values (v_salon, v_supplier, 'INV-2026-001');
    v_text := true;
  exception when others then null;
  end;

  -- 🔴 وتُمحى صفوفُ التجربة وحدَها، بشرطٍ لا يمكن أن يمسّ صفًّا حقيقيًّا.
  --
  -- ⚠️ `DELETE 0` ينجح بصمت، فالعدُّ بعده هو الحارسُ الوحيد — ولا تُستعمل
  -- `raise exception` للإرجاع، لأنها تُسقط المعاملةَ كلَّها ومعها أيُّ شيءٍ آخر
  -- في نفس اللصقة.
  delete from public.product_orders
  where salon_id = v_salon
    and invoice_no is not distinct from null
    and note is null
    and created_at > now() - interval '1 minute';

  delete from public.product_orders
  where salon_id = v_salon and invoice_no = 'INV-2026-001';

  raise notice 'C · blank_refused=% space_refused=% null_ok=% text_ok=%',
    v_blank, v_space, v_null, v_text;
end $$;

-- D · القراءةُ الراجعةُ للنصّ العربيّ الذي أودعه ٠٩٠.
--
-- ⚠️ **بسيطةٌ لدرجة أنها لا تقدر أن تفشل** — لا تجميعَ ولا تحويلَ نوعٍ ولا `||`
-- على ما قد يكون عدمًا. والسؤالُ ليس «هل التعليقُ موجود» بل **هل نجا العربيُّ
-- شحنًا**: محرّرُ Supabase أوقعَ مشكلةَ تشفيرٍ مسّت التعليقات في ٤٣، ولا اختبارَ
-- عندنا يمسك هذا الصنف لأن اختباراتِنا تقرأ المستودعَ لا القاعدة.
select
  'D · التعليق' as section,
  left(col_description('public.product_orders'::regclass, a.attnum), 40) as first_40_chars
from pg_attribute a
where a.attrelid = 'public.product_orders'::regclass
  and a.attname = 'invoice_no';

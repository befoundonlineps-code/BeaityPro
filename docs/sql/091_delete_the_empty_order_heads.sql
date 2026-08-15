-- ==========================================================================
-- ٠٩١ — حذفُ رؤوس الطلبيّات التي بقيت بلا سطور بعد تصفير ٠٨٩.
--
-- 🔴 مُجهَّزٌ ولم أشغّله. المالكُ ينفّذه بيده بعد مراجعته.
--
-- ⚠️ **و`auth.uid()` فارغةٌ في المحرّر، وRLS متجاوَزةٌ هناك بالكامل** — فهذا
-- الحذفُ **لا يقتصر على صالونٍ واحد**؛ يمسّ كلَّ صفٍّ يطابق الشرط في القاعدة.
-- وهذا مقبولٌ هنا فقط لأن الشرطَ نفسَه يستثني كلَّ ما له سطور، **ولأن القاعدةَ
-- صُفِّرت أصلًا بـ٠٨٩** — لكنّه يُقال صراحةً بدل أن يُفترض.
--
-- ---------------------------------------------------------------------------
-- لماذا يوجد هذا الملفّ أصلًا — وكان يمكن ألّا يوجد
--
-- ٠٨٩ صفّر ثلاثةَ عشرَ جدولًا **واستثنى `product_orders` (الرؤوس) بقرارك**،
-- فحُذفت `product_order_lines` وبقيت رؤوسُها. وسطرُه الأخير عدّها كي «لا
-- تُكتشَف لاحقًا كأنها عطل».
--
-- ⚠️ **وقرارُك كان: امسحوها بزرّ الحذف في الشاشة القديمة إن وُجد — وهو موجود.**
-- لكنّ نفسَ الجولة استبدلت تلك الشاشةَ بشاشة «طلب بضاعة» المرجعيّة، **فصار
-- الزرُّ غيرَ قابلٍ للوصول**. فالفرعُ الثاني من قرارك هو الساري، لا الأوّل.
--
-- ---------------------------------------------------------------------------
-- الحارس
--
-- ⚠️ **`DELETE 0` ينجح بصمت، و`DELETE` على الجدول كلّه ينجح بصمتٍ أيضًا** —
-- والفرقُ بينهما لا يظهر في أيِّ مخرَج. فالحذفُ مشروطٌ بـ`not exists`، والعدُّ
-- قبلَه وبعدَه هو ما يقول ماذا جرى.
--
-- ⚠️ **ولا `raise exception` للإرجاع**، لأنها تُسقط المعاملةَ كلَّها ومعها كلُّ
-- ما في اللصقة (البند ١ب).
--
-- المتوقَّع: `deleted` يساوي `empty_before`، و`empty_after` = 0،
-- و**`with_lines_before` = `with_lines_after` بالضبط** — وهذا الأخير هو
-- الشاهدُ الذي يفصل «حذفَ الفارغةَ وحدَها» عن «حذفَ كلَّ شيء».
-- ==========================================================================

do $$
declare
  v_empty_before  integer;
  v_lines_before  integer;
  v_deleted       integer;
  v_empty_after   integer;
  v_lines_after   integer;
begin
  select count(*) into v_empty_before
  from public.product_orders o
  where not exists (select 1 from public.product_order_lines l where l.order_id = o.id);

  -- 🔴 شاهدُ الصدق: الرؤوسُ التي **لها** سطور. لو نزل هذا الرقمُ ولو بواحد،
  -- فالشرطُ لم يحمِ ما وُضع ليحميه — و«صفرُ فارغاتٍ بعدها» وحدَه كان سيبدو
  -- نجاحًا تامًّا في الحالتين.
  select count(*) into v_lines_before
  from public.product_orders o
  where exists (select 1 from public.product_order_lines l where l.order_id = o.id);

  delete from public.product_orders o
  where not exists (select 1 from public.product_order_lines l where l.order_id = o.id);
  get diagnostics v_deleted = row_count;

  select count(*) into v_empty_after
  from public.product_orders o
  where not exists (select 1 from public.product_order_lines l where l.order_id = o.id);

  select count(*) into v_lines_after
  from public.product_orders o
  where exists (select 1 from public.product_order_lines l where l.order_id = o.id);

  raise notice 'empty_before=% deleted=% empty_after=% | with_lines: before=% after=%',
    v_empty_before, v_deleted, v_empty_after, v_lines_before, v_lines_after;
end $$;

-- والقراءةُ الراجعةُ بعد الكتلة — لأن `raise notice` لا يُعرض في محرّر Supabase،
-- وهو بالضبط ما يغري باستعمال الاستثناء للإرجاع.
select
  'بعد الحذف' as section,
  count(*) filter (
    where not exists (select 1 from public.product_order_lines l where l.order_id = o.id)
  ) as empty_expect_0,
  count(*) filter (
    where exists (select 1 from public.product_order_lines l where l.order_id = o.id)
  ) as with_lines,
  count(*) as total
from public.product_orders o;

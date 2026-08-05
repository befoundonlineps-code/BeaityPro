-- ═══════════════════════════════════════════════════════════════════════════
-- البند ٤٣ (الدرجة الرابعة بسلسلة التكلفة) + البند ٣٤ (عمود «مُقدَّرة»)
--
-- ⚠️ مُجهَّز ومعروض ولا يُشغَّل من طرفي — المالك ينفّذه بمحرّر SQL.
--
-- ⚠️ والملف نصفان، والنصف الثاني **غير قابل للكتابة عندي بعد**، والسبب مذكور
--    بموضعه: `post_stock_document` و`post_stocktake` **ليستا بـdocs/db-functions.sql**
--    (البند ٢٨ — الملف متأخّر عن القاعدة)، فلا أملك نصّهما الكامل. وإعادة
--    بناء دالّة من جسمها وحده **تُسقط `SECURITY DEFINER` و`search_path` بصمت**،
--    وهي علّة دفعناها مرّة. فالنصف الأول كامل وقابل للتشغيل، والثاني ينتظر سطرًا.
--
-- ⚠️ ولا `RAISE EXCEPTION` بهذا الملف إطلاقًا: فيه DDL دائم، والاستثناء يُسقط
--    المعاملة كاملة **وبضمنها الـDDL فوقه** — فيبقى القديم حيًّا والفحص يقول
--    «نجح». التحقّق كله بـ`select` عادي بالآخر.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- الجزء ١ — العمود والview  (كامل، شغّله كما هو)
-- ───────────────────────────────────────────────────────────────────────────

-- عمودٌ يقول إن الرقم تقديرٌ لا ثمنٌ مدفوع.
--
-- ⚠️ ليش عمود جنبه ولا `unit_cost nullable`: `sum()` يتخطّى العدم ولا يبطل
-- فيه، فحركة بتكلفة NULL تخرج من البسط وتبقى بالمقام والمتوسّط ينخفض بصمت —
-- تسميم بأنظف صوره، وأخفى من الصفر لأن الصفر يُرى بالسطر والانخفاض لا يُرى.
-- فالدفتر يحمل رقمًا لكل حركة دائمًا، والجهل حقيقةٌ **عن** الرقم لا قيمةً له.
--
-- `not null default false`: الحركات القائمة كلها غير مقدَّرة بحكم التعريف —
-- أسعارها كُتبت بيد إنسان أو حُسبت من متوسّط حقيقي.
alter table stock_movements
  add column if not exists cost_is_estimated boolean not null default false;

comment on column stock_movements.cost_is_estimated is
  'صحيح حين لم تأتِ التكلفة من متوسّط هذا المستودع — أي نزلت السلسلة درجةً أو أكثر. علامة دائمة على الحركة: لا نعيد حساب تكلفة مختومة (ADR-051).';


-- والview يرفع العلامة للرصيد كله.
--
-- ⚠️ `bool_or` تعني: صفّ الرصيد يبقى موسومًا ما دامت بتاريخه حركةٌ مقدَّرة
-- **ولو وردت بعدها عشر شحنات بأسعار حقيقية** — لأن المتوسّط يُشتقّ من كل
-- الحركات، فهو مقدَّرٌ جزئيًّا إلى الأبد. لزجة، وصادقة: العكس هو المخرج
-- الوحيد فعلًا، وهو بالضبط ما يقوله الشرح على الشاشة («كيف تختفي؟»).
--
-- والنصّ أدناه هو تعريف الـview القائم حرفًا بحرف + السطر الجديد وحده.
create or replace view product_balances as
select
  salon_id,
  storage_id,
  product_id,
  sum(quantity_base) as balance_base,
  case when sum(quantity_base) > 0
       then sum(quantity_base * unit_cost) / sum(quantity_base)
       else null end as avg_cost,
  bool_or(cost_is_estimated) as cost_has_estimate
from stock_movements
group by salon_id, storage_id, product_id;


-- ───────────────────────────────────────────────────────────────────────────
-- الجزء ٢ — السلسلة داخل الدالّتين  (⚠️ لا تُكتب قبل وصول نصّهما)
--
-- أرسل مخرج هذا أولًا، ثم أكتب الاستبدال كاملًا بتوقيعه و`SECURITY DEFINER`
-- و`search_path` كما هي — لا من الذاكرة ولا من الجسم وحده:
--
--   select pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('post_stock_document', 'post_stocktake');
--
-- والتغيير المطلوب بجسم كل واحدة، بهذا الترتيب بالضبط:
--
--   ١. متوسّط هذا المستودع        ← موجودة   · cost_is_estimated = false
--   ٢. آخر وارد بهذا المستودع     ← موجودة   · cost_is_estimated = true
--   ٣. آخر وارد بأي مستودع        ← جديدة    · cost_is_estimated = true
--   ٤. السعر الاسميّ               ← موجودة   · cost_is_estimated = true
--   ٥. صفر                        ← موجودة   · cost_is_estimated = true
--
-- ⚠️ والثالثة **فوق** الاسميّ لا تحته، والفرق فرق نوع لا درجة: الأولى ثمنٌ
-- دُفع فعلًا وانسجّل، والثاني رقمٌ كتبه أحدهم بالكتالوج **ولا يعرف أحد وحدته**
-- (البند ٣١). حقيقةٌ مقيسة بمكان آخر أوثق من تخمينٍ بالمكان الصحيح.
--
-- والدرجة الجديدة، جاهزةً للإدراج بعد الدرجة الثانية مباشرةً:
--
--   if v_cost is null then
--     select m.unit_cost into v_cost
--     from stock_movements m
--     where m.salon_id = v_salon_id
--       and m.product_id = v_product_id
--       and m.quantity_base > 0
--     order by m.created_at desc, m.id desc
--     limit 1;
--   end if;
--
-- (بلا شرط `storage_id` — وهذا هو الفرق الوحيد عن الدرجة التي فوقها.)
--
-- وعلامة التقدير تُرفع مرّة واحدة بعد الدرجة الأولى:
--
--   v_cost_estimated := (v_cost_from_average is null);
--   …
--   insert into stock_movements (…, unit_cost, cost_is_estimated)
--   values (…, coalesce(v_cost, 0), v_cost_estimated);
--
-- ⚠️ وأسماء المتغيّرات أعلاه افتراضية — تُطابَق بأسماء الدالّة الحقيقية حين
-- يصل نصّها. لا تُلصق كما هي.
-- ───────────────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────────────
-- التحقّق — بعد الجزء ١ وحده
-- ───────────────────────────────────────────────────────────────────────────

-- ١. العمود موجود بنوعه وقيده
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'stock_movements' and column_name = 'cost_is_estimated';

-- ٢. والview صار يرجّع العمود الجديد، وباقي أعمدته كما هي
select column_name
from information_schema.columns
where table_name = 'product_balances'
order by ordinal_position;

-- ٣. ⚠️ وكل الحركات القائمة غير مقدَّرة — لأن أسعارها كُتبت أو حُسبت فعلًا،
--    والافتراضي false. لو رجع أي صفّ هون فالافتراضي لم يُطبَّق كما يُظنّ.
select count(*) as estimated_rows_before_any_new_document
from stock_movements
where cost_is_estimated;

-- ٤. ولا صفّ رصيد موسوم بعد — نفس السبب، وهذا خطّ الأساس الذي يُقارَن به
--    أول جرد يمرّ بالدرجة الجديدة.
select count(*) as balance_rows_flagged
from product_balances
where cost_has_estimate;

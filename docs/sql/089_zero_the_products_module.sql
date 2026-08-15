-- ٠٨٩ — تصفيرُ موديول المنتجات: ثلاثةَ عشرَ جدولًا، أو لا شيء
--
-- 🔴🔴 هذا الملفُّ يمحو بياناتٍ **لا تُستدرَك**، وبلا نسخةٍ احتياطيّة —
-- قرارُ المالك، معلنًا وواعيًا (البياناتُ اختباريّةٌ لا إنتاجيّة).
--
-- ⚠️ ولا شيءَ خارج الثلاثةَ عشرَ يُلمَس: الموظّفون · إعداداتُ الصالون ·
-- الزبائن · المواعيد · المورّدون · `product_orders` (الرؤوس) — **كلُّها تبقى.**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 الترتيبُ مكتوبٌ بيدٍ صراحةً، ولا يُحسب — وهذا قرارٌ لا كسل
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ترتيبُ العمق في القسم B من ٠٨٧_٢ صحيحٌ **بالنسبة للمفاتيح الأجنبيّة وحدَها**.
-- وهناك قيدٌ لا يعرفه أيُّ حسابِ عمق:
--
--   `refuse_unlinking_stocked_folder` مُشغِّلُ BEFORE DELETE على
--   `storage_categories`، يقرأ `product_balances`، ويرفض شيلَ مجلّدٍ من
--   مستودعٍ فيه رصيدٌ منه.
--
-- ⇒ **`stock_movements` تُفرَّغ قبل `storage_categories`.** وطابقَ العمقُ ذلك
-- هذه المرّة **بالصدفة**، ولذلك لا يُترك للعمق: صدفةٌ صحيحةٌ اليوم تنقلب بأوّل
-- مفتاحٍ يُضاف غدًا، **بلا سطرٍ واحدٍ يشتكي.**
--
-- ⚠️ **ولا `disable trigger`.** حارسٌ معطَّلٌ لم يُعَد تفعيلُه هو ثغرةٌ دائمةٌ
-- ثمنُها أكبر من ترتيبٍ صحيح.
--
-- والحذفُ ثلاثةَ عشرَ أمرًا **مكتوبًا سطرًا سطرًا** لا حلقةً على مصفوفة: من
-- يراجع أمرَ محوٍ لا يُستدرَك يجب أن يرى **بعينه** ما يُمَسّ وبأيّ ترتيب.
-- الحلقةُ تختصر الكتابة وتُخفي المُراجَع.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 وجدولان يشيران إلى نفسيهما، فيُفرَّغان من الأوراق إلى الجذر
-- ═══════════════════════════════════════════════════════════════════════════
--
--   `product_categories.parent_id`        مجلّدٌ داخل مجلّد
--   `stock_documents.reverses_document_id`  مستندُ عكسٍ يشير إلى أصله
--
-- وقاعدةُ الحذف على هذين المفتاحين **غيرُ مقيسةٍ عندنا**. و`NO ACTION` تُفحص
-- عند نهاية الجملة (فتمرّ)، و`RESTRICT` تُفحص فورًا (فترفض) — **والمخرَجان
-- مختلفان تمامًا لنفس الأمر.** فبدل التخمين: تُحذف الأوراقُ مرّةً بعد مرّة حتى
-- لا يبقى شيء. صحيحٌ تحت القراءتين، ولا يحتاج قياسًا.
--
-- ⚠️ **وللحلقة سقفٌ**، وليس زينة: دورةٌ في `parent_id` تجعل كلَّ صفٍّ أبًا لصفّ،
-- فلا يوجد ورقةٌ إطلاقًا و**الحلقةُ لا تنتهي** — أي أن أمرَ المحو *يعلّق* بدل
-- أن يفشل. والسقفُ يُخرجها، ثمّ يمسكها العدُّ البعديّ لأن الجدولَ لن يكون
-- فارغًا. **موقفان، وأيٌّ منهما وحدَه كافٍ.**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🔴 والعدُّ قبل وبعد، ومقارنةُ الفرق
-- ═══════════════════════════════════════════════════════════════════════════
--
-- لكلِّ جدولٍ من الثلاثةَ عشر: **العددُ قبل** (يُقاس هنا، لا يُكتب بيد) ·
-- **كم صفًّا حذفَته الجملة** (`ROW_COUNT`) · **والعددُ بعد** (يجب أن يكون صفرًا).
-- والثلاثةُ تُقارَن: `قبل = محذوف` و`بعد = 0`، وإلّا استثناءٌ يسمّي الجدول.
--
-- ⚠️ **و`DELETE 0` ينجح بصمت** تمامًا كـ`UPDATE 0` في ٠٨٦ب — وهنا أخطر: جدولٌ
-- لم يُمَسّ يبدو كجدولٍ كان فارغًا أصلًا. **العدُّ البعديّ هو الحارسُ الوحيد.**
--
-- ⚠️ **والمجموعُ يُقابَل بـ١٠٨** — الرقمُ الذي راجعه المالك في ٠٨٧_٢. وهو
-- **شاهدٌ لا مصدر**: إن اختلف، فالعالمُ تغيّر بين القياس والتنفيذ (منتجٌ أُدخل،
-- مستندٌ سُجّل)، **وأمرُ محوٍ لا يُستدرَك لا يُنفَّذ على عالمٍ غير الذي رُوجع.**
-- تعديلُ السطر واحدٌ إن كان التغييرُ معروفًا ومقبولًا.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ ثلاثُ ملاحظاتٍ من مراجعة ٠٨٧_٢، مسجَّلة
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ١. **`clients_audit_trigger` خارجُ النطاق تمامًا** — `clients` ليس من
--    الثلاثةَ عشر ولا يُمَسّ. ظهورُه في القسم D صحيحٌ (السؤالُ كان «كلُّ
--    مُشغِّلِ حذفٍ في `public`») **وغيرُ ذي صلةٍ بهذا الملفّ.**
--
-- ٢. 🔴 **والقسم C2 في ٠٨٧_٢ كان مكسورًا، ومخرَجُه يُهمَل.** قارن
--    `'public.' || name` بـ`rel::regclass::text` — و`regclass` **تُسقط اسمَ
--    المخطّط** حين يكون في `search_path`، فيرجّع `products` لا
--    `public.products`. ⇒ الشرطُ صادقٌ دائمًا، **والقسمُ يسمّي الثلاثةَ عشرَ
--    كلَّهم «مذكورٌ ولم يُكتشَف».** (والقسم C1 نجا بالمصادفة: شرطُه الثاني
--    يستعمل `replace(...)` فيطابق.)
--
--    **والعلاجُ نوعٌ لا نصّ:** تُقارَن مُعرِّفاتُ `regclass` نفسُها عبر
--    `to_regclass`، فلا دخلَ للتأهيل ولا لـ`search_path`. وهو المستعمَل في
--    القسم ⓪ أدناه.
--
-- ٣. **القسم C1 رجع فارغًا** — ولا جدولَ مكتشَفٌ خارجَ القائمة. وهذا يُعاد
--    التحقّقُ منه هنا لحظةَ التنفيذ لا يُؤخَذ من مخرَجٍ سابق، لأن بين القياس
--    والتنفيذ وقتًا.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ وما لا يُثبته
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `auth.uid()` فاضيةٌ بالمحرّر و**RLS متجاوَزةٌ بالكامل**، فالحذفُ هنا يمسّ
-- الجداولَ كلَّها بلا سياسة. وهذا **مقصود** — التصفيرُ للقاعدة لا لصالون —
-- لكنّه يُقال كي لا يُقرأ نجاحُه دليلًا على أن الشاشةَ تقدر تفعل مثلَه.
--
-- ⚠️ **ولا DDL هنا إطلاقًا.** ثلاثةَ عشرَ `DELETE` وحرّاسُها، كلُّها DML داخل
-- معاملةٍ واحدة — فكلُّ `RAISE` أدناه **يعيد كلَّ شيء كما كان**. الثلاثةَ عشرَ
-- تُمحى، أو لا يُمحى صفٌّ واحد.

do $$
declare
  v_before  jsonb := '{}'::jsonb;
  v_deleted jsonb := '{}'::jsonb;
  v_after   jsonb := '{}'::jsonb;
  v_n       bigint;
  v_total   bigint := 0;
  v_left    bigint := 0;
  v_step    int;
  v_salons  bigint;
  v_outside text;
  t         text;

  -- 🔴 الترتيبُ نفسُه، مرّةً واحدة: يقرأه العدُّ قبل وبعد، **وتتبعه أوامرُ
  -- الحذف المكتوبةُ سطرًا سطرًا تحت.** قائمتان تتباعدان يومًا؛ وهذه القائمةُ
  -- للقياس، وتلك للتنفيذ، **والحارسُ ⑤ يجعل اختلافَهما مستحيلَ المرور** لأنه
  -- يعدّ كلَّ اسمٍ فيها بعد الحذف ويطلبه صفرًا.
  c_tables constant text[] := array[
    'stock_fine_lines', 'stock_fines',
    'stocktake_counts', 'stocktake_sessions',
    'stock_movements',
    'stock_documents',
    'product_set_components', 'product_order_lines',
    'storage_categories',
    'storage_responsibles',
    'products', 'product_categories', 'storages'
  ];

  -- شاهدُ المراجعة. رقمُ ٠٨٧_٢ الذي قرأه المالك بعينه.
  c_reviewed_total constant bigint := 108;
begin

  -- ═════════════════════════════════════════════════════════════════════════
  -- ⓪ ولا جدولَ خارج القائمة يشير إلى الثلاثةَ عشر
  -- ═════════════════════════════════════════════════════════════════════════
  --
  -- 🔴 وقبله: كلُّ اسمٍ في القائمة يشير إلى جدولٍ موجود.
  --
  -- ⚠️ **وهذا ليس تدقيقًا زائدًا — بدونه يسكت الحارسُ ⓪ نفسُه.** `to_regclass`
  -- ترجع عدمًا لاسمٍ لا وجود له، و`x <> all (…, null, …)` تُقيَّم **UNKNOWN لا
  -- TRUE** — فيسقط الشرطُ كلُّه ويرجع الاستعلامُ صفرَ صفوفٍ **مهما كان هناك من
  -- جداولَ مشيرة.** أي أن حرفًا زائدًا في اسمٍ واحدٍ يُطفئ الحارسَ بصمت،
  -- ويُقرأ إطفاؤه «كلُّ شيءٍ سليم».
  --
  -- وهو **نفسُ صنف العطل الذي كسر C2 في ٠٨٧_٢**: شرطٌ يبدو صحيحًا ويُقيَّم
  -- دائمًا إلى نفس الجواب. ⇒ فالأسماءُ تُفحص أوّلًا، والفحصُ يفشل صاخبًا.
  foreach t in array c_tables loop
    if to_regclass('public.' || t) is null then
      raise exception '⛔ ما في جدولٌ اسمه «public.%» — والقائمةُ فيها اسمٌ غلط. والحارسُ اللي بيدوّر عالمشيرين بيسكت على قائمةٍ فيها عدم، فبيبان سليمًا وهو مطفأ. ولا صفٌّ انمحى.', t;
    end if;
  end loop;

  -- إعادةُ التحقّق من القسم C1 **لحظةَ التنفيذ**: بين القياس والتنفيذ وقت.
  -- والمقارنةُ بمُعرِّفات `regclass` لا بنصوصٍ مؤهَّلة — وهو تصحيحُ العطل الذي
  -- كسر C2.
  select string_agg(distinct con.conrelid::regclass::text, ' · ')
    into v_outside
  from pg_constraint con
  where con.contype = 'f'
    and con.connamespace = 'public'::regnamespace
    and con.confrelid = any (
      select to_regclass('public.' || x)::oid from unnest(c_tables) as x
    )
    and con.conrelid <> all (
      select to_regclass('public.' || x)::oid from unnest(c_tables) as x
    );

  if v_outside is not null then
    raise exception '⛔ في جداولُ خارج القائمة بتشير للثلاتة عشر: %. القائمةُ ناقصة — ولا صفٌّ انمحى.', v_outside;
  end if;

  -- ═════════════════════════════════════════════════════════════════════════
  -- ① صالونٌ واحد — وإلّا فالمحوُ يطال ما لم يُراجَع
  -- ═════════════════════════════════════════════════════════════════════════
  --
  -- المحرّرُ يتخطّى RLS فيرى كلَّ الصالونات، والحذفُ أدناه بلا `where`. فلو كان
  -- بالقاعدة صالونٌ ثانٍ له منتجات، لَمُحيت معها بلا أن يقصد ذلك أحد.
  select count(distinct salon_id) into v_salons from public.products;
  if v_salons > 1 then
    raise exception '⛔ في أكتر من صالونٍ عنده منتجات (العدد: %) — والحذفُ أدناه بلا `where`. وقّف. ولا صفٌّ انمحى.', v_salons;
  end if;

  -- ═════════════════════════════════════════════════════════════════════════
  -- ② العدُّ قبل — يُقاس، ولا يُكتب بيد
  -- ═════════════════════════════════════════════════════════════════════════
  foreach t in array c_tables loop
    execute format('select count(*) from public.%I', t) into v_n;
    v_before := v_before || jsonb_build_object(t, v_n);
    v_total := v_total + v_n;
  end loop;

  if v_total <> c_reviewed_total then
    raise exception '⛔ المجموعُ الآن % والمُراجَعُ بـ٠٨٧_٢ كان %. العالمُ تغيّر بين القياس والتنفيذ، وأمرُ محوٍ ما بينُستدرك ما بينشغّل على عالمٍ غير اللي انراجع. شغّل ٠٨٧_٢ من جديد وابعت الفرق. ولا صفٌّ انمحى. التفصيل: %',
      v_total, c_reviewed_total, v_before::text;
  end if;

  -- ═════════════════════════════════════════════════════════════════════════
  -- ③ الحذف — ثلاثةَ عشرَ أمرًا، مكتوبةً سطرًا سطرًا وبالترتيب
  -- ═════════════════════════════════════════════════════════════════════════

  delete from public.stock_fine_lines;
  get diagnostics v_n = row_count;  v_deleted := v_deleted || jsonb_build_object('stock_fine_lines', v_n);

  delete from public.stock_fines;
  get diagnostics v_n = row_count;  v_deleted := v_deleted || jsonb_build_object('stock_fines', v_n);

  delete from public.stocktake_counts;
  get diagnostics v_n = row_count;  v_deleted := v_deleted || jsonb_build_object('stocktake_counts', v_n);

  delete from public.stocktake_sessions;
  get diagnostics v_n = row_count;  v_deleted := v_deleted || jsonb_build_object('stocktake_sessions', v_n);

  -- 🔴 قبل `storage_categories` — قاعدةٌ مكتوبةٌ هنا لا نتيجةُ حسابِ عمق.
  -- المُشغِّلُ يقرأ `product_balances`، والرصيدُ مجموعُ هذه الحركات. فما دامت
  -- موجودةً، كلُّ حذفٍ من جدول الربط يُرفض برسالةٍ عن «بضاعة» داخل سكربت تصفير.
  delete from public.stock_movements;
  get diagnostics v_n = row_count;  v_deleted := v_deleted || jsonb_build_object('stock_movements', v_n);

  -- مستندٌ يشير إلى مستند: من الأوراق إلى الجذر (انظر الترويسة).
  v_step := 0;
  loop
    v_step := v_step + 1;
    delete from public.stock_documents d
     where not exists (select 1 from public.stock_documents k where k.reverses_document_id = d.id);
    get diagnostics v_n = row_count;
    v_deleted := v_deleted || jsonb_build_object(
      'stock_documents', coalesce((v_deleted->>'stock_documents')::bigint, 0) + v_n);
    exit when v_n = 0 or v_step > 50;
  end loop;

  delete from public.product_set_components;
  get diagnostics v_n = row_count;  v_deleted := v_deleted || jsonb_build_object('product_set_components', v_n);

  delete from public.product_order_lines;
  get diagnostics v_n = row_count;  v_deleted := v_deleted || jsonb_build_object('product_order_lines', v_n);

  -- ⚠️ بعد `stock_movements`. الرصيدُ صار صفرًا فالمُشغِّلُ لا يجد ما يرفض
  -- لأجله — وهو يعمل، لم يُعطَّل.
  delete from public.storage_categories;
  get diagnostics v_n = row_count;  v_deleted := v_deleted || jsonb_build_object('storage_categories', v_n);

  delete from public.storage_responsibles;
  get diagnostics v_n = row_count;  v_deleted := v_deleted || jsonb_build_object('storage_responsibles', v_n);

  delete from public.products;
  get diagnostics v_n = row_count;  v_deleted := v_deleted || jsonb_build_object('products', v_n);

  -- مجلّدٌ داخل مجلّد: من الأوراق إلى الجذر (انظر الترويسة).
  v_step := 0;
  loop
    v_step := v_step + 1;
    delete from public.product_categories c
     where not exists (select 1 from public.product_categories k where k.parent_id = c.id);
    get diagnostics v_n = row_count;
    v_deleted := v_deleted || jsonb_build_object(
      'product_categories', coalesce((v_deleted->>'product_categories')::bigint, 0) + v_n);
    exit when v_n = 0 or v_step > 50;
  end loop;

  delete from public.storages;
  get diagnostics v_n = row_count;  v_deleted := v_deleted || jsonb_build_object('storages', v_n);

  -- ═════════════════════════════════════════════════════════════════════════
  -- ④ العدُّ بعد — وهو الحارسُ الوحيد على `DELETE 0`
  -- ═════════════════════════════════════════════════════════════════════════
  foreach t in array c_tables loop
    execute format('select count(*) from public.%I', t) into v_n;
    v_after := v_after || jsonb_build_object(t, v_n);
    v_left := v_left + v_n;
  end loop;

  -- ═════════════════════════════════════════════════════════════════════════
  -- ⑤ المقارنةُ الثلاثيّة، جدولًا جدولًا
  -- ═════════════════════════════════════════════════════════════════════════
  foreach t in array c_tables loop
    if (v_after->>t)::bigint <> 0 then
      raise exception '⛔ الجدول «%» لسّه فيه صفوف بعد الحذف (العدد: %). ولا صفٌّ انمحى — المعاملةُ رجعت كلَّها. قبل: % · محذوف: %',
        t, (v_after->>t)::bigint, (v_before->>t)::text, coalesce(v_deleted->>t, '—');
    end if;

    if coalesce((v_deleted->>t)::bigint, -1) <> (v_before->>t)::bigint then
      raise exception '⛔ الجدول «%» — الصفوفُ اللي كانت فيه: % · والمحذوف: %. و`DELETE 0` بينجح بصمت، فهاد الحارسُ عليه. ولا صفٌّ انمحى.',
        t, (v_before->>t)::text, coalesce(v_deleted->>t, 'ولا أمرَ حذفٍ مسّه');
    end if;
  end loop;

  if v_left <> 0 then
    raise exception '⛔ ضلّت صفوفٌ بالمجموع (العدد: %). ولا صفٌّ انمحى.', v_left;
  end if;

end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- القراءةُ الراجعة — بسيطةٌ لدرجة ما تقدر تفشل
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ بنفس معاملة الحذف، فأيُّ فشلٍ فيها **يُرجع المحوَ ويبلّغ عن نفسه هو**.
-- فلا تجميعَ معقّد ولا تحويلَ نوعٍ ولا `||` على ما قد يكون عدمًا.
--
-- المتوقَّع: ثلاثةَ عشرَ صفًّا، كلُّها `0`. وصفٌّ أخيرٌ يقول كم رأسَ طلبيّةٍ بقي
-- بلا سطور — **حالةٌ مشروعةٌ ومقصودة** (`product_orders` خارج النطاق بقرارك)،
-- تُعرض كي لا تُكتشَف لاحقًا كأنها عطل.

select 'stock_fine_lines'::text as table_name, count(*) as rows_left from public.stock_fine_lines
union all select 'stock_fines', count(*) from public.stock_fines
union all select 'stocktake_counts', count(*) from public.stocktake_counts
union all select 'stocktake_sessions', count(*) from public.stocktake_sessions
union all select 'stock_movements', count(*) from public.stock_movements
union all select 'stock_documents', count(*) from public.stock_documents
union all select 'product_set_components', count(*) from public.product_set_components
union all select 'product_order_lines', count(*) from public.product_order_lines
union all select 'storage_categories', count(*) from public.storage_categories
union all select 'storage_responsibles', count(*) from public.storage_responsibles
union all select 'products', count(*) from public.products
union all select 'product_categories', count(*) from public.product_categories
union all select 'storages', count(*) from public.storages
union all select '— رؤوس طلبيّاتٍ بقيت بلا سطور (خارج النطاق بقرارك)', count(*) from public.product_orders
order by 1;

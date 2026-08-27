-- 111 -- هل كائناتُ ٠٧٩أ و٠٩٤ حاضرةٌ في القاعدة؟
--
-- ==========================================================================
-- 🔴 قراءةٌ محضة. لا `create` ولا `alter` ولا `drop` ولا `insert` ولا
--    `update` ولا `delete` — ولا كتلةَ `do`. جملةُ `select` واحدةٌ لا غير،
--    فمحرّرُ Supabase يعرض آخرَ مجموعةِ نتائجَ وحدَها.
--
-- 🔴 ورقمُه ١١١ لا ١١٠: السكربت ١١٠ عاش في `/tmp` ولم يُودَع قطّ، فالفجوةُ
--    في الترقيم هي أثرُ الخرق لا خطأً في العدّ. (البند ١٠)
-- ==========================================================================
--
-- ── لماذا يوجد هذا الملفّ ──────────────────────────────────────────────────
--
-- سطرُ الحالة في `docs/sql/README.md` يقول عن ٠٧٩أ و٠٩٤ «⏸ بانتظار التشغيل»
-- و«⏸ معلَّق»، **وثلاثُ قرائنَ مستقلّةٍ تقول إنّهما جريا**:
--
--   ٠٧٩أ  ⟵ متحقِّقوه الثلاثة (٠٧٩ب_٢ · ٠٧٩ب_٣ · ٠٧٩ب_٤) مسجَّلون «✅ شُغّل»،
--            وهم يقرأون المنظورَ الذي يُنشئه هو.
--   ٠٩٤   ⟵ `CLAUDE.md:43` يسمّيه منفَّذًا ومؤكَّدًا من المالك، و٠٩٤ج و٠٩٥
--            مسجَّلان «✅ شُغّل» وهما يعملان على ما يُنشئه.
--
-- 🔴 والقرينةُ ليست تشغيلًا. وحالةُ التشغيل تُكتب لحظةَ تأكيد المالك ولا
--    تُستنتج — فهذا الملفُّ يقيس **حضورَ الأثر**، ولا يترجمه «شُغّل».
--
-- ── ⚠️ حدُّ ما يقوله هذا الملفّ، مكتوبًا قبل تشغيله لا بعده ────────────────
--
-- **حضورُ الكائن لا يُثبت هويّةَ فاعله.** والحكمُ الأقصى الذي يخرج من هنا هو
-- «الأثرُ حاضر»، وترجمتُه إلى «شُغّل» تبقى تأكيدَ المالك وحدَه. وثلاثةُ
-- أسبابٍ مقيسةٍ تجعل هذا الحدَّ شرطًا لا تواضعًا:
--
--   ① `create or replace` و`create … if not exists` لا تفرّق بين إنشاءٍ
--      وإعادةِ كتابة. فحضورُ المنظور لا يقول أيُّ نسخةٍ كتبته.
--   ② `freeze_consignment_after_use` **تسبق هذا المشروعَ كلَّه** — مكتوبٌ في
--      `CLAUDE.md` أنّها إحدى دالّتين تسبقانه وعربيُّهما سليمٌ داخل جسمَيهما.
--      ⇒ **فحضورُها والمشغِّلُ عليها ليس بيّنةً على ٠٧٩أ إطلاقًا**، ويُقرأ
--      صفَّين للسياق لا للحكم.
--   ③ ولملفَّي السؤال أكثرُ من نسخةٍ في التاريخ — ٠٧٩أ **ستُّ نسخ** و٠٩٤
--      **نسختان** (`git log` على الملفّين) ⇒ **فحتّى لو جريا، أيُّ نسخةٍ
--      جرت غيرُ معروفة، ولا يقولها هذا الاستعلام ولا أيُّ استعلام.**
--
-- ── 🔴 وأربعةُ صفوفٍ تقول `t` صادقةً ولا تُقرأ بيّنة ───────────────────────
--
-- **حدُّ كلٍّ منها مكتوبٌ في خانة `note` في المخرَج نفسِه، لا هنا وحدَه** —
-- فمن يقرأ المخرَجَ بعد شهرٍ لا يفتح هذه الترويسة.
--
--   (70) `rls`          ⟵ `relrowsecurity = true` مقيسةٌ على ٤٨ من ٤٨ جدولًا
--   (73)(74) `grant`    ⟵ `has_table_privilege` تصدق عن أيّ طريق: منحٌ مباشرٌ
--                          أو وراثةُ دورٍ أو `PUBLIC` — والصلاحيّاتُ ممنوحةٌ
--                          على كلّ جدولٍ في `public` (ADR-054)
--   (80) `comment_rel`  ⟵ ٠٩٤ج يكتب التعليقَ نفسَه (٠٩٤:٢٠٤ · ٠٩٤ج:٧٤)
--
-- ⇒ **الأربعةُ تقول `t` سواءٌ جرى ٠٩٤ أم لم يجرِ، فهي خبرٌ لا بيّنة.**
--
-- ── وشاهدا الصدق، صفّان بلا سؤالٍ عنهما (البند ١ج) ────────────────────────
--
--   `public.stock_movements`   ⟵ نعرف أنّه موجود  ⇒ **يجب أن يقول `t`**
--   `public.__no_such_table__` ⟵ نعرف أنّه غائب   ⇒ **يجب أن يقول `f`**
--
-- 🔴 **فإن جاء أحدُهما على غير ذلك، فالمخرَجُ كلُّه ساقطٌ ولا يُقرأ منه شيء**
--    — قبل أن يُنظر إلى أيّ صفٍّ آخر.
--
-- ⚠️ **وحدُّ هذا الشرط: هو لقاعدة المالك وحدَها.** على قاعدةٍ فارغةٍ يُشغَّل
--    فيها الملفُّ لاختبار نحوِه، يقول الشاهدُ الأوّل `f` **وهو الصواب** —
--    لأنّ `stock_movements` ليس فيها أصلًا. ⇒ **فالمقصودُ هناك أنّه لم
--    ينفجر، لا أنّ الشاهدَ أخضر.**
--
-- ── وحارسٌ ثالثٌ في المخرَج: الصفُّ ٩٩٩ ────────────────────────────────────
--
-- `case` بلا فرعٍ مطابقٍ يُرجع العدم، **والعدمُ يُعرض خانةً فارغةً فيُقرأ
-- «لا» لا «مجهول».** ⇒ **فالصفُّ الأخير يعدّ الصفوفَ التي لم يُحسب حكمُها،
-- والمنتظَرُ `عددُها: 0`** — وأيُّ رقمٍ غيره يعني نوعًا كُتب خطأً في القائمة.
--
-- ── ماذا يعني كلُّ احتمال — مكتوبًا قبل التشغيل ────────────────────────────
--
--   (أ) كلُّ صفوف ٠٩٤ `t` وكلُّ صفوف ٠٧٩أ `t`
--       ⟹ أثرُ الاثنين حاضرٌ كاملًا. **يُرسَل إلى المالك سؤالُ تأكيدٍ واحدٌ
--          لا أكثر، ويُكتب جوابُه في سطر الحالة.**
--
--   (ب) صفوفُ ٠٩٤ `t` وصفُّ المنظور `f`
--       ⟹ ٠٧٩أ لم يجرِ (أو أثرُه أُزيل). **وسطرُه يبقى كما هو، ويُسجَّل أنّ
--          متحقِّقيه الثلاثةَ الخضرَ يحتاجون تفسيرًا.**
--
--   (ج) بعضُ صفوف سكربتٍ واحدٍ `t` وبعضُها `f`
--       🔴 **حالةٌ لا مفردةَ لها في قائمة الحالات، فعلُها «يُكمَّل ما نقص».**
--          **ولا تُضاف إلى القائمة قبل أن تقع** — القائمةُ تُقفل على ما
--          وُجد لا على ما يُتصوَّر.
--          ⇒ **يُبلَّغ الناقصُ باسمه ولا يُشغَّل شيء.**
--
--   (د) صفَّا الدالّة والمشغِّل `t` وصفُّ المنظور `f`
--       ⟹ **يؤكّد ② أعلاه**: الاثنان يسبقان ٠٧٩أ، فلا يُقرآن بيّنةً له.
--
-- ── مصدرُ قائمة الكائنات ─────────────────────────────────────────────────
--
-- مستخرَجةٌ من ترويسات `create`/`alter`/`comment`/`grant` في نصَّي الملفّين
-- وحدَهما — لا من سطر الوصف في `README.md`، ولا من الذاكرة. (البند ٤ب)
--
--   ٠٧٩أ : docs/sql/079a-live-documents-and-consignment-freeze.sql
--   ٠٩٤  : docs/sql/094_stock_lots.sql
--
-- ==========================================================================

with q as (

select
  e.ord,
  e.script,
  e.kind,
  case when e.parent = '' then '—' else e.parent end as on_what,
  e.obj,
  case e.kind

    -- 🔴 `to_regclass` يرى كلَّ ما في `pg_class` — جدولًا ومنظورًا وفهرسًا
    --    ومتتالية. فالنوعُ يُقيَّد بـ`relkind`، وإلّا قِيس حضورُ الاسم لا
    --    حضورُ الكائن.
    when 'table' then
      exists (
        select 1 from pg_class c
        where c.oid = to_regclass('public.' || e.obj)
          and c.relkind in ('r', 'p')
      )

    when 'view' then
      exists (
        select 1 from pg_class c
        where c.oid = to_regclass('public.' || e.obj)
          and c.relkind in ('v', 'm')
      )

    when 'index' then
      exists (
        select 1 from pg_class c
        where c.oid = to_regclass('public.' || e.obj)
          and c.relkind = 'i'
      )

    -- ⚠️ من `pg_attribute` لا من `information_schema`: الأخيرةُ تُخفي ما لا
    --    يملك الدورُ عليه صلاحيّة، وبقيّةُ الملفّ تقرأ من `pg_catalog`.
    when 'column' then
      exists (
        select 1 from pg_attribute a
        where a.attrelid = to_regclass('public.' || e.parent)
          and a.attname  = e.obj
          and a.attnum   > 0
          and not a.attisdropped
      )

    when 'constraint' then
      exists (
        select 1 from pg_constraint k
        where k.conname  = e.obj
          and k.conrelid = to_regclass('public.' || e.parent)
      )

    when 'policy' then
      exists (
        select 1 from pg_policies p
        where p.schemaname = 'public'
          and p.tablename  = e.parent
          and p.policyname = e.obj
      )

    -- 🔴 هويّةُ الدالّة اسمُها **وتوقيعُها** (البند ٥): دالّةٌ بالاسم نفسِه
    --    ومعاملاتٍ أخرى تُعطي `t` كاذبة. و٠٧٩أ:١٧٨ يكتبها بلا معاملات.
    when 'function' then
      exists (
        select 1 from pg_proc pr
        join pg_namespace n on n.oid = pr.pronamespace
        where n.nspname = 'public'
          and pr.proname = e.obj
          and pg_get_function_identity_arguments(pr.oid) = ''
      )

    when 'trigger' then
      exists (
        select 1 from pg_trigger t
        where t.tgname   = e.obj
          and t.tgrelid  = to_regclass('public.' || e.parent)
          and not t.tgisinternal
      )

    when 'rls' then
      coalesce((
        select c.relrowsecurity from pg_class c
        where c.oid = to_regclass('public.' || e.parent)
      ), false)

    -- 🔴 `has_table_privilege` **ترفع خطأً** على دورٍ غيرِ موجود، فتُسقط
    --    الاستعلامَ كلَّه — لا تُرجع `false`. وشرطُ الجدول وحدَه يستر ذلك
    --    ما دام الجدولُ غائبًا، **ويزول السترُ حيث يُشغَّل فعلًا.**
    -- ✅ و`null` لا `false` عند غياب الدور: ذلك «لم يُقَس» لا «لا صلاحيّة»
    --    — والصفُّ ٩٩٩ يلتقطه ويُعلن عددَه.
    when 'grant' then
      case
        when not exists (
          select 1 from pg_roles where rolname = 'authenticated'
        ) then null
        when to_regclass('public.' || e.parent) is null then false
        else has_table_privilege('authenticated', 'public.' || e.parent, e.obj)
      end

    -- ⚠️ بوستجرس ينمّط القيمَ المنطقيّة، فتُقبل `=on` كما `=true`.
    --    و`f` هنا «ليست بهذه الصيغة» لا «الخاصّيّةُ غائبة».
    when 'view_option' then
      coalesce((
        select c.reloptions && array[e.obj, replace(e.obj, '=true', '=on')]
        from pg_class c
        where c.oid = to_regclass('public.' || e.parent)
      ), false)

    -- 🔴 بمعاملين: الصيغةُ أحاديّةُ المعامل تبحث في أكثرَ من كتالوج.
    when 'comment_rel' then
      (obj_description(to_regclass('public.' || e.parent), 'pg_class')
         is not null)

    when 'comment_col' then
      coalesce((
        select col_description(a.attrelid, a.attnum) is not null
        from pg_attribute a
        where a.attrelid = to_regclass('public.' || e.parent)
          and a.attname  = e.obj
          and a.attnum   > 0
      ), false)

    when 'comment_fn' then
      exists (
        select 1 from pg_proc pr
        join pg_namespace n on n.oid = pr.pronamespace
        where n.nspname = 'public'
          and pr.proname = e.obj
          and pg_get_function_identity_arguments(pr.oid) = ''
          and obj_description(pr.oid, 'pg_proc') is not null
      )

    -- 🔴 صريحًا: نوعٌ يُخطأ كتابتُه غدًا يُرجع العدمَ فيعدُّه الصفُّ ٩٩٩.
    else null

  end as present,
  e.note

from (values

  -- ── شاهدا الصدق ────────────────────────────────────────────────────────
  (  1, 'شاهد', 'table', '', 'stock_movements',
     'يجب t — وإلّا فالمخرَجُ كلُّه ساقط'),
  (  2, 'شاهد', 'table', '', '__no_such_table__',
     'يجب f — وإلّا فالاستعلامُ يقول t عن كلّ شيء'),

  -- ── ٠٧٩أ ───────────────────────────────────────────────────────────────
  ( 10, '079a', 'view',        '',                        'stock_document_liveness',
     'الكائنُ المميِّزُ الوحيد لهذا الملفّ'),
  ( 11, '079a', 'view_option', 'stock_document_liveness', 'security_invoker=true',
     '⚠️ f = ليست بهذه الصيغة، لا الخاصّيّةُ غائبة'),
  ( 12, '079a', 'comment_rel', 'stock_document_liveness', '(تعليقُ المنظور)',
     'عربيٌّ مشحونٌ يُقرأ راجعًا'),
  ( 13, '079a', 'function',    '',                        'freeze_consignment_after_use',
     'تسبق المشروعَ — سياقٌ لا بيّنة'),
  ( 14, '079a', 'comment_fn',  '',                        'freeze_consignment_after_use',
     'سياقٌ لا بيّنة'),
  ( 15, '079a', 'trigger',     'products',                'freeze_consignment_after_use',
     'الاسمُ بلا بادئة — والمزدوجُ trg_… من عهدٍ سابق'),

  -- ── ٠٩٤ — القيود على الجداول القائمة ───────────────────────────────────
  ( 20, '094', 'constraint', 'storages',        'storages_id_salon_key',        ''),
  ( 21, '094', 'constraint', 'products',        'products_id_salon_key',        ''),
  ( 22, '094', 'constraint', 'stock_documents', 'stock_documents_id_salon_key', ''),

  -- ── ٠٩٤ — جدولُ الدفعة وأعمدتُه التسعة ─────────────────────────────────
  ( 30, '094', 'table',  '',           'stock_lots',          'مؤكَّدٌ حاضرًا سلفًا'),
  ( 31, '094', 'column', 'stock_lots', 'id',                  ''),
  ( 32, '094', 'column', 'stock_lots', 'salon_id',            ''),
  ( 33, '094', 'column', 'stock_lots', 'storage_id',          ''),
  ( 34, '094', 'column', 'stock_lots', 'product_id',          ''),
  ( 35, '094', 'column', 'stock_lots', 'source_document_id',  ''),
  ( 36, '094', 'column', 'stock_lots', 'unit_cost',           ''),
  ( 37, '094', 'column', 'stock_lots', 'cost_is_estimated',   ''),
  ( 38, '094', 'column', 'stock_lots', 'received_at',         ''),
  ( 39, '094', 'column', 'stock_lots', 'created_at',          ''),

  -- ── ٠٩٤ — قيودُ جدول الدفعة ────────────────────────────────────────────
  ( 40, '094', 'constraint', 'stock_lots', 'stock_lots_id_salon_key', ''),
  ( 41, '094', 'constraint', 'stock_lots', 'stock_lots_storage_fkey', ''),
  ( 42, '094', 'constraint', 'stock_lots', 'stock_lots_product_fkey', ''),
  ( 43, '094', 'constraint', 'stock_lots', 'stock_lots_document_fkey', ''),

  -- ⚠️ قيدان مضمَّنان **سمّاهما بوستجرس لا الملفّ** (٠٩٤:٩٤ `primary key` ·
  --    ٠٩٤:١١٠ `check (unit_cost >= 0)`) — وهو الصنفُ الرابعُ في البند ٤ب.
  -- 🔴 فالاسمان أدناه عرفُ بوستجرس لا نصٌّ مقروء ⇒ **`f` عندهما يعني «ليس
  --    بهذا الاسم»، لا «القيدُ غائب»** — ويُقرآن بهذا الحدّ أو لا يُقرآن.
  ( 44, '094', 'constraint', 'stock_lots', 'stock_lots_pkey',
     '⚠️ اسمٌ مولَّد — f يعني «ليس بهذا الاسم»'),
  ( 45, '094', 'constraint', 'stock_lots', 'stock_lots_unit_cost_check',
     '⚠️ اسمٌ مولَّد — f يعني «ليس بهذا الاسم»'),

  -- ── ٠٩٤ — ربطُ الحركة بدفعتها ──────────────────────────────────────────
  ( 50, '094', 'column',     'stock_movements', 'lot_id',
     'مؤكَّدٌ حاضرًا سلفًا'),
  ( 51, '094', 'constraint', 'stock_movements', 'stock_movements_lot_fkey', ''),

  -- ── ٠٩٤ — الفهارس ──────────────────────────────────────────────────────
  ( 60, '094', 'index', '', 'stock_lots_fifo_idx',     ''),
  ( 61, '094', 'index', '', 'stock_movements_lot_idx', ''),
  ( 62, '094', 'index', '', 'stock_lots_document_idx', ''),

  -- ── ٠٩٤ — العزل والمنح ─────────────────────────────────────────────────
  ( 70, '094', 'rls',    'stock_lots', '(row level security)',
     '🔴 خبرٌ لا بيّنة — قائمٌ على ٤٨ من ٤٨ جدولًا'),
  ( 71, '094', 'policy', 'stock_lots', 'stock_lots_select',    ''),
  ( 72, '094', 'policy', 'stock_lots', 'stock_lots_insert',    ''),
  ( 73, '094', 'grant',  'stock_lots', 'select',
     '🔴 خبرٌ لا بيّنة — يصدق عن أيّ طريق منحٍ أو وراثةِ دور'),
  ( 74, '094', 'grant',  'stock_lots', 'insert',
     '🔴 خبرٌ لا بيّنة — يصدق عن أيّ طريق منحٍ أو وراثةِ دور'),

  -- ── ٠٩٤ — التعليقات العربيّة ───────────────────────────────────────────
  ( 80, '094', 'comment_rel', 'stock_lots',      '(تعليقُ الجدول)',
     '🔴 خبرٌ لا بيّنة — يكتبه ٠٩٤ج أيضًا'),
  ( 81, '094', 'comment_col', 'stock_lots',      'unit_cost',         ''),
  ( 82, '094', 'comment_col', 'stock_lots',      'cost_is_estimated', ''),
  ( 83, '094', 'comment_col', 'stock_lots',      'received_at',       ''),
  ( 84, '094', 'comment_col', 'stock_movements', 'lot_id',            '')

) as e(ord, script, kind, parent, obj, note)

)

select ord, script, kind, on_what, obj, present, note from q

union all

select
  999,
  'حارس',
  'nulls',
  '—',
  '(صفوفٌ لم يُحسب حكمُها)',
  null::boolean,
  'المنتظَر 0 — والعدد: '
    || (select count(*) from q where q.present is null)::text

order by ord;

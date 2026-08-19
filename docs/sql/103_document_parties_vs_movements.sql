-- ١٠٣ — «من/إلى» كما تحسبها الشاشة، بجانب اتّجاه الحركات الفعليّ.
--
-- **قراءةٌ فقط. ولا `DDL` ولا كتابةَ صفٍّ واحد** — فما فيه شيءٌ يمكن أن يتراجع،
-- والبند ١ لا يمسّه. **وجملةُ `select` واحدة**، لأن محرّرَ Supabase يعرض
-- مجموعةَ النتائج الأخيرة وحدَها **ويبتلع ما قبلها بصمت.**
--
-- ⚠️ **و`auth.uid()` فارغةٌ في المحرّر وRLS متجاوَزةٌ بالكامل هناك.** وهنا في
-- صالحنا: تُرى مستنداتُ كلّ الصالونات. **ولا يثبت هذا شيئًا عن العزل.**
--
-- ══════════════════════════════════════════════════════════════════════
-- لماذا هذا السكربت
-- ══════════════════════════════════════════════════════════════════════
--
-- 🔴 **عُرض اتّجاهُ العكس مقلوبًا، وشُحن.** `reverse_stock_document` **تنسخ
-- `storage_id` و`to_storage_id` كما هما وتنفي `quantity_base` وحدَه** — فعكسُ
-- نقلٍ من أ إلى ب يحمل في صفّه `storage=أ, to=ب` **والبضاعةُ ذهبت ب ⟶ أ.**
--
-- والشاشةُ صُحِّحت (يُقرأ الأصلُ عبر `reverses_document_id` وتُقلَب أطرافُه)
-- **وحارسٌ دائمٌ يقارن الترويسةَ بإشارات السطور.** ⚠️ **لكنّ الحارسَ يقرأ
-- المستودعَ لا القاعدة** — فهذا الملفُّ هو القراءةُ الراجعةُ من الصفوف الحقيقيّة.
--
-- ══════════════════════════════════════════════════════════════════════
-- شاهدُ الصدق — مبنيٌّ في شكل السؤال لا مضافٌ إليه
-- ══════════════════════════════════════════════════════════════════════
--
-- ⚠️ **لو سأل هذا الملفُّ عن مستندات العكس وحدَها، لكانت النتيجةُ الفارغةُ
-- تعني شيئين لا يفترقان:** «لا عكسَ بعد» **أو** «الاستعلامُ لم يصل الجدول».
--
-- ⇒ **فهو يسرد كلَّ مستندٍ**، والعكسُ صنفٌ منها. **فصفرُ صفوفٍ يعني الجدولَ
-- فارغًا** — وهو ادّعاءٌ قابلٌ للتكذيب، بخلاف الصمت. **ويُنتظَر ١٣ صفًّا** بحسب
-- ما قاسه ١٠٢ (`docs_total`)، فعددٌ أقلُّ خبرٌ بحدّ ذاته.
--
-- ══════════════════════════════════════════════════════════════════════
-- كيف يُقرأ المخرَج
-- ══════════════════════════════════════════════════════════════════════
--
--   party_from · party_to      ما **يجب** أن ترسمه الشاشةُ الآن على هذا الصفّ
--   movement_flow              الحقيقةُ من `stock_movements`: مستودعٌ ودخولُه
--   verdict                    مقارنةُ الاثنين آليًّا
--
--   ✅ ok                       الداخلُ في «إلى» والخارجُ في «من»
--   🔴 MISMATCH…                الترويسةُ تخالف الحركات ⟵ العطلُ لم يُصلَح
--   ⓘ no-direction             جردٌ — الاتّجاهُ سطريٌّ لا مستنديّ، فلا ادّعاء
--   ⓘ no-movements             مستندٌ بلا سطور
--
-- ⚠️ **والمقارنةُ تُجرى على طرفِ المستودع وحدَه** — المورّدُ ليس مستودعًا ولا
-- حركةَ له، **فطلبُ حركةٍ له طلبٌ لشيءٍ لا يوجد.** وأوّلُ صياغةٍ للحارس المكافئ
-- في الحزمة نسيت ذلك **فعضّت كودًا سليمًا.**
--
-- ⚠️ **و`suppliers.name` مستعملةٌ هنا بقياسٍ لا بقراءةِ مخطَّط:** الخريطةُ
-- تسرد `name` (`:496`) **وحاشيةٌ في نفس الملفّ تذكر `first_name`/`last_name`**
-- عن جدولٍ آخر. **والحاسمُ أن الشاشةَ ترسم أسماءَ المورّدين فعلًا** عبر
-- `nameOf(suppliers, id)` التي تقرأ `.name`، و`select('*')` هو ما يحمّلها —
-- **فلو كان العمودُ باسمٍ آخرَ لظهرت شرطةٌ مكان كلّ مورّدٍ في لقطات المالك.**
--
-- ⚠️ **وصفوفُ هذه القاعدة اختباريّة** — فهي تجيب «هل الاتّجاه صحيح؟» **ولا
-- تجيب سؤالَ تواتُرٍ أبدًا.**

with net as (
  -- صافي كلّ (مستند، مستودع). الجمعُ ضروريٌّ لأن المستندَ ينقسم حركةً لكلّ
  -- دفعةٍ بعد ٠٩٥، **فمستودعٌ واحدٌ له عدّةُ صفوفٍ بنفس الاتّجاه.**
  select m.document_id, m.storage_id, sum(m.quantity_base) as qty
    from public.stock_movements m
   group by m.document_id, m.storage_id
),
flow as (
  select n.document_id,
         string_agg(
           coalesce(st.name, '(مستودعٌ محذوف)') || ' ' ||
           case when n.qty > 0 then 'داخل' when n.qty < 0 then 'خارج' else 'صفر' end,
           ' · ' order by st.name
         ) as movement_flow,
         max(case when n.qty > 0 then st.name end) as in_storage,
         max(case when n.qty < 0 then st.name end) as out_storage,
         count(*) as storage_rows
    from net n
    left join public.storages st on st.id = n.storage_id
   group by n.document_id
),
base as (
  -- أطرافُ المستند غيرِ العاكس — **نفسُ شروط `documentParties` بنفس الترتيب.**
  select d.id,
         d.doc_type,
         d.doc_date,
         d.doc_number,
         d.reverses_document_id,
         (d.doc_type <> 'stocktake') as directional,
         case
           when d.doc_type = 'stocktake'                 then sf.name
           when d.to_storage_id is not null              then sf.name
           when d.supplier_id is not null
                and d.doc_type = 'supply'                then sup.name
           when d.supplier_id is not null
                and d.doc_type = 'return_to_supplier'    then sf.name
           when d.doc_type in ('supply', 'opening')      then null
           else                                               sf.name
         end as party_from,
         case
           when d.doc_type = 'stocktake'                 then null
           when d.to_storage_id is not null              then stt.name
           when d.supplier_id is not null
                and d.doc_type = 'supply'                then sf.name
           when d.supplier_id is not null
                and d.doc_type = 'return_to_supplier'    then sup.name
           when d.doc_type in ('supply', 'opening')      then sf.name
           else                                               null
         end as party_to,
         -- أيُّ طرفٍ مستودعٌ وأيُّه مورّد — **وهو ما يجعل المقارنةَ ممكنةً
         -- على النصف الذي تعرفه الحركاتُ وحدَه.**
         case
           when d.doc_type = 'stocktake'                 then 'storage'
           when d.to_storage_id is not null              then 'storage'
           when d.supplier_id is not null
                and d.doc_type = 'supply'                then 'supplier'
           when d.supplier_id is not null
                and d.doc_type = 'return_to_supplier'    then 'storage'
           when d.doc_type in ('supply', 'opening')      then null
           else                                               'storage'
         end as from_kind,
         case
           when d.doc_type = 'stocktake'                 then null
           when d.to_storage_id is not null              then 'storage'
           when d.supplier_id is not null
                and d.doc_type = 'supply'                then 'storage'
           when d.supplier_id is not null
                and d.doc_type = 'return_to_supplier'    then 'supplier'
           when d.doc_type in ('supply', 'opening')      then 'storage'
           else                                               null
         end as to_kind
    from public.stock_documents d
    left join public.storages  sf  on sf.id  = d.storage_id
    left join public.storages  stt on stt.id = d.to_storage_id
    left join public.suppliers sup on sup.id = d.supplier_id
),
shown as (
  -- العاكسُ يأخذ أطرافَ أصله **مقلوبةً**؛ وغيرُه يأخذ أطرافَه هو.
  select b.id, b.doc_type, b.doc_date, b.doc_number, b.reverses_document_id,
         o.doc_type as orig_type,
         o.party_from as orig_from, o.party_to as orig_to,
         case
           when b.reverses_document_id is null then b.directional
           when o.id is null                   then false   -- أصلٌ مفقود: لا ادّعاء
           else o.directional
         end as directional,
         case
           when b.reverses_document_id is null then b.party_from
           when o.id is null                   then b.party_from
           when o.directional                  then o.party_to
           else o.party_from
         end as party_from,
         case
           when b.reverses_document_id is null then b.party_to
           when o.id is null                   then b.party_to
           when o.directional                  then o.party_from
           else null
         end as party_to,
         case
           when b.reverses_document_id is null then b.from_kind
           when o.directional                  then o.to_kind
           else o.from_kind
         end as from_kind,
         case
           when b.reverses_document_id is null then b.to_kind
           when o.directional                  then o.from_kind
           else null
         end as to_kind
    from base b
    left join base o on o.id = b.reverses_document_id
)
select
  s.doc_date::date                                as doc_day,
  s.doc_type,
  coalesce(s.doc_number::text, '—')               as doc_no,
  -- 🔴 **`::text` صريحٌ — وغيابُه هو الخطأُ الذي أسقط النسخةَ الأولى عند
  -- التشغيل.** `orig_type` نوعُه `stock_doc_type`، **و`coalesce` تطلب نوعًا
  -- واحدًا لفرعيها** فاصطدم الـenum بنصٍّ حرفيّ. ونفسُ الشيء بين فرعَي `case`.
  --
  -- ⚠️ **ولا يُصلَّح سكربتٌ نُفِّذ في مكانه** — والقاعدةُ لا تمسّ هذا الملفّ:
  -- **هذه النسخةُ لم تعمل قطّ**، والتي عملت هي المصحَّحةُ عند بشّار. فالملفُّ
  -- هنا كان مسوَّدةً مكسورةً لا سجلَّ تنفيذ، **وتركُه مكسورًا يجعله يفشل ثانيةً
  -- لمن يعيده.**
  case when s.reverses_document_id is null then '—'
       else coalesce(s.orig_type::text, '(أصلٌ غيرُ موجود)') end
                                                  as reverses_type,
  coalesce(s.party_from, '—')                     as party_from,
  coalesce(s.party_to, '—')                       as party_to,
  coalesce(f.movement_flow, '(بلا سطور)')         as movement_flow,
  case
    when f.document_id is null                    then 'ⓘ no-movements'
    when not s.directional                        then 'ⓘ no-direction'
    when s.to_kind = 'storage'
         and s.party_to is distinct from f.in_storage
                                                  then '🔴 MISMATCH:to'
    when s.from_kind = 'storage'
         and s.party_from is distinct from f.out_storage
                                                  then '🔴 MISMATCH:from'
    else '✅ ok'
  end                                             as verdict,
  -- الأرقامُ الخامّةُ بجانب الحكم، **فالقارئُ يستطيع أن يخالف السكربت.**
  coalesce(f.in_storage, '—')                     as movements_in,
  coalesce(f.out_storage, '—')                    as movements_out,
  coalesce(s.from_kind, '—')                      as from_kind,
  coalesce(s.to_kind, '—')                        as to_kind,
  s.id                                            as doc_id
from shown s
left join flow f on f.document_id = s.id
order by s.doc_date desc, s.id desc;

-- ==========================================================================
-- ٠٩٤ب/أ — الأعمدة. قراءةٌ فقط، **جملةُ `select` واحدة.**
--
-- 🔴 مُجهَّزٌ ولم أشغّله. يُشغَّل بعد ٠٩٤، وآمنٌ في أيِّ وقت.
--
-- ⚠️ **وواحدةٌ لا أكثر، وهذا سببُ التقسيم كلِّه:** محرّرُ Supabase يعرض **مجموعةَ
-- النتائج الأخيرة وحدَها**، فملفٌّ بخمس جملٍ يعرض واحدةً ويبتلع أربعًا **بلا أن
-- يقول إنه فعل**. وقع مرّتين — بـ٠٩٣ وبـ٠٩٤ب الموحَّد — **والثانيةُ لم تكن
-- لتُكتشف لولا أن المالك عدّ الأقسام الغائبة.**
--
-- ⚠️ **و`information_schema.columns` لا تقول شيئًا عن القيود** — تُرجع الاسمَ
-- والنوعَ والعدميّةَ والافتراضيّ، **والقيدُ ليس في أيٍّ منها**. ولهذا ٠٩٤ب/ب.
--
-- المتوقَّع: ثمانيةُ صفوفٍ لـ`stock_lots` وصفٌّ واحدٌ لـ`lot_id`،
-- **وكلُّها `is_nullable = NO` عدا لا شيء** — ولا افتراضيَّ إلّا على
-- `id` و`cost_is_estimated` و`created_at`.
-- ==========================================================================

select
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  coalesce(c.column_default, '—') as column_default
from information_schema.columns c
where c.table_schema = 'public'
  and (c.table_name = 'stock_lots'
       or (c.table_name = 'stock_movements' and c.column_name = 'lot_id'))
order by c.table_name, c.ordinal_position;

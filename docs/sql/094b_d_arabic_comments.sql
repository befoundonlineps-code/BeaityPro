-- ==========================================================================
-- ٠٩٤ب/د — القراءةُ الراجعةُ للنصّ العربيّ. قراءةٌ فقط، **جملةُ `select` واحدة.**
--
-- 🔴 مُجهَّزٌ ولم أشغّله. يُشغَّل بعد ٠٩٤، وآمنٌ في أيِّ وقت.
--
-- ⚠️ **والسؤال ليس «هل التعليقُ موجود» بل «هل نجا العربيُّ شحنًا».** محرّرُ
-- Supabase أوقعَ مشكلةَ تشفيرٍ مسّت التعليقات في ٤٣ حتى شُغِّل ٤٧ بالإنجليزيّة
-- تفاديًا لها — **ولا اختبارَ في المستودع يمسك هذا الصنف**، لأن اختباراتِنا
-- تقرأ الملفّاتِ لا القاعدة. فالحارسُ الوحيدُ `select` يُكتب مع كلّ شحنة.
--
-- ⚠️ **وهي بسيطةٌ لدرجة أنها لا تقدر أن تفشل** — لا تجميعَ ولا تحويلَ نوعٍ ولا
-- `||` على ما قد يكون عدمًا.
--
-- المتوقَّع: خمسةُ صفوف، **وكلُّها عربيّةٌ مقروءةٌ لا علاماتِ استفهامٍ ولا مربّعات.**
-- ==========================================================================

select
  'جدول' as kind,
  'stock_lots' as on_object,
  left(obj_description('public.stock_lots'::regclass), 60) as first_60_chars

union all

select
  'عمود',
  a.attrelid::regclass::text || '.' || a.attname,
  left(col_description(a.attrelid, a.attnum), 60)
from pg_attribute a
where (a.attrelid = 'public.stock_lots'::regclass
       and a.attname in ('unit_cost', 'cost_is_estimated', 'received_at'))
   or (a.attrelid = 'public.stock_movements'::regclass and a.attname = 'lot_id')

order by kind, on_object;

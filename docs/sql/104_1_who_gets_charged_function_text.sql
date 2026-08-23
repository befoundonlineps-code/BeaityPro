-- ١٠٤_١ — النصُّ الحيُّ لـ post_stocktake_session: مَن يُحاسَب فعلًا؟
--
-- قراءةٌ فقط. لا DDL، ولا كتابة، ولا RAISE. آمنٌ تمامًا، ويمكن تكراره.
--
-- 🔴 لماذا يلزم: كلُّ ما قلناه عن اختيار المُحاسَب مقروءٌ من ملفِّ سكربتٍ في
-- المستودع (٠٩٥)، **لا من القاعدة الحيّة.** و«الوثائق توجّهك والقاعدة تقرّر».
-- والفرقُ ليس نظريًّا هنا: سجلُّنا نفسُه يقول عن ٠٥٦ج إن «الجسم المنشور متأخّر»،
-- أي أنّنا **نعلم** أن ملفًّا وقاعدةً اختلفا من قبل.
--
-- ⚠️ وجملةُ `select` واحدةٌ عمدًا — محرّرُ Supabase يعرض مجموعةَ النتائج
-- الأخيرة وحدَها، وملفٌّ بأقسامٍ يبتلع ما قبل الأخير بصمت.
--
-- ⚠️ والسؤالُ عن **الفئة كلِّها** لا عن اسمٍ واحد: كلُّ دالّةٍ اسمُها يبدأ
-- بـ post_stocktake — فلو وُجدت نسختان (٠٥٤هـ أسقط القديمة، ونجاحُه مسجَّلٌ لا
-- مقيسٌ عندي) ظهرتا معًا هنا. **وصفٌّ واحدٌ هو الخبر، لا الفراغ.**
--
-- ما يُقرأ في المخرَج، بالترتيب:
--   ① n_versions        ⟵ يجب أن يكون 1. أكثرُ من واحدةٍ = استدعاءٌ غامض.
--   ② is_security_definer + search_path  ⟵ يُقرآن قبل أيّ CREATE OR REPLACE قادم
--   ③ charges_storage_owner / asks_storage_responsibles / has_no_responsible
--      / has_many_responsibles  ⟵ هل منطقُ الاختيار الذي وصفناه موجودٌ حرفيًّا؟
--   ④ mentions_p_employee_id_as_payer  ⟵ **يجب أن يكون false.**
--      لو true، فالمُرحِّلُ هو من يدفع — وهو عكسُ ما قرأناه.
--   ⑤ definition       ⟵ النصُّ كاملًا، للقراءة بالعين لا للعدّ وحدَه.

select
  count(*) over ()                                              as n_versions,
  p.proname                                                     as function_name,
  pg_get_function_identity_arguments(p.oid)                     as arguments,
  p.prosecdef                                                   as is_security_definer,
  coalesce(array_to_string(p.proconfig, ' · '), '(بلا search_path مثبَّت)')
                                                                as config,
  -- ⚠️ الإبرُ على **الكود** لا على كلماتٍ قد ترد في تعليق: كلُّ واحدةٍ تحمل
  -- علامةَ إسنادٍ أو قوسًا، فلا يلتقطها شرحٌ عربيٌّ يذكر الاسم.
  (pg_get_functiondef(p.oid) like '%v_charged_id := v_owner_id%')
                                                                as charges_storage_owner,
  (pg_get_functiondef(p.oid) like '%from storage_responsibles r%')
                                                                as asks_storage_responsibles,
  (pg_get_functiondef(p.oid) like '%no_responsible%')           as has_no_responsible,
  (pg_get_functiondef(p.oid) like '%many_responsibles%')        as has_many_responsibles,
  -- 🔴 الفحصُ الحاسم: هل يُسنَد المُرحِّلُ إلى المُحاسَب في أيّ موضع؟
  (pg_get_functiondef(p.oid) like '%v_charged_id := p_employee_id%')
                                                                as mentions_p_employee_id_as_payer,
  (pg_get_functiondef(p.oid) like '%fine_policy_missing%')      as refuses_when_no_policy,
  pg_get_functiondef(p.oid)                                     as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'post_stocktake%'
order by p.proname, arguments;

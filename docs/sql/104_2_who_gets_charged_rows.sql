-- ١٠٤_٢ — مَن سيُحاسَب لو جرى جردٌ اليوم، لكلّ مستودع؟
--
-- قراءةٌ فقط. لا DDL، ولا كتابة، ولا RAISE. آمنٌ تمامًا، ويمكن تكراره.
--
-- 🔴 هذا لا يقرأ الشيفرة — **يعيد تنفيذ منطق الاختيار على الصفوف الحقيقيّة**،
-- فيقول لكلّ مستودعٍ اسمَ من سيحمل العجز. و١٠٤_١ يقول «هل المنطق كما نظنّ»،
-- وهذا يقول «وماذا يُنتج على بياناتك». الاثنان معًا، لا أحدُهما.
--
-- ⚠️ وجملةُ `select` واحدة — محرّرُ Supabase يعرض الأخيرة وحدَها.
--
-- ⚠️ **وشاهدُ الصدق مبنيٌّ في السؤال** (قاعدة ١ج): الاستعلامُ يشمل **كلّ**
-- مستودعات الصالون بلا مرشِّح، **ويعرض `policy_state` و`resolution` لكلّ صفّ.**
-- فصفٌّ يقول `no_responsible` خبرٌ، **وجدولٌ فارغٌ تمامًا يعني أن الاستعلام لم
-- يرَ مستودعًا أصلًا** — وهما لا يتشابهان هنا، بخلاف استعلامِ غيابٍ مرشَّح.
--
-- ما يُقرأ في المخرَج:
--   policy_state   ⟵ 'سياسةٌ مضبوطة' · 'لا سياسة (الترحيلُ يُرفض)'
--                    · 🔴 'صفرٌ — يمرّ ولا يُغرِّم أحدًا' (البند 3.13ز)
--   resolution     ⟵ storage_owner · named_or_role_responsible
--                    · no_responsible · many_responsibles
--   charged_name   ⟵ الاسمُ الذي سيُكتب عليه العجز، أو '—' حين لا أحد
--   n_candidates   ⟵ الرقمُ الخامُّ بجانب الحكم، فيمكن مخالفتُه

select
  s.name                                                        as storage_name,
  s.kind::text                                                  as storage_kind,
  s.fine_percent,
  s.fine_basis::text                                            as fine_basis,
  case
    when s.fine_percent is null or s.fine_basis is null
      then 'لا سياسة (الترحيلُ يُرفض بـfine_policy_missing)'
    when s.fine_percent = 0
      then '🔴 صفرٌ — يمرّ ولا يُغرِّم أحدًا (3.13ز)'
    else 'سياسةٌ مضبوطة'
  end                                                           as policy_state,
  case
    when s.kind = 'professional' then 'storage_owner'
    when coalesce(c.n, 0) = 0 then 'no_responsible'
    when c.n > 1 then 'many_responsibles'
    else 'named_or_role_responsible'
  end                                                           as resolution,
  case
    when s.kind = 'professional'
      then coalesce(o.first_name || ' ' || o.last_name, '(مالكٌ غيرُ مضبوط)')
    when coalesce(c.n, 0) = 1 then c.only_name
    else '—'
  end                                                           as charged_name,
  coalesce(c.n, 0)                                              as n_candidates,
  coalesce(c.all_names, '—')                                    as all_candidates
from storages s
left join employees o
       on o.id = s.owner_employee_id and o.salon_id = s.salon_id
left join lateral (
  -- نفسُ شرط ٠٩٥ حرفًا: الموظّفُ مرشَّحٌ إن سمّاه صفٌّ أو طابق دورُه دورَ صفّ.
  select count(*)                          as n,
         min(e.first_name || ' ' || e.last_name) as only_name,
         string_agg(e.first_name || ' ' || e.last_name, ' · ' order by e.first_name)
                                           as all_names
  from employees e
  where e.salon_id = s.salon_id
    and exists (select 1 from storage_responsibles r
                 where r.storage_id = s.id
                   and r.salon_id   = s.salon_id
                   and (r.employee_id = e.id or r.role = e.role))
) c on true
order by s.name;

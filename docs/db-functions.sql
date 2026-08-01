-- دوال قاعدة البيانات — ملف مولَّد، لا تعدّله بالإيد.
--
-- كل تغيير على أي دالة بيتعكس هون بإعادة توليد، مش بتحرير السطر المتغيّر:
-- الملف قيمته إنه نسخة طبق الأصل عن القاعدة، وأول تعديل يدوي بيلغي هاي
-- القيمة بصمت — بتصير تقرأ وثيقة وإنت مفكّرها القاعدة.
--
-- شغّل هذا بمحرّر SQL والصق المخرج مكان كل شي تحت هذا الرأس:
--
--   select string_agg(pg_get_functiondef(p.oid), E'\n\n' order by p.proname)
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.prokind in ('f', 'p')
--     and not exists (
--       select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
--     );
--
-- شرط pg_depend بيستثني دوال الامتدادات. btree_gist لحاله — اللي بيشغّل
-- قيود EXCLUDE USING gist — بيحطّ ~126 دالة gbt_* بمخطط public. بدون
-- الشرط بيطلع الملف 145 دالة، وبتغرق فيها الـ19 اللي إلنا. الاستثناء
-- بالتبعية لا بنمط الاسم: النمط بيلزمه تحديث مع كل امتداد جديد، والتبعية لأ.
--
-- ليش pg_get_functiondef وليش مش prosrc: prosrc بيرجّع الجسم بس، وما بيقول
-- ولا إشي عن SECURITY DEFINER ولا search_path ولا اللغة. و CREATE OR REPLACE
-- بتصفّر كل خاصية ما بتعطيها إياها صراحةً — يعني إعادة بناء دالة من جسمها
-- لحاله بتسقط تحصيناتها بصمت. صار فعلًا مع seed_cancellation_reasons_for_salon.

CREATE OR REPLACE FUNCTION public.adjust_appointment_duration(p_appointment_id uuid, p_new_end timestamp with time zone, p_adjustment_reason_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_group_id       uuid;
  v_new_primary_id uuid;
  v_new_id         uuid;
  v_primary        appointments%rowtype;
  r                record;
begin
  if p_adjustment_reason_id is null then
    raise exception 'adjustment_reason_required'
      using hint = 'سبب التعديل إجباري';
  end if;

  select group_id into v_group_id from appointments where id = p_appointment_id;
  if not found then
    raise exception 'appointment_not_found';
  end if;

  perform 1 from appointments where group_id = v_group_id for update;

  if exists (
    select 1 from appointments
     where group_id = v_group_id and status not in ('booked', 'cancelled')
  ) then
    raise exception 'appointment_not_adjustable'
      using hint = 'كل أعضاء الجلسة لازم يكونوا بحالة محجوز';
  end if;

  select * into v_primary from appointments where group_id = v_group_id and is_primary;

  if v_primary.status is null or v_primary.status <> 'booked' then
    raise exception 'appointment_not_adjustable'
      using hint = 'هاي الجلسة ما عادت بحالة محجوز';
  end if;

  if p_new_end <= v_primary.start_time then
    raise exception 'adjusted_end_before_start'
      using hint = 'وقت النهاية الجديد لازم يكون بعد بداية الجلسة';
  end if;

  if p_new_end = v_primary.end_time then
    raise exception 'adjustment_no_change'
      using hint = 'وقت النهاية الجديد نفس الحالي';
  end if;

  v_new_primary_id := gen_random_uuid();

  -- القلب أولًا — بيخرج القديم من مجموعة الحالات الشاغلة، فبيصير
  -- الوقت الجديد المتداخل معه متاحًا للإدراج تحت.
  update appointments
     set status = 'adjusted',
         superseded_by_id = v_new_primary_id,
         adjustment_reason_id = p_adjustment_reason_id
   where id = v_primary.id;

  insert into appointments (
    id, salon_id, client_id, service_id, employee_id,
    start_time, end_time, status, note, resource_unit_id,
    group_id, is_primary
  ) values (
    v_new_primary_id, v_primary.salon_id, v_primary.client_id, v_primary.service_id, v_primary.employee_id,
    v_primary.start_time, p_new_end, 'booked', v_primary.note, v_primary.resource_unit_id,
    v_new_primary_id, true
  );

  update employee_schedule_exceptions
     set appointment_id = v_new_primary_id
   where appointment_id = v_primary.id;

  for r in
    select * from appointments
     where group_id = v_group_id and not is_primary
       and status = 'booked'
  loop
    v_new_id := gen_random_uuid();

    update appointments
       set status = 'adjusted',
           superseded_by_id = v_new_id,
           adjustment_reason_id = p_adjustment_reason_id
     where id = r.id;

    insert into appointments (
      id, salon_id, client_id, service_id, employee_id,
      start_time, end_time, status, note, resource_unit_id,
      group_id, is_primary
    ) values (
      v_new_id, r.salon_id, r.client_id, r.service_id, r.employee_id,
      r.start_time, p_new_end, 'booked', r.note, null,
      v_new_primary_id, false
    );

    update employee_schedule_exceptions
       set appointment_id = v_new_id
     where appointment_id = r.id;
  end loop;

  return v_new_primary_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.bulk_release_to_waiting(p_target_kind text, p_employee_id uuid, p_resource_unit_ids uuid[], p_from timestamp with time zone, p_to timestamp with time zone, p_cancellation_reason_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_floor      timestamptz;
  r            record;
  v_waiting_id uuid;
  v_cancelled  uuid[] := '{}';
  v_waiting    uuid[] := '{}';
  v_removed    uuid[] := '{}';
begin
  if p_cancellation_reason_id is null then
    raise exception 'cancellation_reason_required'
      using hint = 'سبب الإلغاء إجباري';
  end if;

  if p_target_kind not in ('employee', 'resource_units') then
    raise exception 'invalid_target_kind'
      using hint = 'نوع الهدف غير معروف';
  end if;

  if p_target_kind = 'employee' and p_employee_id is null then
    raise exception 'employee_required'
      using hint = 'لازم تختار الموظف';
  end if;

  if p_target_kind = 'resource_units'
     and (p_resource_unit_ids is null or cardinality(p_resource_unit_ids) = 0) then
    raise exception 'resource_units_required'
      using hint = 'لازم تختار وحدة مورد وحدة على الأقل';
  end if;

  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'invalid_time_range'
      using hint = 'نهاية النطاق لازم تكون بعد بدايته';
  end if;

  -- أرضية "ما بنمسّ الماضي" بتتحسب هون، مش بالمتصفح. حجز بلّش
  -- قبل هلق ممكن يكون انخدم فعلًا — الصف بيقول booked بس لأن ما
  -- حدا علّمه completed، وما في عمود بيفرّق. إلغاؤه بيزوّر تاريخًا.
  v_floor := greatest(p_from, now());

  if v_floor >= p_to then
    raise exception 'range_entirely_past'
      using hint = 'النطاق المختار كله بالماضي';
  end if;

  -- الاشتقاق جوّا الدالة تحت القفل، لا قائمة معرّفات من المتصفح:
  -- حجز انعمل والنافذة مفتوحة لازم ينمسك كمان، وإلا بيضل على عمود
  -- موظفة غايبة بصمت. الترتيب بـ group_id ثم id ثابت، فتشابك
  -- عمليتين متزامنتين بيصير جمود يكشفه بوستجرس (40P01) بدل تلف.
  --
  -- على الأكثر صف واحد لكل مجموعة بيتطابق: الموظف الواحد ما بيقدر
  -- يكون عضوين بنفس الجلسة (appointments_no_overlap)، ووحدة المورد
  -- ما بيحملها إلا الأساسي (appointments_group_resource_check).
  -- فاستدعاء cancel_appointment ما بيقدر يغيّر صفًا لسا الحلقة
  -- رح توصله.
  for r in
    select a.id, a.is_primary, a.salon_id, a.client_id, a.service_id, a.note
      from appointments a
     where a.status in ('booked', 'pending_approval')
       and a.start_time >= v_floor
       and a.start_time <  p_to
       and (
             (p_target_kind = 'employee'
              and a.employee_id = p_employee_id)
          or (p_target_kind = 'resource_units'
              and a.resource_unit_id = any (p_resource_unit_ids))
           )
     order by a.group_id, a.id
     for update
  loop
    if r.is_primary then
      -- الأساسي هو الجلسة: بتنلغي كاملة، والزبون بيرجع للطابور.
      perform cancel_appointment(r.id, p_cancellation_reason_id);

      v_waiting_id := gen_random_uuid();

      -- نفس شكل عنصر الانتظار العادي بالضبط: مجموعة من واحد،
      -- group_id ذاتي المرجع، بلا موظف ولا وقت ولا وحدة مورد.
      insert into appointments (
        id, salon_id, client_id, service_id, employee_id,
        start_time, end_time, status, note,
        group_id, is_primary, released_from_id
      ) values (
        v_waiting_id, r.salon_id, r.client_id, r.service_id, null,
        null, null, 'waiting'::appointment_status, r.note,
        v_waiting_id, true, r.id
      );

      v_cancelled := v_cancelled || r.id;
      v_waiting   := v_waiting   || v_waiting_id;
    else
      -- مشارك بس: بينشال لحاله والجلسة بتكمل، فالزبون لسا
      -- بينخدم وما إله شغل بالطابور.
      perform remove_participant(r.id, p_cancellation_reason_id);
      v_removed := v_removed || r.id;
    end if;
  end loop;

  return jsonb_build_object(
    'cancelled_ids',   to_jsonb(v_cancelled),
    'waiting_ids',     to_jsonb(v_waiting),
    'removed_ids',     to_jsonb(v_removed),
    'cancelled_count', cardinality(v_cancelled),
    'removed_count',   cardinality(v_removed)
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id uuid, p_cancellation_reason_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_group_id       uuid;
  v_bad_count      int;
  v_primary_status appointment_status;
begin
  if p_cancellation_reason_id is null then
    raise exception 'cancellation_reason_required'
      using hint = 'سبب الإلغاء إجباري';
  end if;

  select group_id into v_group_id from appointments where id = p_appointment_id;
  if not found then
    raise exception 'appointment_not_found';
  end if;

  perform 1 from appointments where group_id = v_group_id for update;

  -- cancelled مستثناة: مشاركة انشالت سابقًا خرجت من الجلسة،
  -- فما إلها رأي بإلغاء الباقي.
  select count(*) into v_bad_count
    from appointments
   where group_id = v_group_id
     and status not in ('booked', 'pending_approval', 'cancelled');

  if v_bad_count > 0 then
    raise exception 'appointment_not_cancellable'
      using hint = 'بعض المشاركين بهاي الجلسة مش بحالة قابلة للإلغاء';
  end if;

  -- الأساسي هو الجلسة. اشتراط حالته صراحةً بيغطّي الحالة
  -- اللي صار الحارس فوق يسمح فيها: مجموعة كل أعضائها ملغيون.
  select status into v_primary_status
    from appointments where group_id = v_group_id and is_primary;

  if v_primary_status is null or v_primary_status not in ('booked', 'pending_approval') then
    raise exception 'appointment_not_cancellable'
      using hint = 'هاي الجلسة ما عادت بحالة تسمح بالإلغاء';
  end if;

  update appointments
     set status = 'cancelled',
         cancellation_reason_id = p_cancellation_reason_id,
         cancelled_at = now()
   where group_id = v_group_id
     and status in ('booked', 'pending_approval');

  delete from employee_schedule_exceptions
   where appointment_id in (select id from appointments where group_id = v_group_id);

  return v_group_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.confirm_pending_appointment(p_appointment_id uuid, p_exception_date date, p_start_time time without time zone, p_end_time time without time zone)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_group_id uuid;
  r record;
  v_found boolean := false;
begin
  select group_id into v_group_id from appointments where id = p_appointment_id;
  if not found then
    raise exception 'appointment_not_found';
  end if;

  for r in
    select id, salon_id, employee_id
      from appointments
     where group_id = v_group_id and status = 'pending_approval'
     for update
  loop
    v_found := true;

    update appointments set status = 'booked' where id = r.id;

    insert into employee_schedule_exceptions
      (salon_id, employee_id, exception_date, start_time, end_time, appointment_id)
    values
      (r.salon_id, r.employee_id, p_exception_date, p_start_time, p_end_time, r.id)
    on conflict (appointment_id) do update
      set exception_date = excluded.exception_date,
          start_time    = excluded.start_time,
          end_time      = excluded.end_time;
  end loop;

  if not v_found then
    raise exception 'appointment_not_pending'
      using hint = 'ما في مشارك بهاي الجلسة بحالة معلّق';
  end if;

  return v_group_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.convert_waiting_appointment(p_appointment_id uuid, p_employee_id uuid, p_service_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_provisional boolean DEFAULT false, p_resource_unit_id uuid DEFAULT NULL::uuid, p_participants jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_row appointments%rowtype;
  r     jsonb;
begin
  if p_employee_id is null then
    raise exception 'employee_required'
      using hint = 'لازم تختار الموظف قبل التحويل';
  end if;
  if p_service_id is null then
    raise exception 'service_required'
      using hint = 'لازم تختار الخدمة قبل التحويل';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'invalid_time_range'
      using hint = 'وقت النهاية لازم يكون بعد وقت البداية';
  end if;

  select * into v_row from appointments where id = p_appointment_id for update;

  if not found then
    raise exception 'appointment_not_found';
  end if;

  -- الحارس ضد التحويل المتزامن: لو جهاز تاني حوّل نفس العنصر
  -- بيناتنا، الحالة ما عادت waiting فبنرفض بدل ما ندهس شغله.
  if v_row.status <> 'waiting' then
    raise exception 'appointment_not_waiting'
      using hint = 'هذا العنصر ما عاد بقائمة الانتظار — يمكن اتحوّل من جهاز تاني';
  end if;

  -- الصف نفسه بيصير الحجز. group_id و is_primary موجودين أصلًا
  -- من لحظة إنشائه (مجموعة من عنصر واحد)، فما بيحتاجوا لمس.
  --
  -- ⚠️ ::appointment_status إجباري: نوع CASE بينحل من فروعه
  -- قبل النظر للعمود، فبيطلع text وبوستجرس بيرفض إسناده لـenum.
  update appointments
     set employee_id      = p_employee_id,
         service_id       = p_service_id,
         start_time       = p_start,
         end_time         = p_end,
         status           = (case when p_provisional then 'pending_approval' else 'booked' end)::appointment_status,
         resource_unit_id = p_resource_unit_id
   where id = p_appointment_id;

  -- المشاركون الإضافيون. كل عنصر بيحمل حالته الخاصة، لأن
  -- المجموعة بتحتمل حالات مختلطة بشكل طبيعي: الأساسية داخل
  -- دوامها فبتنحجز مباشرة، والمساعدة خارج دوامها فبتنحجز
  -- مبدئيًا — نفس ما بيصير بالحجز الجديد بالضبط.
  for r in select value from jsonb_array_elements(p_participants) loop
    insert into appointments (
      salon_id, client_id, service_id, employee_id,
      start_time, end_time, status, note, resource_unit_id,
      group_id, is_primary
    ) values (
      v_row.salon_id, v_row.client_id, p_service_id, (r->>'employee_id')::uuid,
      p_start, p_end,
      (case when coalesce((r->>'provisional')::boolean, false)
            then 'pending_approval' else 'booked' end)::appointment_status,
      v_row.note, null,
      v_row.group_id, false
    );
  end loop;

  return p_appointment_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.log_clients_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if (tg_op = 'INSERT') then
    insert into audit_log (table_name, record_id, action, new_data, changed_by, salon_id)
    values ('clients', new.id, 'insert', to_jsonb(new), auth.uid(), new.salon_id);
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into audit_log (table_name, record_id, action, old_data, new_data, changed_by, salon_id)
    values ('clients', new.id, 'update', to_jsonb(old), to_jsonb(new), auth.uid(), new.salon_id);
    return new;
  elsif (tg_op = 'DELETE') then
    insert into audit_log (table_name, record_id, action, old_data, changed_by, salon_id)
    values ('clients', old.id, 'delete', to_jsonb(old), auth.uid(), old.salon_id);
    return old;
  end if;
  return null;
end;
$function$


CREATE OR REPLACE FUNCTION public.mark_no_show(p_appointment_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_group_id       uuid;
  v_bad_count      int;
  v_primary_status appointment_status;
begin
  select group_id into v_group_id from appointments where id = p_appointment_id;
  if not found then
    raise exception 'appointment_not_found';
  end if;

  perform 1 from appointments where group_id = v_group_id for update;

  select count(*) into v_bad_count
    from appointments
   where group_id = v_group_id and status not in ('booked', 'cancelled');

  if v_bad_count > 0 then
    raise exception 'appointment_not_markable_no_show'
      using hint = 'كل أعضاء الجلسة لازم يكونوا بحالة محجوز';
  end if;

  select status into v_primary_status
    from appointments where group_id = v_group_id and is_primary;

  if v_primary_status is null or v_primary_status <> 'booked' then
    raise exception 'appointment_not_markable_no_show'
      using hint = 'هاي الجلسة ما عادت بحالة محجوز';
  end if;

  update appointments
     set status = 'no_show'
   where group_id = v_group_id and status = 'booked';

  return v_group_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.remove_participant(p_appointment_id uuid, p_cancellation_reason_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_row appointments%rowtype;
begin
  if p_cancellation_reason_id is null then
    raise exception 'cancellation_reason_required'
      using hint = 'سبب الإزالة إجباري';
  end if;

  select * into v_row from appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'appointment_not_found';
  end if;

  -- الرفض الأول: الأساسية مش مشاركة تُزال. إزالتها بتعني إلغاء
  -- الجلسة كلها — وهذا شغل cancel_appointment، بسببها الخاص
  -- وانتشارها على الكل.
  if v_row.is_primary then
    raise exception 'participant_is_primary'
      using hint = 'ما بتقدر تشيل الموظفة الأساسية — إلغاء الجلسة كاملة إله زره الخاص';
  end if;

  -- الرفض الثاني: حالة الصف الممرَّر مرآة موثوقة لحالة المجموعة،
  -- لأن كل انتقالات الحالة بتنتشر على المجموعة بذرّية واحدة —
  -- فما بيلزم فحص منفصل لحالة الأساسي.
  if v_row.status not in ('booked', 'pending_approval') then
    raise exception 'participant_not_removable'
      using hint = 'هاي المشاركة مش بحالة تسمح بالإزالة';
  end if;

  update appointments
     set status = 'cancelled',
         cancellation_reason_id = p_cancellation_reason_id,
         cancelled_at = now()
   where id = p_appointment_id;

  delete from employee_schedule_exceptions where appointment_id = p_appointment_id;

  return p_appointment_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.reschedule_appointment(p_appointment_id uuid, p_new_start timestamp with time zone, p_new_end timestamp with time zone, p_new_employee_id uuid, p_provisional boolean DEFAULT false, p_resource_unit_id uuid DEFAULT NULL::uuid, p_reschedule_reason_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_group_id       uuid;
  v_new_primary_id uuid;
  v_new_id         uuid;
  v_primary        appointments%rowtype;
  r                record;
  v_new_status     appointment_status := case when p_provisional then 'pending_approval' else 'booked' end;
begin
  if p_reschedule_reason_id is null then
    raise exception 'reschedule_reason_required'
      using hint = 'سبب إعادة الجدولة إجباري';
  end if;

  select group_id into v_group_id from appointments where id = p_appointment_id;
  if not found then
    raise exception 'appointment_not_found';
  end if;

  perform 1 from appointments where group_id = v_group_id for update;

  if exists (
    select 1 from appointments
     where group_id = v_group_id and status not in ('booked', 'pending_approval', 'cancelled')
  ) then
    raise exception 'appointment_not_reschedulable'
      using hint = 'كل أعضاء الجلسة لازم يكونوا بحالة قابلة لإعادة الجدولة';
  end if;

  select * into v_primary from appointments where group_id = v_group_id and is_primary;

  if v_primary.status is null or v_primary.status not in ('booked', 'pending_approval') then
    raise exception 'appointment_not_reschedulable'
      using hint = 'هاي الجلسة ما عادت بحالة تسمح بإعادة الجدولة';
  end if;

  v_new_primary_id := gen_random_uuid();

  update appointments
     set status = 'rescheduled',
         superseded_by_id = v_new_primary_id,
         reschedule_reason_id = p_reschedule_reason_id
   where id = v_primary.id;

  delete from employee_schedule_exceptions where appointment_id = v_primary.id;

  insert into appointments (
    id, salon_id, client_id, service_id, employee_id,
    start_time, end_time, status, note, resource_unit_id,
    group_id, is_primary
  ) values (
    v_new_primary_id, v_primary.salon_id, v_primary.client_id, v_primary.service_id, p_new_employee_id,
    p_new_start, p_new_end, v_new_status, v_primary.note, p_resource_unit_id,
    v_new_primary_id, true
  );

  for r in
    select * from appointments
     where group_id = v_group_id and not is_primary
       and status in ('booked', 'pending_approval')
  loop
    v_new_id := gen_random_uuid();

    update appointments
       set status = 'rescheduled',
           superseded_by_id = v_new_id,
           reschedule_reason_id = p_reschedule_reason_id
     where id = r.id;

    delete from employee_schedule_exceptions where appointment_id = r.id;

    insert into appointments (
      id, salon_id, client_id, service_id, employee_id,
      start_time, end_time, status, note, resource_unit_id,
      group_id, is_primary
    ) values (
      v_new_id, r.salon_id, r.client_id, r.service_id, r.employee_id,
      p_new_start, p_new_end, v_new_status, r.note, null,
      v_new_primary_id, false
    );
  end loop;

  return v_new_primary_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.seed_adjustment_reasons_for_salon(p_salon_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from adjustment_reasons where salon_id = p_salon_id) then
    return;
  end if;

  insert into adjustment_reasons (salon_id, name, sort_order) values
    (p_salon_id, 'الخدمة استغرقت وقتًا أطول', 1),
    (p_salon_id, 'طلب الزبون خدمة إضافية',    2),
    (p_salon_id, 'انقطاع كهرباء',              3),
    (p_salon_id, 'انقطاع مياه',                4),
    (p_salon_id, 'عطل بالجهاز',                5),
    (p_salon_id, 'ظرف صحي طارئ',               6),
    (p_salon_id, 'اضطر الزبون للمغادرة',       7),
    (p_salon_id, 'ظرف طارئ للموظف',            8);
end;
$function$


CREATE OR REPLACE FUNCTION public.seed_business_hours_for_new_salon()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into business_hours (salon_id, day_of_week, is_open, open_time, close_time)
  select new.id, d, true, '09:00', '18:00'
  from generate_series(0, 6) as d;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.seed_cancellation_reasons_for_salon(p_salon_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from cancellation_reasons where salon_id = p_salon_id) then
    return; -- زرعناها قبل هيك لهذا الصالون
  end if;

  insert into cancellation_reasons (salon_id, name, sort_order) values
    (p_salon_id, 'خطأ بالحجز', 1),
    (p_salon_id, 'رغبة الزبون بالإلغاء', 2),
    (p_salon_id, 'مرض', 3),
    (p_salon_id, 'نقل لتاريخ آخر', 4),
    (p_salon_id, 'غياب الموظف', 5),
    (p_salon_id, 'عطل بالجهاز', 6);
end;
$function$


CREATE OR REPLACE FUNCTION public.seed_reschedule_reasons_for_salon(p_salon_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from reschedule_reasons where salon_id = p_salon_id) then
    return; -- زرعناها قبل هيك لهذا الصالون
  end if;

  insert into reschedule_reasons (salon_id, name, sort_order) values
    (p_salon_id, 'من العميل', 1),
    (p_salon_id, 'من الموظف', 2),
    (p_salon_id, 'من الإدارة', 3),
    (p_salon_id, 'بسبب الجهاز', 4),
    (p_salon_id, 'بسبب الطبيب', 5),
    (p_salon_id, 'بسبب الإجازة', 6),
    (p_salon_id, 'بسبب الطقس', 7),
    (p_salon_id, 'بسبب عطل', 8),
    (p_salon_id, 'بسبب ازدحام', 9);
end;
$function$


CREATE OR REPLACE FUNCTION public.seed_service_catalog_for_new_salon()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  perform seed_service_catalog_for_salon(new.id);
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.seed_service_catalog_for_salon(p_salon_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if exists (select 1 from service_categories where salon_id = p_salon_id) then
    return;
  end if;

  drop table if exists tmp_service_catalog;
  create temporary table tmp_service_catalog (
    bt business_type,
    root_name text,
    root_order integer,
    root_color text,
    section_name text,
    section_order integer,
    svc_name text,
    svc_order integer,
    svc_minutes integer,
    svc_price numeric(10, 2),
    svc_sex service_sex
  );

  insert into tmp_service_catalog values
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'جلسة عطرية لمحيط العينين والشفتين', 1, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'ماسك عطري للوجه', 2, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'تقشير نباتي عطري', 3, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'تنظيف بشرة لطيف (بدون ألم)', 4, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'عناية بالبشرة الدهنية والمجهدة', 5, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'جلسة تنظيف بشرة متكاملة', 6, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'ماسك لمحيط العينين', 7, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'شد وتحديد ملامح الوجه', 8, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'علاج انتفاخات الوجه', 9, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'عناية أساسية بالوجه', 10, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'علاج مكثف لمكافحة علامات تقدم السن', 11, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'علاج مشاكل البشرة الدهنية', 12, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'برنامج نضارة وتجديد منطقة العينين', 13, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'جلسة ترميم ونعومة البشرة', 14, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'تنظيف بشرة بالموجات فوق الصوتية', 15, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'العناية بالوجه والبشرة', 1, 'الوقاية من التجاعيد', 16, 60, 200, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر التقليدي', 2, 'إزالة شعر الذراعين', 1, 30, 80, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر التقليدي', 2, 'إزالة شعر البيكيني', 2, 30, 80, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر التقليدي', 2, 'إزالة شعر الذقن', 3, 30, 80, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر التقليدي', 2, 'إزالة شعر البيكيني الكامل', 4, 30, 80, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر التقليدي', 2, 'إزالة شعر الساقين بالكامل', 5, 30, 80, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر التقليدي', 2, 'إزالة شعر نصف الساقين', 6, 30, 80, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر التقليدي', 2, 'إزالة شعر الإبطين', 7, 30, 80, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر الذراعين حتى الكوع (نساء)', 1, 30, 150, 'women'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر الذراعين حتى الكوع (رجال)', 2, 30, 150, 'men'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر الذقن', 3, 30, 150, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر الذراعين بالكامل (رجال)', 4, 30, 150, 'men'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر الذراعين بالكامل (نساء)', 5, 30, 150, 'women'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر البيكيني الكامل', 6, 30, 150, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر الساقين بالكامل (رجال)', 7, 30, 150, 'men'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر الساقين بالكامل (نساء)', 8, 30, 150, 'women'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر الشفة السفلى', 9, 30, 150, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر الإبطين (رجال)', 10, 30, 150, 'men'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر الإبطين (نساء)', 11, 30, 150, 'women'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر نصف الساقين (رجال)', 12, 30, 150, 'men'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر نصف الساقين (نساء)', 13, 30, 150, 'women'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'إزالة الشعر بالليزر/الأجهزة', 3, 'ليزر الشارب / الشفة العليا', 14, 30, 150, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'تقشير البشرة', 4, 'تقشير الماندليك (حمض اللوز)', 1, 45, 250, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'تقشير البشرة', 4, 'تقشير كيميائي', 2, 45, 250, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'تقشير البشرة', 4, 'تقشير مركب', 3, 45, 250, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'تقشير البشرة', 4, 'تقشير الفيروليك (للنضارة)', 4, 45, 250, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'تقشير البشرة', 4, 'تقشير الحليب (اللاكتيك)', 5, 45, 250, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'تقشير البشرة', 4, 'جلسة تهدئة البشرة بعد التقشير المتوسط', 6, 45, 250, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'تقشير البشرة', 4, 'برنامج عناية واستشفاء بعد التقشير', 7, 45, 250, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'تقشير البشرة', 4, 'تقشير الريتينول', 8, 45, 250, 'all'),
    ('cosmetology', 'العناية بالبشرة والتجميل', 3, '#EC4899', 'تقشير البشرة', 4, 'تقشير الساليسليك', 9, 45, 250, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'صبغة خالية من الأمونيا', 1, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'سحب لون الشعر', 2, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'تصحيح / استعادة لون الشعر', 3, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'صبغ الشعر', 4, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'تغطية الشيب', 5, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'تلوين الشعر', 6, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'تهيئة الشعر للصبغ أو التجعيد', 7, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'خصلات ملونة (هايلايت)', 8, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'رنساج باستيل', 9, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'هايلايت الجذور', 10, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'صبغ الجذور', 11, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'صبغ وتلوين الشعر', 1, 'تونر / رنساج الشعر', 12, 120, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'ترميم وعلاج الشعر', 2, 'حماية لون الصبغة', 1, 90, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'ترميم وعلاج الشعر', 2, 'عناية أساسية بالشعر', 2, 90, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'ترميم وعلاج الشعر', 2, 'تغليف / لاميناشن الشعر', 3, 90, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'ترميم وعلاج الشعر', 2, 'ماسك إحياء ولمعان الشعر', 4, 90, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'ترميم وعلاج الشعر', 2, 'علاج أطراف الشعر المتقصفة', 5, 90, 300, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'تصفيف وتسريح الشعر', 3, 'تجعيد / فير الشعر', 1, 45, 100, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'تصفيف وتسريح الشعر', 3, 'تسريحة سهرة', 2, 45, 100, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'تصفيف وتسريح الشعر', 3, 'سشوار / تصفيف سريع', 3, 45, 100, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'تصفيف وتسريح الشعر', 3, 'ضفيرة فرنسية', 4, 45, 100, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'تصفيف وتسريح الشعر', 3, 'ستريتنر / تمليس الشعر', 5, 45, 100, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'تصفيف وتسريح الشعر', 3, 'تصفيف الشعر', 6, 45, 100, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'تصفيف وتسريح الشعر', 3, 'تصفيف شعر للأطفال', 7, 45, 100, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'تصفيف وتسريح الشعر', 3, 'تصفيف شعر للمراهقات', 8, 45, 100, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'تصفيف وتسريح الشعر', 3, 'تسريحة عروس', 9, 45, 100, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'قص الشعر', 4, 'تعديل قص الشعر (المستوى 1 إلى 4)', 1, 40, 70, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'قص الشعر', 4, 'قص الشعر حسب الطول (المستوى 1 إلى 4)', 2, 40, 70, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'قص الشعر', 4, 'قصات حديثة/موديل (المستوى 1 إلى 4)', 3, 40, 70, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'قص الشعر', 4, 'غسيل الشعر', 4, 40, 70, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'قص شعر الأطفال واليافعين', 5, 'قص شعر للأطفال (حتى 6 سنوات)', 1, 25, 40, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'قص شعر الأطفال واليافعين', 5, 'قص شعر للأطفال (6 إلى 10 سنوات)', 2, 25, 40, 'all'),
    ('hairdressing', 'خدمات الشعر', 1, '#7C3AED', 'قص شعر الأطفال واليافعين', 5, 'قص شعر للمراهقين', 3, 25, 40, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'مكياج عروس', 1, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'مكياج يومي / ناعم', 2, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'مكياج سهرة', 3, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'تعديل ورسم الحواجب', 4, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'تحديد وترتيب الحواجب', 5, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'صبغ / تشقير الحواجب', 6, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'صبغ الحواجب بالحناء', 7, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'تعديل وتنسيق الرموش', 8, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'تركيب رموش (إكستنشن)', 9, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'إزالة رموش الإكستنشن', 10, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'رفع وتغذية الرموش (لاميناشن)', 11, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'تجعيد الرموش (بيرم)', 12, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'صبغ الرموش', 13, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'صبغ الرموش بالحناء', 14, 60, 150, 'all'),
    ('makeup', 'المكياج والتجميل', 5, '#EF4444', 'المكياج والرموش والحواجب', 1, 'مكياج شامل', 15, 60, 150, 'all'),
    ('massage', 'المساج والاسترخاء', 6, '#10B981', 'خدمات المساج', 1, 'مساج ثنائي (أربعة أيدي)', 1, 60, 200, 'all'),
    ('massage', 'المساج والاسترخاء', 6, '#10B981', 'خدمات المساج', 1, 'مساج السيلوليت', 2, 60, 200, 'all'),
    ('massage', 'المساج والاسترخاء', 6, '#10B981', 'خدمات المساج', 1, 'مساج الظهر', 3, 60, 200, 'all'),
    ('massage', 'المساج والاسترخاء', 6, '#10B981', 'خدمات المساج', 1, 'مساج الرقبة والكتفين', 4, 60, 200, 'all'),
    ('massage', 'المساج والاسترخاء', 6, '#10B981', 'خدمات المساج', 1, 'مساج كامل للجسم', 5, 60, 200, 'all'),
    ('massage', 'المساج والاسترخاء', 6, '#10B981', 'خدمات المساج', 1, 'مساج بالعسل', 6, 60, 200, 'all'),
    ('massage', 'المساج والاسترخاء', 6, '#10B981', 'خدمات المساج', 1, 'مساج تصريف اللمف', 7, 60, 200, 'all'),
    ('massage', 'المساج والاسترخاء', 6, '#10B981', 'خدمات المساج', 1, 'مساج الحوامل', 8, 60, 200, 'all'),
    ('massage', 'المساج والاسترخاء', 6, '#10B981', 'خدمات المساج', 1, 'مساج استرخائي', 9, 60, 200, 'all'),
    ('barbershop', 'الحلاقة الرجالية', 2, '#0EA5E9', 'العناية والشعر للرجال', 1, 'تحديد وتهذيب اللحية', 1, 30, 50, 'men'),
    ('barbershop', 'الحلاقة الرجالية', 2, '#0EA5E9', 'العناية والشعر للرجال', 1, 'قص شعر رجالي', 2, 30, 50, 'men'),
    ('barbershop', 'الحلاقة الرجالية', 2, '#0EA5E9', 'العناية والشعر للرجال', 1, 'تهذيب الشارب', 3, 30, 50, 'men'),
    ('barbershop', 'الحلاقة الرجالية', 2, '#0EA5E9', 'العناية والشعر للرجال', 1, 'ترتيب الشارب والسوالف واللحية', 4, 30, 50, 'men'),
    ('barbershop', 'الحلاقة الرجالية', 2, '#0EA5E9', 'العناية والشعر للرجال', 1, 'حلاقة وتخفيف بسيط', 5, 30, 50, 'men'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'إصلاح ظفر واحد', 1, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'مانيكير كلاسيكي', 2, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'مانيكير مشترك', 3, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'طلاء أظافر سريع', 4, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'فرنش سريع', 5, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'طلاء جل سريع', 6, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'مانيكير سريع', 7, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'طلاء فينيليكس سريع', 8, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'تركيب أظافر فرنسية (فرنش)', 9, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'طلاء أظافر بالجل', 10, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'مانيكير بالجهاز (الدريل)', 11, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'مانيكير أساسي', 12, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'طلاء / تغليف الأظافر', 13, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'تعديل أظافر مع ديزاين', 14, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'تركيب وتمديد الأظافر', 15, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'تركيب أظافر مع ديزاين', 16, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'تسوية سطح الظفر', 17, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'تعديل ظفر واحد', 18, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'ديزاين لظفر واحد', 19, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية باليدين', 1, 'إزالة الأظافر التركيب', 20, 45, 90, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية بالقدمين', 2, 'باديكير كلاسيكي للرجال', 1, 50, 110, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية بالقدمين', 2, 'باديكير كلاسيكي للنساء', 2, 50, 110, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية بالقدمين', 2, 'باديكير متكامل', 3, 50, 110, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية بالقدمين', 2, 'باديكير طبي / علاجي', 4, 50, 110, 'all'),
    ('nails', 'العناية بالأظافر', 4, '#F59E0B', 'العناية بالقدمين', 2, 'باديكير مع طلاء شيلاك', 5, 50, 110, 'all'),
    ('tanning', 'تسمير البشرة', 7, '#A16207', 'التسمير الصناعي', 1, 'تسمير بشرة / تان (بالدقيقة)', 1, 1, 5, 'all');

  -- Level 1: one root per business type, carrying the type.
  insert into service_categories (salon_id, parent_id, business_type, name, sort_order)
  select distinct p_salon_id, null::uuid, c.bt, c.root_name, c.root_order
  from tmp_service_catalog c;

  -- Level 2: sections, untyped — they inherit from their root.
  insert into service_categories (salon_id, parent_id, business_type, name, sort_order)
  select distinct p_salon_id, r.id, null::business_type, c.section_name, c.section_order
  from tmp_service_catalog c
  join service_categories r
    on r.salon_id = p_salon_id
   and r.parent_id is null
   and r.business_type = c.bt;

  -- Level 3: the services themselves, under their section.
  insert into services (salon_id, category_id, name, duration_minutes, price, color, sort_order, sex)
  select p_salon_id, s.id, c.svc_name, c.svc_minutes, c.svc_price, c.root_color, c.svc_order, c.svc_sex
  from tmp_service_catalog c
  join service_categories r
    on r.salon_id = p_salon_id
   and r.parent_id is null
   and r.business_type = c.bt
  join service_categories s
    on s.parent_id = r.id
   and s.name = c.section_name;

  drop table tmp_service_catalog;
end;
$function$


CREATE OR REPLACE FUNCTION public.sync_resource_units()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into resource_units (salon_id, resource_id, unit_index)
    select new.salon_id, new.id, i
    from generate_series(1, new.capacity) as i;

  elsif tg_op = 'UPDATE' and new.capacity is distinct from old.capacity then
    if new.capacity > old.capacity then
      insert into resource_units (salon_id, resource_id, unit_index)
      select new.salon_id, new.id, i
      from generate_series(old.capacity + 1, new.capacity) as i;
    else
      delete from resource_units
      where resource_id = new.id
        and unit_index > new.capacity;
    end if;
  end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.trg_seed_adjustment_reasons()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform seed_adjustment_reasons_for_salon(new.id);
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.trg_seed_cancellation_reasons()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform seed_cancellation_reasons_for_salon(new.id);
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.trg_seed_reschedule_reasons()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform seed_reschedule_reasons_for_salon(new.id);
  return new;
end;
$function$

create or replace function public.list_recent_meeting_room_bookings_v3()
returns table(
  id uuid,
  room_code text,
  room_name text,
  meeting_title text,
  booking_date date,
  start_time time without time zone,
  end_time time without time zone,
  booking_status text,
  requester_profile_id uuid,
  requester_name text,
  requester_role text,
  requester_unit text,
  requester_department text,
  approver_profile_id uuid,
  approver_name text,
  approval_decision_at timestamptz,
  approval_notes text,
  cancelled_at timestamptz,
  cancellation_reason text,
  can_cancel boolean,
  can_approve boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile public.profiles%rowtype;
begin
  select *
  into v_profile
  from public.profiles
  where auth_user_id = auth.uid()
    and active = true
  limit 1;

  if v_profile.id is null then
    raise exception 'Profile aktif tidak ditemukan.';
  end if;

  if (
    (
      lower(trim(coalesce(v_profile.role_level, ''))) like '%system%'
      and lower(trim(coalesce(v_profile.role_level, ''))) like '%admin%'
    )
    or lower(trim(coalesce(v_profile.unit, ''))) = 'administrasi sistem'
  ) then
    raise exception 'SYSTEM_ADMIN tidak menggunakan modul booking ruangan.';
  end if;

  return query
  with ranked as (
    select
      b.*,
      row_number() over (
        partition by b.room_code
        order by b.created_at desc, b.booking_date desc, b.start_time desc, b.id
      ) as room_rank
    from public.marketing_meeting_room_bookings b
    where b.booking_status in ('BOOKED', 'PENDING_APPROVAL')
      and b.room_code in ('MARKETING_MEETING_ROOM', 'DIRPEM_WORK_ROOM')
  )
  select
    b.id,
    b.room_code,
    case
      when b.room_code = 'MARKETING_MEETING_ROOM' then 'Ruang Meeting Marketing'
      when b.room_code = 'DIRPEM_WORK_ROOM' then 'Ruang Kerja DirPem'
      else b.room_code
    end as room_name,
    b.meeting_title,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.booking_status,
    b.requester_profile_id,
    requester.full_name as requester_name,
    requester.role_level as requester_role,
    requester.unit as requester_unit,
    requester.department as requester_department,
    b.approver_profile_id,
    approver.full_name as approver_name,
    b.approval_decision_at,
    b.approval_notes,
    b.cancelled_at,
    b.cancellation_reason,
    (
      b.requester_profile_id = v_profile.id
      and b.booking_status in ('BOOKED', 'PENDING_APPROVAL')
    ) as can_cancel,
    (
      b.approver_profile_id = v_profile.id
      and b.room_code = 'DIRPEM_WORK_ROOM'
      and b.booking_status = 'PENDING_APPROVAL'
    ) as can_approve,
    b.created_at
  from ranked b
  join public.profiles requester
    on requester.id = b.requester_profile_id
  left join public.profiles approver
    on approver.id = b.approver_profile_id
  where b.room_rank <= 10
  order by
    case when b.room_code = 'MARKETING_MEETING_ROOM' then 1 else 2 end,
    b.room_rank;
end;
$function$;

revoke all on function public.list_recent_meeting_room_bookings_v3()
from public, anon;
grant execute on function public.list_recent_meeting_room_bookings_v3()
to authenticated;

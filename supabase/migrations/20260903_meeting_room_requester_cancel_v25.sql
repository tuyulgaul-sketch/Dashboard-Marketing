-- V25: requester cancellation for both Marketing Meeting Room and DirPem Room.
-- Requester may cancel their own booking while status is BOOKED or PENDING_APPROVAL,
-- regardless of whether the scheduled start time has already passed.

create or replace function public.list_meeting_room_bookings_v2(
  p_from_date date default current_date,
  p_to_date date default (current_date + 90)
)
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
  approval_decision_at timestamp with time zone,
  approval_notes text,
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  can_cancel boolean,
  can_approve boolean,
  created_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
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

  if p_to_date < p_from_date then
    raise exception 'Range tanggal tidak valid.';
  end if;

  return query
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
  from public.marketing_meeting_room_bookings b
  join public.profiles requester
    on requester.id = b.requester_profile_id
  left join public.profiles approver
    on approver.id = b.approver_profile_id
  where b.booking_date between p_from_date and p_to_date
  order by b.booking_date asc, b.start_time asc, b.created_at asc;
end;
$$;

create or replace function public.cancel_meeting_room_booking_v2(
  p_booking_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_booking public.marketing_meeting_room_bookings%rowtype;
  v_reason text;
  v_result jsonb;
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

  select *
  into v_booking
  from public.marketing_meeting_room_bookings b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking tidak ditemukan.';
  end if;

  if v_booking.requester_profile_id <> v_profile.id then
    raise exception 'Hanya user yang membuat booking yang dapat melakukan cancel.';
  end if;

  if v_booking.booking_status not in ('BOOKED', 'PENDING_APPROVAL') then
    raise exception 'Booking ini tidak dapat dibatalkan.';
  end if;

  v_reason := trim(coalesce(p_reason, ''));

  update public.marketing_meeting_room_bookings
  set
    booking_status = 'CANCELLED',
    cancelled_at = now(),
    cancelled_by_profile_id = v_profile.id,
    cancellation_reason = nullif(v_reason, '')
  where id = p_booking_id;

  -- For DirPem, inform the approver that the slot has been released.
  if v_booking.room_code = 'DIRPEM_WORK_ROOM'
     and v_booking.approver_profile_id is not null
  then
    insert into public.notifications (
      recipient_profile_id,
      notification_type,
      module,
      title,
      message,
      related_record_id,
      link_path
    )
    values (
      v_booking.approver_profile_id,
      'MEETING_ROOM_CANCELLED',
      'MEETING_ROOM',
      'Booking Ruang Kerja DirPem Dibatalkan',
      format(
        '%s membatalkan booking "%s" pada %s pukul %s - %s.',
        v_profile.full_name,
        v_booking.meeting_title,
        to_char(v_booking.booking_date, 'DD Mon YYYY'),
        to_char(v_booking.start_time, 'HH24:MI'),
        to_char(v_booking.end_time, 'HH24:MI')
      ),
      v_booking.id,
      '/booking-ruang-meeting'
    );
  end if;

  select to_jsonb(b)
  into v_result
  from public.marketing_meeting_room_bookings b
  where b.id = p_booking_id;

  return v_result;
end;
$$;

revoke all on function public.list_meeting_room_bookings_v2(date, date) from public, anon;
grant execute on function public.list_meeting_room_bookings_v2(date, date) to authenticated;

revoke all on function public.cancel_meeting_room_booking_v2(uuid, text) from public, anon;
grant execute on function public.cancel_meeting_room_booking_v2(uuid, text) to authenticated;

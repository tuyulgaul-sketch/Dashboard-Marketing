-- Dashboard Marketing PertaLife
-- Personal Task Need Support Approval V30
-- 2026-09-04
--
-- Extends the existing NEED_SUPPORT collaborator flow with explicit per-person
-- approval for PERSONAL activities. Existing Assignment / Collaboration flows
-- remain unchanged.

begin;

alter table public.activities
  add column if not exists support_approval_status text,
  add column if not exists support_approval_total smallint not null default 0,
  add column if not exists support_approval_approved smallint not null default 0;

do $do$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'activities_support_approval_status_check'
      and conrelid = 'public.activities'::regclass
  ) then
    alter table public.activities
      add constraint activities_support_approval_status_check
      check (
        support_approval_status is null
        or support_approval_status in ('PENDING', 'APPROVED', 'REJECTED')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'activities_support_approval_count_check'
      and conrelid = 'public.activities'::regclass
  ) then
    alter table public.activities
      add constraint activities_support_approval_count_check
      check (
        support_approval_total >= 0
        and support_approval_approved >= 0
        and support_approval_approved <= support_approval_total
      );
  end if;
end
$do$;

create table if not exists public.activity_support_approvals (
  activity_id uuid not null
    references public.activities(id) on delete cascade,
  profile_id uuid not null
    references public.profiles(id) on delete cascade,
  requested_by_profile_id uuid not null
    references public.profiles(id),
  decision_status text not null default 'PENDING'
    check (decision_status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  decision_note text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (activity_id, profile_id)
);

create index if not exists activity_support_approvals_profile_idx
  on public.activity_support_approvals(profile_id, decision_status, requested_at desc);

create index if not exists activity_support_approvals_activity_idx
  on public.activity_support_approvals(activity_id, requested_at desc);

alter table public.activity_support_approvals enable row level security;

-- No direct browser table access. All reads / decisions go through guarded RPCs.
revoke all on public.activity_support_approvals from anon, authenticated;

create or replace function public.sync_need_support_approval_v30()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.collaboration_context = 'NEED_SUPPORT'
     and new.can_edit = true then
    insert into public.activity_support_approvals (
      activity_id,
      profile_id,
      requested_by_profile_id,
      decision_status,
      decision_note,
      requested_at,
      decided_at
    )
    values (
      new.activity_id,
      new.profile_id,
      new.added_by_profile_id,
      'PENDING',
      null,
      coalesce(new.requested_at, now()),
      null
    )
    on conflict (activity_id, profile_id)
    do update set
      requested_by_profile_id = excluded.requested_by_profile_id,
      decision_status = 'PENDING',
      decision_note = null,
      requested_at = excluded.requested_at,
      decided_at = null;
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_need_support_approval_v30() from public, anon, authenticated;

drop trigger if exists trg_sync_need_support_approval_v30
on public.activity_collaborators;

create trigger trg_sync_need_support_approval_v30
after insert or update of collaboration_context, context_note, requested_at, can_edit
on public.activity_collaborators
for each row
execute function public.sync_need_support_approval_v30();

create or replace function public.guard_personal_need_support_v30()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_latest_requested_at timestamptz;
  v_total integer;
begin
  if new.activity_mode = 'PERSONAL'
     and new.status = 'NEED_SUPPORT'
     and old.status is distinct from new.status then

    select max(sa.requested_at)
      into v_latest_requested_at
    from public.activity_support_approvals sa
    where sa.activity_id = new.id;

    if v_latest_requested_at is null then
      raise exception 'Task Pribadi Need Support membutuhkan minimal 1 support target aktif.';
    end if;

    -- Keep only the latest request cycle. Decision history remains preserved in
    -- activity_history, while this table represents the currently active cycle.
    delete from public.activity_support_approvals sa
    where sa.activity_id = new.id
      and sa.requested_at < v_latest_requested_at;

    update public.activity_collaborators c
    set can_edit = false
    where c.activity_id = new.id
      and c.collaboration_context = 'NEED_SUPPORT'
      and coalesce(c.requested_at, '-infinity'::timestamptz) < v_latest_requested_at;

    select count(*)
      into v_total
    from public.activity_support_approvals sa
    where sa.activity_id = new.id
      and sa.requested_at = v_latest_requested_at
      and sa.decision_status = 'PENDING';

    if v_total < 1 then
      raise exception 'Task Pribadi Need Support membutuhkan minimal 1 support target aktif.';
    end if;

    new.support_approval_status := 'PENDING';
    new.support_approval_total := v_total;
    new.support_approval_approved := 0;
  end if;

  -- Owner cannot bypass a pending personal Need Support request by moving the
  -- card out of NEED_SUPPORT. Review RPCs update the approval state first.
  if old.activity_mode = 'PERSONAL'
     and old.status = 'NEED_SUPPORT'
     and old.support_approval_status = 'PENDING'
     and new.status is distinct from old.status
     and new.status <> 'CANCELLED'
     and coalesce(new.support_approval_status, 'PENDING') = 'PENDING' then
    raise exception 'Task masih menunggu approval dari seluruh user Need Support.';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_personal_need_support_v30() from public, anon, authenticated;

drop trigger if exists trg_guard_personal_need_support_v30
on public.activities;

create trigger trg_guard_personal_need_support_v30
before update of status, support_approval_status
on public.activities
for each row
execute function public.guard_personal_need_support_v30();

create or replace function public.list_activity_support_approvals_v30(
  p_activity_id uuid
)
returns table (
  profile_id uuid,
  full_name text,
  role_level text,
  unit text,
  department text,
  decision_status text,
  decision_note text,
  requested_at timestamptz,
  decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if public.current_profile_id() is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  if not public.can_view_activity_id(p_activity_id) then
    raise exception 'Anda tidak memiliki akses untuk melihat approval Need Support ini.';
  end if;

  return query
  select
    sa.profile_id,
    p.full_name,
    p.role_level,
    p.unit,
    p.department,
    sa.decision_status,
    sa.decision_note,
    sa.requested_at,
    sa.decided_at
  from public.activity_support_approvals sa
  join public.profiles p
    on p.id = sa.profile_id
  where sa.activity_id = p_activity_id
  order by p.full_name;
end;
$function$;

revoke all on function public.list_activity_support_approvals_v30(uuid) from public, anon;
grant execute on function public.list_activity_support_approvals_v30(uuid) to authenticated;

create or replace function public.review_personal_task_support_v30(
  p_activity_id uuid,
  p_decision text,
  p_note text default null
)
returns public.activities
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_me uuid;
  v_activity public.activities%rowtype;
  v_decision text;
  v_note text;
  v_total integer;
  v_approved integer;
  v_name text;
begin
  v_me := public.current_profile_id();
  v_decision := upper(trim(coalesce(p_decision, '')));
  v_note := nullif(trim(coalesce(p_note, '')), '');

  if v_me is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  if v_decision not in ('APPROVE', 'REJECT') then
    raise exception 'Keputusan Need Support tidak valid.';
  end if;

  if v_decision = 'REJECT' and v_note is null then
    raise exception 'Catatan penolakan Need Support wajib diisi.';
  end if;

  select a.*
    into v_activity
  from public.activities a
  where a.id = p_activity_id
  for update;

  if not found then
    raise exception 'Aktivitas tidak ditemukan.';
  end if;

  if v_activity.activity_mode <> 'PERSONAL' then
    raise exception 'Approval Need Support V30 hanya berlaku untuk Task Pribadi.';
  end if;

  if v_activity.status <> 'NEED_SUPPORT'
     or v_activity.support_approval_status <> 'PENDING' then
    raise exception 'Task ini tidak sedang menunggu approval Need Support.';
  end if;

  if not exists (
    select 1
    from public.activity_support_approvals sa
    where sa.activity_id = p_activity_id
      and sa.profile_id = v_me
      and sa.decision_status = 'PENDING'
  ) then
    raise exception 'Anda bukan approver Need Support yang masih pending untuk task ini.';
  end if;

  select p.full_name
    into v_name
  from public.profiles p
  where p.id = v_me;

  update public.activity_support_approvals
  set
    decision_status = case when v_decision = 'APPROVE' then 'APPROVED' else 'REJECTED' end,
    decision_note = v_note,
    decided_at = now()
  where activity_id = p_activity_id
    and profile_id = v_me
    and decision_status = 'PENDING';

  -- The current reviewer has finished their action immediately.
  update public.activity_collaborators
  set can_edit = false
  where activity_id = p_activity_id
    and profile_id = v_me
    and collaboration_context = 'NEED_SUPPORT';

  select
    count(*),
    count(*) filter (where decision_status = 'APPROVED')
  into v_total, v_approved
  from public.activity_support_approvals
  where activity_id = p_activity_id;

  if v_decision = 'REJECT' then
    update public.activity_support_approvals
    set
      decision_status = 'CANCELLED',
      decision_note = coalesce(decision_note, 'Siklus Need Support ditutup karena terdapat penolakan.'),
      decided_at = coalesce(decided_at, now())
    where activity_id = p_activity_id
      and decision_status = 'PENDING';

    update public.activity_collaborators
    set can_edit = false
    where activity_id = p_activity_id
      and collaboration_context = 'NEED_SUPPORT';

    update public.activities
    set
      status = 'ON_PROGRESS',
      support_approval_status = 'REJECTED',
      support_approval_total = v_total,
      support_approval_approved = v_approved,
      status_note = concat('Need Support ditolak oleh ', coalesce(v_name, 'support approver'), ': ', v_note),
      updated_at = now()
    where id = p_activity_id
    returning * into v_activity;

    insert into public.activity_history (
      activity_id, actor_profile_id, action, old_status, new_status, notes
    ) values (
      p_activity_id,
      v_me,
      'SUPPORT_REJECTED',
      'NEED_SUPPORT',
      'ON_PROGRESS',
      v_note
    );

    perform public.create_system_notification_vnext(
      v_activity.owner_profile_id,
      'ACTIVITY_SUPPORT_REJECTED',
      'Need Support dikembalikan',
      coalesce(v_name, 'Support approver') || ' mengembalikan Need Support untuk: ' || coalesce(v_activity.title, 'Aktivitas'),
      v_activity.id,
      '/aktivitas',
      'ACTIVITY',
      'support-rejected:' || v_activity.id::text || ':' || v_me::text || ':' || now()::text,
      false
    );

    return v_activity;
  end if;

  if v_approved = v_total and v_total > 0 then
    update public.activity_collaborators
    set can_edit = false
    where activity_id = p_activity_id
      and collaboration_context = 'NEED_SUPPORT';

    update public.activities
    set
      status = 'ON_PROGRESS',
      support_approval_status = 'APPROVED',
      support_approval_total = v_total,
      support_approval_approved = v_approved,
      status_note = 'Seluruh user Need Support telah menyetujui. Task dapat dilanjutkan / diselesaikan oleh owner.',
      updated_at = now()
    where id = p_activity_id
    returning * into v_activity;

    insert into public.activity_history (
      activity_id, actor_profile_id, action, old_status, new_status, notes
    ) values (
      p_activity_id,
      v_me,
      'SUPPORT_ALL_APPROVED',
      'NEED_SUPPORT',
      'ON_PROGRESS',
      coalesce(v_note, 'Seluruh user Need Support telah approve.')
    );

    perform public.create_system_notification_vnext(
      v_activity.owner_profile_id,
      'ACTIVITY_SUPPORT_APPROVED',
      'Need Support disetujui',
      'Seluruh user Need Support telah menyetujui: ' || coalesce(v_activity.title, 'Aktivitas') || '. Task sekarang dapat diselesaikan.',
      v_activity.id,
      '/aktivitas',
      'ACTIVITY',
      'support-all-approved:' || v_activity.id::text || ':' || now()::text,
      false
    );
  else
    update public.activities
    set
      support_approval_total = v_total,
      support_approval_approved = v_approved,
      status_note = v_approved::text || ' dari ' || v_total::text || ' user Need Support telah approve.',
      updated_at = now()
    where id = p_activity_id
    returning * into v_activity;

    insert into public.activity_history (
      activity_id, actor_profile_id, action, old_status, new_status, notes
    ) values (
      p_activity_id,
      v_me,
      'SUPPORT_APPROVED',
      'NEED_SUPPORT',
      'NEED_SUPPORT',
      coalesce(v_note, 'Need Support disetujui oleh ' || coalesce(v_name, 'support approver') || '.')
    );

    perform public.create_system_notification_vnext(
      v_activity.owner_profile_id,
      'ACTIVITY_SUPPORT_PARTIAL_APPROVED',
      'Need Support disetujui sebagian',
      coalesce(v_name, 'Support approver') || ' menyetujui Need Support untuk: ' || coalesce(v_activity.title, 'Aktivitas') || '. Menunggu approver lainnya.',
      v_activity.id,
      '/aktivitas',
      'ACTIVITY',
      'support-partial:' || v_activity.id::text || ':' || v_me::text || ':' || now()::text,
      false
    );
  end if;

  return v_activity;
end;
$function$;

revoke all on function public.review_personal_task_support_v30(uuid, text, text) from public, anon;
grant execute on function public.review_personal_task_support_v30(uuid, text, text) to authenticated;

-- Personal completion guard: once a Task Pribadi requests support, Done is only
-- possible after all selected support users approve the latest request cycle.
create or replace function public.complete_personal_activity_v6(
  p_activity_id uuid,
  p_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_me uuid;
  v_activity public.activities%rowtype;
  v_outcome text;
  v_result jsonb;
begin
  v_me := public.current_profile_id();
  v_outcome := trim(coalesce(p_outcome, ''));

  if v_me is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  if length(v_outcome) < 3 then
    raise exception 'Hasil / Outcome wajib diisi.';
  end if;

  select a.*
    into v_activity
  from public.activities a
  where a.id = p_activity_id
  for update;

  if not found then
    raise exception 'Aktivitas tidak ditemukan.';
  end if;

  if v_activity.activity_mode <> 'PERSONAL' then
    raise exception 'Hanya Task Pribadi yang dapat diselesaikan sendiri.';
  end if;

  if v_activity.owner_profile_id <> v_me then
    raise exception 'Hanya pemilik Task Pribadi yang dapat menandai Done.';
  end if;

  if v_activity.status in ('DRAFT', 'DONE', 'CANCELLED', 'PENDING_VALIDATION') then
    raise exception 'Status Task Pribadi saat ini tidak dapat langsung diselesaikan.';
  end if;

  if v_activity.support_approval_status = 'PENDING' then
    raise exception 'Task masih menunggu approval dari seluruh user Need Support.';
  end if;

  if v_activity.support_approval_status = 'REJECTED' then
    raise exception 'Need Support sebelumnya ditolak. Tindak lanjuti task lalu ajukan Need Support ulang sebelum Done.';
  end if;

  if v_activity.support_approval_status = 'APPROVED'
     and (
       v_activity.support_approval_total < 1
       or v_activity.support_approval_approved <> v_activity.support_approval_total
     ) then
    raise exception 'Status approval Need Support belum konsisten. Muat ulang task dan coba kembali.';
  end if;

  update public.activities
  set
    status = 'DONE',
    progress = 100,
    result = v_outcome,
    status_note = case
      when support_approval_status = 'APPROVED'
        then 'Diselesaikan owner setelah seluruh Need Support approve.'
      else 'Diselesaikan sendiri oleh pemilik Task Pribadi.'
    end,
    validation_approver_profile_id = null,
    validation_submitted_at = null,
    validated_at = now(),
    validation_notes = null,
    updated_at = now()
  where id = p_activity_id;

  insert into public.activity_history (
    activity_id,
    actor_profile_id,
    action,
    old_status,
    new_status,
    notes
  )
  values (
    p_activity_id,
    v_me,
    'PERSONAL_COMPLETED',
    v_activity.status,
    'DONE',
    v_outcome
  );

  select to_jsonb(a)
    into v_result
  from public.activities a
  where a.id = p_activity_id;

  return v_result;
end;
$function$;

revoke all on function public.complete_personal_activity_v6(uuid, text) from public, anon;
grant execute on function public.complete_personal_activity_v6(uuid, text) to authenticated;

comment on table public.activity_support_approvals
is 'Current Need Support approval cycle for PERSONAL activities. Decision audit is retained in activity_history.';

commit;

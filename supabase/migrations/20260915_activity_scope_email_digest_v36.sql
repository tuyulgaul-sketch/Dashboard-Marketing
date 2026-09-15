-- Activity privacy + due-email hardening v36
-- 1) Activity visibility is directional: owner/creator, explicit requester/collaborator,
--    or a manager viewing a descendant. Same-department peers/subordinates do not inherit access.
-- 2) Due/overdue app notifications remain per task, while email is a single daily digest per recipient.
-- 3) Email outbox workers claim rows atomically to prevent duplicate sends under concurrent webhooks.

create or replace function public.can_view_activity_id(p_activity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  me uuid;
  owner_id uuid;
  creator_id uuid;
  current_status text;
  current_assignment_source text;
  requester_id uuid;
begin
  me := public.current_profile_id();

  if me is null then
    return false;
  end if;

  select
    a.owner_profile_id,
    a.created_by_profile_id,
    a.status,
    a.assignment_source,
    a.assignment_requester_profile_id
  into
    owner_id,
    creator_id,
    current_status,
    current_assignment_source,
    requester_id
  from public.activities a
  where a.id = p_activity_id;

  if owner_id is null then
    return false;
  end if;

  -- Draft is private to its creator.
  if current_status = 'DRAFT' then
    return me = creator_id;
  end if;

  -- The owner and creator have an explicit relationship with the task.
  if me = owner_id or me = creator_id then
    return true;
  end if;

  -- Explicit requester/final approver of a self-declared assignment may read it.
  if current_assignment_source = 'SELF_DECLARED'
     and requester_id = me then
    return true;
  end if;

  -- Directional hierarchy only: a manager may see tasks owned by descendants.
  -- A subordinate or peer does not gain access to a manager/peer task merely
  -- because they share unit/department.
  if public.is_profile_in_scope(owner_id) then
    return true;
  end if;

  -- Explicit collaboration remains an allowed access grant.
  return exists (
    select 1
    from public.activity_collaborators c
    where c.activity_id = p_activity_id
      and c.profile_id = me
  );
end;
$function$;

create or replace function public.can_profile_view_activity_v2(
  p_viewer_profile_id uuid,
  p_activity_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_owner_id uuid;
  v_creator_id uuid;
  v_status text;
  v_assignment_source text;
  v_requester_id uuid;
begin
  if p_viewer_profile_id is null or p_activity_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_viewer_profile_id
      and p.active = true
  ) then
    return false;
  end if;

  select
    a.owner_profile_id,
    a.created_by_profile_id,
    a.status,
    a.assignment_source,
    a.assignment_requester_profile_id
  into
    v_owner_id,
    v_creator_id,
    v_status,
    v_assignment_source,
    v_requester_id
  from public.activities a
  where a.id = p_activity_id;

  if v_owner_id is null then
    return false;
  end if;

  if v_status = 'DRAFT' then
    return p_viewer_profile_id = v_creator_id;
  end if;

  if p_viewer_profile_id = v_owner_id
     or p_viewer_profile_id = v_creator_id then
    return true;
  end if;

  if v_assignment_source = 'SELF_DECLARED'
     and v_requester_id = p_viewer_profile_id then
    return true;
  end if;

  -- Viewer may read the task only when the owner is in the viewer's
  -- downward reporting tree.
  if exists (
    with recursive scope_tree as (
      select p.id
      from public.profiles p
      where p.id = p_viewer_profile_id
        and p.active = true

      union all

      select child.id
      from public.profiles child
      join scope_tree parent
        on child.manager_id = parent.id
      where child.active = true
    )
    select 1
    from scope_tree
    where id = v_owner_id
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.activity_collaborators c
    where c.activity_id = p_activity_id
      and c.profile_id = p_viewer_profile_id
  );
end;
$function$;

-- One digest notification/email per recipient per Jakarta calendar day.
create or replace function public.enqueue_activity_due_digest_v36(
  p_recipient_profile_id uuid,
  p_today date default ((now() at time zone 'Asia/Jakarta')::date)
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_due_soon integer := 0;
  v_overdue_own integer := 0;
  v_overdue_team integer := 0;
  v_total integer := 0;
  v_title text;
  v_message text;
begin
  if p_recipient_profile_id is null then
    return null;
  end if;

  select count(*)::integer
  into v_due_soon
  from public.activities a
  where a.owner_profile_id = p_recipient_profile_id
    and a.status not in ('DONE', 'CANCELLED')
    and a.due_date = p_today + 1;

  select count(*)::integer
  into v_overdue_own
  from public.activities a
  where a.owner_profile_id = p_recipient_profile_id
    and a.status not in ('DONE', 'CANCELLED')
    and a.due_date < p_today;

  select count(*)::integer
  into v_overdue_team
  from public.activities a
  join public.profiles owner
    on owner.id = a.owner_profile_id
   and owner.active = true
  where owner.manager_id = p_recipient_profile_id
    and a.status not in ('DONE', 'CANCELLED')
    and a.due_date < p_today;

  v_total := v_due_soon + v_overdue_own + v_overdue_team;

  if v_total = 0 then
    return null;
  end if;

  v_title := format('Ringkasan aktivitas due & overdue (%s)', to_char(p_today, 'DD-MM-YYYY'));
  v_message := format(
    'Terdapat %s aktivitas Anda yang jatuh tempo besok, %s aktivitas Anda yang overdue, dan %s aktivitas tim langsung yang overdue. Buka Dashboard untuk melihat rinciannya.',
    v_due_soon,
    v_overdue_own,
    v_overdue_team
  );

  return public.create_system_notification_vnext(
    p_recipient_profile_id,
    'ACTIVITY_DUE_DIGEST',
    v_title,
    v_message,
    null,
    '/aktivitas',
    'ACTIVITY',
    'activity-due-digest:' || p_today::text,
    true
  );
end;
$function$;

revoke all on function public.enqueue_activity_due_digest_v36(uuid, date) from public, anon, authenticated;
grant execute on function public.enqueue_activity_due_digest_v36(uuid, date) to service_role;

create or replace function public.generate_activity_due_notifications()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a public.activities%rowtype;
  r record;
  v_manager uuid;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  due_count integer := 0;
  overdue_count integer := 0;
  digest_count integer := 0;
begin
  if public.current_profile_id() is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  -- Keep per-task in-app reminders, but do not enqueue one email per task.
  for a in
    select *
    from public.activities
    where status not in ('DONE', 'CANCELLED')
      and due_date = v_today + 1
  loop
    perform public.create_system_notification_vnext(
      a.owner_profile_id,
      'ACTIVITY_DUE_SOON',
      'Aktivitas jatuh tempo besok',
      coalesce(a.title, 'Aktivitas') || ' memiliki due date besok.',
      a.id,
      '/aktivitas',
      'ACTIVITY',
      'due:' || a.id::text || ':' || a.due_date::text,
      false
    );
    due_count := due_count + 1;
  end loop;

  for a in
    select *
    from public.activities
    where status not in ('DONE', 'CANCELLED')
      and due_date < v_today
  loop
    if not exists (
      select 1
      from public.notifications n
      where n.recipient_profile_id = a.owner_profile_id
        and n.related_record_id = a.id
        and n.notification_type = 'ACTIVITY_OVERDUE'
        and (n.created_at at time zone 'Asia/Jakarta')::date >= a.due_date
    ) then
      perform public.create_system_notification_vnext(
        a.owner_profile_id,
        'ACTIVITY_OVERDUE',
        'Aktivitas overdue',
        coalesce(a.title, 'Aktivitas') || ' telah melewati due date.',
        a.id,
        '/aktivitas',
        'ACTIVITY',
        'overdue-owner:' || a.id::text || ':' || a.due_date::text,
        false
      );
    end if;

    select manager_id
    into v_manager
    from public.profiles
    where id = a.owner_profile_id
      and active = true;

    if v_manager is not null
       and v_manager <> a.owner_profile_id
       and not exists (
         select 1
         from public.notifications n
         where n.recipient_profile_id = v_manager
           and n.related_record_id = a.id
           and n.notification_type = 'ACTIVITY_OVERDUE_TEAM'
           and (n.created_at at time zone 'Asia/Jakarta')::date >= a.due_date
       ) then
      perform public.create_system_notification_vnext(
        v_manager,
        'ACTIVITY_OVERDUE_TEAM',
        'Aktivitas tim overdue',
        coalesce(a.title, 'Aktivitas') || ' telah melewati due date.',
        a.id,
        '/aktivitas',
        'ACTIVITY',
        'overdue-manager:' || a.id::text || ':' || a.due_date::text,
        false
      );
    end if;

    overdue_count := overdue_count + 1;
  end loop;

  -- Email is aggregated by recipient. A manager with many overdue direct reports
  -- receives one digest instead of one email per activity.
  for r in
    select distinct recipient_profile_id
    from (
      select a.owner_profile_id as recipient_profile_id
      from public.activities a
      where a.status not in ('DONE', 'CANCELLED')
        and (a.due_date = v_today + 1 or a.due_date < v_today)

      union

      select p.manager_id as recipient_profile_id
      from public.activities a
      join public.profiles p
        on p.id = a.owner_profile_id
       and p.active = true
      where a.status not in ('DONE', 'CANCELLED')
        and a.due_date < v_today
        and p.manager_id is not null
    ) recipients
    where recipient_profile_id is not null
  loop
    if public.enqueue_activity_due_digest_v36(r.recipient_profile_id, v_today) is not null then
      digest_count := digest_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'due_tomorrow_scanned', due_count,
    'overdue_scanned', overdue_count,
    'digest_emails_enqueued', digest_count
  );
end;
$function$;

-- Atomic email claim: concurrent webhook invocations cannot select the same row.
create or replace function public.claim_notification_email_outbox_v36(
  p_limit integer default 25
)
returns table(
  id uuid,
  recipient_email text,
  subject text,
  html_body text,
  attempts integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Recover a worker claim only when it has been abandoned for a long period.
  update public.notification_email_outbox
  set
    status = 'FAILED',
    last_error = coalesce(last_error, 'Recovered stale processing claim'),
    updated_at = now()
  where status = 'PROCESSING'
    and updated_at < now() - interval '15 minutes'
    and attempts < 5;

  return query
  with picked as (
    select o.id
    from public.notification_email_outbox o
    where o.status in ('PENDING', 'FAILED')
      and o.attempts < 5
    order by o.created_at, o.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ), claimed as (
    update public.notification_email_outbox o
    set
      status = 'PROCESSING',
      attempts = o.attempts + 1,
      updated_at = now()
    from picked p
    where o.id = p.id
    returning o.id, o.recipient_email, o.subject, o.html_body, o.attempts
  )
  select c.id, c.recipient_email, c.subject, c.html_body, c.attempts
  from claimed c
  order by c.id;
end;
$function$;

revoke all on function public.claim_notification_email_outbox_v36(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_email_outbox_v36(integer) to service_role;

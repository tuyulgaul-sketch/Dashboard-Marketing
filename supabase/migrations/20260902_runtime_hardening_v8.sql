-- Dashboard Marketing PertaLife
-- Runtime hardening V8
-- 2026-09-02

begin;

create table if not exists public.system_job_state (
  job_name text primary key,
  last_run_at timestamptz null,
  updated_at timestamptz not null default now()
);

revoke all on table public.system_job_state from anon, authenticated;

insert into public.system_job_state (
  job_name,
  last_run_at,
  updated_at
)
values (
  'activity_due_notifications_v8',
  null,
  now()
)
on conflict (job_name) do nothing;

create or replace function public.run_activity_due_maintenance_v8()
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_last_run_at timestamptz;
begin
  if not pg_try_advisory_xact_lock(
    hashtext('activity_due_notifications_v8')
  ) then
    return false;
  end if;

  select s.last_run_at
  into v_last_run_at
  from public.system_job_state s
  where s.job_name = 'activity_due_notifications_v8'
  for update;

  if v_last_run_at is not null
     and v_last_run_at > now() - interval '5 minutes' then
    return false;
  end if;

  perform public.generate_activity_due_notifications();

  update public.system_job_state
  set
    last_run_at = now(),
    updated_at = now()
  where job_name = 'activity_due_notifications_v8';

  return true;
end;
$function$;

revoke all on function public.run_activity_due_maintenance_v8()
from public, anon;
grant execute on function public.run_activity_due_maintenance_v8()
to authenticated;

create index if not exists idx_activities_owner_activity_date_v8
  on public.activities (owner_profile_id, activity_date desc);

create index if not exists idx_activities_status_due_date_v8
  on public.activities (status, due_date);

create index if not exists idx_activities_updated_at_v8
  on public.activities (updated_at desc);

create index if not exists idx_activity_collaborators_profile_activity_v8
  on public.activity_collaborators (profile_id, activity_id);

create index if not exists idx_activity_events_activity_created_v8
  on public.activity_events (activity_id, created_at desc);

create index if not exists idx_activity_comments_activity_created_v8
  on public.activity_comments (activity_id, created_at desc);

create index if not exists idx_notifications_recipient_created_v8
  on public.notifications (recipient_profile_id, created_at desc);

create index if not exists idx_notifications_unread_recipient_v8
  on public.notifications (recipient_profile_id, created_at desc)
  where read_at is null;

commit;

do $cron$
declare
  v_job_id bigint;
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    for v_job_id in
      select jobid
      from cron.job
      where jobname = 'activity-due-maintenance-v8'
    loop
      perform cron.unschedule(v_job_id);
    end loop;

    perform cron.schedule(
      'activity-due-maintenance-v8',
      '*/5 * * * *',
      'select public.run_activity_due_maintenance_v8();'
    );
  end if;
exception
  when others then
    raise notice
      'pg_cron scheduling skipped: %',
      sqlerrm;
end;
$cron$;

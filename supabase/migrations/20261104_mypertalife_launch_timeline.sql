-- MyPertaLife / HUT Pertamina joint delivery tracker.
-- Isolated tables; the legacy Marketing Dashboard modules are unchanged.
create table if not exists public.launch_timeline_tasks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  project_key text not null default 'MYPERTALIFE_HUT_2026',
  workstream text not null default 'Kesiapan',
  title text not null,
  detail text,
  deliverable text,
  supporting_pic text,
  owner_team text not null check (owner_team in ('DA','MARCOMM')),
  start_date date not null,
  due_date date not null,
  status text not null default 'TODO' check (status in ('TODO','IN_PROGRESS','BLOCKED','DONE')),
  evidence_required boolean not null default true,
  is_milestone boolean not null default false,
  notes text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint launch_dates_valid check (start_date <= due_date)
);
create index if not exists launch_tasks_team_date on public.launch_timeline_tasks(owner_team,due_date,status);
create index if not exists launch_tasks_project_date on public.launch_timeline_tasks(project_key,start_date);

create table if not exists public.launch_timeline_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.launch_timeline_tasks(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint not null check(file_size between 1 and 52428800),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint launch_evidence_path_matches_task check (split_part(storage_path,'/',1)=task_id::text)
);
create index if not exists launch_evidence_task on public.launch_timeline_evidence(task_id,created_at desc);

create table if not exists public.launch_timeline_audit (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.launch_timeline_tasks(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id),
  changes jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists launch_timeline_audit_task on public.launch_timeline_audit(task_id,created_at desc);

create or replace function public.is_launch_timeline_member()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles p
 where p.auth_user_id=auth.uid() and p.active=true
 and lower(trim(p.unit))='marketing support'
 and lower(trim(coalesce(p.department,''))) in ('digital & affinity','marketing communication'));
$$;
revoke all on function public.is_launch_timeline_member() from public,anon;
grant execute on function public.is_launch_timeline_member() to authenticated;

alter table public.launch_timeline_tasks enable row level security;
alter table public.launch_timeline_evidence enable row level security;
alter table public.launch_timeline_audit enable row level security;
revoke all on public.launch_timeline_tasks,public.launch_timeline_evidence,public.launch_timeline_audit from anon,authenticated;
grant select,insert,update on public.launch_timeline_tasks to authenticated;
grant select,insert on public.launch_timeline_evidence to authenticated;
grant select on public.launch_timeline_audit to authenticated;
grant usage,select on sequence public.launch_timeline_audit_id_seq to authenticated;
create policy launch_tasks_read on public.launch_timeline_tasks for select to authenticated using (public.is_launch_timeline_member());
create policy launch_tasks_insert on public.launch_timeline_tasks for insert to authenticated with check (public.is_launch_timeline_member());
create policy launch_tasks_update on public.launch_timeline_tasks for update to authenticated using (public.is_launch_timeline_member()) with check (public.is_launch_timeline_member());
create policy launch_evidence_read on public.launch_timeline_evidence for select to authenticated using (public.is_launch_timeline_member());
create policy launch_evidence_insert on public.launch_timeline_evidence for insert to authenticated with check (public.is_launch_timeline_member() and uploaded_by=public.current_profile_id());
create policy launch_audit_read on public.launch_timeline_audit for select to authenticated using (public.is_launch_timeline_member());

create or replace function public.launch_timeline_task_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.code is distinct from old.code or new.project_key is distinct from old.project_key or new.created_at is distinct from old.created_at then
   raise exception 'Identitas task tidak dapat diubah.';
 end if;
 if new.status='DONE' and old.status is distinct from 'DONE' then
   if new.evidence_required and not exists (select 1 from public.launch_timeline_evidence where task_id=new.id) then
     raise exception 'Unggah evidence dulu sebelum memilih Selesai.';
   end if;
   new.completed_at := now();
   new.completed_by := public.current_profile_id();
 elsif new.status<>'DONE' then
   new.completed_at := null;
   new.completed_by := null;
 else
   new.completed_at := old.completed_at;
   new.completed_by := old.completed_by;
 end if;
 new.updated_by := public.current_profile_id();
 new.updated_at := now();
 return new;
end;
$$;
revoke all on function public.launch_timeline_task_guard() from public,anon,authenticated;
drop trigger if exists launch_timeline_task_guard_trigger on public.launch_timeline_tasks;
create trigger launch_timeline_task_guard_trigger before update on public.launch_timeline_tasks
for each row execute function public.launch_timeline_task_guard();

create or replace function public.launch_timeline_record_audit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.launch_timeline_audit(task_id,actor_profile_id,changes)
 values(new.id,public.current_profile_id(),jsonb_build_object(
   'status',jsonb_build_array(old.status,new.status),
   'owner_team',jsonb_build_array(old.owner_team,new.owner_team),
   'dates',jsonb_build_array(old.start_date,old.due_date,new.start_date,new.due_date),
   'notes_changed',old.notes is distinct from new.notes));
 return new;
end;
$$;
revoke all on function public.launch_timeline_record_audit() from public,anon,authenticated;
drop trigger if exists launch_timeline_audit_trigger on public.launch_timeline_tasks;
create trigger launch_timeline_audit_trigger after update on public.launch_timeline_tasks
for each row when (old.status is distinct from new.status or old.owner_team is distinct from new.owner_team or old.start_date is distinct from new.start_date or old.due_date is distinct from new.due_date or old.notes is distinct from new.notes)
execute function public.launch_timeline_record_audit();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('launch-timeline-evidence','launch-timeline-evidence',false,52428800,
array['application/pdf','image/png','image/jpeg','video/mp4','text/plain',
'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy launch_storage_read on storage.objects for select to authenticated
 using (bucket_id='launch-timeline-evidence' and public.is_launch_timeline_member());
create policy launch_storage_upload on storage.objects for insert to authenticated
 with check(bucket_id='launch-timeline-evidence' and public.is_launch_timeline_member()
  and exists(select 1 from public.launch_timeline_tasks t where t.id::text=split_part(name,'/',1)));

create or replace function public.launch_timeline_due_reminders()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_today date := (now() at time zone 'Asia/Jakarta')::date;
 t public.launch_timeline_tasks%rowtype;
 p record;
 n integer:=0;
 v_type text;
begin
 if not public.is_launch_timeline_member() then raise exception 'Akses tidak diizinkan'; end if;
 for t in select * from public.launch_timeline_tasks
  where status <> 'DONE' and due_date <= v_today+1 and due_date >= v_today-30
 loop
  v_type:=case when t.due_date < v_today then 'LAUNCH_OVERDUE' else 'LAUNCH_DUE' end;
  for p in select id from public.profiles
    where active=true and lower(trim(unit))='marketing support'
    and lower(trim(coalesce(department,'')))=
      case when t.owner_team='DA' then 'digital & affinity' else 'marketing communication' end
  loop
   perform public.create_system_notification_vnext(
    p.id,v_type,
    case when v_type='LAUNCH_OVERDUE' then 'Timeline MyPertaLife: terlambat' else 'Timeline MyPertaLife: segera jatuh tempo' end,
    t.title || ' — tenggat ' || to_char(t.due_date,'DD Mon YYYY') || '. Belum ditandai Done.',
    t.id,'/timeline-mypertalife?task='||t.id::text,'MYPERTALIFE_LAUNCH',
    'launch:'||t.id::text||':'||t.due_date::text||':'||v_type||':'||p.id::text,
    true);
   n:=n+1;
  end loop;
 end loop;
 return n;
end;
$$;
revoke all on function public.launch_timeline_due_reminders() from public,anon;
grant execute on function public.launch_timeline_due_reminders() to authenticated;

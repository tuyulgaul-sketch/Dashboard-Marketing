-- MyPertaLife timeline: safe task removal without losing evidence/audit.
-- Removed tasks are excluded from lists, progress denominator, Gantt, and due reminders.
alter table public.launch_timeline_tasks
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id);

create index if not exists launch_tasks_active_idx
  on public.launch_timeline_tasks(start_date,due_date) where deleted_at is null;

-- The client may edit normal fields; archival metadata is RPC-owned.
revoke update on public.launch_timeline_tasks from authenticated;
grant update(owner_team,status,start_date,due_date,notes)
  on public.launch_timeline_tasks to authenticated;

drop policy if exists launch_tasks_read on public.launch_timeline_tasks;
create policy launch_tasks_read on public.launch_timeline_tasks
  for select to authenticated
  using (public.is_launch_timeline_member() and deleted_at is null);

drop policy if exists launch_tasks_insert on public.launch_timeline_tasks;
create policy launch_tasks_insert on public.launch_timeline_tasks
  for insert to authenticated
  with check (
    public.is_launch_timeline_member()
    and deleted_at is null and deleted_by is null
  );

drop policy if exists launch_tasks_update on public.launch_timeline_tasks;
create policy launch_tasks_update on public.launch_timeline_tasks
  for update to authenticated
  using (public.is_launch_timeline_member() and deleted_at is null)
  with check (public.is_launch_timeline_member());

drop policy if exists launch_evidence_read on public.launch_timeline_evidence;
create policy launch_evidence_read on public.launch_timeline_evidence
  for select to authenticated
  using (
    public.is_launch_timeline_member()
    and exists (
      select 1 from public.launch_timeline_tasks t
      where t.id = launch_timeline_evidence.task_id
    )
  );

drop policy if exists launch_evidence_insert on public.launch_timeline_evidence;
create policy launch_evidence_insert on public.launch_timeline_evidence
  for insert to authenticated
  with check (
    public.is_launch_timeline_member()
    and uploaded_by = public.current_profile_id()
    and exists (
      select 1 from public.launch_timeline_tasks t
      where t.id = launch_timeline_evidence.task_id
    )
  );

-- Evidence files remain stored for audit, but become inaccessible after archival.
drop policy if exists launch_storage_read on storage.objects;
create policy launch_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id='launch-timeline-evidence'
    and public.is_launch_timeline_member()
    and exists (
      select 1 from public.launch_timeline_tasks t
      where t.id::text = split_part(name,'/',1)
    )
  );
drop policy if exists launch_storage_upload on storage.objects;
create policy launch_storage_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id='launch-timeline-evidence'
    and public.is_launch_timeline_member()
    and exists (
      select 1 from public.launch_timeline_tasks t
      where t.id::text = split_part(name,'/',1)
    )
  );

create or replace function public.archive_launch_timeline_task(p_task_id uuid)
returns boolean language plpgsql security definer
set search_path=public,pg_temp as $$
declare
  v_profile uuid := public.current_profile_id();
  v_code text;
begin
  if not public.is_launch_timeline_member() or v_profile is null then
    raise exception 'Anda tidak memiliki izin menghapus task timeline.';
  end if;
  select code into v_code
  from public.launch_timeline_tasks
  where id=p_task_id and deleted_at is null
  for update;
  if not found then
    raise exception 'Task sudah dihapus atau tidak ditemukan.';
  end if;

  update public.launch_timeline_tasks
  set deleted_at=now(), deleted_by=v_profile
  where id=p_task_id;

  insert into public.launch_timeline_audit(
    task_id,actor_profile_id,changes
  ) values(
    p_task_id,v_profile,
    jsonb_build_object('action','TASK_ARCHIVED','task_code',v_code)
  );
  return true;
end;
$$;
revoke all on function public.archive_launch_timeline_task(uuid)
  from public,anon;
grant execute on function public.archive_launch_timeline_task(uuid)
  to authenticated;

-- Prevent reminders for archived work even when invoked directly via RPC.
create or replace function public.launch_timeline_due_reminders()
returns integer language plpgsql security definer
set search_path=public,pg_temp as $$
declare
 v_today date := (now() at time zone 'Asia/Jakarta')::date;
 t public.launch_timeline_tasks%rowtype;
 p record;
 n integer:=0;
 v_type text;
begin
 if not public.is_launch_timeline_member() then
   raise exception 'Akses tidak diizinkan';
 end if;
 for t in select * from public.launch_timeline_tasks
  where deleted_at is null
  and status <> 'DONE'
  and due_date <= v_today+1
  and due_date >= v_today-30
 loop
  v_type:=case when t.due_date < v_today then 'LAUNCH_OVERDUE' else 'LAUNCH_DUE' end;
  for p in select id from public.profiles
    where active=true and lower(trim(unit))='marketing support'
    and lower(trim(coalesce(department,'')))=
      case when t.owner_team='DA' then 'digital & affinity'
           else 'marketing communication' end
  loop
   perform public.create_system_notification_vnext(
    p.id,v_type,
    case when v_type='LAUNCH_OVERDUE'
      then 'Timeline MyPertaLife: terlambat'
      else 'Timeline MyPertaLife: segera jatuh tempo' end,
    t.title || ' — tenggat ' || to_char(t.due_date,'DD Mon YYYY') || '. Belum ditandai Done.',
    t.id,'/timeline-mypertalife?task='||t.id::text,'MYPERTALIFE_LAUNCH',
    'launch:'||t.id::text||':'||t.due_date::text||':'||v_type||':'||p.id::text,
    true
   );
   n:=n+1;
  end loop;
 end loop;
 return n;
end;
$$;
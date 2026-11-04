-- Detach active MyPertaLife work from categories. Existing task rows, status, owners,
-- dates, evidence, deleted-at flags and audit history are preserved.
-- Historic categories and archived tasks remain for traceability.
drop trigger if exists launch_timeline_check_target_group_trigger
  on public.launch_timeline_tasks;
drop trigger if exists zz_launch_timeline_set_default_group_trigger
  on public.launch_timeline_tasks;
alter table public.launch_timeline_tasks
  drop constraint if exists launch_timeline_active_group_required;

-- Record the original category assignment before detaching each ACTIVE task.
insert into public.launch_timeline_audit(task_id,actor_profile_id,changes)
select t.id,null,jsonb_build_object(
  'action','TASK_DETACHED_FROM_CATEGORY',
  'former_group_id',t.group_id,
  'new_group_id',null
)
from public.launch_timeline_tasks t
where t.deleted_at is null and t.group_id is not null;

update public.launch_timeline_tasks
set group_id=null
where deleted_at is null and group_id is not null;

-- Allow future tasks to be created without any category; legacy category FK remains
-- nullable and preserves historical links on archived rows.
comment on column public.launch_timeline_tasks.group_id is
  'Legacy category reference; NULL for active flat tasks since 2026-11-04.';

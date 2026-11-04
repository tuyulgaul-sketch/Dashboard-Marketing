-- Allow DA/Marcomm members to rename existing active tasks, preserving audit history.
-- Other protected fields (code, milestone flag, deletion metadata, evidence flags) remain non-editable.
grant update (title) on table public.launch_timeline_tasks to authenticated;

alter table public.launch_timeline_tasks
  add constraint launch_timeline_tasks_title_valid
  check (char_length(btrim(title)) between 1 and 200);

create or replace function public.launch_timeline_record_audit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.launch_timeline_audit(task_id,actor_profile_id,changes)
 values(new.id,public.current_profile_id(),jsonb_build_object(
   'title',case when old.title is distinct from new.title
     then jsonb_build_object('before',old.title,'after',new.title) else null end,
   'status',jsonb_build_array(old.status,new.status),
   'owner_team',jsonb_build_array(old.owner_team,new.owner_team),
   'dates',jsonb_build_array(old.start_date,old.due_date,new.start_date,new.due_date),
   'notes_changed',old.notes is distinct from new.notes
 ));
 return new;
end;
$$;

drop trigger if exists launch_timeline_audit_trigger on public.launch_timeline_tasks;
create trigger launch_timeline_audit_trigger
after update on public.launch_timeline_tasks
for each row
when (old.title is distinct from new.title
  or old.status is distinct from new.status
  or old.owner_team is distinct from new.owner_team
  or old.start_date is distinct from new.start_date
  or old.due_date is distinct from new.due_date
  or old.notes is distinct from new.notes)
execute function public.launch_timeline_record_audit();
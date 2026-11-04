-- Harden completion logic: no DONE at creation and no fabricated evidence metadata.
create or replace function public.launch_timeline_task_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
   if new.status='DONE' then
     raise exception 'Task baru tidak boleh langsung Done; unggah evidence terlebih dahulu.';
   end if;
   new.completed_at:=null; new.completed_by:=null;
   new.updated_by:=public.current_profile_id();
   return new;
 end if;
 if new.code is distinct from old.code
    or new.project_key is distinct from old.project_key
    or new.created_at is distinct from old.created_at
    or new.evidence_required is distinct from old.evidence_required
    or new.is_milestone is distinct from old.is_milestone then
   raise exception 'Properti kontrol task tidak boleh dimodifikasi.';
 end if;
 if new.status='DONE' and old.status is distinct from 'DONE' then
   if new.evidence_required and not exists (
     select 1 from public.launch_timeline_evidence e where e.task_id=new.id
   ) then
     raise exception 'Unggah evidence terlebih dahulu sebelum menandai Selesai.';
   end if;
   new.completed_at:=now();
   new.completed_by:=public.current_profile_id();
 elsif new.status<>'DONE' then
   new.completed_at:=null; new.completed_by:=null;
 else
   new.completed_at:=old.completed_at; new.completed_by:=old.completed_by;
 end if;
 new.updated_by:=public.current_profile_id();
 new.updated_at:=now();
 return new;
end;
$$;
drop trigger if exists launch_timeline_task_guard_insert_trigger on public.launch_timeline_tasks;
create trigger launch_timeline_task_guard_insert_trigger
before insert on public.launch_timeline_tasks
for each row execute function public.launch_timeline_task_guard();

create or replace function public.launch_timeline_evidence_guard()
returns trigger language plpgsql security definer set search_path=public,storage,pg_temp as $$
declare object_size bigint;
begin
 if not public.is_launch_timeline_member() then raise exception 'Akses evidence ditolak.'; end if;
 if new.uploaded_by is distinct from public.current_profile_id() then
   raise exception 'Uploader tidak cocok.';
 end if;
 select (o.metadata->>'size')::bigint into object_size
 from storage.objects o
 where o.bucket_id='launch-timeline-evidence' and o.name=new.storage_path;
 if not found then
   raise exception 'Berkas evidence belum diunggah atau tidak ditemukan.';
 end if;
 if object_size is not null and object_size <> new.file_size then
   raise exception 'Ukuran metadata evidence tidak sesuai.';
 end if;
 return new;
end;
$$;
revoke all on function public.launch_timeline_evidence_guard() from public,anon,authenticated;
drop trigger if exists launch_timeline_evidence_guard_trigger on public.launch_timeline_evidence;
create trigger launch_timeline_evidence_guard_trigger
before insert on public.launch_timeline_evidence
for each row execute function public.launch_timeline_evidence_guard();
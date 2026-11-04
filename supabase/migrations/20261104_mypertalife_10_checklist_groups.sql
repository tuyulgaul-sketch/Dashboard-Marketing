-- Ten MyPertaLife workstreams; original tasks become individual evidence-backed checklist items.
-- Existing IDs, statuses, evidence, archived tasks, and audit trails are preserved.
create table if not exists public.launch_timeline_groups (
 id uuid primary key default gen_random_uuid(),
 group_code text not null unique,
 title text not null check (char_length(btrim(title)) between 1 and 160),
 description text,
 owner_team text not null check (owner_team in ('DA','MARCOMM')),
 sort_order integer not null unique check (sort_order between 1 and 1000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id)
);
create table if not exists public.launch_timeline_group_audit (
 id bigint generated always as identity primary key,
 group_id uuid not null references public.launch_timeline_groups(id) on delete restrict,
 actor_profile_id uuid references public.profiles(id),
 changes jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists launch_group_audit_by_group
 on public.launch_timeline_group_audit(group_id,created_at desc);
alter table public.launch_timeline_groups enable row level security;
alter table public.launch_timeline_group_audit enable row level security;
revoke all on public.launch_timeline_groups,public.launch_timeline_group_audit from anon,authenticated;
grant select on public.launch_timeline_groups,public.launch_timeline_group_audit to authenticated;
grant update(title,description,owner_team) on public.launch_timeline_groups to authenticated;
drop policy if exists launch_groups_select on public.launch_timeline_groups;
create policy launch_groups_select on public.launch_timeline_groups
 for select to authenticated using (public.is_launch_timeline_member());
drop policy if exists launch_groups_update on public.launch_timeline_groups;
create policy launch_groups_update on public.launch_timeline_groups
 for update to authenticated using (public.is_launch_timeline_member())
 with check (public.is_launch_timeline_member());
drop policy if exists launch_group_audit_select on public.launch_timeline_group_audit;
create policy launch_group_audit_select on public.launch_timeline_group_audit
 for select to authenticated using (public.is_launch_timeline_member());
create or replace function public.launch_group_update_audit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 new.updated_at:=now();
 new.updated_by:=public.current_profile_id();
 if old.title is distinct from new.title or old.description is distinct from new.description
 or old.owner_team is distinct from new.owner_team then
  insert into public.launch_timeline_group_audit(group_id,actor_profile_id,changes)
  values(new.id,public.current_profile_id(),
   jsonb_build_object('title',jsonb_build_array(old.title,new.title),
    'owner_team',jsonb_build_array(old.owner_team,new.owner_team),
    'description_changed',old.description is distinct from new.description));
 end if;
 return new;
end;
$$;
revoke all on function public.launch_group_update_audit() from public,anon,authenticated;
drop trigger if exists launch_group_update_audit on public.launch_timeline_groups;
create trigger launch_group_update_audit before update on public.launch_timeline_groups
 for each row execute function public.launch_group_update_audit();
insert into public.launch_timeline_groups(group_code,title,description,owner_team,sort_order)
values
('G01','Kesiapan Infrastruktur & Rilis Aplikasi','Migrasi, pentest, kesiapan versi web/mobile, deployment dan stabilitas teknis.','DA',1),
('G02','Legal, Operasional & Keputusan Go/No-Go','Persetujuan legal dan keamanan, FAQ, sign-off, keputusan go/no-go, dan hypercare.','DA',2),
('G03','Koordinasi Awal & Strategi Kado HUT','Kickoff kerja DA–Marcomm, komunikasi Intercomm dan strategi kategori submission.','DA',3),
('G04','Konsep Kampanye & Produksi Video','Narasi persembahan, key visual, storyboard, rekaman aplikasi dan video final.','MARCOMM',4),
('G05','Persiapan & Pelaksanaan Soft Launch','Materi pimpinan, kebutuhan event, user guide, approval, gladi bersih dan publikasi internal.','MARCOMM',5),
('G06','Company Profile & Proposal Inovasi','Profil perusahaan, manfaat inovasi, template submission dan persetujuan pimpinan.','MARCOMM',6),
('G07','Materi Visual Kado HUT','Foto/video high-resolution, poster infografis dan media looping instalasi.','MARCOMM',7),
('G08','Submission Kado HUT & Review Intercomm','QC, pengiriman resmi, serta penyesuaian hasil review Intercomm.','MARCOMM',8),
('G09','Publikasi Resmi HUT Pertamina','Pengiriman video, approval, penjadwalan dan publikasi persembahan.','MARCOMM',9),
('G10','Monitoring & Laporan Pasca-Publikasi','Monitoring respons publikasi, bukti penayangan dan laporan hasil.','MARCOMM',10)
on conflict (group_code) do nothing;
alter table public.launch_timeline_tasks
 add column if not exists group_id uuid references public.launch_timeline_groups(id);
create index if not exists launch_tasks_group_active_idx
 on public.launch_timeline_tasks(group_id,start_date,due_date) where deleted_at is null;
create or replace function public.launch_timeline_set_default_group()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.group_id is null then
  select id into new.group_id from public.launch_timeline_groups
   where group_code=case when new.owner_team='DA' then 'G01' else 'G04' end;
 end if;
 if new.group_id is null then raise exception 'Kelompok checklist tidak ditemukan'; end if;
 return new;
end;
$$;
revoke all on function public.launch_timeline_set_default_group() from public,anon,authenticated;
drop trigger if exists zz_launch_timeline_set_default_group_trigger on public.launch_timeline_tasks;
create trigger zz_launch_timeline_set_default_group_trigger
 before insert on public.launch_timeline_tasks
 for each row execute function public.launch_timeline_set_default_group();
with mapping(code,group_code) as (values
('TL-01','G01'),
('TL-05','G01'),
('TL-06','G01'),
('TL-07','G01'),
('TL-12','G01'),
('TL-08','G02'),
('TL-09','G02'),
('TL-10','G02'),
('TL-11','G02'),
('TL-14','G02'),
('TL-15','G03'),
('TL-27','G03'),
('TL-35','G03'),
('TL-16','G04'),
('TL-17','G04'),
('TL-18','G04'),
('TL-19','G04'),
('TL-20','G04'),
('TL-28','G04'),
('TL-13','G05'),
('TL-21','G05'),
('TL-22','G05'),
('TL-23','G05'),
('TL-24','G05'),
('TL-25','G05'),
('TL-26','G05'),
('TL-36','G06'),
('TL-37','G06'),
('TL-38','G06'),
('TL-39','G06'),
('TL-43','G06'),
('TL-40','G07'),
('TL-41','G07'),
('TL-42','G07'),
('TL-44','G08'),
('TL-45','G08'),
('TL-46','G08'),
('TL-29','G09'),
('TL-30','G09'),
('TL-31','G09'),
('TL-32','G09'),
('TL-33','G10'),
('TL-47','G10')
)
update public.launch_timeline_tasks t set group_id=g.id
from mapping m join public.launch_timeline_groups g on g.group_code=m.group_code
where t.code=m.code and t.deleted_at is null and t.group_id is null;
update public.launch_timeline_tasks t set group_id=g.id
from public.launch_timeline_groups g
where t.deleted_at is null and t.group_id is null
 and g.group_code=case when t.owner_team='DA' then 'G01' else 'G04' end;
do $$
begin
 if exists(select 1 from public.launch_timeline_tasks
           where deleted_at is null and group_id is null) then
  raise exception 'Masih ada checklist aktif belum memiliki kelompok';
 end if;
end;
$$;
-- Old archived tasks stay archived; each checkbox retains its original private evidence.

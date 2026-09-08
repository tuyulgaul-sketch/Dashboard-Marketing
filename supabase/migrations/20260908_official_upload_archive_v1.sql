-- Official upload archive v1. Schema-only migration; no existing business rows are changed.
-- All removal operations require the exact publisher identity, a fresh preview hash,
-- a written reason, and a full transactional snapshot. No broad DELETE grant is added.
create table if not exists public.marketing_upload_archives (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('target','pipeline','realization')),
  source_id text not null,
  snapshot jsonb not null,
  snapshot_hash text not null,
  reason text not null,
  actor_profile_id uuid not null references public.profiles(id),
  actor_name text not null,
  archived_at timestamptz not null default now(),
  unique (kind,source_id)
);
alter table public.marketing_upload_archives enable row level security;
revoke all on public.marketing_upload_archives from public, anon, authenticated;

create table if not exists public.marketing_upload_tombstones (
  storage_key text not null,
  entity_id text not null,
  archive_id uuid not null references public.marketing_upload_archives(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (storage_key,entity_id)
);
alter table public.marketing_upload_tombstones enable row level security;
revoke all on public.marketing_upload_tombstones from public, anon, authenticated;

create or replace function public.guard_archived_upload_entity_v1()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists (select 1 from public.marketing_upload_tombstones t where t.storage_key=new.storage_key and t.entity_id=new.entity_id) then
    raise exception 'Data upload ini sudah diarsipkan. Hubungi IT untuk pemulihan resmi.' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_archived_upload_entity_v1() from public, anon, authenticated;
drop trigger if exists guard_archived_upload_entity_v1 on public.central_business_entities;
create trigger guard_archived_upload_entity_v1 before insert or update on public.central_business_entities for each row execute function public.guard_archived_upload_entity_v1();

-- Internal candidate function. Its full snapshot is never exposed to authenticated clients.
create or replace function public.official_upload_candidate_v1(p_kind text,p_id text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_rows jsonb; v_count integer; v_blocked integer:=0; v_amount numeric:=0; v_year integer; v_label text; v_date text; v_periods jsonb:='[]'::jsonb; v_row record; v_snapshot jsonb;
begin
  if not public.can_publish_marketing_targets() then raise exception 'Akses pengelolaan upload ditolak.' using errcode='42501'; end if;
  if p_kind not in ('target','pipeline','realization') or nullif(trim(p_id),'') is null then raise exception 'Jenis atau ID upload tidak valid.'; end if;
  if p_kind='target' then
    select b.target_year,b.filename,b.uploaded_at::text,
      jsonb_build_object('batch',to_jsonb(b),'rows',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.marketing_targets t where t.batch_id=b.id),'[]'::jsonb)),
      (select count(*) from public.marketing_targets t where t.batch_id=b.id),
      (select coalesce(sum(t.personal_target_total),0) from public.marketing_targets t where t.batch_id=b.id)
    into v_year,v_label,v_date,v_snapshot,v_count,v_amount
    from public.marketing_target_batches b where b.id=p_id;
  elsif p_kind='realization' then
    select b.payload->>'filename',b.payload->>'uploadedAt',
      jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.storage_key,r.entity_id) from public.central_business_entities r where (r.storage_key='pertalife_official_production_batches' and r.entity_id=b.entity_id) or (r.storage_key='pertalife_official_production_summaries' and r.payload->>'batchId'=b.entity_id)),'[]'::jsonb)),
      (select count(*) from public.central_business_entities s where s.storage_key='pertalife_official_production_summaries' and s.payload->>'batchId'=b.entity_id),
      (select coalesce(sum((s.payload->>'productionAmount')::numeric),0) from public.central_business_entities s where s.storage_key='pertalife_official_production_summaries' and s.payload->>'batchId'=b.entity_id),
      coalesce(b.payload->'publishedPeriodKeys','[]'::jsonb)
    into v_label,v_date,v_snapshot,v_count,v_amount,v_periods
    from public.central_business_entities b where b.storage_key='pertalife_official_production_batches' and b.entity_id=p_id;
    v_year:=null;
  else
    select coalesce(jsonb_agg(to_jsonb(r) order by r.entity_id),'[]'::jsonb),count(*),coalesce(sum((r.payload->>'estimatedPremium')::numeric),0),max(coalesce((r.payload->>'pipelineYear')::integer,0)),max(r.payload->>'createdAt')
    into v_rows,v_count,v_amount,v_year,v_date
    from public.central_business_entities r
    where r.storage_key='pertalife_pipelines' and r.payload->>'source'='RKAP_BULK'
      and coalesce(nullif(r.payload->'rkapPremiumSchedule'->>'sourceBatchId',''),r.entity_id)=p_id;
    v_snapshot:=jsonb_build_object('rows',v_rows);
    v_label:=coalesce((select r.payload->'rkapPremiumSchedule'->>'sourceFile' from public.central_business_entities r where r.storage_key='pertalife_pipelines' and coalesce(nullif(r.payload->'rkapPremiumSchedule'->>'sourceBatchId',''),r.entity_id)=p_id limit 1),p_id);
    for v_row in select r.* from public.central_business_entities r where r.storage_key='pertalife_pipelines' and r.payload->>'source'='RKAP_BULK' and coalesce(nullif(r.payload->'rkapPremiumSchedule'->>'sourceBatchId',''),r.entity_id)=p_id loop
      if v_row.version<>1 or v_row.payload->>'status'<>'Menunggu Upload Dokumen Marketing' or v_row.payload->>'currentHandler'<>'MARKETING'
        or coalesce(jsonb_array_length(case when jsonb_typeof(v_row.payload->'documents')='array' then v_row.payload->'documents' else '[]'::jsonb end),0)>0
        or coalesce(jsonb_array_length(case when jsonb_typeof(v_row.payload->'quotations')='array' then v_row.payload->'quotations' else '[]'::jsonb end),0)>0
        or coalesce(jsonb_array_length(case when jsonb_typeof(v_row.payload->'outcomeDocuments')='array' then v_row.payload->'outcomeDocuments' else '[]'::jsonb end),0)>0
        or exists(select 1 from public.central_business_audit a where a.storage_key='pertalife_pipelines' and a.entity_id=v_row.entity_id and a.action in ('UPDATE','DELETE'))
        or exists(select 1 from public.central_business_files f where f.entity_id=v_row.entity_id)
        or exists(select 1 from public.central_business_entities dep where dep.storage_key<>'pertalife_pipelines' and jsonb_path_exists(dep.payload,'$.** ? (@ == $id)',jsonb_build_object('id',v_row.entity_id)))
      then v_blocked:=v_blocked+1; end if;
    end loop;
  end if;
  if v_snapshot is null or (p_kind='pipeline' and v_count=0) then raise exception 'Upload tidak ditemukan atau sudah diarsipkan.'; end if;
  return jsonb_build_object('kind',p_kind,'id',p_id,'label',v_label,'year',v_year,'uploadedAt',v_date,'recordCount',v_count,'amount',v_amount,'blocked',v_blocked,'periods',v_periods,'hash',encode(extensions.digest(v_snapshot::text,'sha256'),'hex'),'snapshot',v_snapshot);
end;
$$;
revoke all on function public.official_upload_candidate_v1(text,text) from public, anon, authenticated;

create or replace function public.list_official_uploads_v1()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select case when public.can_publish_marketing_targets() then coalesce((
    select jsonb_agg(item order by item->>'uploadedAt' desc,item->>'id') from (
      select jsonb_build_object('kind','target','id',b.id,'label',b.filename,'year',b.target_year,'uploadedAt',b.uploaded_at,'recordCount',b.record_count,'status',b.status,'amount',coalesce((select sum(t.personal_target_total) from public.marketing_targets t where t.batch_id=b.id),0)) item from public.marketing_target_batches b
      union all
      select jsonb_build_object('kind','realization','id',b.entity_id,'label',b.payload->>'filename','uploadedAt',b.payload->>'uploadedAt','recordCount',coalesce((b.payload->>'validRowCount')::integer,0),'status',b.payload->>'status','amount',coalesce((b.payload->>'totalProductionAmount')::numeric,0),'periods',coalesce(b.payload->'publishedPeriodKeys','[]'::jsonb)) from public.central_business_entities b where b.storage_key='pertalife_official_production_batches'
      union all
      select jsonb_build_object('kind','pipeline','id',coalesce(nullif(r.payload->'rkapPremiumSchedule'->>'sourceBatchId',''),r.entity_id),'label',coalesce(max(r.payload->'rkapPremiumSchedule'->>'sourceFile'),max(r.payload->>'customerName'),'Pipeline RKAP'),'year',max(coalesce((r.payload->>'pipelineYear')::integer,0)),'uploadedAt',max(r.payload->>'createdAt'),'recordCount',count(*),'status','Published','amount',coalesce(sum((r.payload->>'estimatedPremium')::numeric),0)) from public.central_business_entities r where r.storage_key='pertalife_pipelines' and r.payload->>'source'='RKAP_BULK' group by coalesce(nullif(r.payload->'rkapPremiumSchedule'->>'sourceBatchId',''),r.entity_id)
    ) q
  ),'[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.list_official_uploads_v1() from public, anon;
grant execute on function public.list_official_uploads_v1() to authenticated;

create or replace function public.preview_official_upload_removal_v1(p_kind text,p_id text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v jsonb;
begin
  v:=public.official_upload_candidate_v1(p_kind,p_id);
  return v-'snapshot';
end;
$$;
revoke all on function public.preview_official_upload_removal_v1(text,text) from public, anon;
grant execute on function public.preview_official_upload_removal_v1(text,text) to authenticated;

create or replace function public.archive_official_upload_v1(p_kind text,p_id text,p_expected_hash text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v jsonb; v_actor public.profiles%rowtype; v_archive uuid; v_deleted integer; v_expected integer;
begin
  if not public.can_publish_marketing_targets() then raise exception 'Hanya Arianie yang dapat mengarsipkan upload.' using errcode='42501'; end if;
  if length(trim(coalesce(p_reason,'')))<10 or length(p_reason)>1000 then raise exception 'Alasan penghapusan wajib diisi, minimal 10 karakter.'; end if;
  select * into strict v_actor from public.profiles where auth_user_id=auth.uid() and active=true and upper(trim(legacy_user_id))='USR-000024';
  if p_kind='target' then
    lock table public.marketing_target_batches in share row exclusive mode;
  elsif p_kind in ('pipeline','realization') then
    lock table public.central_business_entities in share row exclusive mode;
  else raise exception 'Jenis upload tidak valid.'; end if;
  v:=public.official_upload_candidate_v1(p_kind,p_id);
  if p_expected_hash is null or v->>'hash'<>p_expected_hash then raise exception 'Data berubah sejak preview. Muat ulang dan periksa kembali.' using errcode='40001'; end if;
  if (v->>'blocked')::integer>0 then raise exception 'Ada Pipeline yang telah diproses atau memiliki referensi operasional. Penghapusan batch ditolak.' using errcode='23514'; end if;
  v_expected:=jsonb_array_length(v->'snapshot'->'rows');
  insert into public.marketing_upload_archives(kind,source_id,snapshot,snapshot_hash,reason,actor_profile_id,actor_name)
  values(p_kind,p_id,v->'snapshot',v->>'hash',trim(p_reason),v_actor.id,v_actor.full_name) returning id into v_archive;
  if p_kind='target' then
    delete from public.marketing_target_batches where id=p_id;
    get diagnostics v_deleted=row_count;
    if v_deleted<>1 then raise exception 'Jumlah batch target berubah. Transaksi dibatalkan.'; end if;
  else
    insert into public.marketing_upload_tombstones(storage_key,entity_id,archive_id)
    select r->>'storage_key',r->>'entity_id',v_archive from jsonb_array_elements(v->'snapshot'->'rows') r;
    insert into public.central_business_audit(storage_key,entity_id,action,actor_profile_id,actor_name,old_payload,new_payload,old_version,new_version)
    select r->>'storage_key',r->>'entity_id','DELETE',v_actor.id,v_actor.full_name,r->'payload',null,(r->>'version')::bigint,null from jsonb_array_elements(v->'snapshot'->'rows') r;
    delete from public.central_business_entities e using jsonb_array_elements(v->'snapshot'->'rows') r
      where e.storage_key=r->>'storage_key' and e.entity_id=r->>'entity_id';
    get diagnostics v_deleted=row_count;
    if v_deleted<>v_expected then raise exception 'Jumlah record berubah. Transaksi dibatalkan.'; end if;
  end if;
  return jsonb_build_object('archiveId',v_archive,'kind',p_kind,'id',p_id,'recordCount',v_expected,'status','Archived');
end;
$$;
revoke all on function public.archive_official_upload_v1(text,text,text,text) from public, anon;
grant execute on function public.archive_official_upload_v1(text,text,text,text) to authenticated;

-- PertaLife Care Survey workflow.
-- Production source of truth: Survey responses/issues in Supabase; execution remains in existing Activities.
-- Only the two survey owners can read/operate this module. Cross-user Activity access is explicit
-- and applies only to activities whose source_type = PERTALIFE_CARE_SURVEY.

alter table public.activities
  add column if not exists source_type text,
  add column if not exists source_ref text,
  add column if not exists reference_no text;

create unique index if not exists activities_reference_no_unique
  on public.activities(reference_no) where reference_no is not null;
create index if not exists activities_source_type_idx
  on public.activities(source_type, status);
create sequence if not exists public.pertalife_care_activity_reference_seq;

alter table public.activity_collaborators
  drop constraint if exists activity_collaborators_context_check;
alter table public.activity_collaborators
  add constraint activity_collaborators_context_check
  check (collaboration_context = any (array[
    'GENERAL'::text,
    'WAITING_FOLLOW_UP'::text,
    'NEED_SUPPORT'::text,
    'SURVEY_PERTALIFE_CARE'::text
  ]));

create table if not exists public.pertalife_care_survey_responses (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_row integer,
  submitted_at timestamptz not null,
  respondent_name text not null,
  member_id text,
  device_type text,
  os_name text,
  selected_problem_feature text,
  satisfaction_score smallint,
  contactable boolean not null default false,
  phone text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pertalife_care_satisfaction_score_check
    check (satisfaction_score is null or satisfaction_score between 1 and 5)
);

create table if not exists public.pertalife_care_survey_issues (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.pertalife_care_survey_responses(id) on delete cascade,
  feature_key text not null,
  feature_label text not null,
  issue_detail text,
  evidence_url text,
  linked_activity_id uuid references public.activities(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(response_id, feature_key)
);

create index if not exists pertalife_care_survey_responses_submitted_idx
  on public.pertalife_care_survey_responses(submitted_at desc);
create index if not exists pertalife_care_survey_issues_feature_idx
  on public.pertalife_care_survey_issues(feature_key, active);
create index if not exists pertalife_care_survey_issues_activity_idx
  on public.pertalife_care_survey_issues(linked_activity_id)
  where linked_activity_id is not null;

create table if not exists public.pertalife_care_survey_sync_config (
  config_key text primary key,
  secret_hash text not null,
  updated_at timestamptz not null default now()
);

-- SHA-256 only; plaintext ingest key belongs in Google Apps Script Properties, never in Git.
insert into public.pertalife_care_survey_sync_config(config_key, secret_hash)
values ('google_form_ingest', '18bc71f80300e059167b132037bf509b3a04d91113f7de11d9c1377744a8c0a3')
on conflict (config_key) do update
set secret_hash = excluded.secret_hash, updated_at = now();

alter table public.pertalife_care_survey_responses enable row level security;
alter table public.pertalife_care_survey_issues enable row level security;
alter table public.pertalife_care_survey_sync_config enable row level security;

create or replace function public.is_pertalife_care_survey_owner()
returns boolean
language sql stable security definer set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = public.current_profile_id()
      and p.active = true
      and lower(trim(coalesce(p.email, ''))) in ('banjar@pertalife.com', 'nadi.akbar@pertalife.com')
  );
$function$;

revoke all on function public.is_pertalife_care_survey_owner() from public, anon;
grant execute on function public.is_pertalife_care_survey_owner() to authenticated;

drop policy if exists pertalife_care_survey_responses_select on public.pertalife_care_survey_responses;
create policy pertalife_care_survey_responses_select
on public.pertalife_care_survey_responses for select to authenticated
using (public.is_pertalife_care_survey_owner());

drop policy if exists pertalife_care_survey_issues_select on public.pertalife_care_survey_issues;
create policy pertalife_care_survey_issues_select
on public.pertalife_care_survey_issues for select to authenticated
using (public.is_pertalife_care_survey_owner());

revoke all on table public.pertalife_care_survey_sync_config from anon, authenticated;

create or replace function public.ingest_pertalife_care_survey_v1(p_secret text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_expected_hash text;
  v_source_key text;
  v_response_id uuid;
  v_issue jsonb;
  v_feature_key text;
begin
  select secret_hash into v_expected_hash
  from public.pertalife_care_survey_sync_config
  where config_key = 'google_form_ingest';

  if v_expected_hash is null
     or encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex') <> v_expected_hash then
    raise exception 'Invalid survey ingest key.';
  end if;

  v_source_key := nullif(trim(p_payload ->> 'source_key'), '');
  if v_source_key is null then raise exception 'source_key wajib diisi.'; end if;

  insert into public.pertalife_care_survey_responses (
    source_key, source_row, submitted_at, respondent_name, member_id,
    device_type, os_name, selected_problem_feature, satisfaction_score,
    contactable, phone, raw_payload, updated_at
  )
  values (
    v_source_key,
    nullif(p_payload ->> 'source_row', '')::integer,
    coalesce(nullif(p_payload ->> 'submitted_at', '')::timestamptz, now()),
    coalesce(nullif(trim(p_payload ->> 'respondent_name'), ''), 'Tanpa Nama'),
    nullif(trim(p_payload ->> 'member_id'), ''),
    nullif(trim(p_payload ->> 'device_type'), ''),
    nullif(trim(p_payload ->> 'os_name'), ''),
    nullif(trim(p_payload ->> 'selected_problem_feature'), ''),
    nullif(p_payload ->> 'satisfaction_score', '')::smallint,
    coalesce((p_payload ->> 'contactable')::boolean, false),
    nullif(trim(p_payload ->> 'phone'), ''),
    coalesce(p_payload -> 'raw_payload', '{}'::jsonb),
    now()
  )
  on conflict (source_key) do update set
    source_row=excluded.source_row,
    submitted_at=excluded.submitted_at,
    respondent_name=excluded.respondent_name,
    member_id=excluded.member_id,
    device_type=excluded.device_type,
    os_name=excluded.os_name,
    selected_problem_feature=excluded.selected_problem_feature,
    satisfaction_score=excluded.satisfaction_score,
    contactable=excluded.contactable,
    phone=excluded.phone,
    raw_payload=excluded.raw_payload,
    updated_at=now()
  returning id into v_response_id;

  update public.pertalife_care_survey_issues
  set active=false, updated_at=now()
  where response_id=v_response_id;

  if jsonb_typeof(coalesce(p_payload -> 'issues', '[]'::jsonb))='array' then
    for v_issue in select value from jsonb_array_elements(coalesce(p_payload -> 'issues','[]'::jsonb))
    loop
      v_feature_key := nullif(trim(v_issue ->> 'feature_key'), '');
      if v_feature_key is null then continue; end if;
      insert into public.pertalife_care_survey_issues (
        response_id, feature_key, feature_label, issue_detail, evidence_url, active, updated_at
      )
      values (
        v_response_id,
        v_feature_key,
        coalesce(nullif(trim(v_issue ->> 'feature_label'), ''), v_feature_key),
        nullif(trim(v_issue ->> 'issue_detail'), ''),
        nullif(trim(v_issue ->> 'evidence_url'), ''),
        true,
        now()
      )
      on conflict (response_id, feature_key) do update set
        feature_label=excluded.feature_label,
        issue_detail=excluded.issue_detail,
        evidence_url=excluded.evidence_url,
        active=true,
        updated_at=now();
    end loop;
  end if;

  return jsonb_build_object('response_id',v_response_id,'source_key',v_source_key);
end;
$function$;

revoke all on function public.ingest_pertalife_care_survey_v1(text,jsonb) from public, anon, authenticated;
grant execute on function public.ingest_pertalife_care_survey_v1(text,jsonb) to service_role;

create or replace function public.list_pertalife_care_survey_v1()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_pertalife_care_survey_owner() then
    raise exception 'Akses Survey PertaLife Care hanya untuk owner survey.';
  end if;

  return jsonb_build_object(
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'sourceKey',r.source_key,'sourceRow',r.source_row,
        'submittedAt',r.submitted_at,'respondentName',r.respondent_name,
        'memberId',r.member_id,'deviceType',r.device_type,'osName',r.os_name,
        'selectedProblemFeature',r.selected_problem_feature,
        'satisfactionScore',r.satisfaction_score,'contactable',r.contactable,
        'phone',r.phone,'createdAt',r.created_at,'updatedAt',r.updated_at
      ) order by r.submitted_at desc,r.id)
      from public.pertalife_care_survey_responses r
    ),'[]'::jsonb),
    'issues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'responseId',i.response_id,'featureKey',i.feature_key,
        'featureLabel',i.feature_label,'issueDetail',i.issue_detail,
        'evidenceUrl',i.evidence_url,'linkedActivityId',i.linked_activity_id,
        'active',i.active,'activityReferenceNo',a.reference_no,
        'activityTitle',a.title,'activityStatus',a.status,'activityPriority',a.priority,
        'activityOwnerId',a.owner_profile_id,'activityOwnerName',owner.full_name,
        'activityResult',a.result,'activityUpdatedAt',a.updated_at
      ) order by i.created_at,i.id)
      from public.pertalife_care_survey_issues i
      left join public.activities a on a.id=i.linked_activity_id
      left join public.profiles owner on owner.id=a.owner_profile_id
      where i.active=true
    ),'[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'referenceNo',a.reference_no,'title',a.title,
        'description',a.description,'status',a.status,'priority',a.priority,
        'ownerProfileId',a.owner_profile_id,'ownerName',owner.full_name,
        'result',a.result,'createdAt',a.created_at,'updatedAt',a.updated_at,
        'linkedIssueCount',(select count(*) from public.pertalife_care_survey_issues i where i.linked_activity_id=a.id and i.active=true),
        'linkedResponseCount',(select count(distinct i.response_id) from public.pertalife_care_survey_issues i where i.linked_activity_id=a.id and i.active=true),
        'featureKeys',coalesce((select jsonb_agg(x.feature_key order by x.feature_key) from (select distinct i.feature_key from public.pertalife_care_survey_issues i where i.linked_activity_id=a.id and i.active=true) x),'[]'::jsonb),
        'featureLabels',coalesce((select jsonb_agg(x.feature_label order by x.feature_label) from (select distinct i.feature_label from public.pertalife_care_survey_issues i where i.linked_activity_id=a.id and i.active=true) x),'[]'::jsonb)
      ) order by case when a.status='DONE' then 1 else 0 end,a.updated_at desc)
      from public.activities a
      join public.profiles owner on owner.id=a.owner_profile_id
      where a.source_type='PERTALIFE_CARE_SURVEY' and a.status<>'CANCELLED'
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.list_pertalife_care_survey_v1() from public, anon;
grant execute on function public.list_pertalife_care_survey_v1() to authenticated;

create or replace function public.create_pertalife_care_followup_activity_v1(
  p_issue_id uuid, p_title text, p_due_date date default null, p_priority text default 'MEDIUM'
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid;
  v_issue public.pertalife_care_survey_issues%rowtype;
  v_response public.pertalife_care_survey_responses%rowtype;
  v_peer uuid;
  v_priority text;
  v_reference text;
  v_title text;
  v_activity public.activities%rowtype;
begin
  if not public.is_pertalife_care_survey_owner() then raise exception 'Akses Survey PertaLife Care hanya untuk owner survey.'; end if;
  v_me:=public.current_profile_id();
  v_title:=nullif(trim(coalesce(p_title,'')),'');
  if v_title is null or char_length(v_title)<5 then raise exception 'Judul task minimal 5 karakter.'; end if;

  v_priority:=upper(trim(coalesce(p_priority,'MEDIUM')));
  if v_priority not in ('LOW','MEDIUM','HIGH','URGENT') then raise exception 'Priority task tidak valid.'; end if;
  if p_due_date is not null and p_due_date<current_date then raise exception 'Due date tidak boleh di masa lalu.'; end if;

  select * into v_issue from public.pertalife_care_survey_issues
  where id=p_issue_id and active=true for update;
  if v_issue.id is null then raise exception 'Issue survey tidak ditemukan.'; end if;
  if v_issue.linked_activity_id is not null then raise exception 'Issue survey sudah terhubung ke Activity.'; end if;

  select * into v_response from public.pertalife_care_survey_responses where id=v_issue.response_id;
  select p.id into v_peer from public.profiles p
  where p.active=true
    and lower(trim(coalesce(p.email,''))) in ('banjar@pertalife.com','nadi.akbar@pertalife.com')
    and p.id<>v_me
  order by p.full_name limit 1;

  v_reference:='PLC-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.pertalife_care_activity_reference_seq')::text,6,'0');

  insert into public.activities (
    activity_mode,title,category,description,next_action,activity_date,due_date,
    priority,status,progress,owner_profile_id,created_by_profile_id,company_name,
    person_met,product_name,interaction_method,source_type,source_ref,reference_no
  ) values (
    'PERSONAL',v_reference||' • '||v_title,'FOLLOW_UP',
    concat_ws(E'\n','Source: Survey PertaLife Care',
      'Respondent: '||coalesce(v_response.respondent_name,'-'),
      'Member ID: '||coalesce(v_response.member_id,'-'),
      'Feature: '||coalesce(v_issue.feature_label,'-'),
      'Issue: '||coalesce(v_issue.issue_detail,'-'),
      case when v_issue.evidence_url is not null then 'Evidence: '||v_issue.evidence_url else null end),
    'Tindak lanjuti issue survey PertaLife Care dan catat outcome saat selesai.',
    current_date,p_due_date,v_priority,'TO_DO',0,v_me,v_me,'PertaLife Care',
    v_response.respondent_name,'PertaLife Care','Survey','PERTALIFE_CARE_SURVEY',
    v_issue.id::text,v_reference
  ) returning * into v_activity;

  if v_peer is not null then
    insert into public.activity_collaborators (
      activity_id,profile_id,can_edit,added_by_profile_id,collaboration_context,context_note,requested_at
    ) values (
      v_activity.id,v_peer,true,v_me,'SURVEY_PERTALIFE_CARE',
      'Shared survey workspace: Doan Banjar & Nadi Akbar.',now()
    )
    on conflict (activity_id,profile_id) do update set
      can_edit=true,added_by_profile_id=excluded.added_by_profile_id,
      collaboration_context=excluded.collaboration_context,
      context_note=excluded.context_note,requested_at=excluded.requested_at;
  end if;

  insert into public.activity_history(activity_id,actor_profile_id,action,old_status,new_status,notes)
  values(v_activity.id,v_me,'CREATED_PERSONAL',null,'TO_DO','Dibuat dari Survey PertaLife Care | Issue ID '||v_issue.id::text);

  update public.pertalife_care_survey_issues
  set linked_activity_id=v_activity.id,updated_at=now()
  where id=v_issue.id;

  return jsonb_build_object('issueId',v_issue.id,'activityId',v_activity.id,'referenceNo',v_reference,'status',v_activity.status);
end;
$function$;

revoke all on function public.create_pertalife_care_followup_activity_v1(uuid,text,date,text) from public, anon;
grant execute on function public.create_pertalife_care_followup_activity_v1(uuid,text,date,text) to authenticated;

create or replace function public.link_pertalife_care_issue_activity_v1(p_issue_id uuid,p_activity_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_me uuid;
  v_issue public.pertalife_care_survey_issues%rowtype;
  v_activity public.activities%rowtype;
  v_profile record;
begin
  if not public.is_pertalife_care_survey_owner() then raise exception 'Akses Survey PertaLife Care hanya untuk owner survey.'; end if;
  v_me:=public.current_profile_id();

  select * into v_issue from public.pertalife_care_survey_issues
  where id=p_issue_id and active=true for update;
  if v_issue.id is null then raise exception 'Issue survey tidak ditemukan.'; end if;
  if v_issue.linked_activity_id is not null then raise exception 'Issue survey sudah terhubung ke Activity.'; end if;

  select * into v_activity from public.activities
  where id=p_activity_id and source_type='PERTALIFE_CARE_SURVEY' and status<>'CANCELLED'
  for update;
  if v_activity.id is null then raise exception 'Activity survey existing tidak ditemukan.'; end if;

  for v_profile in
    select p.id from public.profiles p
    where p.active=true
      and lower(trim(coalesce(p.email,''))) in ('banjar@pertalife.com','nadi.akbar@pertalife.com')
      and p.id<>v_activity.owner_profile_id
  loop
    insert into public.activity_collaborators(
      activity_id,profile_id,can_edit,added_by_profile_id,collaboration_context,context_note,requested_at
    ) values(
      v_activity.id,v_profile.id,true,v_me,'SURVEY_PERTALIFE_CARE',
      'Shared survey workspace: Doan Banjar & Nadi Akbar.',now()
    )
    on conflict(activity_id,profile_id) do update set
      can_edit=true,added_by_profile_id=excluded.added_by_profile_id,
      collaboration_context=excluded.collaboration_context,
      context_note=excluded.context_note,requested_at=excluded.requested_at;
  end loop;

  if v_activity.status='DONE' then
    update public.activities set
      status='ON_PROGRESS',progress=25,
      status_note='Issue serupa kembali dilaporkan dari Survey PertaLife Care.',
      validation_approver_profile_id=null,validation_submitted_at=null,
      validated_at=null,validation_notes=null,updated_at=now()
    where id=v_activity.id;
    insert into public.activity_history(activity_id,actor_profile_id,action,old_status,new_status,notes)
    values(v_activity.id,v_me,'SURVEY_RECURRENCE_REOPENED','DONE','ON_PROGRESS','Issue survey baru ditautkan ke task existing.');
    v_activity.status:='ON_PROGRESS';
  end if;

  update public.pertalife_care_survey_issues
  set linked_activity_id=v_activity.id,updated_at=now()
  where id=v_issue.id;

  return jsonb_build_object('issueId',v_issue.id,'activityId',v_activity.id,'referenceNo',v_activity.reference_no,'status',v_activity.status);
end;
$function$;

revoke all on function public.link_pertalife_care_issue_activity_v1(uuid,uuid) from public, anon;
grant execute on function public.link_pertalife_care_issue_activity_v1(uuid,uuid) to authenticated;

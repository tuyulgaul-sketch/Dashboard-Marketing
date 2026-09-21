-- PertaLife Care survey source-of-truth reconciliation v2.
-- Stable identity is derived server-side from timestamp + Member ID + respondent.
-- Deleted spreadsheet rows are soft-deleted in Supabase so dashboard counts stay clean
-- while any Activity/audit history can remain intact.

alter table public.pertalife_care_survey_responses
  add column if not exists source_identity text,
  add column if not exists source_deleted_at timestamptz;

update public.pertalife_care_survey_responses r
set source_identity = encode(
      extensions.digest(
        to_char(r.submitted_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS')
        || '|' || lower(trim(coalesce(r.member_id, '')))
        || '|' || lower(trim(coalesce(r.respondent_name, ''))),
        'sha256'
      ),
      'hex'
    )
where r.source_identity is null;

update public.pertalife_care_survey_responses
set source_key = 'form:' || source_identity
where source_identity is not null
  and source_key is distinct from ('form:' || source_identity);

create unique index if not exists pertalife_care_survey_responses_identity_unique
  on public.pertalife_care_survey_responses(source_identity)
  where source_identity is not null;

create index if not exists pertalife_care_survey_responses_active_idx
  on public.pertalife_care_survey_responses(source_deleted_at, submitted_at desc);

create or replace function public.ingest_pertalife_care_survey_v2(
  p_secret text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_expected_hash text;
  v_submitted_at timestamptz;
  v_respondent_name text;
  v_member_id text;
  v_identity text;
  v_stable_key text;
  v_response_id uuid;
  v_issue jsonb;
  v_feature_key text;
begin
  select c.secret_hash into v_expected_hash
  from public.pertalife_care_survey_sync_config c
  where c.config_key = 'google_form_ingest';

  if v_expected_hash is null
     or encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex') <> v_expected_hash then
    raise exception 'Invalid survey ingest key.';
  end if;

  v_submitted_at := coalesce(nullif(p_payload ->> 'submitted_at', '')::timestamptz, now());
  v_respondent_name := coalesce(nullif(trim(p_payload ->> 'respondent_name'), ''), 'Tanpa Nama');
  v_member_id := nullif(trim(p_payload ->> 'member_id'), '');

  v_identity := encode(
    extensions.digest(
      to_char(v_submitted_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS')
      || '|' || lower(trim(coalesce(v_member_id, '')))
      || '|' || lower(trim(coalesce(v_respondent_name, ''))),
      'sha256'
    ),
    'hex'
  );
  v_stable_key := 'form:' || v_identity;

  select r.id into v_response_id
  from public.pertalife_care_survey_responses r
  where r.source_identity = v_identity
  limit 1
  for update;

  if v_response_id is null then
    insert into public.pertalife_care_survey_responses (
      source_key, source_identity, source_row, submitted_at, respondent_name,
      member_id, device_type, os_name, selected_problem_feature,
      satisfaction_score, contactable, phone, raw_payload,
      source_deleted_at, updated_at
    ) values (
      v_stable_key, v_identity,
      nullif(p_payload ->> 'source_row', '')::integer,
      v_submitted_at, v_respondent_name, v_member_id,
      nullif(trim(p_payload ->> 'device_type'), ''),
      nullif(trim(p_payload ->> 'os_name'), ''),
      nullif(trim(p_payload ->> 'selected_problem_feature'), ''),
      nullif(p_payload ->> 'satisfaction_score', '')::smallint,
      coalesce((p_payload ->> 'contactable')::boolean, false),
      nullif(trim(p_payload ->> 'phone'), ''),
      coalesce(p_payload -> 'raw_payload', '{}'::jsonb),
      null, now()
    )
    returning id into v_response_id;
  else
    update public.pertalife_care_survey_responses
    set source_key = v_stable_key,
        source_identity = v_identity,
        source_row = nullif(p_payload ->> 'source_row', '')::integer,
        submitted_at = v_submitted_at,
        respondent_name = v_respondent_name,
        member_id = v_member_id,
        device_type = nullif(trim(p_payload ->> 'device_type'), ''),
        os_name = nullif(trim(p_payload ->> 'os_name'), ''),
        selected_problem_feature = nullif(trim(p_payload ->> 'selected_problem_feature'), ''),
        satisfaction_score = nullif(p_payload ->> 'satisfaction_score', '')::smallint,
        contactable = coalesce((p_payload ->> 'contactable')::boolean, false),
        phone = nullif(trim(p_payload ->> 'phone'), ''),
        raw_payload = coalesce(p_payload -> 'raw_payload', '{}'::jsonb),
        source_deleted_at = null,
        updated_at = now()
    where id = v_response_id;
  end if;

  update public.pertalife_care_survey_issues
  set active = false, updated_at = now()
  where response_id = v_response_id;

  if jsonb_typeof(coalesce(p_payload -> 'issues', '[]'::jsonb)) = 'array' then
    for v_issue in
      select value from jsonb_array_elements(coalesce(p_payload -> 'issues', '[]'::jsonb))
    loop
      v_feature_key := nullif(trim(v_issue ->> 'feature_key'), '');
      if v_feature_key is null then continue; end if;

      insert into public.pertalife_care_survey_issues (
        response_id, feature_key, feature_label, issue_detail,
        evidence_url, active, updated_at
      ) values (
        v_response_id, v_feature_key,
        coalesce(nullif(trim(v_issue ->> 'feature_label'), ''), v_feature_key),
        nullif(trim(v_issue ->> 'issue_detail'), ''),
        nullif(trim(v_issue ->> 'evidence_url'), ''),
        true, now()
      )
      on conflict (response_id, feature_key)
      do update set
        feature_label = excluded.feature_label,
        issue_detail = excluded.issue_detail,
        evidence_url = excluded.evidence_url,
        active = true,
        updated_at = now();
    end loop;
  end if;

  return jsonb_build_object(
    'response_id', v_response_id,
    'source_identity', v_identity,
    'source_key', v_stable_key
  );
end;
$function$;

revoke all on function public.ingest_pertalife_care_survey_v2(text, jsonb)
from public, anon, authenticated;
grant execute on function public.ingest_pertalife_care_survey_v2(text, jsonb)
to service_role;

create or replace function public.reconcile_pertalife_care_survey_v2(
  p_secret text,
  p_payloads jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_expected_hash text;
  v_payload jsonb;
  v_result jsonb;
  v_seen_ids uuid[] := array[]::uuid[];
  v_response_id uuid;
  v_active_count integer;
  v_deleted_count integer;
begin
  select c.secret_hash into v_expected_hash
  from public.pertalife_care_survey_sync_config c
  where c.config_key = 'google_form_ingest';

  if v_expected_hash is null
     or encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex') <> v_expected_hash then
    raise exception 'Invalid survey ingest key.';
  end if;

  if jsonb_typeof(coalesce(p_payloads, '[]'::jsonb)) <> 'array' then
    raise exception 'payloads must be an array.';
  end if;

  for v_payload in
    select value from jsonb_array_elements(coalesce(p_payloads, '[]'::jsonb))
  loop
    v_result := public.ingest_pertalife_care_survey_v2(p_secret, v_payload);
    v_response_id := (v_result ->> 'response_id')::uuid;
    v_seen_ids := array_append(v_seen_ids, v_response_id);
  end loop;

  update public.pertalife_care_survey_responses r
  set source_deleted_at = now(), updated_at = now()
  where r.source_deleted_at is null
    and not (r.id = any(v_seen_ids));

  get diagnostics v_deleted_count = row_count;

  update public.pertalife_care_survey_issues i
  set active = false, updated_at = now()
  where i.response_id in (
    select r.id
    from public.pertalife_care_survey_responses r
    where r.source_deleted_at is not null
  )
    and i.active = true;

  select count(*) into v_active_count
  from public.pertalife_care_survey_responses
  where source_deleted_at is null;

  return jsonb_build_object(
    'active_count', v_active_count,
    'soft_deleted_count', v_deleted_count,
    'seen_count', coalesce(array_length(v_seen_ids, 1), 0)
  );
end;
$function$;

revoke all on function public.reconcile_pertalife_care_survey_v2(text, jsonb)
from public, anon, authenticated;
grant execute on function public.reconcile_pertalife_care_survey_v2(text, jsonb)
to service_role;

create or replace function public.list_pertalife_care_survey_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_pertalife_care_survey_owner() then
    raise exception 'Akses Survey PertaLife Care hanya untuk owner survey.';
  end if;

  return jsonb_build_object(
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'sourceKey', r.source_key, 'sourceRow', r.source_row,
        'submittedAt', r.submitted_at, 'respondentName', r.respondent_name,
        'memberId', r.member_id, 'deviceType', r.device_type, 'osName', r.os_name,
        'selectedProblemFeature', r.selected_problem_feature,
        'satisfactionScore', r.satisfaction_score, 'contactable', r.contactable,
        'phone', r.phone, 'createdAt', r.created_at, 'updatedAt', r.updated_at
      ) order by r.submitted_at desc, r.id)
      from public.pertalife_care_survey_responses r
      where r.source_deleted_at is null
    ), '[]'::jsonb),

    'issues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'responseId', i.response_id, 'featureKey', i.feature_key,
        'featureLabel', i.feature_label, 'issueDetail', i.issue_detail,
        'evidenceUrl', i.evidence_url, 'linkedActivityId', i.linked_activity_id,
        'active', i.active, 'activityReferenceNo', a.reference_no,
        'activityTitle', a.title, 'activityStatus', a.status,
        'activityPriority', a.priority, 'activityOwnerId', a.owner_profile_id,
        'activityOwnerName', owner.full_name, 'activityResult', a.result,
        'activityUpdatedAt', a.updated_at
      ) order by i.created_at, i.id)
      from public.pertalife_care_survey_issues i
      join public.pertalife_care_survey_responses r
        on r.id = i.response_id and r.source_deleted_at is null
      left join public.activities a on a.id = i.linked_activity_id
      left join public.profiles owner on owner.id = a.owner_profile_id
      where i.active = true
    ), '[]'::jsonb),

    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'referenceNo', a.reference_no, 'title', a.title,
        'description', a.description, 'status', a.status, 'priority', a.priority,
        'ownerProfileId', a.owner_profile_id, 'ownerName', owner.full_name,
        'result', a.result, 'createdAt', a.created_at, 'updatedAt', a.updated_at,
        'linkedIssueCount', (
          select count(*)
          from public.pertalife_care_survey_issues i
          join public.pertalife_care_survey_responses r on r.id = i.response_id
          where i.linked_activity_id = a.id and i.active = true
            and r.source_deleted_at is null
        ),
        'linkedResponseCount', (
          select count(distinct i.response_id)
          from public.pertalife_care_survey_issues i
          join public.pertalife_care_survey_responses r on r.id = i.response_id
          where i.linked_activity_id = a.id and i.active = true
            and r.source_deleted_at is null
        ),
        'featureKeys', coalesce((
          select jsonb_agg(x.feature_key order by x.feature_key)
          from (
            select distinct i.feature_key
            from public.pertalife_care_survey_issues i
            join public.pertalife_care_survey_responses r on r.id = i.response_id
            where i.linked_activity_id = a.id and i.active = true
              and r.source_deleted_at is null
          ) x
        ), '[]'::jsonb),
        'featureLabels', coalesce((
          select jsonb_agg(x.feature_label order by x.feature_label)
          from (
            select distinct i.feature_label
            from public.pertalife_care_survey_issues i
            join public.pertalife_care_survey_responses r on r.id = i.response_id
            where i.linked_activity_id = a.id and i.active = true
              and r.source_deleted_at is null
          ) x
        ), '[]'::jsonb)
      ) order by case when a.status = 'DONE' then 1 else 0 end, a.updated_at desc)
      from public.activities a
      join public.profiles owner on owner.id = a.owner_profile_id
      where a.source_type = 'PERTALIFE_CARE_SURVEY'
        and a.status <> 'CANCELLED'
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.list_pertalife_care_survey_v1() from public, anon;
grant execute on function public.list_pertalife_care_survey_v1() to authenticated;

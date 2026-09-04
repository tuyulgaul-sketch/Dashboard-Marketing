-- Dashboard Marketing — Activity Assignment Draft/Publish Hardening V27.1
-- 2026-09-04
-- Draft self-declared assignments stay private. The requester is notified only
-- when the task is created as To Do or later published from Draft -> To Do.

begin;

create or replace function public.create_self_declared_assignment_v6(
  p_payload jsonb,
  p_requester_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_id uuid;
  v_initial_status text;
  v_title text;
  v_description text;
  v_next_action text;
  v_requester_name text;
  v_result jsonb;
  v_collaborator_count integer := 0;
begin
  v_me := public.current_profile_id();

  if v_me is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  perform public.activity_assignment_approval_chain_v6(
    v_me,
    p_requester_profile_id
  );

  select p.full_name
    into v_requester_name
  from public.profiles p
  where p.id = p_requester_profile_id
    and p.active = true;

  v_title := trim(coalesce(p_payload->>'title', ''));
  v_description := trim(coalesce(p_payload->>'description', ''));
  v_next_action := trim(coalesce(p_payload->>'next_action', ''));
  v_initial_status := upper(trim(coalesce(p_payload->>'initial_status', 'TO_DO')));

  if v_title = '' then
    raise exception 'Judul aktivitas wajib diisi.';
  end if;

  if v_description = '' then
    raise exception 'Description / Agenda wajib diisi.';
  end if;

  if v_next_action = '' then
    raise exception 'Next Action wajib diisi.';
  end if;

  if nullif(trim(coalesce(p_payload->>'activity_date', '')), '') is null then
    raise exception 'Tanggal aktivitas wajib diisi.';
  end if;

  if v_initial_status not in ('DRAFT', 'TO_DO') then
    raise exception 'Initial status assignment tidak valid.';
  end if;

  if jsonb_typeof(
    coalesce(p_payload->'collaborator_ids', '[]'::jsonb)
  ) <> 'array' then
    raise exception 'Daftar collaborator tidak valid.';
  end if;

  insert into public.activities (
    title,
    category,
    description,
    next_action,
    activity_date,
    due_date,
    priority,
    status,
    progress,
    owner_profile_id,
    created_by_profile_id,
    company_name,
    person_met,
    position_met,
    product_name,
    related_pipeline_id,
    potential_premium,
    interaction_method,
    activity_mode,
    status_note,
    assignment_source,
    assignment_requester_profile_id
  )
  values (
    v_title,
    coalesce(nullif(p_payload->>'category', ''), 'INTERNAL_COORDINATION'),
    v_description,
    v_next_action,
    (p_payload->>'activity_date')::date,
    nullif(p_payload->>'due_date', '')::date,
    coalesce(nullif(p_payload->>'priority', ''), 'MEDIUM'),
    v_initial_status,
    0,
    v_me,
    v_me,
    nullif(p_payload->>'company_name', ''),
    nullif(p_payload->>'person_met', ''),
    nullif(p_payload->>'position_met', ''),
    nullif(p_payload->>'product_name', ''),
    nullif(p_payload->>'related_pipeline_id', ''),
    nullif(p_payload->>'potential_premium', '')::numeric,
    nullif(p_payload->>'interaction_method', ''),
    'ASSIGNMENT',
    format(
      'Assignment dicatat dari instruksi atasan: %s.',
      coalesce(v_requester_name, 'Atasan')
    ),
    'SELF_DECLARED',
    p_requester_profile_id
  )
  returning id into v_id;

  insert into public.activity_collaborators (
    activity_id,
    profile_id,
    can_edit,
    added_by_profile_id,
    collaboration_context,
    context_note
  )
  select
    v_id,
    p.id,
    true,
    v_me,
    'GENERAL',
    'Kolaborator pada assignment yang dicatat dari instruksi atasan.'
  from (
    select distinct value::uuid as profile_id
    from jsonb_array_elements_text(
      coalesce(p_payload->'collaborator_ids', '[]'::jsonb)
    )
  ) requested
  join public.profiles p
    on p.id = requested.profile_id
   and p.active = true
  where p.id <> v_me
    and not (
      upper(trim(coalesce(p.role_level, ''))) like '%SYSTEM%'
      and upper(trim(coalesce(p.role_level, ''))) like '%ADMIN%'
    )
    and lower(trim(coalesce(p.unit, ''))) <> 'administrasi sistem'
  on conflict (activity_id, profile_id) do nothing;

  get diagnostics v_collaborator_count = row_count;

  insert into public.activity_history (
    activity_id,
    actor_profile_id,
    action,
    old_status,
    new_status,
    notes
  )
  values (
    v_id,
    v_me,
    'CREATED_SELF_DECLARED_ASSIGNMENT',
    null,
    v_initial_status,
    format(
      'Pemberi tugas / final approver: %s%s',
      coalesce(v_requester_name, p_requester_profile_id::text),
      case
        when v_collaborator_count > 0
          then format(' | %s collaborator(s)', v_collaborator_count)
        else ''
      end
    )
  );

  -- Draft is private to its creator. Notify the requester only when published.
  if v_initial_status <> 'DRAFT' then
    perform public.create_system_notification_vnext(
      p_requester_profile_id,
      'ACTIVITY_ASSIGNMENT_RECORDED',
      'Assignment dari instruksi Anda dicatat',
      format(
        'Assignment "%s" telah dicatat oleh pemilik task. Review akan mengikuti hierarchy saat task diajukan.',
        v_title
      ),
      v_id,
      format('/aktivitas?task=%s', v_id),
      'ACTIVITY',
      'self-declared-created:' || v_id::text || ':' || p_requester_profile_id::text,
      true
    );
  end if;

  select to_jsonb(a)
    into v_result
  from public.activities a
  where a.id = v_id;

  return v_result;
end;
$$;

create or replace function public.notify_self_declared_assignment_publish_v27()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'DRAFT'
     and new.status = 'TO_DO'
     and new.activity_mode = 'ASSIGNMENT'
     and new.assignment_source = 'SELF_DECLARED'
     and new.assignment_requester_profile_id is not null then

    perform public.create_system_notification_vnext(
      new.assignment_requester_profile_id,
      'ACTIVITY_ASSIGNMENT_RECORDED',
      'Assignment dari instruksi Anda dipublish',
      'Assignment "' || coalesce(new.title, 'Aktivitas') || '" telah dipublish oleh pemilik task.',
      new.id,
      format('/aktivitas?task=%s', new.id),
      'ACTIVITY',
      'self-declared-publish:' || new.id::text || ':' || new.assignment_requester_profile_id::text,
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_self_declared_assignment_publish_v27
  on public.activities;

create trigger trg_notify_self_declared_assignment_publish_v27
after update of status on public.activities
for each row
execute function public.notify_self_declared_assignment_publish_v27();

-- Create-task mutation RPCs must never be callable by anonymous/public roles.
revoke execute on function public.create_self_declared_assignment_v6(jsonb, uuid)
  from public, anon;
revoke execute on function public.create_universal_activity(jsonb)
  from public, anon;

grant execute on function public.create_self_declared_assignment_v6(jsonb, uuid)
  to authenticated, service_role;
grant execute on function public.create_universal_activity(jsonb)
  to authenticated, service_role;

revoke execute on function public.notify_self_declared_assignment_publish_v27()
  from public, anon, authenticated;

comment on function public.notify_self_declared_assignment_publish_v27()
is 'V27.1: notify the assignment requester only when a self-declared Draft is published to To Do.';

commit;

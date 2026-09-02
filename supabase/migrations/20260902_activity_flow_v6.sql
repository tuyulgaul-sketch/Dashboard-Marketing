-- Dashboard Marketing — Activity Flow V6
-- 2026-09-02
-- Personal tasks are self-completed with mandatory outcome.
-- Self-declared verbal assignments use hierarchical approval while skipping SPV.

begin;

alter table public.activities
  add column if not exists assignment_source text
    not null default 'STANDARD';

alter table public.activities
  add column if not exists assignment_requester_profile_id uuid
    references public.profiles(id) on delete set null;

create index if not exists idx_activities_assignment_requester_v6
  on public.activities(assignment_requester_profile_id);

create or replace function public.activity_assignment_approval_chain_v6(
  p_owner_profile_id uuid,
  p_requester_profile_id uuid
)
returns uuid[]
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_requester_depth integer;
  v_requester_role text;
  v_chain uuid[];
begin
  if p_owner_profile_id is null or p_requester_profile_id is null then
    raise exception 'Owner dan pemberi tugas wajib tersedia.';
  end if;

  select upper(trim(coalesce(p.role_level, '')))
    into v_requester_role
  from public.profiles p
  where p.id = p_requester_profile_id
    and p.active = true;

  if v_requester_role is null then
    raise exception 'Pemberi tugas tidak ditemukan atau tidak aktif.';
  end if;

  if v_requester_role like '%SUPERVISOR%'
     or v_requester_role like '%SPV%' then
    raise exception 'SPV tidak digunakan sebagai final approver pada flow assignment lisan.';
  end if;

  with recursive hierarchy as (
    select
      manager.id,
      manager.manager_id,
      manager.role_level,
      1 as depth
    from public.profiles owner
    join public.profiles manager
      on manager.id = owner.manager_id
    where owner.id = p_owner_profile_id
      and owner.active = true
      and manager.active = true

    union all

    select
      manager.id,
      manager.manager_id,
      manager.role_level,
      h.depth + 1
    from hierarchy h
    join public.profiles manager
      on manager.id = h.manager_id
    where h.depth < 20
      and manager.active = true
  )
  select h.depth
    into v_requester_depth
  from hierarchy h
  where h.id = p_requester_profile_id
  order by h.depth
  limit 1;

  if v_requester_depth is null then
    raise exception 'Pemberi tugas harus berada pada hierarchy atasan pemilik task.';
  end if;

  with recursive hierarchy as (
    select
      manager.id,
      manager.manager_id,
      manager.role_level,
      1 as depth
    from public.profiles owner
    join public.profiles manager
      on manager.id = owner.manager_id
    where owner.id = p_owner_profile_id
      and owner.active = true
      and manager.active = true

    union all

    select
      manager.id,
      manager.manager_id,
      manager.role_level,
      h.depth + 1
    from hierarchy h
    join public.profiles manager
      on manager.id = h.manager_id
    where h.depth < 20
      and manager.active = true
  )
  select array_agg(h.id order by h.depth)
    into v_chain
  from hierarchy h
  where h.depth <= v_requester_depth
    and upper(trim(coalesce(h.role_level, ''))) not like '%SUPERVISOR%'
    and upper(trim(coalesce(h.role_level, ''))) not like '%SPV%';

  if coalesce(array_length(v_chain, 1), 0) = 0
     or v_chain[array_length(v_chain, 1)] <> p_requester_profile_id then
    raise exception 'Approval chain assignment tidak valid.';
  end if;

  return v_chain;
end;
$$;

create or replace function public.complete_personal_activity_v6(
  p_activity_id uuid,
  p_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_activity public.activities%rowtype;
  v_outcome text;
  v_result jsonb;
begin
  v_me := public.current_profile_id();
  v_outcome := trim(coalesce(p_outcome, ''));

  if v_me is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  if length(v_outcome) < 3 then
    raise exception 'Hasil / Outcome wajib diisi.';
  end if;

  select a.*
    into v_activity
  from public.activities a
  where a.id = p_activity_id
  for update;

  if not found then
    raise exception 'Aktivitas tidak ditemukan.';
  end if;

  if v_activity.activity_mode <> 'PERSONAL' then
    raise exception 'Hanya Task Pribadi yang dapat diselesaikan sendiri.';
  end if;

  if v_activity.owner_profile_id <> v_me then
    raise exception 'Hanya pemilik Task Pribadi yang dapat menandai Done.';
  end if;

  if v_activity.status in ('DRAFT', 'DONE', 'CANCELLED', 'PENDING_VALIDATION') then
    raise exception 'Status Task Pribadi saat ini tidak dapat langsung diselesaikan.';
  end if;

  update public.activities
  set
    status = 'DONE',
    progress = 100,
    result = v_outcome,
    status_note = 'Diselesaikan sendiri oleh pemilik Task Pribadi.',
    validation_approver_profile_id = null,
    validation_submitted_at = null,
    validated_at = now(),
    validation_notes = null,
    updated_at = now()
  where id = p_activity_id;

  insert into public.activity_history (
    activity_id,
    actor_profile_id,
    action,
    old_status,
    new_status,
    notes
  )
  values (
    p_activity_id,
    v_me,
    'PERSONAL_COMPLETED',
    v_activity.status,
    'DONE',
    v_outcome
  );

  select to_jsonb(a)
    into v_result
  from public.activities a
  where a.id = p_activity_id;

  return v_result;
end;
$$;

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
  v_collaborator_text text;
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

  if v_initial_status not in ('DRAFT', 'TO_DO') then
    raise exception 'Initial status assignment tidak valid.';
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

  for v_collaborator_text in
    select value
    from jsonb_array_elements_text(
      coalesce(p_payload->'collaborator_ids', '[]'::jsonb)
    )
  loop
    if v_collaborator_text::uuid <> v_me then
      insert into public.activity_collaborators (
        activity_id,
        profile_id,
        can_edit,
        added_by_profile_id,
        collaboration_context,
        context_note
      )
      values (
        v_id,
        v_collaborator_text::uuid,
        true,
        v_me,
        'ASSIGNMENT',
        'Kolaborator pada assignment yang dicatat dari instruksi atasan.'
      )
      on conflict do nothing;
    end if;
  end loop;

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
      'Pemberi tugas / final approver: %s',
      coalesce(v_requester_name, p_requester_profile_id::text)
    )
  );

  insert into public.notifications (
    recipient_profile_id,
    notification_type,
    module,
    title,
    message,
    related_record_id,
    link_path
  )
  values (
    p_requester_profile_id,
    'ACTIVITY_ASSIGNMENT_RECORDED',
    'ACTIVITY',
    'Assignment dari instruksi Anda dicatat',
    format(
      'Assignment "%s" telah dicatat oleh pemilik task. Review akan mengikuti hierarchy saat task diajukan.',
      v_title
    ),
    v_id,
    format('/aktivitas?task=%s', v_id)
  );

  select to_jsonb(a)
    into v_result
  from public.activities a
  where a.id = v_id;

  return v_result;
end;
$$;

create or replace function public.submit_self_declared_assignment_v6(
  p_activity_id uuid,
  p_result text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_activity public.activities%rowtype;
  v_chain uuid[];
  v_target uuid;
  v_result_text text;
  v_result jsonb;
begin
  v_me := public.current_profile_id();
  v_result_text := trim(coalesce(p_result, ''));

  if v_me is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  if length(v_result_text) < 3 then
    raise exception 'Ringkasan hasil aktivitas wajib diisi.';
  end if;

  select a.*
    into v_activity
  from public.activities a
  where a.id = p_activity_id
  for update;

  if not found then
    raise exception 'Aktivitas tidak ditemukan.';
  end if;

  if v_activity.assignment_source <> 'SELF_DECLARED'
     or v_activity.activity_mode <> 'ASSIGNMENT' then
    raise exception 'Aktivitas ini bukan assignment dari instruksi atasan.';
  end if;

  if v_activity.owner_profile_id <> v_me then
    raise exception 'Hanya pemilik assignment yang dapat mengajukan validasi.';
  end if;

  if v_activity.status in ('DRAFT', 'PENDING_VALIDATION', 'DONE', 'CANCELLED') then
    raise exception 'Status assignment saat ini tidak dapat diajukan.';
  end if;

  v_chain := public.activity_assignment_approval_chain_v6(
    v_activity.owner_profile_id,
    v_activity.assignment_requester_profile_id
  );

  if v_activity.validation_approver_profile_id is not null
     and array_position(
       v_chain,
       v_activity.validation_approver_profile_id
     ) is not null then
    v_target := v_activity.validation_approver_profile_id;
  else
    v_target := v_chain[1];
  end if;

  if v_target is null then
    raise exception 'Approver assignment tidak ditemukan.';
  end if;

  update public.activities
  set
    status = 'PENDING_VALIDATION',
    progress = 100,
    result = v_result_text,
    validation_approver_profile_id = v_target,
    validation_submitted_at = now(),
    status_note = 'Menunggu review approval assignment.',
    updated_at = now()
  where id = p_activity_id;

  insert into public.activity_history (
    activity_id,
    actor_profile_id,
    action,
    old_status,
    new_status,
    notes
  )
  values (
    p_activity_id,
    v_me,
    'SUBMIT_VALIDATION',
    v_activity.status,
    'PENDING_VALIDATION',
    v_result_text
  );

  insert into public.notifications (
    recipient_profile_id,
    notification_type,
    module,
    title,
    message,
    related_record_id,
    link_path
  )
  values (
    v_target,
    'ACTIVITY_PENDING_VALIDATION',
    'ACTIVITY',
    'Aktivitas menunggu validasi',
    format(
      'Assignment "%s" menunggu review Anda.',
      v_activity.title
    ),
    p_activity_id,
    format('/aktivitas?task=%s', p_activity_id)
  );

  select to_jsonb(a)
    into v_result
  from public.activities a
  where a.id = p_activity_id;

  return v_result;
end;
$$;

create or replace function public.review_self_declared_assignment_v6(
  p_activity_id uuid,
  p_decision text,
  p_remark text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_decision text;
  v_remark text;
  v_activity public.activities%rowtype;
  v_chain uuid[];
  v_position integer;
  v_next uuid;
  v_actor_name text;
  v_next_name text;
  v_result jsonb;
begin
  v_me := public.current_profile_id();
  v_decision := upper(trim(coalesce(p_decision, '')));
  v_remark := trim(coalesce(p_remark, ''));

  if v_me is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  if v_remark = '' then
    raise exception 'Remark wajib diisi.';
  end if;

  if v_decision not in ('DONE', 'REVISE', 'REJECT') then
    raise exception 'Decision validasi tidak dikenali.';
  end if;

  select a.*
    into v_activity
  from public.activities a
  where a.id = p_activity_id
  for update;

  if not found then
    raise exception 'Aktivitas tidak ditemukan.';
  end if;

  if v_activity.assignment_source <> 'SELF_DECLARED'
     or v_activity.activity_mode <> 'ASSIGNMENT' then
    raise exception 'Aktivitas ini bukan assignment dari instruksi atasan.';
  end if;

  if v_activity.status <> 'PENDING_VALIDATION' then
    raise exception 'Aktivitas sudah tidak berada pada Pending Validation.';
  end if;

  if v_activity.validation_approver_profile_id is distinct from v_me then
    raise exception 'Hanya approver aktif yang dapat memproses task ini.';
  end if;

  v_chain := public.activity_assignment_approval_chain_v6(
    v_activity.owner_profile_id,
    v_activity.assignment_requester_profile_id
  );

  v_position := array_position(v_chain, v_me);

  if v_position is null then
    raise exception 'Reviewer tidak termasuk approval chain assignment.';
  end if;

  select p.full_name
    into v_actor_name
  from public.profiles p
  where p.id = v_me;

  if v_decision = 'DONE' then
    if v_position < array_length(v_chain, 1) then
      v_next := v_chain[v_position + 1];

      select p.full_name
        into v_next_name
      from public.profiles p
      where p.id = v_next;

      update public.activities
      set
        validation_approver_profile_id = v_next,
        validation_notes = v_remark,
        status_note = format(
          'Tahap review %s selesai. Menunggu %s.',
          coalesce(v_actor_name, 'Approver'),
          coalesce(v_next_name, 'approver berikutnya')
        ),
        updated_at = now()
      where id = p_activity_id;

      insert into public.activity_history (
        activity_id,
        actor_profile_id,
        action,
        old_status,
        new_status,
        notes
      )
      values (
        p_activity_id,
        v_me,
        'VALIDATION_STEP_APPROVED',
        'PENDING_VALIDATION',
        'PENDING_VALIDATION',
        v_remark
      );

      insert into public.notifications (
        recipient_profile_id,
        notification_type,
        module,
        title,
        message,
        related_record_id,
        link_path
      )
      values (
        v_next,
        'ACTIVITY_PENDING_VALIDATION',
        'ACTIVITY',
        'Aktivitas menunggu validasi',
        format(
          'Review sebelumnya selesai. Assignment "%s" kini menunggu review Anda.',
          v_activity.title
        ),
        p_activity_id,
        format('/aktivitas?task=%s', p_activity_id)
      );

      insert into public.notifications (
        recipient_profile_id,
        notification_type,
        module,
        title,
        message,
        related_record_id,
        link_path
      )
      values (
        v_activity.owner_profile_id,
        'ACTIVITY_REVIEW_STEP_APPROVED',
        'ACTIVITY',
        'Tahap review assignment disetujui',
        format(
          '%s menyetujui tahap review. Task diteruskan ke approver berikutnya.',
          coalesce(v_actor_name, 'Approver')
        ),
        p_activity_id,
        format('/aktivitas?task=%s', p_activity_id)
      );

    else
      update public.activities
      set
        status = 'DONE',
        progress = 100,
        validated_at = now(),
        validation_notes = v_remark,
        status_note = v_remark,
        updated_at = now()
      where id = p_activity_id;

      insert into public.activity_history (
        activity_id,
        actor_profile_id,
        action,
        old_status,
        new_status,
        notes
      )
      values (
        p_activity_id,
        v_me,
        'VALIDATION_APPROVED',
        'PENDING_VALIDATION',
        'DONE',
        v_remark
      );

      insert into public.notifications (
        recipient_profile_id,
        notification_type,
        module,
        title,
        message,
        related_record_id,
        link_path
      )
      values (
        v_activity.owner_profile_id,
        'ACTIVITY_APPROVED',
        'ACTIVITY',
        'Aktivitas disetujui',
        format(
          '%s menyetujui dan menyelesaikan assignment "%s".',
          coalesce(v_actor_name, 'Final approver'),
          v_activity.title
        ),
        p_activity_id,
        format('/aktivitas?task=%s', p_activity_id)
      );
    end if;

  elsif v_decision = 'REVISE' then
    update public.activities
    set
      status = 'ON_PROGRESS',
      progress = least(progress, 90),
      validation_notes = v_remark,
      status_note = v_remark,
      updated_at = now()
    where id = p_activity_id;

    insert into public.activity_history (
      activity_id,
      actor_profile_id,
      action,
      old_status,
      new_status,
      notes
    )
    values (
      p_activity_id,
      v_me,
      'VALIDATION_RETURNED',
      'PENDING_VALIDATION',
      'ON_PROGRESS',
      v_remark
    );

    insert into public.notifications (
      recipient_profile_id,
      notification_type,
      module,
      title,
      message,
      related_record_id,
      link_path
    )
    values (
      v_activity.owner_profile_id,
      'ACTIVITY_RETURNED',
      'ACTIVITY',
      'Aktivitas dikembalikan',
      format(
        '%s meminta revisi pada assignment "%s". Remark: %s',
        coalesce(v_actor_name, 'Approver'),
        v_activity.title,
        v_remark
      ),
      p_activity_id,
      format('/aktivitas?task=%s', p_activity_id)
    );

  else
    update public.activities
    set
      status = 'CANCELLED',
      progress = least(progress, 99),
      validated_at = now(),
      validation_notes = v_remark,
      status_note = v_remark,
      follow_up_date = null,
      updated_at = now()
    where id = p_activity_id;

    insert into public.activity_history (
      activity_id,
      actor_profile_id,
      action,
      old_status,
      new_status,
      notes
    )
    values (
      p_activity_id,
      v_me,
      'VALIDATION_REJECTED',
      'PENDING_VALIDATION',
      'CANCELLED',
      v_remark
    );

    insert into public.notifications (
      recipient_profile_id,
      notification_type,
      module,
      title,
      message,
      related_record_id,
      link_path
    )
    values (
      v_activity.owner_profile_id,
      'ACTIVITY_REJECTED',
      'ACTIVITY',
      'Aktivitas ditolak',
      format(
        '%s menolak assignment "%s". Remark: %s',
        coalesce(v_actor_name, 'Approver'),
        v_activity.title,
        v_remark
      ),
      p_activity_id,
      format('/aktivitas?task=%s', p_activity_id)
    );
  end if;

  select to_jsonb(a)
    into v_result
  from public.activities a
  where a.id = p_activity_id;

  return v_result;
end;
$$;

revoke all on function public.activity_assignment_approval_chain_v6(uuid, uuid) from public;
revoke all on function public.complete_personal_activity_v6(uuid, text) from public;
revoke all on function public.create_self_declared_assignment_v6(jsonb, uuid) from public;
revoke all on function public.submit_self_declared_assignment_v6(uuid, text) from public;
revoke all on function public.review_self_declared_assignment_v6(uuid, text, text) from public;

grant execute on function public.activity_assignment_approval_chain_v6(uuid, uuid) to authenticated;
grant execute on function public.complete_personal_activity_v6(uuid, text) to authenticated;
grant execute on function public.create_self_declared_assignment_v6(jsonb, uuid) to authenticated;
grant execute on function public.submit_self_declared_assignment_v6(uuid, text) to authenticated;
grant execute on function public.review_self_declared_assignment_v6(uuid, text, text) to authenticated;

commit;

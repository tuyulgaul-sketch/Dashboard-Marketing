-- Dashboard Marketing — Activity Assignment Notification Dedupe V27.2
-- 2026-09-04
-- Prevent duplicate notifications on self-declared Assignment submit/final review.
-- Generic activity status trigger remains the single notification source for
-- PENDING_VALIDATION, DONE, ON_PROGRESS(return), and CANCELLED transitions.

begin;

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

  -- No explicit notification here. trg_notify_activity_change sends exactly
  -- one ACTIVITY_PENDING_VALIDATION notification to validation_approver_profile_id.

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

      -- Status remains PENDING_VALIDATION, so the generic status trigger does
      -- not notify the next approver. This explicit notification is required.
      perform public.create_system_notification_vnext(
        v_next,
        'ACTIVITY_PENDING_VALIDATION',
        'Aktivitas menunggu validasi',
        format(
          'Review sebelumnya selesai. Assignment "%s" kini menunggu review Anda.',
          v_activity.title
        ),
        p_activity_id,
        format('/aktivitas?task=%s', p_activity_id),
        'ACTIVITY',
        'self-declared-next-approver:' || p_activity_id::text || ':' || v_next::text || ':' || now()::text,
        true
      );

      perform public.create_system_notification_vnext(
        v_activity.owner_profile_id,
        'ACTIVITY_REVIEW_STEP_APPROVED',
        'Tahap review assignment disetujui',
        format(
          '%s menyetujui tahap review. Task diteruskan ke approver berikutnya.',
          coalesce(v_actor_name, 'Approver')
        ),
        p_activity_id,
        format('/aktivitas?task=%s', p_activity_id),
        'ACTIVITY',
        'self-declared-step-approved:' || p_activity_id::text || ':' || v_me::text || ':' || v_next::text,
        false
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

      -- trg_notify_activity_change sends exactly one ACTIVITY_APPROVED.
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

    -- trg_notify_activity_change sends exactly one ACTIVITY_RETURNED.

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

    -- trg_notify_activity_change sends exactly one ACTIVITY_CANCELLED.
  end if;

  select to_jsonb(a)
    into v_result
  from public.activities a
  where a.id = p_activity_id;

  return v_result;
end;
$$;

revoke execute on function public.submit_self_declared_assignment_v6(uuid, text)
  from public, anon;
revoke execute on function public.review_self_declared_assignment_v6(uuid, text, text)
  from public, anon;

grant execute on function public.submit_self_declared_assignment_v6(uuid, text)
  to authenticated, service_role;
grant execute on function public.review_self_declared_assignment_v6(uuid, text, text)
  to authenticated, service_role;

comment on function public.submit_self_declared_assignment_v6(uuid, text)
is 'V27.2: submit self-declared assignment using the generic status notification trigger without duplicate approval notifications.';

comment on function public.review_self_declared_assignment_v6(uuid, text, text)
is 'V27.2: review self-declared assignment without duplicate final/return/cancel notifications; explicit notifications remain only for multi-step approval continuation.';

commit;

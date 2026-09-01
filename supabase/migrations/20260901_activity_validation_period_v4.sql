-- Dashboard Marketing — Activity Validation V4
-- 2026-09-01
-- Adds governed 3-way validation decision:
-- DONE / REVISE / REJECT.
-- REVISE returns the task to ON_PROGRESS and guarantees progress < 100.
-- REJECT follows the canonical cancellation state (CANCELLED).

begin;

create or replace function public.review_activity_validation_v2(
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
  v_actor_name text;
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

  if v_activity.status <> 'PENDING_VALIDATION' then
    raise exception 'Aktivitas sudah tidak berada pada Pending Validation.';
  end if;

  if v_activity.validation_approver_profile_id is distinct from v_me then
    raise exception 'Hanya approver validasi yang dapat memproses task ini.';
  end if;

  select p.full_name
    into v_actor_name
  from public.profiles p
  where p.id = v_me;

  if v_decision = 'DONE' then
    perform public.transition_activity_vnext(
      p_activity_id,
      'DONE',
      jsonb_build_object(
        'note', v_remark
      )
    );

  elsif v_decision = 'REVISE' then
    perform public.transition_activity_vnext(
      p_activity_id,
      'ON_PROGRESS',
      jsonb_build_object(
        'note', v_remark
      )
    );

    -- Submit Validation currently makes progress 100%.
    -- A revised task must become actionable again and may not stay at 100%.
    update public.activities
    set
      progress = 90,
      updated_at = now()
    where id = p_activity_id
      and progress >= 100;

  else
    -- REJECT follows the existing cancellation model.
    -- CANCELLED is intentionally outside Kanban buckets but remains auditable.
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

    if v_activity.owner_profile_id is distinct from v_me then
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
          '%s menolak aktivitas "%s". Remark: %s',
          coalesce(v_actor_name, 'Approver'),
          v_activity.title,
          v_remark
        ),
        p_activity_id,
        format('/aktivitas?task=%s', p_activity_id)
      );
    end if;
  end if;

  select to_jsonb(a)
    into v_result
  from public.activities a
  where a.id = p_activity_id;

  return v_result;
end;
$$;

revoke all
  on function public.review_activity_validation_v2(uuid, text, text)
  from public;

grant execute
  on function public.review_activity_validation_v2(uuid, text, text)
  to authenticated;

commit;

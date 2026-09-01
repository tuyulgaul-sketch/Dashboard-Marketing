-- Dashboard Marketing — include notification state in Global Reset
-- Keeps profiles/auth intact. Clears transient in-app attention data only.

begin;

create or replace function public.admin_clear_notification_state_for_global_reset()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_is_admin boolean := false;
  v_notifications_deleted bigint := 0;
  v_view_states_deleted bigint := 0;
begin
  v_me := public.current_profile_id();

  if v_me is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = v_me
      and p.active = true
      and (
        upper(trim(coalesce(p.role_level, ''))) = 'SYSTEM_ADMIN'
        or lower(trim(coalesce(p.unit, ''))) = 'administrasi sistem'
      )
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Hanya SYSTEM_ADMIN yang dapat membersihkan notification state.';
  end if;

  -- Bell / in-app inbox.
  delete from public.notifications;
  get diagnostics v_notifications_deleted = row_count;

  -- Per-user Activity seen + Discussion read state.
  if to_regclass('public.activity_view_states') is not null then
    delete from public.activity_view_states;
    get diagnostics v_view_states_deleted = row_count;
  end if;

  return jsonb_build_object(
    'notifications_deleted', v_notifications_deleted,
    'activity_view_states_deleted', v_view_states_deleted
  );
end;
$$;

revoke all
  on function public.admin_clear_notification_state_for_global_reset()
  from public;

grant execute
  on function public.admin_clear_notification_state_for_global_reset()
  to authenticated;

commit;

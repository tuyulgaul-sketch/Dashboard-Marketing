-- Dashboard Marketing PertaLife
-- V22 — global Tanda Terima registry visibility + complete UAT reset
-- 2026-09-03
--
-- 1) Every active business account may read every Tanda Terima registry row.
--    Mutation authority remains unchanged and party-based.
-- 2) Global Reset also clears Meeting Room bookings and transient notification
--    outboxes while preserving accounts, profiles, master products and push
--    subscriptions.

begin;

-- ---------------------------------------------------------------------------
-- Tanda Terima registry: global read visibility for active business accounts.
-- Keep this as an additional permissive SELECT path instead of broadening the
-- generic central business RLS function used by unrelated modules.
-- ---------------------------------------------------------------------------

drop policy if exists
  "central_business_entities_tanda_terima_global_select_v22"
on public.central_business_entities;

create policy
  "central_business_entities_tanda_terima_global_select_v22"
on public.central_business_entities
for select
to authenticated
using (
  storage_key = 'pertalife_document_handovers'
  and exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and p.active = true
      and upper(trim(coalesce(p.role_level, ''))) <> 'SYSTEM_ADMIN'
  )
);

-- ---------------------------------------------------------------------------
-- Global reset: Activity + Meeting Room + runtime epoch.
-- The central-business reset continues to clear Tanda Terima, supporting docs,
-- targets and the other centralized business collections in its own stage.
-- ---------------------------------------------------------------------------

create or replace function public.admin_global_reset_database()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_admin_profile_id uuid;
  v_activity_count bigint := 0;
  v_meeting_room_count bigint := 0;
  v_new_epoch bigint;
begin
  select p.id
  into v_admin_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.active = true
    and (
      upper(trim(p.role_level)) = 'SYSTEM_ADMIN'
      or lower(trim(p.unit)) = 'administrasi sistem'
    )
  limit 1;

  if v_admin_profile_id is null then
    raise exception 'SYSTEM_ADMIN access required';
  end if;

  select count(*)
  into v_activity_count
  from public.activities;

  select count(*)
  into v_meeting_room_count
  from public.marketing_meeting_room_bookings;

  -- Supabase-native Activity domain. Child rows are also covered by CASCADE,
  -- but explicit deletes are kept for compatibility with the established reset.
  delete from public.activity_comments
  where true;

  delete from public.activity_history
  where true;

  delete from public.activity_collaborators
  where true;

  delete from public.activity_attachments
  where true;

  delete from public.activities
  where true;

  -- Meeting Room is a separate Supabase-native domain and was previously not
  -- covered by Global Reset.
  delete from public.marketing_meeting_room_bookings
  where true;

  update public.system_runtime_state
  set
    data_epoch = data_epoch + 1,
    last_global_reset_at = now(),
    last_global_reset_by = v_admin_profile_id,
    updated_at = now()
  where id = 1
  returning data_epoch
  into v_new_epoch;

  return jsonb_build_object(
    'success', true,
    'deleted_activities', v_activity_count,
    'deleted_meeting_room_bookings', v_meeting_room_count,
    'data_epoch', v_new_epoch,
    'reset_at', now()
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Global reset notification cleanup. Keep push subscriptions so devices do not
-- need to opt in again after UAT reset, but remove all business notification
-- and delivery-outbox residue.
-- ---------------------------------------------------------------------------

create or replace function public.admin_clear_notification_state_for_global_reset()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_me uuid;
  v_is_admin boolean := false;
  v_notifications_deleted bigint := 0;
  v_view_states_deleted bigint := 0;
  v_email_outbox_deleted bigint := 0;
  v_push_outbox_deleted bigint := 0;
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

  -- Clear delivery queues first so no old UAT event can be dispatched after
  -- the visible notification rows are removed.
  if to_regclass('public.notification_email_outbox') is not null then
    delete from public.notification_email_outbox
    where true;

    get diagnostics v_email_outbox_deleted = row_count;
  end if;

  if to_regclass('public.push_outbox_v13') is not null then
    delete from public.push_outbox_v13
    where true;

    get diagnostics v_push_outbox_deleted = row_count;
  end if;

  delete from public.notifications
  where true;

  get diagnostics v_notifications_deleted = row_count;

  if to_regclass('public.activity_view_states') is not null then
    delete from public.activity_view_states
    where true;

    get diagnostics v_view_states_deleted = row_count;
  end if;

  return jsonb_build_object(
    'notifications_deleted', v_notifications_deleted,
    'activity_view_states_deleted', v_view_states_deleted,
    'notification_email_outbox_deleted', v_email_outbox_deleted,
    'push_outbox_deleted', v_push_outbox_deleted
  );
end;
$function$;

commit;

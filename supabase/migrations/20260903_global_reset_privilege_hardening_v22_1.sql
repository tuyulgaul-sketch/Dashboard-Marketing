-- Dashboard Marketing PertaLife
-- V22.1 — Global Reset RPC privilege hardening
-- 2026-09-03
--
-- The functions already perform their own SYSTEM_ADMIN/support-root checks.
-- This removes the inherited PUBLIC/anon EXECUTE path as an additional layer.

begin;

revoke all
on function public.admin_global_reset_database()
from public, anon;

grant execute
on function public.admin_global_reset_database()
to authenticated;

revoke all
on function public.admin_clear_notification_state_for_global_reset()
from public, anon;

grant execute
on function public.admin_clear_notification_state_for_global_reset()
to authenticated;

revoke all
on function public.list_central_business_file_paths_for_reset()
from public, anon;

grant execute
on function public.list_central_business_file_paths_for_reset()
to authenticated;

revoke all
on function public.reset_central_business_data()
from public, anon;

grant execute
on function public.reset_central_business_data()
to authenticated;

commit;

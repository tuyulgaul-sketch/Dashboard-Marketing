-- Dashboard Marketing PertaLife
-- Tanda Terima V19.1 — narrow RPC exposure / remove redundant file SELECT policy
-- 2026-09-03

begin;

-- Application entry point: signed-in users need this, anonymous users do not.
revoke execute on function public.apply_central_business_changes(text, jsonb, jsonb)
from anon;

-- These helpers are either used internally by SECURITY DEFINER functions or
-- by authenticated-only RLS. Anonymous callers never need direct RPC access.
revoke execute on function public.central_can_mutate_business_entity(text, jsonb, jsonb)
from anon;
revoke execute on function public.central_can_view_business_entity(text, jsonb)
from anon;
revoke execute on function public.central_validate_business_transition(text, jsonb, jsonb)
from anon;

-- V19 helpers are internal implementation details. They are invoked by
-- SECURITY DEFINER code / triggers, not directly by the web client.
revoke all on function public.current_business_runtime_user_id_v19()
from public, anon, authenticated;
revoke all on function public.resolve_business_profile_id_v19(text)
from public, anon, authenticated;

-- Trigger functions must not be exposed as callable RPC endpoints.
revoke all on function public.notify_document_handover_v19()
from public, anon, authenticated;
revoke all on function public.enqueue_legacy_push_v13()
from public, anon, authenticated;

-- V19 central_can_view_business_entity now handles TANDA_TERIMA party-based
-- file visibility through the generic central_business_files_select_policy.
-- The older V17 SELECT policy is therefore redundant and caused two
-- permissive SELECT policies to be evaluated for every row.
drop policy if exists central_business_files_tanda_terima_select_v17
on public.central_business_files;

commit;

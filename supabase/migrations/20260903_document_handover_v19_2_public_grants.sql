-- Dashboard Marketing PertaLife
-- Tanda Terima V19.2 — close inherited PUBLIC EXECUTE grants
-- 2026-09-03

begin;

-- Internal helpers: only SECURITY DEFINER owner code needs to call these.
revoke all on function public.central_can_mutate_business_entity(text, jsonb, jsonb)
from public, anon, authenticated;

revoke all on function public.central_validate_business_transition(text, jsonb, jsonb)
from public, anon, authenticated;

-- This helper is evaluated by authenticated RLS policies, so keep only the
-- explicit authenticated grant and remove inherited PUBLIC/anon exposure.
revoke all on function public.central_can_view_business_entity(text, jsonb)
from public, anon, authenticated;
grant execute on function public.central_can_view_business_entity(text, jsonb)
to authenticated;

commit;

-- Dashboard Marketing PertaLife
-- Tanda Terima V15 — profile-native TRM numbering
-- 2026-09-03
--
-- V14 already supports active profiles without legacy_user_id by assigning
-- deterministic runtime identities PRF-<profile_uuid>. The TRM sequence RPC
-- was still enforcing the old legacy_user_id requirement, which caused
-- LEGACY_USER_REQUIRED before a handover could even be created.
--
-- This migration keeps the same RPC name and the same global sequential
-- numbering format. It only changes actor validation from legacy identity to
-- active authenticated profile identity.

begin;

create or replace function public.reserve_document_handover_id_v13_1(
  p_handover_date date
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_profile_id uuid;
  v_year integer;
  v_month integer;
  v_existing_max integer;
  v_next_sequence integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select p.id
  into v_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.active = true
  limit 1;

  if v_profile_id is null then
    raise exception 'ACTIVE_PROFILE_REQUIRED';
  end if;

  if p_handover_date is null then
    raise exception 'HANDOVER_DATE_REQUIRED';
  end if;

  v_year := extract(year from p_handover_date)::integer;
  v_month := extract(month from p_handover_date)::integer;

  select coalesce(
    max(
      case
        when entity_id ~ ('^TRM-' || v_year || '-' || lpad(v_month::text, 2, '0') || '-[0-9]{5}$')
        then right(entity_id, 5)::integer
        else null
      end
    ),
    0
  )
  into v_existing_max
  from public.central_business_entities
  where storage_key = 'pertalife_document_handovers';

  insert into public.document_handover_sequences_v13_1 (
    year_no,
    month_no,
    last_sequence,
    updated_at
  )
  values (
    v_year,
    v_month,
    v_existing_max + 1,
    now()
  )
  on conflict (year_no, month_no)
  do update set
    last_sequence =
      greatest(
        public.document_handover_sequences_v13_1.last_sequence,
        v_existing_max
      ) + 1,
    updated_at = now()
  returning last_sequence
  into v_next_sequence;

  return
    'TRM-' ||
    v_year::text ||
    '-' ||
    lpad(v_month::text, 2, '0') ||
    '-' ||
    lpad(v_next_sequence::text, 5, '0');
end;
$function$;

revoke all
on function public.reserve_document_handover_id_v13_1(date)
from public, anon;

grant execute
on function public.reserve_document_handover_id_v13_1(date)
to authenticated;

comment on function public.reserve_document_handover_id_v13_1(date)
is 'TRM global sequence reservation. V15 authenticates against active profile identity and no longer requires legacy_user_id.';

commit;

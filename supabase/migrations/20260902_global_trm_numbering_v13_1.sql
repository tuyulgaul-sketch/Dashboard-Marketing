begin;

create table if not exists public.document_handover_sequences_v13_1 (
  year_no integer not null,
  month_no integer not null,
  last_sequence integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (year_no, month_no),
  constraint document_handover_sequences_v13_1_month_check
    check (month_no between 1 and 12),
  constraint document_handover_sequences_v13_1_sequence_check
    check (last_sequence >= 0)
);

alter table public.document_handover_sequences_v13_1
  enable row level security;

revoke all on table public.document_handover_sequences_v13_1
  from anon, authenticated;

create or replace function public.reserve_document_handover_id_v13_1(
  p_handover_date date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_year integer;
  v_month integer;
  v_existing_max integer;
  v_next_sequence integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into v_profile
  from public.profiles
  where auth_user_id = auth.uid()
    and is_active = true
  limit 1;

  if v_profile.id is null then
    raise exception 'ACTIVE_PROFILE_REQUIRED';
  end if;

  if coalesce(v_profile.legacy_user_id, '') = '' then
    raise exception 'LEGACY_USER_REQUIRED';
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
$$;

revoke all on function public.reserve_document_handover_id_v13_1(date)
  from public, anon;

grant execute on function public.reserve_document_handover_id_v13_1(date)
  to authenticated;

commit;

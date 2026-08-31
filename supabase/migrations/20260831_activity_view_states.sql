-- Dashboard Marketing — per-user Activity seen state
-- Apply in Supabase before production to persist card-read state cross-device.

create table if not exists public.activity_view_states (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, activity_id)
);

create index if not exists idx_activity_view_states_activity_id
  on public.activity_view_states(activity_id);

alter table public.activity_view_states enable row level security;

grant select, insert, update
  on public.activity_view_states
  to authenticated;

drop policy if exists "activity_view_states_select_own"
  on public.activity_view_states;

create policy "activity_view_states_select_own"
  on public.activity_view_states
  for select
  to authenticated
  using (
    profile_id = (
      select p.id
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.active = true
      limit 1
    )
  );

drop policy if exists "activity_view_states_insert_own"
  on public.activity_view_states;

create policy "activity_view_states_insert_own"
  on public.activity_view_states
  for insert
  to authenticated
  with check (
    profile_id = (
      select p.id
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.active = true
      limit 1
    )
  );

drop policy if exists "activity_view_states_update_own"
  on public.activity_view_states;

create policy "activity_view_states_update_own"
  on public.activity_view_states
  for update
  to authenticated
  using (
    profile_id = (
      select p.id
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.active = true
      limit 1
    )
  )
  with check (
    profile_id = (
      select p.id
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.active = true
      limit 1
    )
  );

create or replace function public.get_my_activity_view_states()
returns table (
  activity_id uuid,
  last_seen_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    avs.activity_id,
    avs.last_seen_at
  from public.activity_view_states avs
  where avs.profile_id = (
    select p.id
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.active = true
    limit 1
  );
$$;

grant execute
  on function public.get_my_activity_view_states()
  to authenticated;

create or replace function public.mark_activity_seen(
  p_activity_id uuid
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_seen_at timestamptz := now();
begin
  select p.id
    into v_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.active = true
  limit 1;

  if v_profile_id is null then
    raise exception 'Active profile tidak ditemukan';
  end if;

  -- Runs under caller RLS so an inaccessible Activity cannot be marked seen.
  if not exists (
    select 1
    from public.activities a
    where a.id = p_activity_id
  ) then
    raise exception
      'Aktivitas tidak ditemukan atau tidak dapat diakses';
  end if;

  insert into public.activity_view_states (
    profile_id,
    activity_id,
    last_seen_at,
    updated_at
  )
  values (
    v_profile_id,
    p_activity_id,
    v_seen_at,
    v_seen_at
  )
  on conflict (profile_id, activity_id)
  do update set
    last_seen_at = excluded.last_seen_at,
    updated_at = excluded.updated_at;

  return v_seen_at;
end;
$$;

grant execute
  on function public.mark_activity_seen(uuid)
  to authenticated;

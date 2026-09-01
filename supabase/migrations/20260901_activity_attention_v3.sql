-- Dashboard Marketing — Activity Attention V3
-- Separate Discussion unread state from general Activity seen state.

begin;

do $$
begin
  if to_regclass('public.activity_view_states') is null then
    raise exception 'Table public.activity_view_states tidak ditemukan';
  end if;
  if to_regclass('public.activity_comments') is null then
    raise exception 'Table public.activity_comments tidak ditemukan';
  end if;
  if to_regclass('public.activity_events') is null then
    raise exception 'Table public.activity_events tidak ditemukan';
  end if;
end
$$;

alter table public.activity_view_states
  add column if not exists last_discussion_seen_at timestamptz null;

update public.activity_view_states
set last_discussion_seen_at = last_seen_at
where last_discussion_seen_at is null;

create or replace function public.get_my_activity_discussion_attention_v3()
returns table (
  activity_id uuid,
  unread_count integer,
  latest_comment_at timestamptz,
  last_discussion_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select public.current_profile_id() as id
  )
  select
    c.activity_id,
    count(*)::integer as unread_count,
    max(c.created_at) as latest_comment_at,
    max(avs.last_discussion_seen_at) as last_discussion_seen_at
  from public.activity_comments c
  cross join me
  left join public.activity_view_states avs
    on avs.activity_id = c.activity_id
   and avs.profile_id = me.id
  where
    me.id is not null
    and c.created_by_profile_id is distinct from me.id
    and public.can_view_activity_id(c.activity_id)
    and c.created_at > coalesce(
      avs.last_discussion_seen_at,
      '1970-01-01 00:00:00+00'::timestamptz
    )
    and exists (
      select 1
      from public.activity_events e
      where e.activity_id = c.activity_id
        and e.source_id = c.id
        and e.event_type in ('COMMENT_ADDED', 'COMMENT_REPLIED')
    )
  group by c.activity_id;
$$;

revoke all
  on function public.get_my_activity_discussion_attention_v3()
  from public;

grant execute
  on function public.get_my_activity_discussion_attention_v3()
  to authenticated;

create or replace function public.mark_activity_discussion_seen_v3(
  p_activity_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_seen_at timestamptz := now();
begin
  v_profile_id := public.current_profile_id();

  if v_profile_id is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  if not public.can_view_activity_id(p_activity_id) then
    raise exception 'Aktivitas tidak ditemukan atau tidak dapat diakses.';
  end if;

  insert into public.activity_view_states (
    profile_id,
    activity_id,
    last_seen_at,
    last_discussion_seen_at,
    created_at,
    updated_at
  )
  values (
    v_profile_id,
    p_activity_id,
    v_seen_at,
    v_seen_at,
    v_seen_at,
    v_seen_at
  )
  on conflict (profile_id, activity_id)
  do update set
    last_seen_at = greatest(
      public.activity_view_states.last_seen_at,
      excluded.last_seen_at
    ),
    last_discussion_seen_at = excluded.last_discussion_seen_at,
    updated_at = excluded.updated_at;

  return v_seen_at;
end;
$$;

revoke all
  on function public.mark_activity_discussion_seen_v3(uuid)
  from public;

grant execute
  on function public.mark_activity_discussion_seen_v3(uuid)
  to authenticated;

commit;


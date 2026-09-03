-- Dashboard Marketing PertaLife
-- Release Sync Hardening V20
-- 2026-09-03
--
-- Purpose:
-- Provide a privacy-safe Realtime invalidation channel for data that is
-- intentionally read through RPC / RLS instead of exposing the underlying
-- tables directly to Postgres Changes consumers.
--
-- Channels:
--   DIRECTORY       -> profile / hierarchy changes
--   MEETING_ROOM    -> room booking lifecycle changes
--   ACTIVITY_DETAIL -> comments / attachments / collaborators / history
--
-- The revision table contains no business payload and no entity identifiers.
-- Clients receive only an invalidation signal and then reload authorized data
-- through the existing server-side APIs.

begin;

create table if not exists public.app_sync_revisions (
  channel text primary key,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint app_sync_revisions_channel_check
    check (channel in ('DIRECTORY','MEETING_ROOM','ACTIVITY_DETAIL'))
);

alter table public.app_sync_revisions enable row level security;

revoke all on table public.app_sync_revisions from public, anon;
grant select on table public.app_sync_revisions to authenticated;

drop policy if exists app_sync_revisions_select_authenticated
on public.app_sync_revisions;

create policy app_sync_revisions_select_authenticated
on public.app_sync_revisions
for select
to authenticated
using (auth.uid() is not null);

insert into public.app_sync_revisions(channel, revision)
values
  ('DIRECTORY', 0),
  ('MEETING_ROOM', 0),
  ('ACTIVITY_DETAIL', 0)
on conflict (channel) do nothing;

create or replace function public.bump_app_sync_revision_v20(
  p_channel text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_channel not in ('DIRECTORY','MEETING_ROOM','ACTIVITY_DETAIL') then
    raise exception 'Sync channel tidak valid: %', p_channel;
  end if;

  insert into public.app_sync_revisions(
    channel,
    revision,
    updated_at
  )
  values (
    p_channel,
    1,
    now()
  )
  on conflict (channel)
  do update set
    revision = public.app_sync_revisions.revision + 1,
    updated_at = now();
end;
$$;

-- Internal trigger helper only; never callable by browser roles.
revoke all
on function public.bump_app_sync_revision_v20(text)
from public, anon, authenticated;

create or replace function public.signal_directory_sync_v20()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_app_sync_revision_v20('DIRECTORY');

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all
on function public.signal_directory_sync_v20()
from public, anon, authenticated;

drop trigger if exists trg_signal_directory_sync_v20
on public.profiles;

create trigger trg_signal_directory_sync_v20
after insert or update or delete
on public.profiles
for each row
execute function public.signal_directory_sync_v20();

create or replace function public.signal_meeting_room_sync_v20()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_app_sync_revision_v20('MEETING_ROOM');

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all
on function public.signal_meeting_room_sync_v20()
from public, anon, authenticated;

drop trigger if exists trg_signal_meeting_room_sync_v20
on public.marketing_meeting_room_bookings;

create trigger trg_signal_meeting_room_sync_v20
after insert or update or delete
on public.marketing_meeting_room_bookings
for each row
execute function public.signal_meeting_room_sync_v20();

create or replace function public.signal_activity_detail_sync_v20()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_app_sync_revision_v20('ACTIVITY_DETAIL');

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all
on function public.signal_activity_detail_sync_v20()
from public, anon, authenticated;

drop trigger if exists trg_signal_activity_comment_sync_v20
on public.activity_comments;
create trigger trg_signal_activity_comment_sync_v20
after insert or update or delete
on public.activity_comments
for each row
execute function public.signal_activity_detail_sync_v20();

drop trigger if exists trg_signal_activity_attachment_sync_v20
on public.activity_attachments;
create trigger trg_signal_activity_attachment_sync_v20
after insert or update or delete
on public.activity_attachments
for each row
execute function public.signal_activity_detail_sync_v20();

drop trigger if exists trg_signal_activity_collaborator_sync_v20
on public.activity_collaborators;
create trigger trg_signal_activity_collaborator_sync_v20
after insert or update or delete
on public.activity_collaborators
for each row
execute function public.signal_activity_detail_sync_v20();

drop trigger if exists trg_signal_activity_history_sync_v20
on public.activity_history;
create trigger trg_signal_activity_history_sync_v20
after insert or update or delete
on public.activity_history
for each row
execute function public.signal_activity_detail_sync_v20();

-- Add only the privacy-safe revision table to Realtime. Underlying profile,
-- meeting-room and activity-detail tables retain their existing RLS/RPC model.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_sync_revisions'
  ) then
    alter publication supabase_realtime
      add table public.app_sync_revisions;
  end if;
end;
$$;

commit;

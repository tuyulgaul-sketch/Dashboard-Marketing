-- Dashboard Marketing — Activity Realtime V5
-- 2026-09-01
-- Ensures public.activities emits Supabase Realtime changes.

begin;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activities'
  ) then
    alter publication supabase_realtime
      add table public.activities;
  end if;
end
$$;

commit;

-- Dashboard Marketing PertaLife
-- Release Sync Hardening V20.1
-- Optimize authenticated SELECT policy for the small sync revision channel.

begin;

drop policy if exists app_sync_revisions_select_authenticated
on public.app_sync_revisions;

create policy app_sync_revisions_select_authenticated
on public.app_sync_revisions
for select
to authenticated
using ((select auth.uid()) is not null);

commit;

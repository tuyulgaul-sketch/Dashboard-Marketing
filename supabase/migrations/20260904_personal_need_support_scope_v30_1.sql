-- Dashboard Marketing PertaLife
-- Personal Task Need Support Approval V30.1
-- Keep mandatory approval rows strictly scoped to PERSONAL activities.

begin;

create or replace function public.sync_need_support_approval_v30()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.collaboration_context = 'NEED_SUPPORT'
     and new.can_edit = true
     and exists (
       select 1
       from public.activities a
       where a.id = new.activity_id
         and a.activity_mode = 'PERSONAL'
     ) then
    insert into public.activity_support_approvals (
      activity_id,
      profile_id,
      requested_by_profile_id,
      decision_status,
      decision_note,
      requested_at,
      decided_at
    )
    values (
      new.activity_id,
      new.profile_id,
      new.added_by_profile_id,
      'PENDING',
      null,
      coalesce(new.requested_at, now()),
      null
    )
    on conflict (activity_id, profile_id)
    do update set
      requested_by_profile_id = excluded.requested_by_profile_id,
      decision_status = 'PENDING',
      decision_note = null,
      requested_at = excluded.requested_at,
      decided_at = null;
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_need_support_approval_v30()
from public, anon, authenticated;

commit;

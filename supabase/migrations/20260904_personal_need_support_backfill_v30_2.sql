-- Dashboard Marketing PertaLife
-- Personal Task Need Support Approval V30.2
-- Backfill PERSONAL tasks that were already in NEED_SUPPORT before V30.

begin;

insert into public.activity_support_approvals (
  activity_id,
  profile_id,
  requested_by_profile_id,
  decision_status,
  decision_note,
  requested_at,
  decided_at
)
select
  a.id,
  c.profile_id,
  c.added_by_profile_id,
  'PENDING',
  null,
  coalesce(c.requested_at, now()),
  null
from public.activities a
join public.activity_collaborators c
  on c.activity_id = a.id
 and c.collaboration_context = 'NEED_SUPPORT'
 and c.can_edit = true
join public.profiles p
  on p.id = c.profile_id
 and p.active = true
where a.activity_mode = 'PERSONAL'
  and a.status = 'NEED_SUPPORT'
  and a.support_approval_status is null
on conflict (activity_id, profile_id)
do update set
  requested_by_profile_id = excluded.requested_by_profile_id,
  decision_status = 'PENDING',
  decision_note = null,
  requested_at = excluded.requested_at,
  decided_at = null;

with counts as (
  select
    a.id as activity_id,
    count(sa.profile_id)::smallint as total
  from public.activities a
  join public.activity_support_approvals sa
    on sa.activity_id = a.id
   and sa.decision_status = 'PENDING'
  where a.activity_mode = 'PERSONAL'
    and a.status = 'NEED_SUPPORT'
    and a.support_approval_status is null
  group by a.id
)
update public.activities a
set
  support_approval_status = 'PENDING',
  support_approval_total = counts.total,
  support_approval_approved = 0,
  status_note = coalesce(
    a.status_note,
    'Menunggu approval dari seluruh user Need Support.'
  ),
  updated_at = now()
from counts
where a.id = counts.activity_id
  and counts.total > 0;

commit;

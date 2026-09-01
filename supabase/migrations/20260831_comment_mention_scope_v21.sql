-- Dashboard Marketing — Comment V2.1 task-centric mention scope
-- Scope rule:
--   1) Mention follows the TASK OWNER's activity team, never the comment actor.
--   2) Team = same normalized department as owner; if owner has no department,
--      same normalized unit.
--   3) Plus ONE ceiling profile: the first manager above the owner whose team key
--      differs from the owner's team key.
--   4) Every mention candidate must be able to open the activity under the same
--      access semantics used by can_view_activity_id().
-- Existing Comment V2 remains intact; frontend will call the new v21 RPC.

begin;

create or replace function public.can_profile_view_activity_v2(
  p_viewer_profile_id uuid,
  p_activity_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_creator_id uuid;
  v_status text;
  v_viewer_department text;
  v_viewer_unit text;
  v_owner_department text;
  v_owner_unit text;
begin
  if p_viewer_profile_id is null or p_activity_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_viewer_profile_id
      and p.active = true
  ) then
    return false;
  end if;

  select
    a.owner_profile_id,
    a.created_by_profile_id,
    a.status
  into
    v_owner_id,
    v_creator_id,
    v_status
  from public.activities a
  where a.id = p_activity_id;

  if v_owner_id is null then
    return false;
  end if;

  if v_status = 'DRAFT' then
    return p_viewer_profile_id = v_creator_id;
  end if;

  if p_viewer_profile_id = v_owner_id
     or p_viewer_profile_id = v_creator_id then
    return true;
  end if;

  if exists (
    with recursive scope_tree as (
      select p.id
      from public.profiles p
      where p.id = p_viewer_profile_id
        and p.active = true

      union all

      select child.id
      from public.profiles child
      join scope_tree parent
        on child.manager_id = parent.id
      where child.active = true
    )
    select 1
    from scope_tree
    where id = v_owner_id
  ) then
    return true;
  end if;

  select
    lower(trim(coalesce(vp.department, ''))),
    lower(trim(coalesce(vp.unit, ''))),
    lower(trim(coalesce(op.department, ''))),
    lower(trim(coalesce(op.unit, '')))
  into
    v_viewer_department,
    v_viewer_unit,
    v_owner_department,
    v_owner_unit
  from public.profiles vp
  cross join public.profiles op
  where vp.id = p_viewer_profile_id
    and vp.active = true
    and op.id = v_owner_id
    and op.active = true;

  if (
    v_viewer_department not in ('', 'none', 'null')
    and v_viewer_department = v_owner_department
  ) or (
    v_viewer_department in ('', 'none', 'null')
    and v_viewer_unit <> ''
    and v_viewer_unit = v_owner_unit
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.activity_collaborators c
    where c.activity_id = p_activity_id
      and c.profile_id = p_viewer_profile_id
  ) then
    return true;
  end if;

  return false;
end;
$$;

revoke all
  on function public.can_profile_view_activity_v2(uuid, uuid)
  from public;

grant execute
  on function public.can_profile_view_activity_v2(uuid, uuid)
  to authenticated;

create or replace function public.is_activity_mention_candidate_v2(
  p_activity_id uuid,
  p_profile_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_owner_department text;
  v_owner_unit text;
  v_candidate_department text;
  v_candidate_unit text;
  v_ceiling_id uuid;
begin
  if p_activity_id is null or p_profile_id is null then
    return false;
  end if;

  select
    a.owner_profile_id,
    lower(trim(coalesce(owner.department, ''))),
    lower(trim(coalesce(owner.unit, '')))
  into
    v_owner_id,
    v_owner_department,
    v_owner_unit
  from public.activities a
  join public.profiles owner
    on owner.id = a.owner_profile_id
   and owner.active = true
  where a.id = p_activity_id;

  if v_owner_id is null then
    return false;
  end if;

  select
    lower(trim(coalesce(p.department, ''))),
    lower(trim(coalesce(p.unit, '')))
  into
    v_candidate_department,
    v_candidate_unit
  from public.profiles p
  where p.id = p_profile_id
    and p.active = true;

  if not found then
    return false;
  end if;

  if not public.can_profile_view_activity_v2(
    p_profile_id,
    p_activity_id
  ) then
    return false;
  end if;

  if v_owner_department not in ('', 'none', 'null') then
    if v_candidate_department = v_owner_department then
      return true;
    end if;

    with recursive manager_chain as (
      select
        p.id,
        p.manager_id,
        lower(trim(coalesce(p.department, ''))) as department_key,
        1 as depth
      from public.profiles p
      where p.id = (
        select owner.manager_id
        from public.profiles owner
        where owner.id = v_owner_id
      )
        and p.active = true

      union all

      select
        p.id,
        p.manager_id,
        lower(trim(coalesce(p.department, ''))) as department_key,
        mc.depth + 1
      from public.profiles p
      join manager_chain mc
        on p.id = mc.manager_id
      where p.active = true
    )
    select mc.id
      into v_ceiling_id
    from manager_chain mc
    where mc.department_key <> v_owner_department
       or mc.department_key in ('', 'none', 'null')
    order by mc.depth
    limit 1;
  else
    if v_owner_unit <> ''
       and v_candidate_unit = v_owner_unit then
      return true;
    end if;

    with recursive manager_chain as (
      select
        p.id,
        p.manager_id,
        lower(trim(coalesce(p.unit, ''))) as unit_key,
        1 as depth
      from public.profiles p
      where p.id = (
        select owner.manager_id
        from public.profiles owner
        where owner.id = v_owner_id
      )
        and p.active = true

      union all

      select
        p.id,
        p.manager_id,
        lower(trim(coalesce(p.unit, ''))) as unit_key,
        mc.depth + 1
      from public.profiles p
      join manager_chain mc
        on p.id = mc.manager_id
      where p.active = true
    )
    select mc.id
      into v_ceiling_id
    from manager_chain mc
    where mc.unit_key <> v_owner_unit
    order by mc.depth
    limit 1;
  end if;

  return p_profile_id = v_ceiling_id;
end;
$$;

revoke all
  on function public.is_activity_mention_candidate_v2(uuid, uuid)
  from public;

grant execute
  on function public.is_activity_mention_candidate_v2(uuid, uuid)
  to authenticated;

create or replace function public.get_activity_mention_candidates_v2(
  p_activity_id uuid
)
returns table (
  id uuid,
  full_name text,
  role_level text,
  unit text,
  department text,
  manager_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid;
begin
  v_me := public.current_profile_id();

  if v_me is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  if not public.can_view_activity_id(p_activity_id) then
    raise exception 'Anda tidak memiliki akses ke aktivitas ini.';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.role_level,
    p.unit,
    p.department,
    p.manager_id
  from public.profiles p
  where p.active = true
    and p.id <> v_me
    and public.is_activity_mention_candidate_v2(
      p_activity_id,
      p.id
    )
  order by p.full_name;
end;
$$;

revoke all
  on function public.get_activity_mention_candidates_v2(uuid)
  from public;

grant execute
  on function public.get_activity_mention_candidates_v2(uuid)
  to authenticated;

create or replace function public.decorate_activity_comment_v21(
  p_comment_id uuid,
  p_parent_comment_id uuid default null,
  p_mentioned_profile_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_name text;
  v_activity_id uuid;
  v_activity_title text;
  v_comment_created_at timestamptz;
  v_requested_count integer := 0;
  v_allowed_count integer := 0;
  v_target uuid;
  v_link text;
begin
  v_actor_id := public.current_profile_id();

  if v_actor_id is null then
    raise exception 'Profile aktif untuk user login tidak ditemukan.';
  end if;

  select p.full_name
    into v_actor_name
  from public.profiles p
  where p.id = v_actor_id;

  select
    c.activity_id,
    a.title,
    c.created_at
  into
    v_activity_id,
    v_activity_title,
    v_comment_created_at
  from public.activity_comments c
  join public.activities a
    on a.id = c.activity_id
  where c.id = p_comment_id
    and c.created_by_profile_id = v_actor_id;

  if v_activity_id is null then
    raise exception 'Komentar tidak ditemukan atau bukan milik user aktif.';
  end if;

  if not public.can_view_activity_id(v_activity_id) then
    raise exception 'Anda tidak memiliki akses ke aktivitas ini.';
  end if;

  select count(distinct x.id)
    into v_requested_count
  from unnest(
    coalesce(p_mentioned_profile_ids, '{}'::uuid[])
  ) as x(id)
  where x.id is distinct from v_actor_id;

  select count(distinct x.id)
    into v_allowed_count
  from unnest(
    coalesce(p_mentioned_profile_ids, '{}'::uuid[])
  ) as x(id)
  where x.id is distinct from v_actor_id
    and public.is_activity_mention_candidate_v2(
      v_activity_id,
      x.id
    );

  if v_requested_count <> v_allowed_count then
    raise exception
      'Mention hanya diperbolehkan untuk tim pemilik aktivitas dan satu pimpinan di atas tim yang juga memiliki akses ke task.';
  end if;

  perform public.decorate_activity_comment_v2(
    p_comment_id,
    p_parent_comment_id,
    '{}'::uuid[]
  );

  insert into public.activity_comment_mentions (
    comment_id,
    mentioned_profile_id
  )
  select
    p_comment_id,
    x.id
  from (
    select distinct id
    from unnest(
      coalesce(p_mentioned_profile_ids, '{}'::uuid[])
    ) as t(id)
  ) x
  where x.id is distinct from v_actor_id
    and public.is_activity_mention_candidate_v2(
      v_activity_id,
      x.id
    )
  on conflict (comment_id, mentioned_profile_id)
  do nothing;

  v_link := format(
    '/aktivitas?task=%s&tab=discussion&comment=%s',
    v_activity_id,
    p_comment_id
  );

  for v_target in
    select acm.mentioned_profile_id
    from public.activity_comment_mentions acm
    where acm.comment_id = p_comment_id
      and acm.mentioned_profile_id is distinct from v_actor_id
      and public.can_profile_view_activity_v2(
        acm.mentioned_profile_id,
        v_activity_id
      )
  loop
    update public.notifications
    set
      notification_type = 'ACTIVITY_MENTION',
      module = 'ACTIVITY',
      title = format(
        '%s menyebut Anda dalam komentar',
        v_actor_name
      ),
      message = format(
        'Anda di-mention pada: %s',
        v_activity_title
      ),
      link_path = v_link
    where id = (
      select n.id
      from public.notifications n
      where n.recipient_profile_id = v_target
        and n.related_record_id = v_activity_id
        and n.notification_type in (
          'ACTIVITY_COMMENT',
          'ACTIVITY_REPLY',
          'ACTIVITY_COMMENT_MANAGER',
          'ACTIVITY_MENTION'
        )
        and n.created_at >= v_comment_created_at - interval '5 seconds'
      order by n.created_at desc
      limit 1
    );

    if not found then
      insert into public.notifications (
        recipient_profile_id,
        notification_type,
        module,
        title,
        message,
        related_record_id,
        link_path
      )
      values (
        v_target,
        'ACTIVITY_MENTION',
        'ACTIVITY',
        format(
          '%s menyebut Anda dalam komentar',
          v_actor_name
        ),
        format(
          'Anda di-mention pada: %s',
          v_activity_title
        ),
        v_activity_id,
        v_link
      );
    end if;
  end loop;
end;
$$;

revoke all
  on function public.decorate_activity_comment_v21(uuid, uuid, uuid[])
  from public;

grant execute
  on function public.decorate_activity_comment_v21(uuid, uuid, uuid[])
  to authenticated;

commit;

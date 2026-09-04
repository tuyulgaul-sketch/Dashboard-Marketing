-- Dashboard Marketing — Activity Mursid Requester V28
-- 2026-09-04
-- Allow DH/SPV/Staff in Captive Marketing and Corporate & Retail Marketing
-- to select Mursid Pratomo as task giver/final approver without changing
-- profiles.manager_id or global organizational hierarchy.

begin;

create or replace function public.activity_assignment_approval_chain_v6(
  p_owner_profile_id uuid,
  p_requester_profile_id uuid
)
returns uuid[]
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_requester_depth integer;
  v_requester_role text;
  v_requester_name text;
  v_requester_unit text;
  v_owner_role text;
  v_owner_unit text;
  v_chain uuid[];
  v_is_mursid_exception boolean := false;
begin
  if p_owner_profile_id is null or p_requester_profile_id is null then
    raise exception 'Owner dan pemberi tugas wajib tersedia.';
  end if;

  select
    upper(trim(coalesce(p.role_level, ''))),
    upper(trim(coalesce(p.full_name, ''))),
    upper(trim(coalesce(p.unit, '')))
  into
    v_requester_role,
    v_requester_name,
    v_requester_unit
  from public.profiles p
  where p.id = p_requester_profile_id
    and p.active = true;

  if v_requester_role is null then
    raise exception 'Pemberi tugas tidak ditemukan atau tidak aktif.';
  end if;

  if v_requester_role like '%SUPERVISOR%'
     or v_requester_role like '%SPV%' then
    raise exception 'SPV tidak digunakan sebagai final approver pada flow assignment lisan.';
  end if;

  select
    upper(trim(coalesce(p.role_level, ''))),
    upper(trim(coalesce(p.unit, '')))
  into
    v_owner_role,
    v_owner_unit
  from public.profiles p
  where p.id = p_owner_profile_id
    and p.active = true;

  if v_owner_role is null then
    raise exception 'Pemilik task tidak ditemukan atau tidak aktif.';
  end if;

  v_is_mursid_exception :=
    v_requester_name = 'MURSID PRATOMO'
    and v_requester_role = 'ADVISOR'
    and v_requester_unit in ('DIRECTORATE MARKETING', 'DIREKTORAT MARKETING')
    and (
      v_owner_role in ('DH', 'STAFF')
      or v_owner_role like '%DEPARTMENT HEAD%'
      or v_owner_role like '%SUPERVISOR%'
      or v_owner_role like '%SPV%'
    )
    and (
      v_owner_unit like 'CAPTIVE%'
      or v_owner_unit like 'CRM%'
      or v_owner_unit like 'CORPORATE & RETAIL%'
      or v_owner_unit like 'CORPORATE AND RETAIL%'
    );

  if v_is_mursid_exception then
    -- Preserve line-manager approval up to VP, keep the existing SPV skip,
    -- then use Mursid as the explicitly selected final approver.
    with recursive hierarchy as (
      select
        manager.id,
        manager.manager_id,
        manager.role_level,
        1 as depth
      from public.profiles owner
      join public.profiles manager
        on manager.id = owner.manager_id
      where owner.id = p_owner_profile_id
        and owner.active = true
        and manager.active = true

      union all

      select
        manager.id,
        manager.manager_id,
        manager.role_level,
        h.depth + 1
      from hierarchy h
      join public.profiles manager
        on manager.id = h.manager_id
      where h.depth < 20
        and manager.active = true
    )
    select array_agg(h.id order by h.depth)
      into v_chain
    from hierarchy h
    where upper(trim(coalesce(h.role_level, ''))) not like '%SUPERVISOR%'
      and upper(trim(coalesce(h.role_level, ''))) not like '%SPV%'
      and upper(trim(coalesce(h.role_level, ''))) not in ('DIRECTOR', 'DIREKTUR');

    v_chain := coalesce(v_chain, '{}'::uuid[]) || p_requester_profile_id;

    if coalesce(array_length(v_chain, 1), 0) = 0
       or v_chain[array_length(v_chain, 1)] <> p_requester_profile_id then
      raise exception 'Approval chain assignment untuk Mursid Pratomo tidak valid.';
    end if;

    return v_chain;
  end if;

  with recursive hierarchy as (
    select
      manager.id,
      manager.manager_id,
      manager.role_level,
      1 as depth
    from public.profiles owner
    join public.profiles manager
      on manager.id = owner.manager_id
    where owner.id = p_owner_profile_id
      and owner.active = true
      and manager.active = true

    union all

    select
      manager.id,
      manager.manager_id,
      manager.role_level,
      h.depth + 1
    from hierarchy h
    join public.profiles manager
      on manager.id = h.manager_id
    where h.depth < 20
      and manager.active = true
  )
  select h.depth
    into v_requester_depth
  from hierarchy h
  where h.id = p_requester_profile_id
  order by h.depth
  limit 1;

  if v_requester_depth is null then
    raise exception 'Pemberi tugas harus berada pada hierarchy atasan pemilik task.';
  end if;

  with recursive hierarchy as (
    select
      manager.id,
      manager.manager_id,
      manager.role_level,
      1 as depth
    from public.profiles owner
    join public.profiles manager
      on manager.id = owner.manager_id
    where owner.id = p_owner_profile_id
      and owner.active = true
      and manager.active = true

    union all

    select
      manager.id,
      manager.manager_id,
      manager.role_level,
      h.depth + 1
    from hierarchy h
    join public.profiles manager
      on manager.id = h.manager_id
    where h.depth < 20
      and manager.active = true
  )
  select array_agg(h.id order by h.depth)
    into v_chain
  from hierarchy h
  where h.depth <= v_requester_depth
    and upper(trim(coalesce(h.role_level, ''))) not like '%SUPERVISOR%'
    and upper(trim(coalesce(h.role_level, ''))) not like '%SPV%';

  if coalesce(array_length(v_chain, 1), 0) = 0
     or v_chain[array_length(v_chain, 1)] <> p_requester_profile_id then
    raise exception 'Approval chain assignment tidak valid.';
  end if;

  return v_chain;
end;
$$;

create or replace function public.can_view_activity_id(p_activity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid;
  owner_id uuid;
  creator_id uuid;
  current_status text;
  current_assignment_source text;
  requester_id uuid;
begin
  me := public.current_profile_id();

  if me is null then
    return false;
  end if;

  select
    a.owner_profile_id,
    a.created_by_profile_id,
    a.status,
    a.assignment_source,
    a.assignment_requester_profile_id
  into
    owner_id,
    creator_id,
    current_status,
    current_assignment_source,
    requester_id
  from public.activities a
  where a.id = p_activity_id;

  if owner_id is null then
    return false;
  end if;

  -- Draft remains private to its creator until it is published.
  if current_status = 'DRAFT' then
    return me = creator_id;
  end if;

  if me = owner_id or me = creator_id then
    return true;
  end if;

  -- The selected task giver/final approver can read the published assignment
  -- but edit permission remains governed separately by can_edit_activity_id().
  if current_assignment_source = 'SELF_DECLARED'
     and requester_id = me then
    return true;
  end if;

  if public.is_profile_in_scope(owner_id) then
    return true;
  end if;

  if public.is_same_activity_team(owner_id) then
    return true;
  end if;

  return exists (
    select 1
    from public.activity_collaborators c
    where c.activity_id = p_activity_id
      and c.profile_id = me
  );
end;
$$;

commit;

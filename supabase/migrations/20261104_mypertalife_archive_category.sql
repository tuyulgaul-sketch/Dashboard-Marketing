-- Category lifecycle: archive or transfer active checklist items, without losing evidence.
-- Team assignment belongs to each checklist, not the category.
alter table public.launch_timeline_groups
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id);

create index if not exists launch_groups_active_sort_idx
  on public.launch_timeline_groups(sort_order)
  where deleted_at is null;

-- Keep the historical owner_team field solely for backward-compatible metadata.
-- Categorization no longer grants any power to change a category-level owner.
revoke update(owner_team) on public.launch_timeline_groups from authenticated;

drop policy if exists launch_groups_select on public.launch_timeline_groups;
create policy launch_groups_select on public.launch_timeline_groups
  for select to authenticated
  using (public.is_launch_timeline_member() and deleted_at is null);

drop policy if exists launch_groups_update on public.launch_timeline_groups;
create policy launch_groups_update on public.launch_timeline_groups
  for update to authenticated
  using (public.is_launch_timeline_member() and deleted_at is null)
  with check (public.is_launch_timeline_member() and deleted_at is null);

-- Block adding/moving checklist items into an archived or unknown category.
-- For legacy clients inserting without group_id, fall back to the first ACTIVE group.
create or replace function public.launch_timeline_set_default_group()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and new.group_id is not distinct from old.group_id then
    return new;
  end if;
  if new.group_id is null then
    select g.id into new.group_id
      from public.launch_timeline_groups g
      where g.deleted_at is null
      order by g.sort_order
      limit 1;
  end if;
  perform 1 from public.launch_timeline_groups g
    where g.id=new.group_id and g.deleted_at is null
    for share;
  if not found then
    raise exception 'Kategori tidak ditemukan atau sudah dihapus.';
  end if;
  return new;
end;
$$;
drop trigger if exists launch_timeline_check_target_group_trigger on public.launch_timeline_tasks;
create trigger launch_timeline_check_target_group_trigger
before update of group_id on public.launch_timeline_tasks
for each row execute function public.launch_timeline_set_default_group();

create or replace function public.archive_launch_timeline_group(
  p_group_id uuid,
  p_action text,
  p_target_group_id uuid default null
)
returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare
  v_actor uuid := public.current_profile_id();
  v_source public.launch_timeline_groups%rowtype;
  v_target public.launch_timeline_groups%rowtype;
  v_affected integer := 0;
  v_action text := upper(btrim(coalesce(p_action,'')));
begin
  if not public.is_launch_timeline_member() or v_actor is null then
    raise exception 'Anda tidak berhak menghapus kategori.';
  end if;
  if v_action not in ('MOVE','ARCHIVE_ALL') then
    raise exception 'Pilihan penghapusan kategori tidak valid.';
  end if;

  -- Serialize category archival actions, including the "last category" guard.
  perform pg_advisory_xact_lock(114217, 20261104);
  select * into v_source
    from public.launch_timeline_groups
    where id=p_group_id and deleted_at is null
    for update;
  if not found then raise exception 'Kategori tidak ditemukan atau sudah dihapus.'; end if;

  if (select count(*) from public.launch_timeline_groups where deleted_at is null) <= 1 then
    raise exception 'Kategori terakhir tidak dapat dihapus agar workspace tetap dapat digunakan.';
  end if;

  if v_action = 'MOVE' then
    if p_target_group_id is null or p_target_group_id=p_group_id then
      raise exception 'Pilih kategori tujuan yang berbeda.';
    end if;
    select * into v_target
      from public.launch_timeline_groups
      where id=p_target_group_id and deleted_at is null
      for update;
    if not found then raise exception 'Kategori tujuan tidak tersedia.'; end if;

    insert into public.launch_timeline_audit(task_id,actor_profile_id,changes)
      select t.id,v_actor,jsonb_build_object(
        'action','CATEGORY_MOVED',
        'from_category',v_source.group_code,
        'to_category',v_target.group_code,
        'old_group_id',p_group_id,
        'new_group_id',p_target_group_id
      )
      from public.launch_timeline_tasks t
      where t.group_id=p_group_id and t.deleted_at is null;

    update public.launch_timeline_tasks
      set group_id=p_target_group_id
      where group_id=p_group_id and deleted_at is null;
    get diagnostics v_affected=row_count;
  else
    insert into public.launch_timeline_audit(task_id,actor_profile_id,changes)
      select t.id,v_actor,jsonb_build_object(
        'action','CATEGORY_ARCHIVED_WITH_CHECKLIST',
        'category',v_source.group_code
      )
      from public.launch_timeline_tasks t
      where t.group_id=p_group_id and t.deleted_at is null;

    update public.launch_timeline_tasks
      set deleted_at=now(),deleted_by=v_actor
      where group_id=p_group_id and deleted_at is null;
    get diagnostics v_affected=row_count;
  end if;

  update public.launch_timeline_groups
    set deleted_at=now(),deleted_by=v_actor
    where id=p_group_id;
  insert into public.launch_timeline_group_audit(group_id,actor_profile_id,changes)
  values(p_group_id,v_actor,jsonb_build_object(
    'action','CATEGORY_ARCHIVED',
    'mode',v_action,
    'affected_checklists',v_affected,
    'destination_group_id',p_target_group_id
  ));

  return jsonb_build_object(
    'success',true,
    'mode',v_action,
    'affected_checklists',v_affected
  );
end;
$$;
revoke all on function public.archive_launch_timeline_group(uuid,text,uuid)
  from public,anon;
grant execute on function public.archive_launch_timeline_group(uuid,text,uuid)
  to authenticated;
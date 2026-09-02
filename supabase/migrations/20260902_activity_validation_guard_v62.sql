-- Dashboard Marketing — Activity Validation Guard V6.2
-- 2026-09-02
-- Fixes:
-- 1) PERSONAL tasks may be completed directly by their owner with mandatory outcome.
-- 2) SELF_DECLARED assignments use hierarchical approval chain with SPV skipped.
-- 3) Standard assignment/collaboration validation governance remains unchanged.

begin;

create or replace function public.enforce_activity_validation()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  me uuid;
  expected_manager uuid;
  v_chain uuid[];
  v_expected_self_approver uuid;
begin
  me := public.current_profile_id();

  select p.manager_id
  into expected_manager
  from public.profiles p
  where p.id = new.owner_profile_id;

  ---------------------------------------------------------------------------
  -- ENTERING PENDING VALIDATION
  ---------------------------------------------------------------------------
  if new.status = 'PENDING_VALIDATION'
     and old.status is distinct from 'PENDING_VALIDATION' then

    if coalesce(new.assignment_source, 'STANDARD') = 'SELF_DECLARED'
       and new.activity_mode = 'ASSIGNMENT' then

      if new.assignment_requester_profile_id is null then
        raise exception 'Assignment dari instruksi atasan belum memiliki pemberi tugas / final approver.';
      end if;

      v_chain := public.activity_assignment_approval_chain_v6(
        new.owner_profile_id,
        new.assignment_requester_profile_id
      );

      -- Initial submit starts at the first reviewer in the chain.
      -- After REVISE, validation_approver_profile_id is intentionally retained
      -- so resubmission returns to the reviewer who requested the revision.
      if old.validation_approver_profile_id is not null
         and array_position(
           v_chain,
           old.validation_approver_profile_id
         ) is not null then
        v_expected_self_approver := old.validation_approver_profile_id;
      else
        v_expected_self_approver := v_chain[1];
      end if;

      if new.validation_approver_profile_id
         is distinct from v_expected_self_approver then
        raise exception
          'Approver assignment lisan tidak sesuai approval chain yang berlaku.';
      end if;

    else
      -- Existing governance for ordinary Assignment / Collaboration.
      if expected_manager is null then
        raise exception 'Aktivitas owner ini tidak memiliki manager untuk validasi.';
      end if;

      if new.validation_approver_profile_id is distinct from expected_manager then
        raise exception 'Approver validasi harus direct manager dari owner.';
      end if;
    end if;
  end if;

  ---------------------------------------------------------------------------
  -- LEAVING PENDING VALIDATION
  ---------------------------------------------------------------------------
  if old.status = 'PENDING_VALIDATION'
     and new.status is distinct from old.status then

    if me is distinct from old.validation_approver_profile_id then
      raise exception 'Hanya approver validasi yang dapat memutuskan aktivitas ini.';
    end if;
  end if;

  ---------------------------------------------------------------------------
  -- MOVING TO DONE
  ---------------------------------------------------------------------------
  if new.status = 'DONE'
     and old.status is distinct from 'DONE' then

    -- PERSONAL = diary pribadi.
    -- Owner dapat menyelesaikan sendiri tanpa Pending Validation.
    if coalesce(new.activity_mode, 'PERSONAL') = 'PERSONAL' then

      if me is distinct from new.owner_profile_id then
        raise exception 'Hanya pemilik Task Pribadi yang dapat menandai DONE.';
      end if;

      if old.status in ('DRAFT', 'PENDING_VALIDATION') then
        raise exception 'Task Pribadi harus dipublish terlebih dahulu sebelum ditandai DONE.';
      end if;

      if length(trim(coalesce(new.result, ''))) < 3 then
        raise exception 'Hasil / Outcome wajib diisi sebelum Task Pribadi ditandai DONE.';
      end if;

      -- Allowed. No managerial validation required.
      null;

    elsif old.status = 'PENDING_VALIDATION' then
      -- Existing governed completion for Assignment / Collaboration.
      if me is distinct from old.validation_approver_profile_id then
        raise exception 'DONE memerlukan approval dari approver validasi.';
      end if;

    elsif expected_manager is null and me = new.owner_profile_id then
      -- Preserve existing behavior for top-level profiles.
      null;

    else
      raise exception 'Gunakan Submit Validation sebelum mengubah aktivitas menjadi DONE.';
    end if;
  end if;

  return new;
end;
$function$;

commit;

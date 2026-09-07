-- Add Fact Finding to the existing Marketing Administration document family.
-- Preserve v31/v32 identities, grants, owner/status checks and every other module.
-- No business rows, accounts, files or existing documents are modified.
begin;

create or replace function public.is_admin_document_category_v33(p_category text)
returns boolean language sql immutable
set search_path = ''
as $function$
  select upper(trim(coalesce(p_category, ''))) in ('SPAJ', 'SPAK', 'FACT_FINDING');
$function$;
revoke all on function public.is_admin_document_category_v33(text) from public, anon, authenticated;

-- Rewrite only the audited category predicate in the existing functions.
-- CREATE OR REPLACE preserves their signatures, owners, grants and security settings.
-- Abort rather than silently replacing an unfamiliar or concurrently changed definition.
do $migration$
declare
  v_signature text;
  v_oid oid;
  v_definition text;
  v_old constant text := 'in (''SPAJ'', ''SPAK'')';
  v_new constant text := 'in (''SPAJ'', ''SPAK'', ''FACT_FINDING'')';
begin
  foreach v_signature in array array[
    'public.is_protected_admin_document_v32(text,jsonb)',
    'public.list_published_admin_documents_v31()',
    'public.can_read_published_admin_document_v31(text)',
    'public.central_can_view_published_admin_catalog_entity(text,jsonb)',
    'public.central_can_view_published_admin_catalog_file(text,text)'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then
      raise exception 'Required document function is missing: %', v_signature;
    end if;
    v_definition := pg_get_functiondef(v_oid);
    if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'Unexpected category predicate in %. Review before applying.', v_signature;
    end if;
    execute replace(v_definition, v_old, v_new);
  end loop;
end;
$migration$;

-- Verify the exact category scope and the existing non-public helper privileges.
do $check$
begin
  if not public.is_admin_document_category_v33('FACT_FINDING')
     or not public.is_admin_document_category_v33('SPAJ')
     or not public.is_admin_document_category_v33('SPAK')
     or public.is_admin_document_category_v33('BROSUR')
     or public.is_admin_document_category_v33('FACT_FINDING_OTHER') then
    raise exception 'Fact Finding category scope verification failed.';
  end if;
  if has_function_privilege('authenticated', 'public.is_admin_document_category_v33(text)', 'EXECUTE') then
    raise exception 'The internal category helper must not be publicly executable.';
  end if;
end;
$check$;
commit;

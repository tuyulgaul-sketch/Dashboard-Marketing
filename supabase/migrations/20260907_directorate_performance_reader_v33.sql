-- Read-only directorate performance projection. No existing table, policy,
-- publisher routine, or business record is modified by this migration.
-- The function deliberately exposes aggregates, not policy/customer records.
create or replace function public.list_directorate_performance_v33()
returns jsonb
language plpgsql
stable security definer
set search_path = public, pg_temp
as $function$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.active = true
      and not (
        (lower(trim(coalesce(p.role_level, ''))) like '%system%'
         and lower(trim(coalesce(p.role_level, ''))) like '%admin%')
        or lower(trim(coalesce(p.unit, ''))) = 'administrasi sistem'
      )
  ) then
    raise exception 'Akses laporan Direktorat Marketing ditolak.' using errcode = '42501';
  end if;

  with target_months as (
    select
      t.target_year as year,
      coalesce(nullif(trim(t.unit), ''), 'None') as unit,
      coalesce(nullif(trim(t.department), ''), 'None') as department,
      m.month,
      sum(coalesce(t.personal_target_total, 0)) as annual_total,
      sum(coalesce(t.personal_target_new_business, 0)) as annual_nb,
      sum(coalesce(t.personal_target_renewal, 0)) as annual_rn,
      sum(coalesce(t.monthly_new_business[m.month], 0)) as monthly_nb,
      sum(coalesce(t.monthly_renewal[m.month], 0)) as monthly_rn,
      max(t.published_at) as published_at
    from public.marketing_targets t
    join public.marketing_target_batches b on b.id = t.batch_id
    cross join generate_series(1, 12) as m(month)
    where b.is_current = true and b.status = 'Published'
    group by t.target_year, t.unit, t.department, m.month
  ), target_groups as (
    select year, unit, department,
      max(annual_total) as annual_total,
      max(annual_nb) as annual_nb,
      max(annual_rn) as annual_rn,
      jsonb_agg(monthly_nb order by month) as monthly_nb,
      jsonb_agg(monthly_rn order by month) as monthly_rn,
      max(published_at) as published_at
    from target_months
    group by year, unit, department
  ), official_rows as (
    select s.entity_id,
      s.payload,
      b.payload as batch_payload
    from public.central_business_entities s
    join public.central_business_entities b
      on b.storage_key = 'pertalife_official_production_batches'
     and b.entity_id = s.payload ->> 'batchId'
    where s.storage_key = 'pertalife_official_production_summaries'
      and b.payload ->> 'status' = 'Published'
  )
  select jsonb_build_object(
    'refreshedAt', now(),
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'year', year, 'unit', unit, 'department', department,
        'annualTotal', annual_total, 'annualNB', annual_nb, 'annualRN', annual_rn,
        'monthlyNB', monthly_nb, 'monthlyRN', monthly_rn,
        'publishedAt', published_at
      ) order by year, unit, department) from target_groups
    ), '[]'::jsonb),
    'summaries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entity_id,
        'year', (payload ->> 'productionYear')::integer,
        'month', (payload ->> 'productionMonth')::integer,
        'unit', payload ->> 'marketingFunction',
        'department', payload ->> 'department',
        'businessType', payload ->> 'businessType',
        'productName', payload ->> 'productName',
        'amount', (payload ->> 'productionAmount')::numeric,
        'transactionCount', coalesce((payload ->> 'transactionCount')::integer, 0)
      ) order by (payload ->> 'productionYear')::integer,
                 (payload ->> 'productionMonth')::integer, entity_id)
      from official_rows
    ), '[]'::jsonb),
    'batches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.entity_id,
        'uploadedAt', b.payload ->> 'uploadedAt',
        'uploadedByName', b.payload ->> 'uploadedByName',
        'filename', b.payload ->> 'filename',
        'publishedPeriodKeys', coalesce(b.payload -> 'publishedPeriodKeys', '[]'::jsonb),
        'totalProductionAmount', coalesce((b.payload ->> 'totalProductionAmount')::numeric, 0),
        'validRowCount', coalesce((b.payload ->> 'validRowCount')::integer, 0)
      ) order by b.payload ->> 'uploadedAt' desc, b.entity_id desc)
      from public.central_business_entities b
      where b.storage_key = 'pertalife_official_production_batches'
        and b.payload ->> 'status' = 'Published'
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.list_directorate_performance_v33() from public, anon;
grant execute on function public.list_directorate_performance_v33() to authenticated;
comment on function public.list_directorate_performance_v33() is
  'Authenticated non-system directorate performance aggregates. Never exposes raw policies, customers, files or individual target holders.';

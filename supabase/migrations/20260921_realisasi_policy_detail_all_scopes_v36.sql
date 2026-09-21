-- Expose policy-level Realisasi detail consistently with the public Directorate Realisasi summary.
-- v35 restricted detail rows to the signed-in hierarchy while parent summaries were directorate-wide.
-- v36 preserves the same authenticated active-profile guard, then returns policy detail from every
-- Published Official Production batch. The UI still filters year, scope, business type and product.

create or replace function public.list_directorate_performance_v36()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_result jsonb;
  v_details jsonb;
begin
  -- Reuse v35 for its access guard plus targets, summaries and batch history.
  v_result := public.list_directorate_performance_v35();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.entity_id,
        'year', (d.payload ->> 'productionYear')::integer,
        'month', (d.payload ->> 'productionMonth')::integer,
        'unit', d.payload ->> 'marketingFunction',
        'department', coalesce(nullif(d.payload ->> 'department', ''), 'None'),
        'businessType', d.payload ->> 'businessType',
        'productName', d.payload ->> 'productName',
        'policyNumber', coalesce(d.payload ->> 'policyNumber', ''),
        'customerName', coalesce(d.payload ->> 'customerName', 'Pemegang polis belum teridentifikasi'),
        'amount', coalesce((d.payload ->> 'productionAmount')::numeric, 0),
        'sourceRows', coalesce((d.payload ->> 'sourceRowCount')::integer, 1),
        'picUserId', coalesce(d.payload ->> 'picUserId', ''),
        'sourceBatchId', coalesce(d.payload ->> 'sourceBatchId', ''),
        'legacyBackfill', coalesce((d.payload ->> 'legacyBackfill')::boolean, false)
      )
      order by
        (d.payload ->> 'productionYear')::integer,
        (d.payload ->> 'productionMonth')::integer,
        d.payload ->> 'productName',
        d.payload ->> 'customerName',
        d.entity_id
    ),
    '[]'::jsonb
  )
  into v_details
  from public.central_business_entities d
  join public.central_business_entities b
    on b.storage_key = 'pertalife_official_production_batches'
   and b.entity_id = d.payload ->> 'sourceBatchId'
  where d.storage_key = 'pertalife_official_production_policy_details'
    and b.payload ->> 'status' = 'Published';

  return jsonb_set(v_result, '{details}', v_details, true);
end;
$function$;

revoke all on function public.list_directorate_performance_v36() from public, anon;
grant execute on function public.list_directorate_performance_v36() to authenticated;

comment on function public.list_directorate_performance_v36() is
  'Authenticated Directorate performance projection. Policy detail follows the same directorate-visible Realisasi scope as parent summaries; UI filters select year, scope and business type.';

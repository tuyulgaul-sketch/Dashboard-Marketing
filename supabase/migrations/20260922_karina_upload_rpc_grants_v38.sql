-- Keep central file registration authenticated-only after the v37 size-limit update.
revoke execute on function public.register_central_business_file(
  text, text, text, text, text, text, text, bigint, jsonb, jsonb
) from public, anon;

grant execute on function public.register_central_business_file(
  text, text, text, text, text, text, text, bigint, jsonb, jsonb
) to authenticated, service_role;

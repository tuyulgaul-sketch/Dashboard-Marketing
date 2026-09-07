-- Correct existing v34 installations without modifying business data.
-- A BEFORE INSERT trigger fires before ON CONFLICT DO UPDATE. Restricting
-- RKAP_BULK there would block ordinary progress updates to existing rows.
-- The AFTER INSERT trigger runs only for actual inserts. Existing official
-- updates, source conversions and deletes remain protected BEFORE mutation.
drop trigger if exists central_official_performance_upload_guard_v34 on public.central_business_entities;
drop trigger if exists central_official_performance_upload_insert_v34 on public.central_business_entities;
create trigger central_official_performance_upload_guard_v34
before update or delete on public.central_business_entities
for each row execute function public.guard_official_performance_upload_v34();
create trigger central_official_performance_upload_insert_v34
after insert on public.central_business_entities
for each row execute function public.guard_official_performance_upload_v34();

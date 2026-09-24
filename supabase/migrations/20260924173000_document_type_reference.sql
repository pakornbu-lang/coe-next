begin;
alter table public.portal_reference_data drop constraint portal_reference_data_kind_check;
alter table public.portal_reference_data add constraint portal_reference_data_kind_check
  check (kind in ('scholarship_type','faculty','major','document_type'));
-- Existing Admin RPC, RLS, version checks and audit logging apply to this kind.
notify pgrst, 'reload schema';
commit;

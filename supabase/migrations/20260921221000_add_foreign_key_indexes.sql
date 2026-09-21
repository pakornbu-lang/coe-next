-- Cover foreign-key columns used by joins and parent-row updates/deletes.
create index if not exists application_appeals_resolved_by_idx
  on public.application_appeals(resolved_by);
create index if not exists application_documents_checked_by_idx
  on public.application_documents(checked_by);
create index if not exists application_documents_requirement_id_idx
  on public.application_documents(requirement_id);
create index if not exists application_interviews_created_by_idx
  on public.application_interviews(created_by);
create index if not exists application_status_history_actor_id_idx
  on public.application_status_history(actor_id);
create index if not exists applications_decided_by_idx
  on public.applications(decided_by);
create index if not exists disbursements_recorded_by_idx
  on public.disbursements(recorded_by);
create index if not exists review_assignments_assigned_by_idx
  on public.review_assignments(assigned_by);
create index if not exists scholarships_scholarship_type_id_idx
  on public.scholarships(scholarship_type_id);

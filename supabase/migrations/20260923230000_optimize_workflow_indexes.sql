-- Migration: Optimize high-frequency workflow and scholarship indexes
-- Ensures all query-critical foreign keys and compound filter paths have indexes.
-- Using IF NOT EXISTS ensures no duplicate index errors even if already indexed by constraints.

create index if not exists applications_student_updated_idx
  on public.applications(student_id, updated_at desc);

create index if not exists application_documents_app_status_idx
  on public.application_documents(application_id, status);

create index if not exists application_status_history_app_created_idx
  on public.application_status_history(application_id, created_at desc);

create index if not exists application_payment_accounts_application_id_idx
  on public.application_payment_accounts(application_id);

create index if not exists disbursements_application_id_idx
  on public.disbursements(application_id);

create index if not exists application_interviews_application_id_idx
  on public.application_interviews(application_id);

create index if not exists application_appeals_application_id_idx
  on public.application_appeals(application_id);

create index if not exists scholarships_status_closes_idx
  on public.scholarships(status, closes_at);


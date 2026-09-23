-- Existing rows were checked before applying this migration. Keep direct SQL
-- writes aligned with the application form and student_save_application RPC.
alter table public.portal_profiles
  validate constraint portal_profiles_phone_check;

alter table public.application_payment_accounts
  drop constraint application_payment_accounts_account_number_check;
alter table public.application_payment_accounts
  add constraint application_payment_accounts_account_number_check
  check (account_number ~ '^[0-9]{10,15}$');

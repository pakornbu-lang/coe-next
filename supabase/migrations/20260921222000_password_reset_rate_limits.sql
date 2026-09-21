-- Server-only rate limiting for Apps Script password recovery emails.
create table public.password_reset_rate_limits (
  id bigint generated always as identity primary key,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  requested_at timestamptz not null default now()
);

alter table public.password_reset_rate_limits enable row level security;
revoke all on public.password_reset_rate_limits from public, anon, authenticated;
grant all on public.password_reset_rate_limits to service_role;
create index password_reset_rate_limits_email_time_idx
  on public.password_reset_rate_limits(email_hash, requested_at desc);

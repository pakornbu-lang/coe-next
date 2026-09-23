-- Throttle the server-only registration action before it calls the Auth admin API.
-- Store keyed hashes rather than addresses or IPs.
create table public.registration_rate_limits (
  id bigint generated always as identity primary key,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text check (ip_hash ~ '^[0-9a-f]{64}$'),
  requested_at timestamptz not null default now()
);

alter table public.registration_rate_limits enable row level security;
revoke all on public.registration_rate_limits from public, anon, authenticated;
grant all on public.registration_rate_limits to service_role;
create index registration_rate_limits_email_time_idx
  on public.registration_rate_limits(email_hash, requested_at desc);
create index registration_rate_limits_ip_time_idx
  on public.registration_rate_limits(ip_hash, requested_at desc) where ip_hash is not null;
create index registration_rate_limits_time_idx
  on public.registration_rate_limits(requested_at desc);
comment on table public.registration_rate_limits is
  'ตัวนับคำขอสมัครสมาชิกฝั่งเซิร์ฟเวอร์ เก็บแฮชอีเมล/IP เพื่อลดการสร้างบัญชีจำนวนมาก';

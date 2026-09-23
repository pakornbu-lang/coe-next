-- M01: Optimize student registration rate limiting.
-- Reduce database round trips by checking and reserving
-- a registration attempt inside one RPC transaction.

create or replace function public.reserve_registration_attempt(
  p_email_hash text,
  p_ip_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - interval '1 hour';
  v_email_count bigint := 0;
  v_ip_count bigint := 0;
  v_total_count bigint := 0;
begin
  if p_email_hash is null
     or p_email_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid email hash'
      using errcode = '22023';
  end if;

  if p_ip_hash is not null
     and p_ip_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid IP hash'
      using errcode = '22023';
  end if;

  -- Prevent concurrent registration requests from all passing
  -- the counters before an attempt is recorded.
  perform pg_advisory_xact_lock(33101);

  select count(*)
  into v_email_count
  from public.registration_rate_limits
  where email_hash = p_email_hash
    and requested_at >= v_since;

  if p_ip_hash is not null then
    select count(*)
    into v_ip_count
    from public.registration_rate_limits
    where ip_hash = p_ip_hash
      and requested_at >= v_since;
  end if;

  select count(*)
  into v_total_count
  from public.registration_rate_limits
  where requested_at >= v_since;

  if v_email_count >= 3
     or v_ip_count >= 20
     or v_total_count >= 100
  then
    return false;
  end if;

  insert into public.registration_rate_limits (
    email_hash,
    ip_hash
  )
  values (
    p_email_hash,
    p_ip_hash
  );

  return true;
end;
$$;

revoke all
on function public.reserve_registration_attempt(text, text)
from public, anon, authenticated;

grant execute
on function public.reserve_registration_attempt(text, text)
to service_role;

comment on function public.reserve_registration_attempt(text, text) is
  'Atomically checks and reserves one server-side student registration attempt.';
-- Prevent PostgREST 14 from retrying application-level optimistic
-- concurrency conflicts as PostgreSQL serialization failures.
--
-- Existing RPC functions used SQLSTATE 40001 for stale-version checks.
-- 40001 means serialization_failure and may be retried by PostgREST.
-- Replace those application-level errors with P0001 instead.
--
-- Business logic, locking, version checks and permissions remain unchanged.

do $migration$
declare
  fn record;
  original_definition text;
  patched_definition text;
begin
  for fn in
    select
      p.oid,
      n.nspname as schema_name,
      p.proname as function_name
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind = 'f'
      and p.prosrc like '%40001%'
  loop
    original_definition := pg_get_functiondef(fn.oid);

    patched_definition := replace(
      original_definition,
      '''40001''',
      '''P0001'''
    );

    if patched_definition <> original_definition then
      execute patched_definition;
    end if;
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind = 'f'
      and p.prosrc like '%40001%'
  ) then
    raise exception
      'Application functions using SQLSTATE 40001 still remain';
  end if;
end
$migration$;

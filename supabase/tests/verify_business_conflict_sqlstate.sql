-- Read-only. Run in Supabase SQL Editor after the migration.
-- Expected: 12 rows, every row has business_conflict_uses_pt409 = true
-- and business_conflict_still_uses_40001 = false.
select n.nspname as schema_name,p.proname as function_name,
  p.prosrc ~* $pattern$raise[[:space:]]+exception[[:space:]]+('STALE_VERSION'|'Appeal is not available or changed')[[:space:]]+using[[:space:]]+errcode[[:space:]]*=[[:space:]]*'PT409'$pattern$
    as business_conflict_uses_pt409,
  p.prosrc ~* $pattern$raise[[:space:]]+exception[[:space:]]+('STALE_VERSION'|'Appeal is not available or changed')[[:space:]]+using[[:space:]]+errcode[[:space:]]*=[[:space:]]*'40001'$pattern$
    as business_conflict_still_uses_40001
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prokind='f'
  and (p.prosrc like '%STALE_VERSION%' or p.prosrc like '%Appeal is not available or changed%')
order by 1,2;

-- Current API sessions only. This does NOT stop any connection.
-- A returned row is not proof of a retry loop. Match its pid to a current
-- Postgres error log's process_id before considering termination.
select pid,state,query_start,wait_event_type,wait_event
from pg_catalog.pg_stat_activity
where usename='authenticator'
order by query_start;

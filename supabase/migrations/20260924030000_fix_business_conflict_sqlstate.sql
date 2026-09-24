-- Stop application-level version conflicts from triggering PostgREST retries.
-- Preserve installed function definitions, owners, signatures, grants and settings.
-- Genuine PostgreSQL serialization failures are not changed.
begin;
do $migration$
declare
  target record; fn record; matches integer;
  definition text; updated_definition text;
  old_pattern constant text := $pattern$raise[[:space:]]+exception[[:space:]]+('STALE_VERSION'|'Appeal is not available or changed')[[:space:]]+using[[:space:]]+errcode[[:space:]]*=[[:space:]]*'40001'$pattern$;
  new_pattern constant text := $pattern$raise[[:space:]]+exception[[:space:]]+('STALE_VERSION'|'Appeal is not available or changed')[[:space:]]+using[[:space:]]+errcode[[:space:]]*=[[:space:]]*'PT409'$pattern$;
begin
  for target in
    select * from (values
      ('private','portal_admin_member'),
      ('private','portal_admin_reference'),
      ('private','portal_update_self_profile'),
      ('public','staff_save_scholarship'),
      ('public','student_save_application'),
      ('public','staff_review_application_documents'),
      ('public','committee_save_evaluation'),
      ('public','staff_decide_application'),
      ('public','staff_record_disbursement'),
      ('public','staff_resolve_appeal'),
      ('public','staff_manage_review'),
      ('public','staff_schedule_interview_v2')
    ) as targets(schema_name,function_name)
  loop
    select count(*) into matches from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname=target.schema_name and p.proname=target.function_name and p.prokind='f';
    if matches<>1 then
      raise exception 'Expected one function %.%, found %. No changes committed.',
        target.schema_name,target.function_name,matches;
    end if;
    select p.oid,p.prosrc into fn from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname=target.schema_name and p.proname=target.function_name and p.prokind='f';
    definition:=pg_catalog.pg_get_functiondef(fn.oid);
    updated_definition:=regexp_replace(definition,old_pattern,
      $replacement$raise exception \1 using errcode='PT409'$replacement$,'gi');
    if updated_definition<>definition then
      execute updated_definition;
      raise notice 'Updated %.%',target.schema_name,target.function_name;
    elsif fn.prosrc ~* new_pattern then
      raise notice 'Already updated %.%',target.schema_name,target.function_name;
    else
      raise exception 'Unexpected conflict handler in %.%. No changes committed.',
        target.schema_name,target.function_name;
    end if;
  end loop;
  -- Abort if another installed application function still raises these business
  -- messages as 40001, rather than leaving a partial fix.
  if exists(
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f' and p.prosrc ~* old_pattern
  ) then
    raise exception 'Additional business conflict handler found. No changes committed; review installed functions.';
  end if;
end;
$migration$;
notify pgrst,'reload schema';
commit;

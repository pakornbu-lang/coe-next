-- Stop application-level version conflicts from triggering PostgREST retries.
-- Preserve installed function definitions, owners, signatures, grants and settings.
-- Genuine PostgreSQL serialization failures are not changed.
begin;

do $migration$
declare
  target record;
  fn record;
  relevant_matches integer;
  definition text;
  updated_definition text;

  old_pattern constant text :=
    $pattern$raise[[:space:]]+exception[[:space:]]+('STALE_VERSION'|'Appeal is not available or changed')[[:space:]]+using[[:space:]]+errcode[[:space:]]*=[[:space:]]*('40001'|'P0001')$pattern$;

  new_pattern constant text :=
    $pattern$raise[[:space:]]+exception[[:space:]]+('STALE_VERSION'|'Appeal is not available or changed')[[:space:]]+using[[:space:]]+errcode[[:space:]]*=[[:space:]]*'PT409'$pattern$;

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

    if not exists (
      select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n
        on n.oid = p.pronamespace
      where n.nspname = target.schema_name
        and p.proname = target.function_name
        and p.prokind = 'f'
    ) then
      raise exception
        'Expected function %.% but none was found. No changes committed.',
        target.schema_name,
        target.function_name;
    end if;

    relevant_matches := 0;

    for fn in
      select
        p.oid,
        p.prosrc,
        pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_args
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n
        on n.oid = p.pronamespace
      where n.nspname = target.schema_name
        and p.proname = target.function_name
        and p.prokind = 'f'
    loop
      definition := pg_catalog.pg_get_functiondef(fn.oid);

      updated_definition := regexp_replace(
        definition,
        old_pattern,
        $replacement$raise exception \1 using errcode='PT409'$replacement$,
        'gi'
      );

      if updated_definition <> definition then
        execute updated_definition;
        relevant_matches := relevant_matches + 1;

        raise notice
          'Updated %.%(%)',
          target.schema_name,
          target.function_name,
          fn.identity_args;

      elsif fn.prosrc ~* new_pattern then
        relevant_matches := relevant_matches + 1;

        raise notice
          'Already updated %.%(%)',
          target.schema_name,
          target.function_name,
          fn.identity_args;
      end if;
    end loop;

    if relevant_matches = 0 then
      raise exception
        'Expected conflict handler in at least one overload of %.%. No changes committed.',
        target.schema_name,
        target.function_name;
    end if;

  end loop;

  -- Abort if another installed application function still raises these
  -- business conflicts as 40001 or the earlier P0001 compatibility code.
  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname in ('public','private')
      and p.prokind = 'f'
      and p.prosrc ~* old_pattern
  ) then
    raise exception
      'Additional business conflict handler found. No changes committed; review installed functions.';
  end if;
end;
$migration$;

notify pgrst,'reload schema';
commit;

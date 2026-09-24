-- Additive UI/workflow support. Existing conflict-code fixes are preserved.
begin;

alter table public.scholarships add column if not exists eligible_faculties text[] not null default '{}';
alter table public.scholarships add column if not exists eligible_majors text[] not null default '{}';

-- Delegate to the installed save function so existing validation/version fixes survive.
-- Both the scholarship and its audience are saved in a single transaction.
create or replace function public.staff_save_scholarship_with_audience(p_data jsonb, p_faculties text[], p_majors text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; old_row public.scholarships; new_row public.scholarships;
begin
  perform private.portal_require_active_role(array['staff']);
  if p_data is null or jsonb_typeof(p_data) <> 'object' or p_faculties is null or p_majors is null
     or cardinality(p_faculties)>100 or cardinality(p_majors)>200
     or (cardinality(p_majors)>0 and cardinality(p_faculties)=0)
     or exists(select 1 from unnest(p_faculties || p_majors) name where name is null or char_length(btrim(name)) not between 1 and 150) then
    raise exception 'Invalid scholarship audience' using errcode='22023';
  end if;
  select coalesce(array_agg(distinct btrim(name) order by btrim(name)), '{}') into p_faculties from unnest(p_faculties) name;
  select coalesce(array_agg(distinct btrim(name) order by btrim(name)), '{}') into p_majors from unnest(p_majors) name;
  if nullif(p_data->>'p_id','') is not null then
    select * into old_row from public.scholarships where id=(p_data->>'p_id')::uuid for update;
    if found and (old_row.eligible_faculties is distinct from p_faculties or old_row.eligible_majors is distinct from p_majors)
       and exists(select 1 from public.applications where scholarship_id=old_row.id) then
      raise exception 'Audience cannot change after applications exist' using errcode='22023';
    end if;
  end if;
  v_id := public.staff_save_scholarship(
    p_id => nullif(p_data->>'p_id','')::uuid, p_version => (p_data->>'p_version')::integer,
    p_title => p_data->>'p_title', p_type_id => nullif(p_data->>'p_type_id','')::uuid,
    p_description => p_data->>'p_description', p_eligibility => p_data->>'p_eligibility',
    p_amount => (p_data->>'p_amount')::numeric, p_quota => (p_data->>'p_quota')::integer,
    p_minimum_gpa => (p_data->>'p_minimum_gpa')::numeric,
    p_opens_at => (p_data->>'p_opens_at')::timestamptz, p_closes_at => (p_data->>'p_closes_at')::timestamptz,
    p_status => p_data->>'p_status', p_requirements => p_data->'p_requirements', p_criteria => p_data->'p_criteria',
    p_reason => p_data->>'p_reason', p_program_kind => p_data->>'p_program_kind', p_cover_path => p_data->>'p_cover_path'
  );
  update public.scholarships set eligible_faculties=p_faculties, eligible_majors=p_majors where id=v_id returning * into new_row;
  perform private.portal_write_audit('update_scholarship_audience','scholarship',v_id,
    case when old_row.id is null then null else jsonb_build_object('eligible_faculties',old_row.eligible_faculties,'eligible_majors',old_row.eligible_majors) end,
    jsonb_build_object('eligible_faculties',new_row.eligible_faculties,'eligible_majors',new_row.eligible_majors),p_data->>'p_reason');
  return v_id;
end;
$$;
revoke all on function public.staff_save_scholarship_with_audience(jsonb,text[],text[]) from public, anon;
grant execute on function public.staff_save_scholarship_with_audience(jsonb,text[],text[]) to authenticated;

-- Check configured audience on submission, not while a student is drafting.
create or replace function private.check_scholarship_application_audience()
returns trigger language plpgsql security definer set search_path = '' as $$
declare scholarship public.scholarships;
begin
  if new.status <> 'submitted' then return new; end if;
  if tg_op='UPDATE' then
    if old.status=new.status and old.application_data is not distinct from new.application_data then return new; end if;
  end if;
  select * into scholarship from public.scholarships where id=new.scholarship_id;
  if (cardinality(scholarship.eligible_faculties)>0 and not coalesce(btrim(new.application_data->>'faculty')=any(scholarship.eligible_faculties),false))
     or (cardinality(scholarship.eligible_majors)>0 and not coalesce(btrim(new.application_data->>'major')=any(scholarship.eligible_majors),false)) then
    raise exception 'Faculty or major is outside scholarship audience' using errcode='PT422';
  end if;
  return new;
end;
$$;
revoke all on function private.check_scholarship_application_audience() from public, anon, authenticated;
drop trigger if exists check_scholarship_application_audience on public.applications;
create trigger check_scholarship_application_audience before insert or update of application_data,status on public.applications
for each row execute function private.check_scholarship_application_audience();

-- Change only the status guard, leaving the installed function's other fixes intact.
do $$
declare definition text; target regprocedure;
begin
  target := to_regprocedure('public.staff_schedule_interview_v2(uuid,integer,timestamp with time zone,timestamp with time zone,uuid,text,text,text,text,text)');
  if target is null then raise exception 'Install review_operations migration before this migration'; end if;
  definition := pg_get_functiondef(target);
  if position('status in (''ready_for_review'',''committee_review'')' in definition)>0 then
    definition := replace(definition, 'status in (''ready_for_review'',''committee_review'')',
      'status in (''ready_for_review'',''committee_review'',''approved'',''reserve'',''rejected'')');
    execute definition;
  elsif position('status in (''ready_for_review'',''committee_review'',''approved'',''reserve'',''rejected'')' in definition)=0 then
    raise exception 'Unexpected interview status guard: review installed function before applying';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

begin;

create or replace function private.check_application_minimum_gpa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare minimum numeric; raw_gpa text;
begin
  if new.status <> 'submitted' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status = new.status and old.application_data is not distinct from new.application_data
       and old.scholarship_id = new.scholarship_id then return new; end if;
  end if;
  select minimum_gpa into minimum from public.scholarships where id=new.scholarship_id for share;
  if minimum is null then return new; end if;
  raw_gpa := new.application_data->>'gpa';
  if raw_gpa is null or raw_gpa !~ '^(0|[0-3](\.[0-9]{1,2})?|4(\.0{1,2})?)$' then
    raise exception 'Invalid application GPA' using errcode='PT422';
  end if;
  if raw_gpa::numeric < minimum then
    raise exception 'GPA is below scholarship minimum' using errcode='PT422';
  end if;
  return new;
end;
$$;
revoke all on function private.check_application_minimum_gpa() from public, anon, authenticated;
create trigger check_application_minimum_gpa
before insert or update of status,application_data,scholarship_id on public.applications
for each row execute function private.check_application_minimum_gpa();
notify pgrst, 'reload schema';
commit;

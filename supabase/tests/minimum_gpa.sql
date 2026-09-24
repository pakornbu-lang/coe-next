-- Isolated database only; run after migrations.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-4000-8000-000000009702','gpa@test.invalid','{"full_name":"GPA Test","student_id":"99009702"}');
insert into public.scholarships(id,title,amount,quota,minimum_gpa,opens_at,closes_at,status,created_by) values
('10000000-0000-4000-8000-000000009702','GPA test',1000,5,3.00,now()-interval '1 day',now()+interval '1 day','published','00000000-0000-4000-8000-000000009702');
insert into public.applications(id,scholarship_id,student_id,student_name,student_code,application_data) values
('20000000-0000-4000-8000-000000009702','10000000-0000-4000-8000-000000009702','00000000-0000-4000-8000-000000009702','GPA Test','99009702','{"gpa":"2.99"}');
do $$
declare prior text; gpa text;
begin
  foreach prior in array array['draft','revision_requested'] loop
    update public.applications set status=prior,submitted_at=case when prior='draft' then null else now() end
      where id='20000000-0000-4000-8000-000000009702';
    foreach gpa in array array['2.99','', 'abc','4.01','3.001'] loop
      begin
        update public.applications set application_data=jsonb_build_object('gpa',gpa),status='submitted',submitted_at=now()
          where id='20000000-0000-4000-8000-000000009702';
        raise exception 'TEST FAILED accepted GPA % from %',gpa,prior;
      exception when sqlstate 'PT422' then
        if sqlerrm not in ('Invalid application GPA','GPA is below scholarship minimum') then raise; end if;
      end;
      if (select status from public.applications where id='20000000-0000-4000-8000-000000009702') <> prior then
        raise exception 'TEST FAILED rejected submission changed status';
      end if;
    end loop;
    update public.applications set application_data='{"gpa":"3.00"}',status='submitted',submitted_at=now()
      where id='20000000-0000-4000-8000-000000009702';
    update public.applications set application_data='{"gpa":"4.00"}'
      where id='20000000-0000-4000-8000-000000009702';
  end loop;
  update public.scholarships set minimum_gpa=null where id='10000000-0000-4000-8000-000000009702';
  update public.applications set application_data='{"gpa":"0.00"}' where id='20000000-0000-4000-8000-000000009702';
end;
$$;
rollback;

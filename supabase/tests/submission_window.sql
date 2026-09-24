-- Run in an isolated database after migrations. All fixtures roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-4000-8000-000000009701','window@test.invalid','{"full_name":"Window Test","student_id":"99009701"}');
insert into public.scholarships(id,title,amount,quota,opens_at,closes_at,status,created_by) values
('10000000-0000-4000-8000-000000009701','Submission window test',1000,5,now()-interval '1 day',now()+interval '1 day','published','00000000-0000-4000-8000-000000009701');
insert into public.applications(id,scholarship_id,student_id,student_name,student_code) values
('20000000-0000-4000-8000-000000009701','10000000-0000-4000-8000-000000009701','00000000-0000-4000-8000-000000009701','Window Test','99009701');
do $$
declare mode text; prior text;
begin
  foreach prior in array array['draft','revision_requested'] loop
    update public.applications set status=prior, submitted_at=case when prior='draft' then null else now() end
      where id='20000000-0000-4000-8000-000000009701';
    foreach mode in array array['expired','closed','future','boundary'] loop
      update public.scholarships set
        status=case when mode='closed' then 'closed' else 'published' end,
        opens_at=case when mode='future' then now()+interval '1 hour' else now()-interval '2 days' end,
        closes_at=case when mode='expired' then now()-interval '1 day' when mode='boundary' then clock_timestamp() else now()+interval '1 day' end
        where id='10000000-0000-4000-8000-000000009701';
      begin
        update public.applications set status='submitted',submitted_at=now() where id='20000000-0000-4000-8000-000000009701';
        raise exception 'TEST FAILED: % accepted from %',mode,prior;
      exception when sqlstate 'PT422' then
        if sqlerrm <> 'Scholarship is not open' then raise; end if;
      end;
      if (select status from public.applications where id='20000000-0000-4000-8000-000000009701') <> prior then
        raise exception 'TEST FAILED: rejected submission changed status';
      end if;
    end loop;
    update public.scholarships set status='published',opens_at=now()-interval '1 day',closes_at=now()+interval '1 day'
      where id='10000000-0000-4000-8000-000000009701';
    update public.applications set status='submitted',submitted_at=now() where id='20000000-0000-4000-8000-000000009701';
  end loop;
end;
$$;
rollback;

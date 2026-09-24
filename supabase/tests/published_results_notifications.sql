-- Run only in an isolated database after migrations; fixtures roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-4000-8000-000000009704','publication@test.invalid','{"full_name":"Publication Test","student_id":"99009704"}');
update public.portal_profiles set active=true,email='publication@test.invalid' where id='00000000-0000-4000-8000-000000009704';
insert into public.scholarships(id,title,amount,quota,opens_at,closes_at,status,created_by) values
('10000000-0000-4000-8000-000000009704','Publication test',1000,5,now()-interval '1 day',now()+interval '1 day','published','00000000-0000-4000-8000-000000009704');
insert into public.applications(id,scholarship_id,student_id,student_name,student_code,status,submitted_at) values
('20000000-0000-4000-8000-000000009704','10000000-0000-4000-8000-000000009704','00000000-0000-4000-8000-000000009704','Publication Test','99009704','approved',now());
do $$
declare n integer;
begin
  update public.scholarships set results_published_at=now() where id='10000000-0000-4000-8000-000000009704';
  select count(*) into n from public.portal_notifications where user_id='00000000-0000-4000-8000-000000009704' and kind='results_published';
  if n<>1 then raise exception 'TEST FAILED first publication count %',n; end if;
  if not exists(select 1 from public.notification_email_outbox o join public.portal_notifications p on p.id=o.notification_id where p.user_id='00000000-0000-4000-8000-000000009704' and p.kind='results_published') then raise exception 'TEST FAILED missing email queue'; end if;
  update public.scholarships set results_published_at=results_published_at where id='10000000-0000-4000-8000-000000009704';
  update public.scholarships set results_published_at=null where id='10000000-0000-4000-8000-000000009704';
  select count(*) into n from public.portal_notifications where user_id='00000000-0000-4000-8000-000000009704' and kind='results_published';
  if n<>1 then raise exception 'TEST FAILED duplicate or hide notification'; end if;
  update public.scholarships set results_published_at=now() where id='10000000-0000-4000-8000-000000009704';
  select count(*) into n from public.portal_notifications where user_id='00000000-0000-4000-8000-000000009704' and kind='results_published';
  if n<>2 then raise exception 'TEST FAILED republication'; end if;
end;
$$;
rollback;

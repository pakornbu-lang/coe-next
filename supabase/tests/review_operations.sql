-- Run only in an isolated database; fixtures are rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000001','staff@test.invalid','{"full_name":"Staff","student_id":"90000001"}'),
('00000000-0000-4000-8000-000000000002','reviewer@test.invalid','{"full_name":"Reviewer","student_id":"90000002"}'),
('00000000-0000-4000-8000-000000000003','student@test.invalid','{"full_name":"Student","student_id":"90000003"}'),
('00000000-0000-4000-8000-000000000004','reviewer2@test.invalid','{"full_name":"Reviewer Two","student_id":"90000004"}'),
('00000000-0000-4000-8000-000000000005','student2@test.invalid','{"full_name":"Student Two","student_id":"90000005"}');
update public.portal_profiles set role='staff' where student_id='90000001';
update public.portal_profiles set role='committee' where student_id in ('90000002','90000004');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into public.scholarships(id,title,amount,quota,opens_at,closes_at,created_by) values
('10000000-0000-4000-8000-000000000001','Test scholarship',1000,5,now()-interval '1 day',now()+interval '10 days','00000000-0000-4000-8000-000000000001');
insert into public.applications(id,scholarship_id,student_id,student_name,student_code,status,submitted_at) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','Student','90000003','ready_for_review',now()),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','Student Two','90000005','ready_for_review',now());
insert into public.scholarship_review_criteria(id,scholarship_id,label,max_score,sort_order) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Criteria',100,1);
do $$
declare assignment uuid; v integer; n integer; before_count integer;
begin
 assignment:=public.staff_assign_reviewer('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Test assignment');
 select version into v from public.review_assignments where id=assignment;
 perform public.staff_manage_review(assignment,v,now()+interval '12 hours',null,false,'Set deadline');
 begin
  perform public.staff_manage_review(assignment,v,now()+interval '12 hours',null,false,'Stale version');
  raise exception 'TEST FAILED stale version accepted';
 exception when serialization_failure then null; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
 begin
  perform public.staff_manage_review(assignment,v+1,null,null,true,'Unauthorized');
  raise exception 'TEST FAILED student allowed';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
 perform public.committee_declare_conflict(assignment,false,null);
 perform public.committee_save_evaluation(assignment,null,'[{"criterion_id":"30000000-0000-4000-8000-000000000001","score":80,"comment":""}]','approve','Good',true);
 begin
  perform public.committee_save_evaluation(assignment,1,'[{"criterion_id":"30000000-0000-4000-8000-000000000001","score":90,"comment":""}]','approve','Edited',true);
  raise exception 'TEST FAILED submitted review editable';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
 begin
  perform public.staff_assign_reviewer('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Reassign completed');
  raise exception 'TEST FAILED completed review reopened';
 exception when invalid_parameter_value then null; end;
 assignment:=public.staff_assign_reviewer('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004','Assign second');
 select version into v from public.review_assignments where id=assignment;
 perform public.staff_manage_review(assignment,v,now()+interval '12 hours','00000000-0000-4000-8000-000000000002',false,'Replace reviewer');
 if (select status from public.review_assignments where id=assignment)<>'revoked' then raise exception 'TEST FAILED replacement did not revoke original'; end if;
 select id,version into assignment,v from public.review_assignments where application_id='20000000-0000-4000-8000-000000000002' and reviewer_id='00000000-0000-4000-8000-000000000002';
 perform public.staff_manage_review(assignment,v,null,null,true,'Withdraw task');
 if (select status from public.review_assignments where id=assignment)<>'revoked' then raise exception 'TEST FAILED withdrawal'; end if;
 perform public.staff_schedule_interview_v2('20000000-0000-4000-8000-000000000001',null,now()+interval '2 hours',now()+interval '3 hours','00000000-0000-4000-8000-000000000002','Room A','','','scheduled','');
 begin
  perform public.staff_schedule_interview_v2('20000000-0000-4000-8000-000000000002',null,now()+interval '2 hours',now()+interval '3 hours','00000000-0000-4000-8000-000000000002','Room B','','','scheduled','');
  raise exception 'TEST FAILED reviewer overlap accepted';
 exception when exclusion_violation then null; end;
 begin
  perform public.staff_schedule_interview_v2('20000000-0000-4000-8000-000000000002',null,now()+interval '2 hours',now()+interval '3 hours','00000000-0000-4000-8000-000000000004','Room A','','','scheduled','');
  raise exception 'TEST FAILED room overlap accepted';
 exception when exclusion_violation then null; end;
 perform public.staff_schedule_interview_v2('20000000-0000-4000-8000-000000000002',null,now()+interval '3 hours',now()+interval '4 hours','00000000-0000-4000-8000-000000000002','Room A','','','scheduled','');
 select count(*) into before_count from public.portal_notifications;
 n:=public.enqueue_workflow_reminders();
 if n<>2 then raise exception 'TEST FAILED expected two interview reminders, got %',n; end if;
 n:=public.enqueue_workflow_reminders();
 if n<>0 then raise exception 'TEST FAILED duplicate reminders'; end if;
 if not exists(select 1 from public.notification_email_outbox) then raise exception 'TEST FAILED no email queued'; end if;
end; $$;
grant usage on schema auth to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
do $$ begin
 if exists(select 1 from public.application_interviews) then raise exception 'TEST FAILED unrelated reviewer sees interviews'; end if;
 begin
  perform public.enqueue_workflow_reminders();
  raise exception 'TEST FAILED authenticated can run scheduler';
 exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
 if (select count(*) from public.application_interviews)<>2 then raise exception 'TEST FAILED interviewer cannot see own appointments'; end if;
end; $$;
reset role;
rollback;

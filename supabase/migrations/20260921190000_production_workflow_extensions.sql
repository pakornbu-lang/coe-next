-- Production workflow controls: reviewer quorum, conflicts of interest,
-- interviews, result publication and appeals.

alter table public.scholarships
  add column required_reviewer_count smallint not null default 1 check(required_reviewer_count between 1 and 10),
  add column results_published_at timestamptz,
  add column appeal_deadline timestamptz;

alter table public.review_assignments
  add column conflict_status text not null default 'pending' check(conflict_status in ('pending','clear','declared')),
  add column conflict_note text check(conflict_note is null or char_length(conflict_note)<=1000),
  add column conflict_declared_at timestamptz;

create function private.portal_reset_reassigned_conflict()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='assigned' and old.status is distinct from 'assigned' then
    new.conflict_status:='pending';
    new.conflict_note:=null;
    new.conflict_declared_at:=null;
  end if;
  return new;
end;
$$;
create trigger reset_reassigned_conflict before update on public.review_assignments for each row execute function private.portal_reset_reassigned_conflict();

create function private.portal_require_clear_review_conflict()
returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.review_assignments r where r.id=new.assignment_id and r.conflict_status='clear') then
    raise exception 'Conflict disclosure is required before evaluation' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger require_clear_review_conflict before insert or update on public.evaluations for each row execute function private.portal_require_clear_review_conflict();

create table public.application_interviews(
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  scheduled_at timestamptz not null,
  location text not null check(char_length(btrim(location)) between 2 and 300),
  meeting_url text check(meeting_url is null or char_length(meeting_url)<=1000),
  note text not null default '' check(char_length(note)<=2000),
  status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled','no_show')),
  created_by uuid not null references public.portal_profiles(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_appeals(
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  reason text not null check(char_length(btrim(reason)) between 20 and 5000),
  status text not null default 'pending' check(status in ('pending','upheld','rejected')),
  response text check(response is null or char_length(response)<=5000),
  submitted_at timestamptz not null default now(),
  resolved_by uuid references public.portal_profiles(id),
  resolved_at timestamptz,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.application_interviews enable row level security;
alter table public.application_appeals enable row level security;
revoke all on public.application_interviews,public.application_appeals from anon,authenticated;
grant select on public.application_interviews,public.application_appeals to authenticated;
grant all on public.application_interviews,public.application_appeals to service_role;

create policy "Staff read interviews" on public.application_interviews for select to authenticated using ((select private.portal_has_active_role(array['staff'])));
create policy "Students read own interviews" on public.application_interviews for select to authenticated using (exists(select 1 from public.applications a where a.id=application_id and a.student_id=(select auth.uid())));
create policy "Assigned committee read interviews" on public.application_interviews for select to authenticated using (exists(select 1 from public.review_assignments r where r.application_id=application_interviews.application_id and r.reviewer_id=(select auth.uid()) and r.status in ('assigned','completed')));
create policy "Staff read appeals" on public.application_appeals for select to authenticated using ((select private.portal_has_active_role(array['staff'])));
create policy "Students read own appeals" on public.application_appeals for select to authenticated using (exists(select 1 from public.applications a where a.id=application_id and a.student_id=(select auth.uid())));

create or replace function public.committee_declare_conflict(p_assignment_id uuid,p_has_conflict boolean,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare v_assignment public.review_assignments;
begin
  perform private.portal_require_active_role(array['committee']);
  select * into v_assignment from public.review_assignments where id=p_assignment_id for update;
  if not found or v_assignment.reviewer_id<>auth.uid() or v_assignment.status<>'assigned' then raise exception 'Review assignment is not available' using errcode='42501'; end if;
  if p_note is not null and char_length(p_note)>1000 then raise exception 'Conflict note is too long' using errcode='22023'; end if;
  update public.review_assignments set conflict_status=case when p_has_conflict then 'declared' else 'clear' end,conflict_note=nullif(btrim(coalesce(p_note,'')),''),conflict_declared_at=now(),status=case when p_has_conflict then 'revoked' else status end where id=p_assignment_id;
  if p_has_conflict then
    perform private.portal_notify(v_assignment.assigned_by,'reviewer_conflict','กรรมการแจ้งผลประโยชน์ทับซ้อน','กรรมการไม่สามารถประเมินใบสมัครนี้ได้ โปรดมอบหมายกรรมการคนใหม่','/staff/review/'||v_assignment.application_id::text);
  end if;
  perform private.portal_write_audit('declare_review_conflict','review_assignment',p_assignment_id,to_jsonb(v_assignment),(select to_jsonb(r) from public.review_assignments r where r.id=p_assignment_id),case when p_has_conflict then 'แจ้งผลประโยชน์ทับซ้อน' else 'ยืนยันว่าไม่มีผลประโยชน์ทับซ้อน' end);
end;
$$;

create or replace function public.staff_set_scholarship_process(p_scholarship_id uuid,p_required_reviewers integer,p_publish_results boolean,p_appeal_deadline timestamptz,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare old_row public.scholarships; new_row public.scholarships;
begin
  perform private.portal_require_active_role(array['staff']);
  if p_required_reviewers not between 1 and 10 or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'Invalid process settings' using errcode='22023'; end if;
  select * into old_row from public.scholarships where id=p_scholarship_id for update;
  if not found then raise exception 'Scholarship not found' using errcode='P0002'; end if;
  if p_publish_results and not exists(select 1 from public.applications where scholarship_id=p_scholarship_id and status in ('approved','reserve','rejected')) then raise exception 'No final results are available' using errcode='22023'; end if;
  if p_appeal_deadline is not null and (not p_publish_results or p_appeal_deadline<=now()) then raise exception 'Appeal deadline must be after publication' using errcode='22023'; end if;
  update public.scholarships set required_reviewer_count=p_required_reviewers,results_published_at=case when p_publish_results then coalesce(results_published_at,now()) else null end,appeal_deadline=case when p_publish_results then p_appeal_deadline else null end,version=version+1,updated_at=now() where id=p_scholarship_id returning * into new_row;
  perform private.portal_write_audit('set_scholarship_process','scholarship',p_scholarship_id,to_jsonb(old_row),to_jsonb(new_row),p_reason);
end;
$$;

create or replace function public.staff_schedule_interview(p_application_id uuid,p_scheduled_at timestamptz,p_location text,p_meeting_url text,p_note text,p_status text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_app public.applications; v_interview public.application_interviews;
begin
  perform private.portal_require_active_role(array['staff']);
  select * into v_app from public.applications where id=p_application_id;
  if not found or v_app.status not in ('ready_for_review','committee_review') then raise exception 'Application is not ready for interview' using errcode='22023'; end if;
  if p_scheduled_at is null or char_length(btrim(coalesce(p_location,''))) not between 2 and 300 or p_status not in ('scheduled','completed','cancelled','no_show') or char_length(coalesce(p_meeting_url,''))>1000 or char_length(coalesce(p_note,''))>2000 then raise exception 'Invalid interview data' using errcode='22023'; end if;
  insert into public.application_interviews(application_id,scheduled_at,location,meeting_url,note,status,created_by)
  values(p_application_id,p_scheduled_at,btrim(p_location),nullif(btrim(coalesce(p_meeting_url,'')),''),btrim(coalesce(p_note,'')),p_status,auth.uid())
  on conflict(application_id) do update set scheduled_at=excluded.scheduled_at,location=excluded.location,meeting_url=excluded.meeting_url,note=excluded.note,status=excluded.status,version=public.application_interviews.version+1,updated_at=now()
  returning * into v_interview;
  perform private.portal_notify(v_app.student_id,'interview_scheduled',case when p_status='cancelled' then 'ยกเลิกนัดสัมภาษณ์' else 'แจ้งนัดสัมภาษณ์ทุนการศึกษา' end,'เปิดใบสมัครเพื่อดูวัน เวลา และสถานที่สัมภาษณ์','/applications/'||p_application_id::text);
  perform private.portal_write_audit('schedule_interview','application_interview',v_interview.id,null,to_jsonb(v_interview),'บันทึกนัดสัมภาษณ์');
  return v_interview.id;
end;
$$;

create or replace function public.student_submit_appeal(p_application_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_app public.applications; v_scholarship public.scholarships; v_appeal public.application_appeals; v_staff uuid;
begin
  perform private.portal_require_active_role(array['student']);
  select * into v_app from public.applications where id=p_application_id and student_id=auth.uid();
  if not found or v_app.status not in ('reserve','rejected') then raise exception 'This result cannot be appealed' using errcode='22023'; end if;
  select * into v_scholarship from public.scholarships where id=v_app.scholarship_id;
  if v_scholarship.results_published_at is null or v_scholarship.appeal_deadline is null or now()>v_scholarship.appeal_deadline then raise exception 'Appeal period is closed' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 20 and 5000 then raise exception 'Appeal reason is required' using errcode='22023'; end if;
  insert into public.application_appeals(application_id,reason) values(p_application_id,btrim(p_reason)) returning * into v_appeal;
  for v_staff in select id from public.portal_profiles where active and role='staff' loop perform private.portal_notify(v_staff,'appeal_submitted','มีคำอุทธรณ์ใหม่','นักศึกษาส่งคำอุทธรณ์ผลทุนการศึกษา','/staff/review/'||p_application_id::text); end loop;
  perform private.portal_write_audit('submit_appeal','application_appeal',v_appeal.id,null,to_jsonb(v_appeal),'นักศึกษาส่งคำอุทธรณ์');
  return v_appeal.id;
end;
$$;

create or replace function public.staff_resolve_appeal(p_appeal_id uuid,p_version integer,p_status text,p_response text)
returns void language plpgsql security definer set search_path='' as $$
declare old_row public.application_appeals; new_row public.application_appeals; v_student uuid; v_application uuid;
begin
  perform private.portal_require_active_role(array['staff']);
  if p_status not in ('upheld','rejected') or char_length(btrim(coalesce(p_response,''))) not between 10 and 5000 then raise exception 'Appeal response is required' using errcode='22023'; end if;
  select * into old_row from public.application_appeals where id=p_appeal_id for update;
  if not found or old_row.status<>'pending' or old_row.version<>p_version then raise exception 'Appeal is not available or changed' using errcode='40001'; end if;
  update public.application_appeals set status=p_status,response=btrim(p_response),resolved_by=auth.uid(),resolved_at=now(),version=version+1,updated_at=now() where id=p_appeal_id returning * into new_row;
  select a.student_id,a.id into v_student,v_application from public.applications a where a.id=new_row.application_id;
  perform private.portal_notify(v_student,'appeal_resolved','แจ้งผลคำอุทธรณ์','เจ้าหน้าที่บันทึกผลการพิจารณาคำอุทธรณ์แล้ว','/applications/'||v_application::text);
  perform private.portal_write_audit('resolve_appeal','application_appeal',p_appeal_id,to_jsonb(old_row),to_jsonb(new_row),'พิจารณาคำอุทธรณ์');
end;
$$;

create or replace function public.published_scholarship_results(p_scholarship_id uuid)
returns table(application_no bigint,result text,decided_at timestamptz) language sql stable security definer set search_path='' as $$
  select a.application_no,a.status,a.decided_at from public.applications a join public.scholarships s on s.id=a.scholarship_id where s.id=p_scholarship_id and s.results_published_at is not null and a.status in ('approved','reserve','rejected') order by case a.status when 'approved' then 1 when 'reserve' then 2 else 3 end,a.application_no;
$$;

create or replace function public.staff_decide_application(p_application_id uuid,p_version integer,p_decision text,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare old_row public.applications; new_row public.applications; v_scholarship public.scholarships; v_approved integer; v_completed integer;
begin
  perform private.portal_require_active_role(array['staff']);
  if p_decision not in ('approved','reserve','rejected') or p_reason is null or char_length(btrim(p_reason)) not between 3 and 2000 then raise exception 'Invalid final decision' using errcode='22023'; end if;
  select * into old_row from public.applications where id=p_application_id for update;
  if not found or old_row.status<>'committee_review' then raise exception 'Application is not ready for final decision' using errcode='22023'; end if;
  if p_version is distinct from old_row.version then raise exception 'STALE_VERSION' using errcode='40001'; end if;
  select * into v_scholarship from public.scholarships where id=old_row.scholarship_id for update;
  select count(*) into v_completed from public.review_assignments where application_id=p_application_id and status='completed';
  if v_completed<v_scholarship.required_reviewer_count then raise exception 'Reviewer quorum has not been reached' using errcode='22023'; end if;
  if p_decision='approved' then select count(*) into v_approved from public.applications where scholarship_id=v_scholarship.id and status='approved'; if v_approved>=v_scholarship.quota then raise exception 'Scholarship quota has been filled' using errcode='22023'; end if; end if;
  update public.applications set status=p_decision,decided_by=auth.uid(),decided_at=now(),decision_reason=btrim(p_reason),version=version+1,updated_at=now() where id=p_application_id returning * into new_row;
  perform private.portal_add_status_history(p_application_id,old_row.status,p_decision,p_reason,true);
  perform private.portal_notify(old_row.student_id,'final_decision',case p_decision when 'approved' then 'ใบสมัครได้รับการอนุมัติ' when 'reserve' then 'ใบสมัครอยู่ในรายชื่อสำรอง' else 'ผลการพิจารณาใบสมัคร' end,'เปิดใบสมัครเพื่อดูผลการพิจารณาและรายละเอียดจากเจ้าหน้าที่','/applications/'||p_application_id::text);
  perform private.portal_write_audit('finalize_application','application',p_application_id,to_jsonb(old_row),to_jsonb(new_row),p_reason);
end;
$$;

revoke all on function public.committee_declare_conflict(uuid,boolean,text),public.staff_set_scholarship_process(uuid,integer,boolean,timestamptz,text),public.staff_schedule_interview(uuid,timestamptz,text,text,text,text),public.student_submit_appeal(uuid,text),public.staff_resolve_appeal(uuid,integer,text,text),public.published_scholarship_results(uuid) from public;
grant execute on function public.committee_declare_conflict(uuid,boolean,text),public.staff_set_scholarship_process(uuid,integer,boolean,timestamptz,text),public.staff_schedule_interview(uuid,timestamptz,text,text,text,text),public.student_submit_appeal(uuid,text),public.staff_resolve_appeal(uuid,integer,text,text) to authenticated;
grant execute on function public.published_scholarship_results(uuid) to anon,authenticated;

notify pgrst,'reload schema';

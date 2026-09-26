-- Review operations, interview scheduling and idempotent reminders.
-- ส่วนขยายการจัดการกรรมการและสัมภาษณ์: อ่านประกอบ migration รุ่นใหม่กว่านี้ด้วย
-- ตัวอย่าง: 20260924120000_review_ui_workflow.sql ปรับสถานะใบสมัครที่นัดได้
-- การปรับกฎระบบที่ติดตั้งแล้วให้เพิ่ม migration ใหม่ ไม่แก้ SQL เก่าแล้วคาดว่าจะถูกรันซ้ำ
-- เพิ่มคอลัมน์ใดต้องแก้ type, select, ฟอร์ม และ Server Action ที่ส่งข้อมูลนั้นด้วย
alter table public.review_assignments add column due_at timestamptz,
  add column version integer not null default 1;
alter table public.application_interviews add column ends_at timestamptz,
  add column interviewer_id uuid references public.portal_profiles(id),
  add column outcome text not null default '' check(char_length(outcome)<=2000);
update public.application_interviews set ends_at=scheduled_at+interval '30 minutes';
alter table public.application_interviews alter column ends_at set not null;
create index on public.review_assignments(due_at) where status='assigned';
create index on public.application_interviews(interviewer_id,scheduled_at) where status='scheduled';

-- Trigger ล็อกงานที่ประเมินเสร็จแล้วไม่ให้เปลี่ยนกลับ และเพิ่ม version ทุกครั้งที่แก้งาน
-- หากต้องการเปิดงานย้อนหลัง ต้องออกแบบประวัติผลเดิมและสิทธิ์ร่วมกับ RPC ไม่ปลดเงื่อนไขหน้าเว็บอย่างเดียว
create function private.guard_review_assignment()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='completed' and new.status<>'completed' then
    raise exception 'Submitted review is locked' using errcode='22023';
  end if;
  new.version:=old.version+1;
  return new;
end; $$;
create trigger guard_review_assignment before update on public.review_assignments
for each row execute function private.guard_review_assignment();

-- RPC ของ manageReview: ตรวจ staff, ล็อกใบสมัคร/งาน, ตรวจ version และสถานะก่อนแก้
-- เปลี่ยนกรรมการจะถอนงานเดิมแล้วสร้างงานใหม่ เพื่อเก็บเส้นทางการมอบหมาย
-- ข้อจำกัดกำหนดส่ง/เหตุผล/งานซ้ำต้องปรับใน migration ใหม่ พร้อม validation ของ AssignmentControl
create function public.staff_manage_review(p_id uuid,p_version integer,p_due_at timestamptz,p_replacement uuid,p_revoke boolean,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare old_row public.review_assignments; new_id uuid;
begin
  perform private.portal_require_active_role(array['staff']);
  -- Match assignment creation lock order: application first.
  perform 1 from public.applications where id=(select application_id from public.review_assignments where id=p_id) for update;
  select * into old_row from public.review_assignments where id=p_id for update;
  if not found or old_row.version is distinct from p_version then raise exception 'STALE_VERSION' using errcode='40001'; end if;
  if old_row.status<>'assigned' then raise exception 'Only pending assignments can change' using errcode='22023'; end if;
  if not exists(select 1 from public.applications where id=old_row.application_id and status='committee_review') then raise exception 'Application is closed' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 or (p_due_at is not null and p_due_at<=now()) then raise exception 'Invalid deadline or reason' using errcode='22023'; end if;
  if p_replacement=old_row.reviewer_id or (p_replacement is not null and p_revoke) then raise exception 'Invalid replacement' using errcode='22023'; end if;
  if p_replacement is not null and exists(select 1 from public.review_assignments where application_id=old_row.application_id and reviewer_id=p_replacement) then raise exception 'Reviewer already assigned' using errcode='23505'; end if;
  update public.review_assignments set due_at=p_due_at,status=case when p_revoke or p_replacement is not null then 'revoked' else status end where id=p_id;
  if p_replacement is not null then
    new_id:=public.staff_assign_reviewer(old_row.application_id,p_replacement,p_reason);
    update public.review_assignments set due_at=p_due_at where id=new_id;
  end if;
  perform private.portal_notify(old_row.reviewer_id,'assignment_changed','งานประเมินมีการเปลี่ยนแปลง',p_reason,'/committee');
  perform private.portal_write_audit('manage_review','review_assignment',p_id,to_jsonb(old_row),
    jsonb_build_object('due_at',p_due_at,'replacement',p_replacement,'revoked',p_revoke),p_reason);
end; $$;
revoke all on function public.staff_manage_review(uuid,integer,timestamptz,uuid,boolean,text) from public,anon;
grant execute on function public.staff_manage_review(uuid,integer,timestamptz,uuid,boolean,text) to authenticated;

-- Trigger ตรวจเวลาสิ้นสุดและนัดซ้อนของกรรมการ นักศึกษา หรือสถานที่
-- advisory lock ป้องกันคำขอนัดพร้อมกันตรวจผ่านทั้งคู่; ต้องพิจารณากลไกนี้เมื่อเปลี่ยนวิธีตรวจเวลาชน
-- ช่วงติดกันพอดีไม่ถือว่าซ้อนตามเงื่อนไข < และ > ด้านล่าง
create function private.guard_interview_time()
returns trigger language plpgsql set search_path='' as $$
begin
  -- Serialize schedule changes, including calls through the original RPC.
  perform pg_advisory_xact_lock(20260923,1);
  if new.ends_at is null then new.ends_at:=new.scheduled_at+interval '30 minutes'; end if;
  if tg_op='UPDATE' and new.scheduled_at is distinct from old.scheduled_at and new.ends_at=old.ends_at then
    new.ends_at:=new.scheduled_at+(old.ends_at-old.scheduled_at);
  end if;
  if new.ends_at<=new.scheduled_at then raise exception 'Invalid interview end time' using errcode='22023'; end if;
  if new.interviewer_id is not null and not exists(select 1 from public.portal_profiles where id=new.interviewer_id and active and role='committee') then raise exception 'Invalid interviewer' using errcode='22023'; end if;
  if new.status='scheduled' and exists(
    select 1 from public.application_interviews i
    join public.applications a on a.id=i.application_id
    join public.applications n on n.id=new.application_id
    where i.id<>new.id and i.status='scheduled'
      and i.scheduled_at<new.ends_at and i.ends_at>new.scheduled_at
      and (i.interviewer_id=new.interviewer_id or a.student_id=n.student_id
        or lower(btrim(i.location))=lower(btrim(new.location)))
  ) then raise exception 'Interview time overlaps' using errcode='23P01'; end if;
  return new;
end; $$;
create trigger guard_interview_time before insert or update on public.application_interviews
for each row execute function private.guard_interview_time();

-- RPC หลักของ saveInterview: ตรวจสิทธิ์ รุ่นข้อมูล เวลา กรรมการ สถานะ และผลสัมภาษณ์
-- insert ... on conflict(application_id) คือสร้างนัดใหม่หรือแก้นัดของใบสมัครเดิม
-- เปลี่ยนชื่อ/เพิ่ม parameter ต้องแก้ app/actions/review-operations.ts และฟอร์ม InterviewControl คู่กัน
create function public.staff_schedule_interview_v2(p_application_id uuid,p_version integer,p_start timestamptz,p_end timestamptz,p_interviewer uuid,p_location text,p_url text,p_note text,p_status text,p_outcome text)
returns void language plpgsql security definer set search_path='' as $$
declare old_row public.application_interviews; new_row public.application_interviews; student uuid;
begin
  perform private.portal_require_active_role(array['staff']);
  perform pg_advisory_xact_lock(20260923,1);
  select student_id into student from public.applications where id=p_application_id and status in ('ready_for_review','committee_review') for update;
  if not found then raise exception 'Application is not ready' using errcode='22023'; end if;
  select * into old_row from public.application_interviews where application_id=p_application_id for update;
  if (found and old_row.version is distinct from p_version) or (not found and p_version is not null) then raise exception 'STALE_VERSION' using errcode='40001'; end if;
  if p_start is null or p_end is null or p_end<=p_start or p_interviewer is null
    or (p_status='scheduled' and p_start<=now())
    or (p_status='completed' and char_length(btrim(coalesce(p_outcome,'')))<3)
    or (coalesce(p_url,'')<>'' and p_url !~ '^https?://') then raise exception 'Invalid interview data' using errcode='22023'; end if;
  insert into public.application_interviews(application_id,scheduled_at,ends_at,interviewer_id,location,meeting_url,note,status,outcome,created_by)
    values(p_application_id,p_start,p_end,p_interviewer,btrim(p_location),nullif(p_url,''),p_note,p_status,p_outcome,auth.uid())
    on conflict(application_id) do update set scheduled_at=excluded.scheduled_at,ends_at=excluded.ends_at,
    interviewer_id=excluded.interviewer_id,location=excluded.location,meeting_url=excluded.meeting_url,
    note=excluded.note,status=excluded.status,outcome=excluded.outcome,version=public.application_interviews.version+1,updated_at=now()
    returning * into new_row;
  perform private.portal_notify(student,'interview_changed','นัดสัมภาษณ์มีการเปลี่ยนแปลง','ตรวจวันเวลา สถานที่ และสถานะล่าสุด','/applications/'||p_application_id::text);
  perform private.portal_notify(p_interviewer,'interview_changed','แจ้งนัดสัมภาษณ์','ตรวจตารางนัดสัมภาษณ์ล่าสุด','/committee/interviews');
  if old_row.interviewer_id is not null and old_row.interviewer_id<>p_interviewer then
    perform private.portal_notify(old_row.interviewer_id,'interview_changed','เปลี่ยนกรรมการสัมภาษณ์','นัดหมายเดิมของคุณมีการเปลี่ยนแปลง','/committee/interviews');
  end if;
  perform private.portal_write_audit('schedule_interview','application_interview',new_row.id,to_jsonb(old_row),to_jsonb(new_row),'จัดการนัดสัมภาษณ์');
end; $$;
revoke all on function public.staff_schedule_interview_v2(uuid,integer,timestamptz,timestamptz,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.staff_schedule_interview_v2(uuid,integer,timestamptz,timestamptz,uuid,text,text,text,text,text) to authenticated;

create policy "Interviewers read own schedule" on public.application_interviews for select to authenticated
using(interviewer_id=(select auth.uid()) and (select private.portal_has_active_role(array['committee'])));

create table private.workflow_reminder_receipts(key text primary key,created_at timestamptz not null default now());
create function public.enqueue_workflow_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare r record; claimed text; count_sent integer:=0;
begin
  for r in select id,reviewer_id,due_at from public.review_assignments
    where status='assigned' and due_at between now() and now()+interval '24 hours' loop
    claimed:=null;
    insert into private.workflow_reminder_receipts(key) values('review:'||r.id||':'||r.due_at)
      on conflict do nothing returning key into claimed;
    if claimed is not null then
      perform private.portal_notify(r.reviewer_id,'review_due','งานประเมินใกล้ครบกำหนด','กรุณาส่งผลประเมินภายในเวลาที่กำหนด','/committee');
      count_sent:=count_sent+1;
    end if;
  end loop;
  for r in select i.*,a.student_id from public.application_interviews i join public.applications a on a.id=i.application_id
    where i.status='scheduled' and i.scheduled_at between now() and now()+interval '24 hours' loop
    claimed:=null;
    insert into private.workflow_reminder_receipts(key) values('interview:'||r.id||':'||r.version)
      on conflict do nothing returning key into claimed;
    if claimed is not null then
      perform private.portal_notify(r.student_id,'interview_due','ใกล้ถึงเวลาสัมภาษณ์','ตรวจวันเวลาและสถานที่ในใบสมัคร','/applications/'||r.application_id::text);
      if r.interviewer_id is not null then perform private.portal_notify(r.interviewer_id,'interview_due','ใกล้ถึงเวลาสัมภาษณ์','ตรวจตารางสัมภาษณ์ของคุณ','/committee/interviews'); end if;
      count_sent:=count_sent+1;
    end if;
  end loop;
  return count_sent;
end; $$;
revoke all on function public.enqueue_workflow_reminders() from public,anon,authenticated;
grant execute on function public.enqueue_workflow_reminders() to service_role;
notify pgrst,'reload schema';

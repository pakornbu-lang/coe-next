-- Personal notifications for staff, committee and admins.
-- Apply after the team's review_operations and decouple_notification_outbox migrations.
begin;

create or replace function public.mark_all_my_notifications_read()
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.portal_require_active_role(array['staff','committee','admin']);
  update public.portal_notifications set read_at=now()
  where user_id=(select auth.uid()) and read_at is null;
end; $$;
revoke all on function public.mark_all_my_notifications_read() from public,anon;
grant execute on function public.mark_all_my_notifications_read() to authenticated;

-- Separate delivery primitive from recipient routing. No unrestricted public RPC.
create or replace function private.portal_deliver_notification(
  p_user_id uuid,p_kind text,p_title text,p_body text,p_href text,p_email boolean default true)
returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_email text;
begin
  select email into v_email from public.portal_profiles where id=p_user_id and active;
  if not found then return; end if;
  insert into public.portal_notifications(user_id,kind,title,body,href)
  values(p_user_id,p_kind,p_title,p_body,p_href) returning id into v_id;
  if p_email and v_email is not null and position('@' in v_email)>1 then
    insert into public.notification_email_outbox(notification_id,to_email,subject,body,href,status,max_retries)
    values(v_id,v_email,'[ระบบทุนการศึกษา] '||p_title,p_body,p_href,'pending',5);
  end if;
end; $$;
revoke all on function private.portal_deliver_notification(uuid,text,text,text,text,boolean) from public,anon,authenticated;

-- scholarships.created_by is the current schema's responsible officer.
-- Legacy submit/appeal RPCs loop over all staff; suppress unrelated recipients.
create or replace function private.portal_notify(p_user_id uuid,p_kind text,p_title text,p_body text,p_href text)
returns void language plpgsql security definer set search_path='' as $$
declare v_app uuid; v_owner uuid; v_recipient uuid:=p_user_id; v_title text:=p_title;
  v_kind text:=p_kind; v_href text:=p_href; v_body text:=p_body;
begin
  if p_kind in ('application_submitted','appeal_submitted','evaluation_submitted','reviewer_conflict') then
    if p_href ~ '^/staff/review/[0-9a-f-]{36}$' then
      v_app:=substring(p_href from '[0-9a-f-]{36}$')::uuid;
    elsif p_href ~ '^/staff/review\?application=[0-9a-f-]{36}$' then
      v_app:=substring(p_href from '[0-9a-f-]{36}$')::uuid;
    end if;
    select s.created_by into v_owner from public.applications a
      join public.scholarships s on s.id=a.scholarship_id where a.id=v_app;
    if v_owner is not null then
      if p_kind in ('application_submitted','appeal_submitted') and p_user_id<>v_owner then return; end if;
      v_recipient:=v_owner;
      v_href:='/staff/review/'||v_app;
    end if;
    if p_kind='application_submitted' and exists(
      select 1 from public.application_status_history
      where application_id=v_app and from_status='revision_requested' and to_status='submitted'
        and created_at= (select max(h.created_at) from public.application_status_history h where h.application_id=v_app)
    ) then
      v_kind:='application_resubmitted'; v_title:='นักศึกษาส่งเอกสารแก้ไขแล้ว';
      v_body:='กรุณาตรวจใบสมัครและเอกสารที่ส่งกลับมาอีกครั้ง';
    end if;
  end if;
  perform private.portal_deliver_notification(v_recipient,v_kind,v_title,v_body,v_href);
end; $$;
revoke all on function private.portal_notify(uuid,text,text,text,text) from public,anon,authenticated;

create or replace function private.notify_review_quorum()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_required integer; v_count integer; claimed text;
begin
  if new.status<>'completed' or old.status='completed' then return new; end if;
  select s.created_by,s.required_reviewer_count into v_owner,v_required
    from public.applications a join public.scholarships s on s.id=a.scholarship_id where a.id=new.application_id;
  select count(*) into v_count from public.review_assignments r
    join public.evaluations e on e.assignment_id=r.id
    where r.application_id=new.application_id and r.status='completed'
      and r.conflict_status='clear' and e.submitted_at is not null;
  if v_count>=v_required then
    insert into private.workflow_reminder_receipts(key)
      values('quorum:'||new.application_id||':'||v_required)
      on conflict do nothing returning key into claimed;
    if claimed is not null then
      perform private.portal_notify(v_owner,'review_quorum','ได้รับผลประเมินครบแล้ว',
        'ใบสมัครได้รับผลประเมินครบตามจำนวนที่กำหนด พร้อมให้เจ้าหน้าที่สรุปผล',
        '/staff/review/'||new.application_id);
    end if;
  end if;
  return new;
end; $$;
revoke all on function private.notify_review_quorum() from public,anon,authenticated;
drop trigger if exists notify_review_quorum on public.review_assignments;
create trigger notify_review_quorum after update of status on public.review_assignments
for each row execute function private.notify_review_quorum();

create or replace function private.notify_assigned_document_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
  if tg_op='UPDATE' then
    if old.file_path is not distinct from new.file_path then return new; end if;
  end if;
  for r in select id,reviewer_id from public.review_assignments
    where application_id=new.application_id and status='assigned' loop
    perform private.portal_notify(r.reviewer_id,'review_document_changed','เอกสารประกอบใบสมัครเปลี่ยนแปลง',
      'กรุณาตรวจเอกสารล่าสุดก่อนส่งผลประเมิน','/staff/evaluation?assignment='||r.id);
  end loop;
  return new;
end; $$;
revoke all on function private.notify_assigned_document_change() from public,anon,authenticated;
drop trigger if exists notify_assigned_document_change on public.application_documents;
create trigger notify_assigned_document_change after insert or update of file_path on public.application_documents
for each row execute function private.notify_assigned_document_change();

-- Keep account notifications separate from scholarship activity.
create or replace function private.notify_admin_account_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record; v_kind text; v_title text; v_href text;
begin
  if tg_op='INSERT' then
    if new.pending_role is null then return new; end if;
    v_kind:='role_requested'; v_title:='มีคำขอบทบาทรอตรวจสอบ'; v_href:='/admin?status=pending';
  elsif new.pending_role is distinct from old.pending_role and new.pending_role is not null then
    v_kind:='role_requested'; v_title:='มีคำขอบทบาทรอตรวจสอบ'; v_href:='/admin?status=pending';
  elsif new.active is distinct from old.active or new.role is distinct from old.role then
    v_kind:='account_changed'; v_title:='มีการเปลี่ยนสถานะหรือสิทธิ์บัญชี';
    v_href:='/admin?q='||new.student_id;
  else return new;
  end if;
  for r in select id from public.portal_profiles where active and role='admin' loop
    perform private.portal_notify(r.id,v_kind,v_title,'โปรดตรวจสอบบัญชีและประวัติการแก้ไขในหน้าจัดการสมาชิก',v_href);
  end loop;
  return new;
end; $$;
revoke all on function private.notify_admin_account_change() from public,anon,authenticated;
drop trigger if exists notify_admin_account_change on public.portal_profiles;
create trigger notify_admin_account_change after insert or update of active,role,pending_role on public.portal_profiles
for each row execute function private.notify_admin_account_change();

-- Failure alerts are in-app only: never create another email failure loop.
create or replace function private.notify_terminal_email_failure()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record; claimed text;
begin
  if new.status<>'failed' or new.attempts<new.max_retries then return new; end if;
  insert into private.workflow_reminder_receipts(key) values('email-failed:'||new.id)
    on conflict do nothing returning key into claimed;
  if claimed is not null then
    for r in select id from public.portal_profiles where active and role='admin' loop
      perform private.portal_deliver_notification(r.id,'email_failed','มีอีเมลส่งไม่สำเร็จครบจำนวนครั้ง',
        'กรุณาตรวจสอบการตั้งค่าผู้ให้บริการอีเมลและรายการที่ส่งล้มเหลว','/admin/notifications',false);
    end loop;
  end if;
  return new;
end; $$;
revoke all on function private.notify_terminal_email_failure() from public,anon,authenticated;
drop trigger if exists notify_terminal_email_failure on public.notification_email_outbox;
create trigger notify_terminal_email_failure after update of status,attempts on public.notification_email_outbox
for each row execute function private.notify_terminal_email_failure();

-- Admin-only read access; no direct UPDATE grant.
grant select on public.notification_email_outbox to authenticated;
drop policy if exists "Admins read email delivery" on public.notification_email_outbox;
create policy "Admins read email delivery" on public.notification_email_outbox
for select to authenticated using((select private.portal_is_admin()));
create or replace function public.admin_retry_notification_email(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare old_row public.notification_email_outbox;
begin
  perform private.portal_require_active_role(array['admin']);
  select * into old_row from public.notification_email_outbox where id=p_id for update;
  if not found or old_row.status<>'failed' or old_row.attempts<old_row.max_retries then
    raise exception 'Only exhausted failed messages can be retried' using errcode='22023';
  end if;
  update public.notification_email_outbox set status='pending',attempts=0,last_error=null,
    next_attempt_at=now(),updated_at=now() where id=p_id;
  delete from private.workflow_reminder_receipts where key='email-failed:'||p_id;
  perform private.portal_write_audit('retry_notification_email','notification_email_outbox',p_id,
    jsonb_build_object('status',old_row.status,'attempts',old_row.attempts),
    jsonb_build_object('status','pending','attempts',0),'ผู้ดูแลระบบเข้าคิวส่งอีเมลใหม่');
end; $$;
revoke all on function public.admin_retry_notification_email(uuid) from public,anon;
grant execute on function public.admin_retry_notification_email(uuid) to authenticated;

-- Avoid one permanently failed row starving newer email deliveries.
create or replace function public.notification_email_batch(p_limit integer default 20)
returns setof public.notification_email_outbox language sql security definer set search_path='' as $$
  select * from public.notification_email_outbox
  where status in ('pending','queued','failed') and attempts<max_retries and next_attempt_at<=now()
  order by created_at,id limit least(greatest(p_limit,1),20);
$$;
revoke all on function public.notification_email_batch(integer) from public,anon,authenticated;
grant execute on function public.notification_email_batch(integer) to service_role;

create or replace function public.enqueue_workflow_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare r record; claimed text; count_sent integer:=0; v_admin record;
begin
  for r in select ra.id,ra.reviewer_id,ra.due_at from public.review_assignments ra
    join public.applications a on a.id=ra.application_id
    join public.portal_profiles p on p.id=ra.reviewer_id and p.active and p.role='committee'
    where ra.status='assigned' and a.status='committee_review'
      and ra.due_at between now() and now()+interval '48 hours' loop
    claimed:=null;
    insert into private.workflow_reminder_receipts(key) values('review:'||r.id||':'||r.due_at)
      on conflict do nothing returning key into claimed;
    if claimed is not null then
      perform private.portal_notify(r.reviewer_id,'review_due','งานประเมินใกล้ครบกำหนด',
        'กรุณาส่งผลประเมินภายในเวลาที่กำหนด','/staff/evaluation?assignment='||r.id);
      count_sent:=count_sent+1;
    end if;
  end loop;
  for r in select i.*,a.student_id from public.application_interviews i join public.applications a on a.id=i.application_id
    where i.status='scheduled' and i.scheduled_at between now() and now()+interval '24 hours' loop
    claimed:=null;
    insert into private.workflow_reminder_receipts(key) values('interview:'||r.id||':'||r.version)
      on conflict do nothing returning key into claimed;
    if claimed is not null then
      perform private.portal_notify(r.student_id,'interview_due','ใกล้ถึงเวลาสัมภาษณ์','ตรวจวันเวลาและสถานที่ในใบสมัคร','/applications/'||r.application_id);
      if r.interviewer_id is not null then perform private.portal_notify(r.interviewer_id,'interview_due','ใกล้ถึงเวลาสัมภาษณ์','ตรวจตารางสัมภาษณ์ของคุณ','/committee/interviews'); end if;
      count_sent:=count_sent+1;
    end if;
  end loop;
  for r in select a.id,a.decided_at,s.created_by,s.results_published_at
    from public.applications a join public.scholarships s on s.id=a.scholarship_id
    join public.portal_profiles p on p.id=s.created_by and p.active and p.role='staff'
    where a.status='approved' and s.results_published_at is not null and a.decided_at is not null
      and greatest(a.decided_at,s.results_published_at)<=now()-interval '7 days'
      and not exists(select 1 from public.disbursements d where d.application_id=a.id and d.status='paid') loop
    claimed:=null;
    insert into private.workflow_reminder_receipts(key) values('payment:'||r.id||':'||r.decided_at||':'||r.results_published_at)
      on conflict do nothing returning key into claimed;
    if claimed is not null then
      perform private.portal_notify(r.created_by,'payment_pending','มีผู้ได้รับทุนที่ยังไม่บันทึกการจ่าย',
        'ผ่านกำหนด 7 วันหลังอนุมัติและประกาศผลแล้ว กรุณาตรวจข้อมูลการจ่ายทุน','/staff/review/'||r.id);
      count_sent:=count_sent+1;
    end if;
  end loop;
  -- Existing failures from before this migration also need an admin alert.
  for r in select id from public.notification_email_outbox where status='failed' and attempts>=max_retries loop
    claimed:=null;
    insert into private.workflow_reminder_receipts(key) values('email-failed:'||r.id)
      on conflict do nothing returning key into claimed;
    if claimed is not null then
      for v_admin in select id from public.portal_profiles where active and role='admin' loop
        perform private.portal_deliver_notification(v_admin.id,'email_failed','มีอีเมลส่งไม่สำเร็จครบจำนวนครั้ง',
          'กรุณาตรวจสอบการตั้งค่าและรายการส่งล้มเหลว','/admin/notifications',false);
      end loop;
      count_sent:=count_sent+1;
    end if;
  end loop;
  return count_sent;
end; $$;
revoke all on function public.enqueue_workflow_reminders() from public,anon,authenticated;
grant execute on function public.enqueue_workflow_reminders() to service_role;

-- Qualify the outer id so assigned committee members can open notification details.
drop policy if exists "Members read allowed applications" on public.applications;
create policy "Members read allowed applications" on public.applications for select to authenticated using (
  applications.student_id=(select auth.uid()) or (select private.portal_has_active_role(array['staff']))
  or ((select private.portal_has_active_role(array['committee'])) and exists(
    select 1 from public.review_assignments r where r.application_id=applications.id
    and r.reviewer_id=(select auth.uid()) and r.status in ('assigned','completed')))
);
notify pgrst,'reload schema';
commit;

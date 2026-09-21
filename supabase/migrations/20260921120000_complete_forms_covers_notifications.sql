-- Complete scholarship forms, reusable scholarship programmes, cover images,
-- and an email outbox coupled to the in-app notification record.

alter table public.scholarships
  add column if not exists program_kind text not null default 'general'
    check (program_kind in ('academic','financial_need','activity','talent','research','emergency','general')),
  add column if not exists cover_path text check (cover_path is null or char_length(cover_path) between 10 and 500);

create table if not exists public.notification_email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.portal_notifications(id) on delete cascade,
  to_email text not null check (char_length(to_email) between 3 and 254 and position('@' in to_email) > 1),
  subject text not null check (char_length(subject) between 2 and 255),
  body text not null check (char_length(body) <= 1000),
  href text not null check (href ~ '^/'),
  status text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  attempts smallint not null default 0 check (attempts between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  provider_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notification_email_outbox_dispatch_idx on public.notification_email_outbox(status, next_attempt_at, created_at);
alter table public.notification_email_outbox enable row level security;
revoke all on public.notification_email_outbox from anon, authenticated;
grant all on public.notification_email_outbox to service_role;

create or replace function private.portal_notify(p_user_id uuid, p_kind text, p_title text, p_body text, p_href text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_notification public.portal_notifications; v_email text;
begin
  insert into public.portal_notifications(user_id, kind, title, body, href)
  values(p_user_id, p_kind, p_title, p_body, p_href)
  returning * into v_notification;
  select email into v_email from public.portal_profiles where id=p_user_id and active;
  if v_email is not null and char_length(v_email) between 3 and 254 and position('@' in v_email) > 1 then
    insert into public.notification_email_outbox(notification_id,to_email,subject,body,href)
    values(v_notification.id,v_email,'[ระบบทุนการศึกษา] '||v_notification.title,v_notification.body,v_notification.href);
  end if;
end;
$$;
revoke all on function private.portal_notify(uuid,text,text,text,text) from public, anon, authenticated;

create or replace function public.staff_save_scholarship(
  p_id uuid, p_version integer, p_title text, p_type_id uuid, p_description text, p_eligibility text,
  p_amount numeric, p_quota integer, p_minimum_gpa numeric, p_opens_at timestamptz, p_closes_at timestamptz,
  p_status text, p_requirements jsonb, p_criteria jsonb, p_reason text, p_program_kind text, p_cover_path text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare old_row public.scholarships; new_row public.scholarships; v_id uuid; v_has_applications boolean;
begin
  perform private.portal_require_active_role(array['staff']);
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'Reason required' using errcode = '22023'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 3 and 200 or p_description is null or char_length(p_description) > 5000
     or p_eligibility is null or char_length(p_eligibility) > 5000 or p_amount is null or p_amount <= 0 or p_quota is null or p_quota < 1
     or p_minimum_gpa is not null and (p_minimum_gpa < 0 or p_minimum_gpa > 4) or p_opens_at is null or p_closes_at is null or p_opens_at >= p_closes_at
     or p_status not in ('draft','published','closed','archived') or p_program_kind not in ('academic','financial_need','activity','talent','research','emergency','general')
     or jsonb_typeof(p_requirements) <> 'array' or jsonb_typeof(p_criteria) <> 'array' then
    raise exception 'Invalid scholarship data' using errcode = '22023';
  end if;
  if p_type_id is not null and not exists(select 1 from public.portal_reference_data where id=p_type_id and kind='scholarship_type' and active) then
    raise exception 'Invalid scholarship type' using errcode = '22023';
  end if;
  if jsonb_array_length(p_criteria) = 0 or jsonb_array_length(p_criteria) > 20 or jsonb_array_length(p_requirements) > 30 then
    raise exception 'At least one criterion and valid list sizes are required' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_criteria) as x(label text, details text, max_score numeric, sort_order integer)
    where x.label is null or char_length(btrim(x.label)) not between 2 and 150 or coalesce(char_length(x.details),0)>1000 or x.max_score is null or x.max_score<=0 or x.max_score>1000 or x.sort_order not between 1 and 100) then
    raise exception 'Invalid requirement or criterion' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_requirements) as x(label text, details text, required boolean, sort_order integer)
    where x.label is null or char_length(btrim(x.label)) not between 2 and 150 or coalesce(char_length(x.details),0)>1000 or x.required is null or x.sort_order not between 1 and 100) then
    raise exception 'Invalid requirement or criterion' using errcode = '22023';
  end if;
  if p_cover_path is not null and (char_length(p_cover_path) not between 10 and 500 or not exists(select 1 from storage.objects where bucket_id='scholarship-covers' and name=p_cover_path)) then
    raise exception 'Uploaded scholarship cover not found' using errcode = '22023';
  end if;
  if p_id is null then
    if p_cover_path is not null and split_part(p_cover_path,'/',1) <> auth.uid()::text then raise exception 'Invalid scholarship cover owner' using errcode='42501'; end if;
    insert into public.scholarships(title,scholarship_type_id,program_kind,cover_path,description,eligibility,amount,quota,minimum_gpa,opens_at,closes_at,status,created_by)
    values(btrim(p_title),p_type_id,p_program_kind,p_cover_path,btrim(p_description),btrim(p_eligibility),p_amount,p_quota,p_minimum_gpa,p_opens_at,p_closes_at,p_status,auth.uid()) returning * into new_row;
    v_id := new_row.id;
  else
    select * into old_row from public.scholarships where id=p_id for update;
    if not found then raise exception 'Scholarship not found' using errcode = 'P0002'; end if;
    if p_version is distinct from old_row.version then raise exception 'STALE_VERSION' using errcode = '40001'; end if;
    if p_cover_path is distinct from old_row.cover_path and p_cover_path is not null and split_part(p_cover_path,'/',1) <> auth.uid()::text then raise exception 'Invalid scholarship cover owner' using errcode='42501'; end if;
    select exists(select 1 from public.applications where scholarship_id=p_id) into v_has_applications;
    if v_has_applications and (p_requirements is distinct from (select coalesce(jsonb_agg(jsonb_build_object('label',label,'details',details,'required',required,'sort_order',sort_order) order by sort_order),'[]'::jsonb) from public.scholarship_document_requirements where scholarship_id=p_id)
      or p_criteria is distinct from (select coalesce(jsonb_agg(jsonb_build_object('label',label,'details',details,'max_score',max_score,'sort_order',sort_order) order by sort_order),'[]'::jsonb) from public.scholarship_review_criteria where scholarship_id=p_id)) then
      raise exception 'Requirements and criteria cannot change after applications exist' using errcode = '22023';
    end if;
    update public.scholarships set title=btrim(p_title),scholarship_type_id=p_type_id,program_kind=p_program_kind,cover_path=p_cover_path,description=btrim(p_description),eligibility=btrim(p_eligibility),amount=p_amount,quota=p_quota,minimum_gpa=p_minimum_gpa,opens_at=p_opens_at,closes_at=p_closes_at,status=p_status,version=version+1,updated_at=now()
    where id=p_id returning * into new_row;
    v_id := p_id;
    delete from public.scholarship_document_requirements where scholarship_id=v_id and not v_has_applications;
    delete from public.scholarship_review_criteria where scholarship_id=v_id and not v_has_applications;
  end if;
  if not coalesce(v_has_applications,false) then
    insert into public.scholarship_document_requirements(scholarship_id,label,details,required,sort_order)
    select v_id,btrim(label),btrim(coalesce(details,'')),required,sort_order from jsonb_to_recordset(p_requirements) as x(label text,details text,required boolean,sort_order smallint);
    insert into public.scholarship_review_criteria(scholarship_id,label,details,max_score,sort_order)
    select v_id,btrim(label),btrim(coalesce(details,'')),max_score,sort_order from jsonb_to_recordset(p_criteria) as x(label text,details text,max_score numeric,sort_order smallint);
  end if;
  perform private.portal_write_audit(case when p_id is null then 'create_scholarship' else 'update_scholarship' end,'scholarship',v_id,
    case when p_id is null then null else to_jsonb(old_row) end,to_jsonb(new_row),p_reason);
  return v_id;
end;
$$;
revoke all on function public.staff_save_scholarship(uuid,integer,text,uuid,text,text,numeric,integer,numeric,timestamptz,timestamptz,text,jsonb,jsonb,text,text,text) from public, anon;
grant execute on function public.staff_save_scholarship(uuid,integer,text,uuid,text,text,numeric,integer,numeric,timestamptz,timestamptz,text,jsonb,jsonb,text,text,text) to authenticated;

create or replace function public.student_save_application(
  p_application_id uuid, p_version integer, p_scholarship_id uuid, p_data jsonb, p_bank_name text,
  p_account_holder text, p_account_number text, p_submit boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare old_row public.applications; new_row public.applications; v_scholarship public.scholarships; v_student public.portal_profiles; v_missing integer; v_id uuid; v_staff_id uuid;
begin
  perform private.portal_require_active_role(array['student']);
  if jsonb_typeof(p_data) <> 'object' then raise exception 'Invalid application data' using errcode='22023'; end if;
  if p_application_id is null then
    select * into v_scholarship from public.scholarships where id=p_scholarship_id and status='published' and now() between opens_at and closes_at;
    if not found then raise exception 'Scholarship is not open' using errcode='22023'; end if;
    select * into v_student from public.portal_profiles where id=auth.uid() and active and role='student';
    if not found then raise exception 'Student profile not found' using errcode='42501'; end if;
    insert into public.applications(scholarship_id,student_id,student_name,student_code,application_data)
    values(p_scholarship_id,auth.uid(),v_student.full_name,v_student.student_id,p_data) returning * into new_row;
    v_id:=new_row.id;
    perform private.portal_add_status_history(v_id,null,'draft','เริ่มกรอกใบสมัคร',true);
    perform private.portal_write_audit('create_application','application',v_id,null,to_jsonb(new_row),'เริ่มกรอกใบสมัคร');
  else
    select * into old_row from public.applications where id=p_application_id for update;
    if not found or old_row.student_id <> auth.uid() then raise exception 'Application not found' using errcode='42501'; end if;
    if p_version is distinct from old_row.version then raise exception 'STALE_VERSION' using errcode='40001'; end if;
    if old_row.status not in ('draft','revision_requested') then raise exception 'Application cannot be edited now' using errcode='22023'; end if;
    v_id:=old_row.id;
    p_scholarship_id:=old_row.scholarship_id;
    update public.applications set application_data=p_data,version=version+1,updated_at=now() where id=v_id returning * into new_row;
  end if;
  if p_bank_name is not null or p_account_holder is not null or p_account_number is not null then
    if char_length(btrim(coalesce(p_bank_name,''))) not between 2 and 150 or char_length(btrim(coalesce(p_account_holder,''))) not between 2 and 200 or btrim(coalesce(p_account_number,'')) !~ '^[0-9 -]{8,30}$' then
      raise exception 'Invalid bank account details' using errcode='22023';
    end if;
    insert into public.application_payment_accounts(application_id,bank_name,account_holder,account_number)
    values(v_id,btrim(p_bank_name),btrim(p_account_holder),btrim(p_account_number))
    on conflict(application_id) do update set bank_name=excluded.bank_name,account_holder=excluded.account_holder,account_number=excluded.account_number,updated_at=now();
  end if;
  if p_submit then
    if new_row.status not in ('draft','revision_requested') then raise exception 'Application cannot be submitted now' using errcode='22023'; end if;
    if char_length(btrim(coalesce(p_data->>'faculty',''))) < 2 or char_length(btrim(coalesce(p_data->>'major',''))) < 2
       or coalesce(p_data->>'education_level','') not in ('ปริญญาตรี','ปริญญาโท','ปริญญาเอก','อื่น ๆ')
       or coalesce(p_data->>'study_year','') !~ '^[1-8]$'
       or coalesce(p_data->>'gpa','') !~ '^(0|[0-3](\.[0-9]{1,2})?|4(\.0{1,2})?)$'
       or coalesce(p_data->>'phone','') !~ '^[0-9+ ()-]{7,25}$'
       or char_length(btrim(coalesce(p_data->>'address',''))) < 5
       or coalesce(p_data->>'income','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
       or coalesce(p_data->>'family_members','') !~ '^[1-9][0-9]?$'
       or coalesce(p_data->>'parent_status','') not in ('อยู่ด้วยกัน','แยกกันอยู่','หย่า','บิดาเสียชีวิต','มารดาเสียชีวิต','เสียชีวิตทั้งคู่','other')
       or (p_data->>'parent_status'='other' and char_length(btrim(coalesce(p_data->>'parent_status_other',''))) < 2)
       or char_length(btrim(coalesce(p_data->>'reason',''))) < 20 then
      raise exception 'Complete every required application field before submitting' using errcode='22023';
    end if;
    if not exists(select 1 from public.application_payment_accounts where application_id=v_id) then raise exception 'Bank account details are required' using errcode='22023'; end if;
    select count(*) into v_missing from public.scholarship_document_requirements r where r.scholarship_id=p_scholarship_id and r.required and not exists(
      select 1 from public.application_documents d where d.application_id=v_id and d.requirement_id=r.id
    );
    if v_missing > 0 then raise exception 'Required documents are missing' using errcode='22023'; end if;
    update public.applications set status='submitted',submitted_at=coalesce(submitted_at,now()),version=version+1,updated_at=now() where id=v_id returning * into new_row;
    perform private.portal_add_status_history(v_id,old_row.status,'submitted','ส่งใบสมัครเพื่อรอตรวจเอกสาร',true);
    perform private.portal_write_audit('submit_application','application',v_id,case when old_row.id is null then null else to_jsonb(old_row) end,to_jsonb(new_row),'นักศึกษาส่งใบสมัคร');
    for v_staff_id in select id from public.portal_profiles where active and role='staff' loop
      perform private.portal_notify(v_staff_id,'application_submitted','มีใบสมัครใหม่รอตรวจสอบ','มีนักศึกษาส่งใบสมัครทุนใหม่ โปรดตรวจสอบเอกสารประกอบ','/staff/review/'||v_id::text);
    end loop;
  elsif old_row.id is not null then
    perform private.portal_write_audit('save_application_draft','application',v_id,to_jsonb(old_row),to_jsonb(new_row),'บันทึกร่างใบสมัคร');
  end if;
  return v_id;
end;
$$;
revoke all on function public.student_save_application(uuid,integer,uuid,jsonb,text,text,text,boolean) from public, anon;
grant execute on function public.student_save_application(uuid,integer,uuid,jsonb,text,text,text,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('scholarship-covers','scholarship-covers',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function private.portal_can_upload_scholarship_cover(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.portal_has_active_role(array['staff']))
    and split_part(p_path,'/',1)=auth.uid()::text and split_part(p_path,'/',2) <> '' and split_part(p_path,'/',3) = '';
$$;
create or replace function private.portal_can_delete_scholarship_cover(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.portal_has_active_role(array['staff']))
    and not exists(select 1 from public.scholarships where cover_path=p_path);
$$;
revoke all on function private.portal_can_upload_scholarship_cover(text), private.portal_can_delete_scholarship_cover(text) from public, anon;
grant execute on function private.portal_can_upload_scholarship_cover(text), private.portal_can_delete_scholarship_cover(text) to authenticated;

drop policy if exists "Staff upload scholarship covers" on storage.objects;
create policy "Staff upload scholarship covers" on storage.objects for insert to authenticated with check (
  bucket_id='scholarship-covers' and (select private.portal_can_upload_scholarship_cover(name))
);
drop policy if exists "Staff remove unused scholarship covers" on storage.objects;
create policy "Staff remove unused scholarship covers" on storage.objects for delete to authenticated using (
  bucket_id='scholarship-covers' and (select private.portal_can_delete_scholarship_cover(name))
);

notify pgrst, 'reload schema';

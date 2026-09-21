-- Keep the database validation aligned with the form. The application action
-- also validates these values, but an RPC can be called directly.

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
    if char_length(btrim(coalesce(p_bank_name,''))) not between 2 and 150 or char_length(btrim(coalesce(p_account_holder,''))) not between 2 and 200 or btrim(coalesce(p_account_number,'')) !~ '^[0-9]{10,15}$' then
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
       or coalesce(p_data->>'phone','') !~ '^0[0-9]{9}$'
       or (coalesce(p_data->>'emergency_phone','') <> '' and coalesce(p_data->>'emergency_phone','') !~ '^0[0-9]{9}$')
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

-- Existing phone values remain untouched. Every changed or new phone follows
-- the 10-digit Thai format specified in the application.
alter table public.portal_profiles drop constraint if exists portal_profiles_phone_check;
alter table public.portal_profiles add constraint portal_profiles_phone_check
  check (phone is null or phone ~ '^0[0-9]{9}$') not valid;

notify pgrst, 'reload schema';

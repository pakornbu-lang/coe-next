-- Core scholarship workflow: applications, private documents, committee review,
-- final decisions, notifications and recorded disbursements.
-- Every public mutation below verifies the caller again; RLS is not the only guard.

create function private.portal_has_active_role(p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.portal_profiles
    where id = auth.uid() and active and role = any(p_roles)
  );
$$;
revoke all on function private.portal_has_active_role(text[]) from public, anon;
grant execute on function private.portal_has_active_role(text[]) to authenticated;

create function private.portal_require_active_role(p_roles text[]) returns text
language plpgsql security definer set search_path = '' as $$
declare actor_name text;
begin
  select full_name into actor_name from public.portal_profiles
  where id = auth.uid() and active and role = any(p_roles) for share;
  if actor_name is null then raise exception 'Required role is not active' using errcode = '42501'; end if;
  return actor_name;
end;
$$;
revoke all on function private.portal_require_active_role(text[]) from public, anon, authenticated;

create function private.portal_write_audit(
  p_action text, p_entity text, p_target_id uuid, p_before jsonb, p_after jsonb, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare actor_name text;
begin
  select full_name into actor_name from public.portal_profiles
  where id = auth.uid() and active;
  if actor_name is null then raise exception 'Active member required' using errcode = '42501'; end if;
  insert into public.portal_audit_log(actor_id, actor_name, action, entity, target_id, before_data, after_data, reason)
  values(auth.uid(), actor_name, p_action, p_entity, p_target_id, p_before, p_after, btrim(p_reason));
end;
$$;
revoke all on function private.portal_write_audit(text,text,uuid,jsonb,jsonb,text) from public, anon, authenticated;

create table public.scholarships (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 200),
  scholarship_type_id uuid references public.portal_reference_data(id),
  description text not null default '' check (char_length(description) <= 5000),
  eligibility text not null default '' check (char_length(eligibility) <= 5000),
  amount numeric(12,2) not null check (amount > 0 and amount <= 100000000),
  quota integer not null check (quota between 1 and 100000),
  minimum_gpa numeric(3,2) check (minimum_gpa between 0 and 4),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','published','closed','archived')),
  created_by uuid not null references public.portal_profiles(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opens_at < closes_at)
);
create index scholarships_public_idx on public.scholarships(status, opens_at, closes_at);
create index scholarships_created_idx on public.scholarships(created_by, created_at desc);

create table public.scholarship_document_requirements (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 2 and 150),
  details text not null default '' check (char_length(details) <= 1000),
  required boolean not null default true,
  sort_order smallint not null check (sort_order between 1 and 100),
  unique(scholarship_id, sort_order),
  unique(scholarship_id, label)
);

create table public.scholarship_review_criteria (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 2 and 150),
  details text not null default '' check (char_length(details) <= 1000),
  max_score numeric(5,2) not null check (max_score > 0 and max_score <= 1000),
  sort_order smallint not null check (sort_order between 1 and 100),
  unique(scholarship_id, sort_order),
  unique(scholarship_id, label)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  application_no bigint generated always as identity unique,
  scholarship_id uuid not null references public.scholarships(id),
  student_id uuid not null references public.portal_profiles(id),
  student_name text not null check (char_length(btrim(student_name)) between 1 and 200),
  student_code text not null check (student_code ~ '^[0-9]{8,12}$'),
  application_data jsonb not null default '{}'::jsonb check (jsonb_typeof(application_data) = 'object'),
  status text not null default 'draft' check (status in ('draft','submitted','revision_requested','ready_for_review','committee_review','approved','reserve','rejected')),
  submitted_at timestamptz,
  decided_by uuid references public.portal_profiles(id),
  decided_at timestamptz,
  decision_reason text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scholarship_id, student_id),
  check ((status = 'draft' and submitted_at is null) or (status <> 'draft' and submitted_at is not null))
);
create index applications_student_idx on public.applications(student_id, updated_at desc);
create index applications_staff_idx on public.applications(status, updated_at desc);

-- Payment details stay in a separate table so assigned committee members cannot read them.
create table public.application_payment_accounts (
  application_id uuid primary key references public.applications(id) on delete cascade,
  bank_name text not null check (char_length(btrim(bank_name)) between 2 and 150),
  account_holder text not null check (char_length(btrim(account_holder)) between 2 and 200),
  account_number text not null check (account_number ~ '^[0-9 -]{8,30}$'),
  updated_at timestamptz not null default now()
);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  requirement_id uuid not null references public.scholarship_document_requirements(id),
  file_path text not null unique check (char_length(file_path) between 10 and 500),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size integer not null check (file_size between 1 and 10485760),
  status text not null default 'pending' check (status in ('pending','verified','revision_required')),
  feedback text,
  checked_by uuid references public.portal_profiles(id),
  checked_at timestamptz,
  version integer not null default 1,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id, requirement_id)
);
create index application_documents_application_idx on public.application_documents(application_id, status);

create table public.review_assignments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  reviewer_id uuid not null references public.portal_profiles(id),
  assigned_by uuid not null references public.portal_profiles(id),
  status text not null default 'assigned' check (status in ('assigned','completed','revoked')),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(application_id, reviewer_id)
);
create index review_assignments_reviewer_idx on public.review_assignments(reviewer_id, status, assigned_at desc);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.review_assignments(id) on delete cascade,
  scores jsonb not null default '[]'::jsonb check (jsonb_typeof(scores) = 'array'),
  total_score numeric(8,2) not null default 0 check (total_score >= 0),
  recommendation text not null check (recommendation in ('approve','reserve','reject')),
  comment text not null default '' check (char_length(comment) <= 2000),
  submitted_at timestamptz,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text not null default '' check (char_length(reason) <= 2000),
  visible_to_student boolean not null default true,
  actor_id uuid references public.portal_profiles(id),
  created_at timestamptz not null default now()
);
create index application_status_history_application_idx on public.application_status_history(application_id, created_at desc);

create table public.portal_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.portal_profiles(id) on delete cascade,
  kind text not null check (char_length(kind) between 2 and 50),
  title text not null check (char_length(title) between 2 and 200),
  body text not null default '' check (char_length(body) <= 1000),
  href text not null default '/' check (href ~ '^/'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index portal_notifications_user_idx on public.portal_notifications(user_id, read_at, created_at desc);

create function private.portal_notify(p_user_id uuid, p_kind text, p_title text, p_body text, p_href text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.portal_notifications(user_id, kind, title, body, href)
  values(p_user_id, p_kind, p_title, p_body, p_href);
end;
$$;
revoke all on function private.portal_notify(uuid,text,text,text,text) from public, anon, authenticated;

create table public.disbursements (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id),
  amount numeric(12,2) not null check (amount > 0 and amount <= 100000000),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  transfer_date date,
  transfer_reference text check (transfer_reference is null or char_length(btrim(transfer_reference)) between 3 and 120),
  proof_path text unique,
  bank_name_snapshot text not null check (char_length(bank_name_snapshot) between 2 and 150),
  account_holder_snapshot text not null check (char_length(account_holder_snapshot) between 2 and 200),
  account_number_snapshot text not null check (account_number_snapshot ~ '^[0-9 -]{8,30}$'),
  recorded_by uuid not null references public.portal_profiles(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'paid') or (transfer_date is not null and transfer_reference is not null))
);
create index disbursements_status_idx on public.disbursements(status, updated_at desc);

alter table public.scholarships enable row level security;
alter table public.scholarship_document_requirements enable row level security;
alter table public.scholarship_review_criteria enable row level security;
alter table public.applications enable row level security;
alter table public.application_payment_accounts enable row level security;
alter table public.application_documents enable row level security;
alter table public.review_assignments enable row level security;
alter table public.evaluations enable row level security;
alter table public.application_status_history enable row level security;
alter table public.portal_notifications enable row level security;
alter table public.disbursements enable row level security;

revoke all on public.scholarships, public.scholarship_document_requirements, public.scholarship_review_criteria,
  public.applications, public.application_payment_accounts, public.application_documents, public.review_assignments,
  public.evaluations, public.application_status_history, public.portal_notifications, public.disbursements
from anon, authenticated;
grant select on public.scholarships, public.scholarship_document_requirements, public.scholarship_review_criteria to anon, authenticated;
grant select on public.applications, public.application_payment_accounts, public.application_documents, public.review_assignments,
  public.evaluations, public.application_status_history, public.portal_notifications, public.disbursements to authenticated;
grant all on public.scholarships, public.scholarship_document_requirements, public.scholarship_review_criteria,
  public.applications, public.application_payment_accounts, public.application_documents, public.review_assignments,
  public.evaluations, public.application_status_history, public.portal_notifications, public.disbursements to service_role;

-- The public can only see open/closed published scholarships. Staff can also see drafts.
create policy "Public reads published scholarships" on public.scholarships for select to anon, authenticated
  using (status in ('published','closed'));
create policy "Staff reads all scholarships" on public.scholarships for select to authenticated
  using ((select private.portal_has_active_role(array['staff'])));
create policy "Public reads published scholarship requirements" on public.scholarship_document_requirements for select to anon, authenticated
  using (exists (select 1 from public.scholarships s where s.id = scholarship_id and s.status in ('published','closed')));
create policy "Staff reads all scholarship requirements" on public.scholarship_document_requirements for select to authenticated
  using ((select private.portal_has_active_role(array['staff'])));
create policy "Public reads published scholarship criteria" on public.scholarship_review_criteria for select to anon, authenticated
  using (exists (select 1 from public.scholarships s where s.id = scholarship_id and s.status in ('published','closed')));
create policy "Staff reads all scholarship criteria" on public.scholarship_review_criteria for select to authenticated
  using ((select private.portal_has_active_role(array['staff'])));

create policy "Students read own applications" on public.applications for select to authenticated
  using (student_id = (select auth.uid()));
create policy "Staff read applications" on public.applications for select to authenticated
  using ((select private.portal_has_active_role(array['staff'])));
create policy "Committee read assigned applications" on public.applications for select to authenticated
  using (exists (select 1 from public.review_assignments r where r.application_id = id and r.reviewer_id = (select auth.uid()) and r.status in ('assigned','completed')));

create policy "Students and staff read payment accounts" on public.application_payment_accounts for select to authenticated
  using ((select private.portal_has_active_role(array['staff'])) or exists (select 1 from public.applications a where a.id = application_id and a.student_id = (select auth.uid())));

create policy "Students read own documents" on public.application_documents for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and a.student_id = (select auth.uid())));
create policy "Staff read documents" on public.application_documents for select to authenticated
  using ((select private.portal_has_active_role(array['staff'])));
create policy "Committee read assigned documents" on public.application_documents for select to authenticated
  using (exists (select 1 from public.review_assignments r where r.application_id = application_documents.application_id and r.reviewer_id = (select auth.uid()) and r.status in ('assigned','completed')));

create policy "Staff and committee read assignments" on public.review_assignments for select to authenticated
  using ((select private.portal_has_active_role(array['staff'])) or reviewer_id = (select auth.uid()));
create policy "Staff and assigned committee read evaluations" on public.evaluations for select to authenticated
  using ((select private.portal_has_active_role(array['staff'])) or exists (select 1 from public.review_assignments r where r.id = assignment_id and r.reviewer_id = (select auth.uid())));
create policy "Students read visible status history" on public.application_status_history for select to authenticated
  using (visible_to_student and exists (select 1 from public.applications a where a.id = application_id and a.student_id = (select auth.uid())));
create policy "Staff read status history" on public.application_status_history for select to authenticated
  using ((select private.portal_has_active_role(array['staff'])));
create policy "Assigned committee read status history" on public.application_status_history for select to authenticated
  using (exists (select 1 from public.review_assignments r where r.application_id = application_status_history.application_id and r.reviewer_id = (select auth.uid()) and r.status in ('assigned','completed')));
create policy "Members read own notifications" on public.portal_notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Students and staff read disbursements" on public.disbursements for select to authenticated
  using ((select private.portal_has_active_role(array['staff'])) or exists (select 1 from public.applications a where a.id = application_id and a.student_id = (select auth.uid())));

-- Staff need a narrow directory of active committee members in order to assign reviews.
create policy "Staff read active committee members" on public.portal_profiles for select to authenticated
  using (role = 'committee' and active and (select private.portal_has_active_role(array['staff'])));

create function private.portal_add_status_history(
  p_application_id uuid, p_from text, p_to text, p_reason text, p_visible boolean
) returns void language sql security definer set search_path = '' as $$
  insert into public.application_status_history(application_id, from_status, to_status, reason, visible_to_student, actor_id)
  values(p_application_id, p_from, p_to, btrim(p_reason), p_visible, auth.uid());
$$;
revoke all on function private.portal_add_status_history(uuid,text,text,text,boolean) from public, anon, authenticated;

create function public.staff_save_scholarship(
  p_id uuid, p_version integer, p_title text, p_type_id uuid, p_description text, p_eligibility text,
  p_amount numeric, p_quota integer, p_minimum_gpa numeric, p_opens_at timestamptz, p_closes_at timestamptz,
  p_status text, p_requirements jsonb, p_criteria jsonb, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare old_row public.scholarships; new_row public.scholarships; v_id uuid; v_has_applications boolean;
begin
  perform private.portal_require_active_role(array['staff']);
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'Reason required' using errcode = '22023'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 3 and 200 or p_description is null or char_length(p_description) > 5000
     or p_eligibility is null or char_length(p_eligibility) > 5000 or p_amount is null or p_amount <= 0 or p_quota is null or p_quota < 1
     or p_minimum_gpa is not null and (p_minimum_gpa < 0 or p_minimum_gpa > 4) or p_opens_at is null or p_closes_at is null or p_opens_at >= p_closes_at
     or p_status not in ('draft','published','closed','archived') or jsonb_typeof(p_requirements) <> 'array' or jsonb_typeof(p_criteria) <> 'array' then
    raise exception 'Invalid scholarship data' using errcode = '22023';
  end if;
  if p_type_id is not null and not exists(select 1 from public.portal_reference_data where id=p_type_id and kind='scholarship_type' and active) then
    raise exception 'Invalid scholarship type' using errcode = '22023';
  end if;
  if jsonb_array_length(p_criteria) = 0 or jsonb_array_length(p_criteria) > 20 or jsonb_array_length(p_requirements) > 30 then
    raise exception 'At least one criterion and valid list sizes are required' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_criteria) as x(label text, details text, max_score numeric, sort_order integer)
    where x.label is null or char_length(btrim(x.label)) not between 2 and 150 or coalesce(char_length(x.details),0)>1000 or x.max_score is null or x.max_score<=0 or x.max_score>1000 or x.sort_order not between 1 and 100)
    or exists(select 1 from jsonb_to_recordset(p_requirements) as x(label text, details text, required boolean, sort_order integer)
    where x.label is null or char_length(btrim(x.label)) not between 2 and 150 or coalesce(char_length(x.details),0)>1000 or x.required is null or x.sort_order not between 1 and 100) then
    raise exception 'Invalid requirement or criterion' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.scholarships(title,scholarship_type_id,description,eligibility,amount,quota,minimum_gpa,opens_at,closes_at,status,created_by)
    values(btrim(p_title),p_type_id,btrim(p_description),btrim(p_eligibility),p_amount,p_quota,p_minimum_gpa,p_opens_at,p_closes_at,p_status,auth.uid()) returning * into new_row;
    v_id := new_row.id;
  else
    select * into old_row from public.scholarships where id=p_id for update;
    if not found then raise exception 'Scholarship not found' using errcode = 'P0002'; end if;
    if p_version is distinct from old_row.version then raise exception 'STALE_VERSION' using errcode = '40001'; end if;
    select exists(select 1 from public.applications where scholarship_id=p_id) into v_has_applications;
    if v_has_applications and (p_requirements is distinct from (select coalesce(jsonb_agg(jsonb_build_object('label',label,'details',details,'required',required,'sort_order',sort_order) order by sort_order),'[]'::jsonb) from public.scholarship_document_requirements where scholarship_id=p_id)
      or p_criteria is distinct from (select coalesce(jsonb_agg(jsonb_build_object('label',label,'details',details,'max_score',max_score,'sort_order',sort_order) order by sort_order),'[]'::jsonb) from public.scholarship_review_criteria where scholarship_id=p_id)) then
      raise exception 'Requirements and criteria cannot change after applications exist' using errcode = '22023';
    end if;
    update public.scholarships set title=btrim(p_title),scholarship_type_id=p_type_id,description=btrim(p_description),eligibility=btrim(p_eligibility),amount=p_amount,quota=p_quota,minimum_gpa=p_minimum_gpa,opens_at=p_opens_at,closes_at=p_closes_at,status=p_status,version=version+1,updated_at=now()
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
revoke all on function public.staff_save_scholarship(uuid,integer,text,uuid,text,text,numeric,integer,numeric,timestamptz,timestamptz,text,jsonb,jsonb,text) from public, anon;
grant execute on function public.staff_save_scholarship(uuid,integer,text,uuid,text,text,numeric,integer,numeric,timestamptz,timestamptz,text,jsonb,jsonb,text) to authenticated;

create function public.student_save_application(
  p_application_id uuid, p_version integer, p_scholarship_id uuid, p_data jsonb, p_bank_name text,
  p_account_holder text, p_account_number text, p_submit boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare old_row public.applications; new_row public.applications; v_scholarship public.scholarships; v_student public.portal_profiles; v_missing integer; v_id uuid;
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
    if char_length(btrim(coalesce(p_data->>'faculty',''))) < 2 or char_length(btrim(coalesce(p_data->>'major',''))) < 2 or coalesce(p_data->>'gpa','') !~ '^(0|[0-3](\.[0-9]{1,2})?|4(\.0{1,2})?)$'
      or char_length(btrim(coalesce(p_data->>'reason',''))) < 20 then raise exception 'Complete faculty, major, GPA and application reason before submitting' using errcode='22023'; end if;
    if not exists(select 1 from public.application_payment_accounts where application_id=v_id) then raise exception 'Bank account details are required' using errcode='22023'; end if;
    select count(*) into v_missing from public.scholarship_document_requirements r where r.scholarship_id=p_scholarship_id and r.required and not exists(
      select 1 from public.application_documents d where d.application_id=v_id and d.requirement_id=r.id
    );
    if v_missing > 0 then raise exception 'Required documents are missing' using errcode='22023'; end if;
    update public.applications set status='submitted',submitted_at=coalesce(submitted_at,now()),version=version+1,updated_at=now() where id=v_id returning * into new_row;
    perform private.portal_add_status_history(v_id,old_row.status,'submitted','ส่งใบสมัครเพื่อรอตรวจเอกสาร',true);
    perform private.portal_write_audit('submit_application','application',v_id,case when old_row.id is null then null else to_jsonb(old_row) end,to_jsonb(new_row),'นักศึกษาส่งใบสมัคร');
  elsif old_row.id is not null then
    perform private.portal_write_audit('save_application_draft','application',v_id,to_jsonb(old_row),to_jsonb(new_row),'บันทึกร่างใบสมัคร');
  end if;
  return v_id;
end;
$$;
revoke all on function public.student_save_application(uuid,integer,uuid,jsonb,text,text,text,boolean) from public, anon;
grant execute on function public.student_save_application(uuid,integer,uuid,jsonb,text,text,text,boolean) to authenticated;

create function public.student_replace_application_document(
  p_application_id uuid, p_requirement_id uuid, p_file_path text, p_file_name text, p_mime_type text, p_file_size integer
) returns text language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_old_path text; v_expected_prefix text;
begin
  perform private.portal_require_active_role(array['student']);
  select * into v_app from public.applications where id=p_application_id for update;
  if not found or v_app.student_id <> auth.uid() then raise exception 'Application not found' using errcode='42501'; end if;
  if v_app.status not in ('draft','revision_requested') then raise exception 'Documents cannot be replaced now' using errcode='22023'; end if;
  v_expected_prefix:=auth.uid()::text||'/'||p_application_id::text||'/';
  if p_file_path is null or left(p_file_path,char_length(v_expected_prefix))<>v_expected_prefix or p_file_name is null or char_length(p_file_name) not between 1 and 255
    or p_mime_type not in ('application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document') or p_file_size not between 1 and 10485760 then
    raise exception 'Invalid document metadata' using errcode='22023';
  end if;
  if not exists(select 1 from public.scholarship_document_requirements where id=p_requirement_id and scholarship_id=v_app.scholarship_id) then
    raise exception 'Invalid document requirement' using errcode='22023';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='scholarship-documents' and name=p_file_path) then raise exception 'Uploaded file not found' using errcode='22023'; end if;
  select file_path into v_old_path from public.application_documents where application_id=p_application_id and requirement_id=p_requirement_id for update;
  insert into public.application_documents(application_id,requirement_id,file_path,file_name,mime_type,file_size)
  values(p_application_id,p_requirement_id,p_file_path,p_file_name,p_mime_type,p_file_size)
  on conflict(application_id,requirement_id) do update set file_path=excluded.file_path,file_name=excluded.file_name,mime_type=excluded.mime_type,file_size=excluded.file_size,status='pending',feedback=null,checked_by=null,checked_at=null,version=application_documents.version+1,uploaded_at=now(),updated_at=now();
  perform private.portal_write_audit('replace_application_document','application_document',coalesce((select id from public.application_documents where application_id=p_application_id and requirement_id=p_requirement_id),p_application_id),null,
    jsonb_build_object('application_id',p_application_id,'requirement_id',p_requirement_id,'file_name',p_file_name),'อัปโหลดเอกสารประกอบใบสมัคร');
  return v_old_path;
end;
$$;
revoke all on function public.student_replace_application_document(uuid,uuid,text,text,text,integer) from public, anon;
grant execute on function public.student_replace_application_document(uuid,uuid,text,text,text,integer) to authenticated;

create function public.staff_review_application_documents(
  p_application_id uuid, p_version integer, p_documents jsonb, p_action text, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare old_row public.applications; new_row public.applications; v_invalid integer; v_revision integer;
begin
  perform private.portal_require_active_role(array['staff']);
  if jsonb_typeof(p_documents) <> 'array' or p_action not in ('verify','request_revision') or p_reason is null or char_length(btrim(p_reason)) not between 3 and 2000 then
    raise exception 'Invalid review request' using errcode='22023';
  end if;
  select * into old_row from public.applications where id=p_application_id for update;
  if not found then raise exception 'Application not found' using errcode='P0002'; end if;
  if p_version is distinct from old_row.version then raise exception 'STALE_VERSION' using errcode='40001'; end if;
  if old_row.status not in ('submitted','revision_requested') then raise exception 'Application is not awaiting document review' using errcode='22023'; end if;
  select count(*) into v_invalid from jsonb_to_recordset(p_documents) as x(id uuid,status text,feedback text)
  where x.id is null or x.status not in ('verified','revision_required') or coalesce(char_length(x.feedback),0)>2000
     or not exists(select 1 from public.application_documents d where d.id=x.id and d.application_id=p_application_id);
  if v_invalid > 0 then raise exception 'Invalid document review data' using errcode='22023'; end if;
  update public.application_documents d set status=x.status,feedback=nullif(btrim(coalesce(x.feedback,'')),''),checked_by=auth.uid(),checked_at=now(),version=d.version+1,updated_at=now()
  from jsonb_to_recordset(p_documents) as x(id uuid,status text,feedback text) where d.id=x.id and d.application_id=p_application_id;
  if p_action='verify' then
    if exists(select 1 from public.scholarship_document_requirements r where r.scholarship_id=old_row.scholarship_id and r.required and not exists(select 1 from public.application_documents d where d.application_id=p_application_id and d.requirement_id=r.id and d.status='verified')) then
      raise exception 'All required documents must be verified first' using errcode='22023';
    end if;
    update public.applications set status='ready_for_review',version=version+1,updated_at=now() where id=p_application_id returning * into new_row;
    perform private.portal_add_status_history(p_application_id,old_row.status,'ready_for_review',p_reason,true);
    perform private.portal_notify(old_row.student_id,'documents_verified','เอกสารผ่านการตรวจสอบ','เอกสารของคุณผ่านการตรวจสอบแล้ว รอการพิจารณาจากกรรมการ','/applications/'||p_application_id::text);
  else
    select count(*) into v_revision from public.application_documents where application_id=p_application_id and status='revision_required';
    if v_revision=0 then raise exception 'Mark at least one document for revision' using errcode='22023'; end if;
    update public.applications set status='revision_requested',version=version+1,updated_at=now() where id=p_application_id returning * into new_row;
    perform private.portal_add_status_history(p_application_id,old_row.status,'revision_requested',p_reason,true);
    perform private.portal_notify(old_row.student_id,'revision_requested','กรุณาแก้ไขเอกสาร','เจ้าหน้าที่ขอให้แก้ไขเอกสารประกอบใบสมัคร โปรดเปิดใบสมัครเพื่อดูรายละเอียด','/applications/'||p_application_id::text);
  end if;
  perform private.portal_write_audit('review_application_documents','application',p_application_id,to_jsonb(old_row),to_jsonb(new_row),p_reason);
end;
$$;
revoke all on function public.staff_review_application_documents(uuid,integer,jsonb,text,text) from public, anon;
grant execute on function public.staff_review_application_documents(uuid,integer,jsonb,text,text) to authenticated;

create function public.staff_assign_reviewer(p_application_id uuid,p_reviewer_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_assignment public.review_assignments;
begin
  perform private.portal_require_active_role(array['staff']);
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
  select * into v_app from public.applications where id=p_application_id for update;
  if not found or v_app.status not in ('ready_for_review','committee_review') then raise exception 'Application is not ready for committee review' using errcode='22023'; end if;
  if not exists(select 1 from public.portal_profiles where id=p_reviewer_id and active and role='committee') then raise exception 'Reviewer must be an active committee member' using errcode='22023'; end if;
  insert into public.review_assignments(application_id,reviewer_id,assigned_by,reason)
  values(p_application_id,p_reviewer_id,auth.uid(),btrim(p_reason))
  on conflict(application_id,reviewer_id) do update set status='assigned',assigned_by=excluded.assigned_by,reason=excluded.reason,assigned_at=now(),completed_at=null
  returning * into v_assignment;
  if v_app.status='ready_for_review' then
    update public.applications set status='committee_review',version=version+1,updated_at=now() where id=p_application_id;
    perform private.portal_add_status_history(p_application_id,'ready_for_review','committee_review','มอบหมายกรรมการพิจารณา',true);
  end if;
  perform private.portal_notify(p_reviewer_id,'review_assigned','ได้รับมอบหมายให้พิจารณาใบสมัคร','มีใบสมัครทุนที่รอผลประเมินจากคุณ','/staff/evaluation?assignment='||v_assignment.id::text);
  perform private.portal_write_audit('assign_reviewer','review_assignment',v_assignment.id,null,to_jsonb(v_assignment),p_reason);
  return v_assignment.id;
end;
$$;
revoke all on function public.staff_assign_reviewer(uuid,uuid,text) from public, anon;
grant execute on function public.staff_assign_reviewer(uuid,uuid,text) to authenticated;

create function public.committee_save_evaluation(
  p_assignment_id uuid,p_version integer,p_scores jsonb,p_recommendation text,p_comment text,p_submit boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_assignment public.review_assignments; v_app public.applications; v_criterion record; v_score numeric; v_total numeric:=0; v_count integer:=0; old_row public.evaluations; new_row public.evaluations;
begin
  perform private.portal_require_active_role(array['committee']);
  if jsonb_typeof(p_scores)<>'array' or p_recommendation not in ('approve','reserve','reject') or p_comment is null or char_length(p_comment)>2000 then raise exception 'Invalid evaluation data' using errcode='22023'; end if;
  select * into v_assignment from public.review_assignments where id=p_assignment_id for update;
  if not found or v_assignment.reviewer_id<>auth.uid() or v_assignment.status<>'assigned' then raise exception 'Review assignment is not available' using errcode='42501'; end if;
  select * into v_app from public.applications where id=v_assignment.application_id;
  if v_app.status<>'committee_review' then raise exception 'Application is not in committee review' using errcode='22023'; end if;
  for v_criterion in select id,max_score from public.scholarship_review_criteria where scholarship_id=v_app.scholarship_id order by sort_order loop
    v_count:=v_count+1;
    select nullif(x.score,'')::numeric into v_score from jsonb_to_recordset(p_scores) as x(criterion_id uuid,score text,comment text) where x.criterion_id=v_criterion.id;
    if v_score is null or v_score<0 or v_score>v_criterion.max_score then raise exception 'Every criterion needs a valid score' using errcode='22023'; end if;
    v_total:=v_total+v_score;
  end loop;
  if v_count=0 or jsonb_array_length(p_scores)<>v_count then raise exception 'Evaluation criteria do not match' using errcode='22023'; end if;
  select * into old_row from public.evaluations where assignment_id=p_assignment_id for update;
  if found and p_version is distinct from old_row.version then raise exception 'STALE_VERSION' using errcode='40001'; end if;
  if found and old_row.submitted_at is not null then raise exception 'Submitted evaluation cannot be changed' using errcode='22023'; end if;
  insert into public.evaluations(assignment_id,scores,total_score,recommendation,comment,submitted_at)
  values(p_assignment_id,p_scores,v_total,p_recommendation,btrim(p_comment),case when p_submit then now() else null end)
  on conflict(assignment_id) do update set scores=excluded.scores,total_score=excluded.total_score,recommendation=excluded.recommendation,comment=excluded.comment,submitted_at=case when p_submit then now() else null end,version=public.evaluations.version+1,updated_at=now()
  returning * into new_row;
  if p_submit then
    update public.review_assignments set status='completed',completed_at=now() where id=p_assignment_id;
    perform private.portal_notify(v_assignment.assigned_by,'evaluation_submitted','กรรมการส่งผลประเมินแล้ว','มีผลประเมินใหม่สำหรับใบสมัครที่คุณมอบหมาย','/staff/review?application='||v_app.id::text);
  end if;
  perform private.portal_write_audit(case when p_submit then 'submit_evaluation' else 'save_evaluation_draft' end,'evaluation',new_row.id,case when found then to_jsonb(old_row) else null end,to_jsonb(new_row),case when p_submit then 'กรรมการส่งผลประเมิน' else 'กรรมการบันทึกร่างผลประเมิน' end);
end;
$$;
revoke all on function public.committee_save_evaluation(uuid,integer,jsonb,text,text,boolean) from public, anon;
grant execute on function public.committee_save_evaluation(uuid,integer,jsonb,text,text,boolean) to authenticated;

create function public.staff_decide_application(p_application_id uuid,p_version integer,p_decision text,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare old_row public.applications; new_row public.applications; v_scholarship public.scholarships; v_approved integer;
begin
  perform private.portal_require_active_role(array['staff']);
  if p_decision not in ('approved','reserve','rejected') or p_reason is null or char_length(btrim(p_reason)) not between 3 and 2000 then raise exception 'Invalid final decision' using errcode='22023'; end if;
  select * into old_row from public.applications where id=p_application_id for update;
  if not found or old_row.status<>'committee_review' then raise exception 'Application is not ready for final decision' using errcode='22023'; end if;
  if p_version is distinct from old_row.version then raise exception 'STALE_VERSION' using errcode='40001'; end if;
  if not exists(select 1 from public.review_assignments where application_id=p_application_id and status='completed') then raise exception 'At least one committee evaluation is required' using errcode='22023'; end if;
  select * into v_scholarship from public.scholarships where id=old_row.scholarship_id for update;
  if p_decision='approved' then
    select count(*) into v_approved from public.applications where scholarship_id=v_scholarship.id and status='approved';
    if v_approved>=v_scholarship.quota then raise exception 'Scholarship quota has been filled' using errcode='22023'; end if;
  end if;
  update public.applications set status=p_decision,decided_by=auth.uid(),decided_at=now(),decision_reason=btrim(p_reason),version=version+1,updated_at=now() where id=p_application_id returning * into new_row;
  perform private.portal_add_status_history(p_application_id,old_row.status,p_decision,p_reason,true);
  perform private.portal_notify(old_row.student_id,'final_decision',case p_decision when 'approved' then 'ใบสมัครได้รับการอนุมัติ' when 'reserve' then 'ใบสมัครอยู่ในรายชื่อสำรอง' else 'ผลการพิจารณาใบสมัคร' end,
    'เปิดใบสมัครเพื่อดูผลการพิจารณาและรายละเอียดจากเจ้าหน้าที่','/applications/'||p_application_id::text);
  perform private.portal_write_audit('finalize_application','application',p_application_id,to_jsonb(old_row),to_jsonb(new_row),p_reason);
end;
$$;
revoke all on function public.staff_decide_application(uuid,integer,text,text) from public, anon;
grant execute on function public.staff_decide_application(uuid,integer,text,text) to authenticated;

create function public.staff_record_disbursement(
  p_application_id uuid,p_version integer,p_amount numeric,p_status text,p_transfer_date date,p_transfer_reference text,p_proof_path text,p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_account public.application_payment_accounts; old_row public.disbursements; new_row public.disbursements; v_max_amount numeric;
begin
  perform private.portal_require_active_role(array['staff']);
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 or p_amount is null or p_amount<=0 or p_status not in ('pending','paid','failed') then raise exception 'Invalid disbursement data' using errcode='22023'; end if;
  select a.* into v_app from public.applications a where a.id=p_application_id for update;
  select amount into v_max_amount from public.scholarships where id=v_app.scholarship_id;
  if not found or v_app.status<>'approved' then raise exception 'Only approved applications can be disbursed' using errcode='22023'; end if;
  if p_amount>v_max_amount then raise exception 'Amount exceeds scholarship amount' using errcode='22023'; end if;
  if p_status='paid' and (p_transfer_date is null or char_length(btrim(coalesce(p_transfer_reference,''))) not between 3 and 120) then raise exception 'Paid transfers require date and reference' using errcode='22023'; end if;
  if p_proof_path is not null and not exists(select 1 from storage.objects where bucket_id='scholarship-payment-proofs' and name=p_proof_path) then raise exception 'Payment proof not found' using errcode='22023'; end if;
  select * into v_account from public.application_payment_accounts where application_id=p_application_id;
  if not found then raise exception 'Payment account not found' using errcode='22023'; end if;
  select * into old_row from public.disbursements where application_id=p_application_id for update;
  if found and p_version is distinct from old_row.version then raise exception 'STALE_VERSION' using errcode='40001'; end if;
  insert into public.disbursements(application_id,amount,status,transfer_date,transfer_reference,proof_path,bank_name_snapshot,account_holder_snapshot,account_number_snapshot,recorded_by)
  values(p_application_id,p_amount,p_status,p_transfer_date,nullif(btrim(coalesce(p_transfer_reference,'')),''),p_proof_path,v_account.bank_name,v_account.account_holder,v_account.account_number,auth.uid())
  on conflict(application_id) do update set amount=excluded.amount,status=excluded.status,transfer_date=excluded.transfer_date,transfer_reference=excluded.transfer_reference,proof_path=excluded.proof_path,bank_name_snapshot=excluded.bank_name_snapshot,account_holder_snapshot=excluded.account_holder_snapshot,account_number_snapshot=excluded.account_number_snapshot,recorded_by=excluded.recorded_by,version=public.disbursements.version+1,updated_at=now()
  returning * into new_row;
  if p_status='paid' then
    perform private.portal_notify(v_app.student_id,'disbursement_paid','บันทึกการโอนทุนแล้ว','เจ้าหน้าที่บันทึกการจ่ายทุนของคุณแล้ว','/applications/'||p_application_id::text);
  end if;
  perform private.portal_write_audit(case when found then 'update_disbursement' else 'create_disbursement' end,'disbursement',new_row.id,case when found then to_jsonb(old_row) else null end,to_jsonb(new_row),p_reason);
  return new_row.id;
end;
$$;
revoke all on function public.staff_record_disbursement(uuid,integer,numeric,text,date,text,text,text) from public, anon;
grant execute on function public.staff_record_disbursement(uuid,integer,numeric,text,date,text,text,text) to authenticated;

create function public.mark_my_notification_read(p_notification_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.portal_notifications where id=p_notification_id and user_id=auth.uid()) then raise exception 'Notification not found' using errcode='42501'; end if;
  update public.portal_notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=auth.uid();
end;
$$;
revoke all on function public.mark_my_notification_read(uuid) from public, anon;
grant execute on function public.mark_my_notification_read(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('scholarship-documents','scholarship-documents',false,10485760,array['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('scholarship-payment-proofs','scholarship-payment-proofs',false,5242880,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function private.portal_can_upload_application_document(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.portal_has_active_role(array['student'])) and exists (
    select 1 from public.applications a
    where a.id::text = split_part(p_path,'/',2) and a.student_id = auth.uid() and a.status in ('draft','revision_requested')
      and split_part(p_path,'/',1) = auth.uid()::text and split_part(p_path,'/',3) <> ''
  );
$$;
create function private.portal_can_read_application_document(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.portal_has_active_role(array['staff'])) or exists(
    select 1 from public.application_documents d join public.applications a on a.id=d.application_id
    where d.file_path=p_path and a.student_id=auth.uid()
  ) or exists(
    select 1 from public.application_documents d join public.review_assignments r on r.application_id=d.application_id
    where d.file_path=p_path and r.reviewer_id=auth.uid() and r.status in ('assigned','completed')
  );
$$;
create function private.portal_can_delete_application_document(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.portal_has_active_role(array['student'])) and split_part(p_path,'/',1)=auth.uid()::text
    and not exists(select 1 from public.application_documents where file_path=p_path);
$$;
create function private.portal_can_upload_payment_proof(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.portal_has_active_role(array['staff'])) and split_part(p_path,'/',1) ~ '^[0-9a-f-]{36}$' and split_part(p_path,'/',2) <> '';
$$;
create function private.portal_can_read_payment_proof(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.portal_has_active_role(array['staff'])) or exists(
    select 1 from public.disbursements d join public.applications a on a.id=d.application_id
    where d.proof_path=p_path and a.student_id=auth.uid()
  );
$$;
create function private.portal_can_delete_payment_proof(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.portal_has_active_role(array['staff'])) and not exists(select 1 from public.disbursements where proof_path=p_path);
$$;
revoke all on function private.portal_can_upload_application_document(text), private.portal_can_read_application_document(text), private.portal_can_delete_application_document(text), private.portal_can_upload_payment_proof(text), private.portal_can_read_payment_proof(text), private.portal_can_delete_payment_proof(text) from public, anon;
grant execute on function private.portal_can_upload_application_document(text), private.portal_can_read_application_document(text), private.portal_can_delete_application_document(text), private.portal_can_upload_payment_proof(text), private.portal_can_read_payment_proof(text), private.portal_can_delete_payment_proof(text) to authenticated;

create policy "Students upload application documents" on storage.objects for insert to authenticated with check (
  bucket_id='scholarship-documents' and (select private.portal_can_upload_application_document(name))
);
create policy "Allowed members read application documents" on storage.objects for select to authenticated using (
  bucket_id='scholarship-documents' and (select private.portal_can_read_application_document(name))
);
create policy "Students remove replaced application documents" on storage.objects for delete to authenticated using (
  bucket_id='scholarship-documents' and (select private.portal_can_delete_application_document(name))
);
create policy "Staff upload payment proofs" on storage.objects for insert to authenticated with check (
  bucket_id='scholarship-payment-proofs' and (select private.portal_can_upload_payment_proof(name))
);
create policy "Allowed members read payment proofs" on storage.objects for select to authenticated using (
  bucket_id='scholarship-payment-proofs' and (select private.portal_can_read_payment_proof(name))
);
create policy "Staff remove replaced payment proofs" on storage.objects for delete to authenticated using (
  bucket_id='scholarship-payment-proofs' and (select private.portal_can_delete_payment_proof(name))
);

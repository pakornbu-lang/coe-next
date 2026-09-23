-- Preserve each uploaded file and its review result independently of application status history.
alter table public.application_documents
  add column revision_no integer not null default 1 check (revision_no > 0);

create table public.application_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.application_documents(id) on delete cascade,
  revision_no integer not null check (revision_no > 0),
  file_path text not null unique check (char_length(file_path) between 10 and 500),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size integer not null check (file_size between 1 and 10485760),
  status text not null default 'pending' check (status in ('pending','verified','revision_required')),
  feedback text,
  checked_by uuid references public.portal_profiles(id),
  checked_at timestamptz,
  uploaded_at timestamptz not null default now(),
  -- Set only after the university approves a retention policy. No automatic deletion is enabled.
  retain_until timestamptz,
  unique (document_id, revision_no)
);
create index application_document_versions_document_idx
  on public.application_document_versions(document_id, revision_no desc);

-- Existing files have no recoverable earlier revisions; backfill only their current file.
insert into public.application_document_versions
  (document_id, revision_no, file_path, file_name, mime_type, file_size, status, feedback, checked_by, checked_at, uploaded_at)
select id, 1, file_path, file_name, mime_type, file_size, status, feedback, checked_by, checked_at, uploaded_at
from public.application_documents;

alter table public.application_document_versions enable row level security;
revoke all on public.application_document_versions from anon, authenticated;
grant select on public.application_document_versions to authenticated;
grant all on public.application_document_versions to service_role;
create policy "Students and staff read document versions"
  on public.application_document_versions for select to authenticated
  using (
    (select private.portal_has_active_role(array['staff']))
    or ((select private.portal_has_active_role(array['student'])) and exists (
      select 1 from public.application_documents d
      join public.applications a on a.id=d.application_id
      where d.id=document_id and a.student_id=(select auth.uid())
    ))
  );

-- All new document uploads go through the server action after content inspection.
drop policy if exists "Students upload application documents" on storage.objects;

-- Committee access remains limited to the file referenced by application_documents.
create or replace function private.portal_can_read_application_document(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.portal_has_active_role(array['staff'])) or exists (
    select 1 from public.application_documents d join public.applications a on a.id=d.application_id
    where d.file_path=p_path and a.student_id=auth.uid()
  ) or exists (
    select 1 from public.application_document_versions v
    join public.application_documents d on d.id=v.document_id
    join public.applications a on a.id=d.application_id
    where v.file_path=p_path and a.student_id=auth.uid()
      and (select private.portal_has_active_role(array['student']))
  ) or exists (
    select 1 from public.application_documents d join public.review_assignments r on r.application_id=d.application_id
    where d.file_path=p_path and r.reviewer_id=auth.uid() and r.status in ('assigned','completed')
  );
$$;

create or replace function private.portal_can_delete_application_document(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.portal_has_active_role(array['student'])) and split_part(p_path,'/',1)=auth.uid()::text
    and not exists(select 1 from public.application_documents where file_path=p_path)
    and not exists(select 1 from public.application_document_versions where file_path=p_path);
$$;

create or replace function public.student_replace_application_document(
  p_application_id uuid, p_requirement_id uuid, p_file_path text, p_file_name text, p_mime_type text, p_file_size integer
) returns text language plpgsql security definer set search_path = '' as $$
declare v_app public.applications; v_old_path text; v_expected_prefix text; v_document public.application_documents;
begin
  perform private.portal_require_active_role(array['student']);
  select * into v_app from public.applications where id=p_application_id for update;
  if not found or v_app.student_id <> auth.uid() then raise exception 'Application not found' using errcode='42501'; end if;
  if v_app.status not in ('draft','revision_requested') then raise exception 'Documents cannot be replaced now' using errcode='22023'; end if;
  v_expected_prefix:=auth.uid()::text||'/'||p_application_id::text||'/';
  if p_file_path is null or left(p_file_path,char_length(v_expected_prefix))<>v_expected_prefix
    or p_file_name is null or char_length(p_file_name) not between 1 and 255
    or p_mime_type not in ('application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    or p_file_size not between 1 and 10485760 then
    raise exception 'Invalid document metadata' using errcode='22023';
  end if;
  if not exists(select 1 from public.scholarship_document_requirements where id=p_requirement_id and scholarship_id=v_app.scholarship_id) then
    raise exception 'Invalid document requirement' using errcode='22023';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='scholarship-documents' and name=p_file_path) then
    raise exception 'Uploaded file not found' using errcode='22023';
  end if;
  if exists(select 1 from public.application_document_versions where file_path=p_file_path) then
    raise exception 'Document file already belongs to a version' using errcode='23505';
  end if;
  select file_path into v_old_path from public.application_documents
    where application_id=p_application_id and requirement_id=p_requirement_id for update;
  insert into public.application_documents(application_id,requirement_id,file_path,file_name,mime_type,file_size)
  values(p_application_id,p_requirement_id,p_file_path,p_file_name,p_mime_type,p_file_size)
  on conflict(application_id,requirement_id) do update set
    file_path=excluded.file_path,file_name=excluded.file_name,mime_type=excluded.mime_type,file_size=excluded.file_size,
    status='pending',feedback=null,checked_by=null,checked_at=null,
    version=application_documents.version+1,revision_no=application_documents.revision_no+1,
    uploaded_at=now(),updated_at=now()
  returning * into v_document;
  insert into public.application_document_versions
    (document_id,revision_no,file_path,file_name,mime_type,file_size,uploaded_at)
  values (v_document.id,v_document.revision_no,p_file_path,p_file_name,p_mime_type,p_file_size,v_document.uploaded_at);
  perform private.portal_write_audit('replace_application_document','application_document',v_document.id,null,
    jsonb_build_object('application_id',p_application_id,'requirement_id',p_requirement_id,'revision_no',v_document.revision_no,'file_name',p_file_name),
    'อัปโหลดเอกสารประกอบใบสมัคร');
  return v_old_path;
end;
$$;

create or replace function public.staff_review_application_documents(
  p_application_id uuid, p_version integer, p_documents jsonb, p_action text, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare old_row public.applications; new_row public.applications; v_total integer; v_submitted integer; v_distinct integer; v_invalid integer; v_revision integer;
begin
  perform private.portal_require_active_role(array['staff']);
  if p_documents is null or jsonb_typeof(p_documents) <> 'array'
    or p_action is null or p_action not in ('verify','request_revision')
    or p_reason is null or char_length(btrim(p_reason)) not between 3 and 2000 then
    raise exception 'Invalid review request' using errcode='22023';
  end if;
  select * into old_row from public.applications where id=p_application_id for update;
  if not found then raise exception 'Application not found' using errcode='P0002'; end if;
  if p_version is distinct from old_row.version then raise exception 'STALE_VERSION' using errcode='40001'; end if;
  if old_row.status not in ('submitted','revision_requested') then
    raise exception 'Application is not awaiting document review' using errcode='22023';
  end if;
  select count(*) into v_total from public.application_documents where application_id=p_application_id;
  select count(*),count(distinct x.id) into v_submitted,v_distinct
    from jsonb_to_recordset(p_documents) as x(id uuid,version integer,status text,feedback text);
  if v_submitted<>v_total or v_distinct<>v_total then
    raise exception 'Every document must be reviewed exactly once' using errcode='22023';
  end if;
  select count(*) into v_invalid
    from jsonb_to_recordset(p_documents) as x(id uuid,version integer,status text,feedback text)
    where x.id is null or x.version is null or x.status is null or x.status not in ('verified','revision_required')
      or coalesce(char_length(x.feedback),0)>2000
      or (x.status='revision_required' and char_length(btrim(coalesce(x.feedback,'')))<3)
      or not exists (
        select 1 from public.application_documents d
        where d.id=x.id and d.application_id=p_application_id
      );
  if v_invalid>0 then raise exception 'Invalid document review data' using errcode='22023'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_documents) as x(id uuid,version integer,status text,feedback text)
    join public.application_documents d on d.id=x.id
    where d.application_id=p_application_id and d.version<>x.version
  ) then raise exception 'STALE_VERSION' using errcode='40001'; end if;
  if p_action='verify' and exists (
    select 1 from jsonb_to_recordset(p_documents) as x(id uuid,version integer,status text,feedback text)
    where x.status<>'verified'
  ) then raise exception 'All uploaded documents must be verified first' using errcode='22023'; end if;
  update public.application_documents d set
    status=x.status,feedback=nullif(btrim(coalesce(x.feedback,'')),''),checked_by=auth.uid(),checked_at=now(),
    version=d.version+1,updated_at=now()
  from jsonb_to_recordset(p_documents) as x(id uuid,version integer,status text,feedback text)
  where d.id=x.id and d.application_id=p_application_id;
  update public.application_document_versions v set
    status=d.status,feedback=d.feedback,checked_by=d.checked_by,checked_at=d.checked_at
  from public.application_documents d
  where v.document_id=d.id and v.revision_no=d.revision_no and d.application_id=p_application_id;
  if p_action='verify' then
    if exists (
      select 1 from public.scholarship_document_requirements r
      where r.scholarship_id=old_row.scholarship_id and r.required
        and not exists (
          select 1 from public.application_documents d
          where d.application_id=p_application_id and d.requirement_id=r.id and d.status='verified'
        )
    ) then raise exception 'All required documents must be verified first' using errcode='22023'; end if;
    update public.applications set status='ready_for_review',version=version+1,updated_at=now()
      where id=p_application_id returning * into new_row;
    perform private.portal_add_status_history(p_application_id,old_row.status,'ready_for_review',p_reason,true);
    perform private.portal_notify(old_row.student_id,'documents_verified','เอกสารผ่านการตรวจสอบ',
      'เอกสารของคุณผ่านการตรวจสอบแล้ว รอการพิจารณาจากกรรมการ','/applications/'||p_application_id::text);
  else
    select count(*) into v_revision from public.application_documents
      where application_id=p_application_id and status='revision_required';
    if v_revision=0 then raise exception 'Mark at least one document for revision' using errcode='22023'; end if;
    update public.applications set status='revision_requested',version=version+1,updated_at=now()
      where id=p_application_id returning * into new_row;
    perform private.portal_add_status_history(p_application_id,old_row.status,'revision_requested',p_reason,true);
    perform private.portal_notify(old_row.student_id,'revision_requested','กรุณาแก้ไขเอกสาร',
      'เจ้าหน้าที่ขอให้แก้ไขเอกสารประกอบใบสมัคร โปรดเปิดใบสมัครเพื่อดูรายละเอียด','/applications/'||p_application_id::text);
  end if;
  perform private.portal_write_audit('review_application_documents','application',p_application_id,
    to_jsonb(old_row),to_jsonb(new_row),p_reason);
end;
$$;

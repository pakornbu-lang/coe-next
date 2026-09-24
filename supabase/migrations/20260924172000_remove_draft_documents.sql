begin;
-- Private retention archive: removal from a draft is not permanent file deletion.
create table private.removed_application_documents (
  id uuid primary key,
  application_id uuid not null,
  removed_by uuid not null,
  removed_at timestamptz not null default now(),
  document_snapshot jsonb not null,
  version_snapshots jsonb not null
);
revoke all on private.removed_application_documents from public, anon, authenticated;

create function public.student_remove_draft_document(p_application_id uuid, p_document_id uuid, p_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare app public.applications; doc public.application_documents;
begin
  perform private.portal_require_active_role(array['student']);
  select * into app from public.applications where id=p_application_id for update;
  if not found or app.student_id <> auth.uid() then
    raise exception 'Application not found' using errcode='42501';
  end if;
  if app.status <> 'draft' or app.submitted_at is not null then
    raise exception 'Only unsubmitted draft documents can be removed' using errcode='PT422';
  end if;
  select * into doc from public.application_documents
    where id=p_document_id and application_id=app.id for update;
  if not found then raise exception 'Document not found' using errcode='42501'; end if;
  if doc.version is distinct from p_version then raise exception 'STALE_VERSION' using errcode='PT409'; end if;
  insert into private.removed_application_documents(id,application_id,removed_by,document_snapshot,version_snapshots)
    select doc.id,app.id,auth.uid(),to_jsonb(doc),coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb)
    from public.application_document_versions v where v.document_id=doc.id;
  delete from public.application_documents where id=doc.id;
  perform private.portal_write_audit('remove_draft_document','application_document',doc.id,
    jsonb_build_object('application_id',app.id,'file_name',doc.file_name),null,'นำเอกสารออกจากใบสมัครร่าง');
end;
$$;
revoke all on function public.student_remove_draft_document(uuid,uuid,integer) from public,anon;
grant execute on function public.student_remove_draft_document(uuid,uuid,integer) to authenticated;

-- Archived evidence must remain protected from direct Storage deletion.
create or replace function private.portal_can_delete_application_document(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.portal_has_active_role(array['student'])) and split_part(p_path,'/',1)=auth.uid()::text
    and not exists(select 1 from public.application_documents where file_path=p_path)
    and not exists(select 1 from public.application_document_versions where file_path=p_path)
    and not exists(select 1 from private.removed_application_documents d
      where d.document_snapshot->>'file_path'=p_path
      or exists(select 1 from jsonb_array_elements(d.version_snapshots) v where v->>'file_path'=p_path));
$$;
notify pgrst, 'reload schema';
commit;

-- An upheld appeal must reopen the application so staff can issue a new
-- decision. Rejected appeals leave the original decision unchanged.

create or replace function public.staff_resolve_appeal(p_appeal_id uuid,p_version integer,p_status text,p_response text)
returns void language plpgsql security definer set search_path='' as $$
declare
  old_row public.application_appeals;
  new_row public.application_appeals;
  old_application public.applications;
begin
  perform private.portal_require_active_role(array['staff']);
  if p_status not in ('upheld','rejected') or char_length(btrim(coalesce(p_response,''))) not between 10 and 5000 then
    raise exception 'Appeal response is required' using errcode='22023';
  end if;
  select * into old_row from public.application_appeals where id=p_appeal_id for update;
  if not found or old_row.status<>'pending' or old_row.version<>p_version then
    raise exception 'Appeal is not available or changed' using errcode='40001';
  end if;
  select * into old_application from public.applications where id=old_row.application_id for update;
  if not found then raise exception 'Application not found' using errcode='P0002'; end if;

  update public.application_appeals
  set status=p_status,response=btrim(p_response),resolved_by=auth.uid(),resolved_at=now(),version=version+1,updated_at=now()
  where id=p_appeal_id returning * into new_row;

  if p_status='upheld' then
    if old_application.status not in ('reserve','rejected') then
      raise exception 'Application is not available for reconsideration' using errcode='22023';
    end if;
    update public.applications
    set status='committee_review',decided_by=null,decided_at=null,decision_reason=null,version=version+1,updated_at=now()
    where id=old_application.id;
    perform private.portal_add_status_history(old_application.id,old_application.status,'committee_review','รับอุทธรณ์: '||btrim(p_response),true);
  end if;

  perform private.portal_notify(old_application.student_id,'appeal_resolved','แจ้งผลคำอุทธรณ์',case when p_status='upheld' then 'รับคำอุทธรณ์แล้ว ใบสมัครถูกเปิดเพื่อพิจารณาใหม่' else 'เจ้าหน้าที่พิจารณาคำอุทธรณ์แล้ว ผลเดิมยังคงเดิม' end,'/applications/'||old_application.id::text);
  perform private.portal_write_audit('resolve_appeal','application_appeal',p_appeal_id,to_jsonb(old_row),to_jsonb(new_row),'พิจารณาคำอุทธรณ์');
end;
$$;

revoke all on function public.staff_resolve_appeal(uuid,integer,text,text) from public,anon;
grant execute on function public.staff_resolve_appeal(uuid,integer,text,text) to authenticated;

notify pgrst,'reload schema';

-- Allow committee members to save incomplete score drafts. Full scores remain
-- mandatory at submission, and the staff notification opens the exact record.

create or replace function public.committee_save_evaluation(
  p_assignment_id uuid,p_version integer,p_scores jsonb,p_recommendation text,p_comment text,p_submit boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_assignment public.review_assignments;
  v_app public.applications;
  v_criterion record;
  v_score_text text;
  v_score numeric;
  v_total numeric:=0;
  v_count integer:=0;
  v_had_existing boolean:=false;
  old_row public.evaluations;
  new_row public.evaluations;
begin
  perform private.portal_require_active_role(array['committee']);
  if jsonb_typeof(p_scores)<>'array' or p_recommendation not in ('approve','reserve','reject') or p_comment is null or char_length(p_comment)>2000 then
    raise exception 'Invalid evaluation data' using errcode='22023';
  end if;
  select * into v_assignment from public.review_assignments where id=p_assignment_id for update;
  if not found or v_assignment.reviewer_id<>auth.uid() or v_assignment.status<>'assigned' then raise exception 'Review assignment is not available' using errcode='42501'; end if;
  select * into v_app from public.applications where id=v_assignment.application_id;
  if v_app.status<>'committee_review' then raise exception 'Application is not in committee review' using errcode='22023'; end if;

  for v_criterion in select id,max_score from public.scholarship_review_criteria where scholarship_id=v_app.scholarship_id order by sort_order loop
    v_count:=v_count+1;
    select nullif(btrim(x.score),'') into v_score_text
      from jsonb_to_recordset(p_scores) as x(criterion_id uuid,score text,comment text)
      where x.criterion_id=v_criterion.id;
    if v_score_text is null then
      if p_submit then raise exception 'Every criterion needs a valid score' using errcode='22023'; end if;
      continue;
    end if;
    begin
      v_score:=v_score_text::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Every criterion needs a valid score' using errcode='22023';
    end;
    if v_score<0 or v_score>v_criterion.max_score then raise exception 'Every criterion needs a valid score' using errcode='22023'; end if;
    v_total:=v_total+v_score;
  end loop;
  if v_count=0 or jsonb_array_length(p_scores)<>v_count then raise exception 'Evaluation criteria do not match' using errcode='22023'; end if;
  if exists(select 1 from jsonb_to_recordset(p_scores) as x(criterion_id uuid,score text,comment text) where char_length(coalesce(x.comment,''))>1000) then
    raise exception 'Evaluation comment is too long' using errcode='22023';
  end if;

  select * into old_row from public.evaluations where assignment_id=p_assignment_id for update;
  v_had_existing:=found;
  if v_had_existing and p_version is distinct from old_row.version then raise exception 'STALE_VERSION' using errcode='40001'; end if;
  if v_had_existing and old_row.submitted_at is not null then raise exception 'Submitted evaluation cannot be changed' using errcode='22023'; end if;
  insert into public.evaluations(assignment_id,scores,total_score,recommendation,comment,submitted_at)
  values(p_assignment_id,p_scores,v_total,p_recommendation,btrim(p_comment),case when p_submit then now() else null end)
  on conflict(assignment_id) do update set scores=excluded.scores,total_score=excluded.total_score,recommendation=excluded.recommendation,comment=excluded.comment,submitted_at=case when p_submit then now() else null end,version=public.evaluations.version+1,updated_at=now()
  returning * into new_row;
  if p_submit then
    update public.review_assignments set status='completed',completed_at=now() where id=p_assignment_id;
    perform private.portal_notify(v_assignment.assigned_by,'evaluation_submitted','กรรมการส่งผลประเมินแล้ว','มีผลประเมินใหม่สำหรับใบสมัครที่คุณมอบหมาย','/staff/review/'||v_app.id::text);
  end if;
  perform private.portal_write_audit(case when p_submit then 'submit_evaluation' else 'save_evaluation_draft' end,'evaluation',new_row.id,case when v_had_existing then to_jsonb(old_row) else null end,to_jsonb(new_row),case when p_submit then 'กรรมการส่งผลประเมิน' else 'กรรมการบันทึกร่างผลประเมิน' end);
end;
$$;

revoke all on function public.committee_save_evaluation(uuid,integer,jsonb,text,text,boolean) from public, anon;
grant execute on function public.committee_save_evaluation(uuid,integer,jsonb,text,text,boolean) to authenticated;

notify pgrst, 'reload schema';

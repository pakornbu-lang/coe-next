-- Consolidate overlapping permissive SELECT policies. This keeps the existing
-- access model while avoiding repeated policy evaluation for every row.

drop policy if exists "Public reads published scholarships" on public.scholarships;
drop policy if exists "Staff reads all scholarships" on public.scholarships;
create policy "Anonymous reads published scholarships"
  on public.scholarships for select to anon
  using (status in ('published', 'closed'));
create policy "Members read available scholarships"
  on public.scholarships for select to authenticated
  using (
    status in ('published', 'closed')
    or (select private.portal_has_active_role(array['staff']))
  );

drop policy if exists "Public reads published scholarship requirements" on public.scholarship_document_requirements;
drop policy if exists "Staff reads all scholarship requirements" on public.scholarship_document_requirements;
create policy "Anonymous reads published scholarship requirements"
  on public.scholarship_document_requirements for select to anon
  using (
    exists (
      select 1 from public.scholarships s
      where s.id = scholarship_id and s.status in ('published', 'closed')
    )
  );
create policy "Members read available scholarship requirements"
  on public.scholarship_document_requirements for select to authenticated
  using (
    (select private.portal_has_active_role(array['staff']))
    or exists (
      select 1 from public.scholarships s
      where s.id = scholarship_id and s.status in ('published', 'closed')
    )
  );

drop policy if exists "Public reads published scholarship criteria" on public.scholarship_review_criteria;
drop policy if exists "Staff reads all scholarship criteria" on public.scholarship_review_criteria;
create policy "Anonymous reads published scholarship criteria"
  on public.scholarship_review_criteria for select to anon
  using (
    exists (
      select 1 from public.scholarships s
      where s.id = scholarship_id and s.status in ('published', 'closed')
    )
  );
create policy "Members read available scholarship criteria"
  on public.scholarship_review_criteria for select to authenticated
  using (
    (select private.portal_has_active_role(array['staff']))
    or exists (
      select 1 from public.scholarships s
      where s.id = scholarship_id and s.status in ('published', 'closed')
    )
  );

drop policy if exists "Students read own applications" on public.applications;
drop policy if exists "Staff read applications" on public.applications;
drop policy if exists "Committee read assigned applications" on public.applications;
create policy "Members read allowed applications"
  on public.applications for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.portal_has_active_role(array['staff']))
    or exists (
      select 1 from public.review_assignments r
      where r.application_id = id
        and r.reviewer_id = (select auth.uid())
        and r.status in ('assigned', 'completed')
    )
  );

drop policy if exists "Students read own documents" on public.application_documents;
drop policy if exists "Staff read documents" on public.application_documents;
drop policy if exists "Committee read assigned documents" on public.application_documents;
create policy "Members read allowed application documents"
  on public.application_documents for select to authenticated
  using (
    (select private.portal_has_active_role(array['staff']))
    or exists (
      select 1 from public.applications a
      where a.id = application_id and a.student_id = (select auth.uid())
    )
    or exists (
      select 1 from public.review_assignments r
      where r.application_id = application_documents.application_id
        and r.reviewer_id = (select auth.uid())
        and r.status in ('assigned', 'completed')
    )
  );

drop policy if exists "Students read visible status history" on public.application_status_history;
drop policy if exists "Staff read status history" on public.application_status_history;
drop policy if exists "Assigned committee read status history" on public.application_status_history;
create policy "Members read allowed status history"
  on public.application_status_history for select to authenticated
  using (
    (select private.portal_has_active_role(array['staff']))
    or (
      visible_to_student
      and exists (
        select 1 from public.applications a
        where a.id = application_id and a.student_id = (select auth.uid())
      )
    )
    or exists (
      select 1 from public.review_assignments r
      where r.application_id = application_status_history.application_id
        and r.reviewer_id = (select auth.uid())
        and r.status in ('assigned', 'completed')
    )
  );

drop policy if exists "Members read own profile or admins read all" on public.portal_profiles;
drop policy if exists "Staff read active committee members" on public.portal_profiles;
create policy "Members read allowed profiles"
  on public.portal_profiles for select to authenticated
  using (
    (select auth.uid()) = id
    or (select private.portal_is_admin())
    or (
      role = 'committee'
      and active
      and (select private.portal_has_active_role(array['staff']))
    )
  );

drop policy if exists "Staff read interviews" on public.application_interviews;
drop policy if exists "Students read own interviews" on public.application_interviews;
drop policy if exists "Assigned committee read interviews" on public.application_interviews;
create policy "Members read allowed interviews"
  on public.application_interviews for select to authenticated
  using (
    (select private.portal_has_active_role(array['staff']))
    or exists (
      select 1 from public.applications a
      where a.id = application_id and a.student_id = (select auth.uid())
    )
    or exists (
      select 1 from public.review_assignments r
      where r.application_id = application_interviews.application_id
        and r.reviewer_id = (select auth.uid())
        and r.status in ('assigned', 'completed')
    )
  );

drop policy if exists "Staff read appeals" on public.application_appeals;
drop policy if exists "Students read own appeals" on public.application_appeals;
create policy "Members read allowed appeals"
  on public.application_appeals for select to authenticated
  using (
    (select private.portal_has_active_role(array['staff']))
    or exists (
      select 1 from public.applications a
      where a.id = application_id and a.student_id = (select auth.uid())
    )
  );

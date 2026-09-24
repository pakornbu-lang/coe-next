begin;

create function private.notify_scholarship_results_published()
returns trigger language plpgsql security definer set search_path = '' as $$
declare applicant record;
begin
  -- Saving settings on an already published result is not a new publication.
  if old.results_published_at is not null or new.results_published_at is null then return new; end if;
  for applicant in select student_id from public.applications
    where scholarship_id=new.id and status in ('approved','reserve','rejected') loop
    perform private.portal_notify(applicant.student_id,'results_published',
      'ประกาศผลการพิจารณาทุนแล้ว',
      'ประกาศผลทุน '||new.title||' แล้ว กรุณาเปิดหน้าประกาศผลเพื่อตรวจสอบเลขใบสมัครของคุณ',
      '/scholarships/'||new.id::text||'/results');
  end loop;
  return new;
end;
$$;
revoke all on function private.notify_scholarship_results_published() from public,anon,authenticated;
create trigger notify_scholarship_results_published
after update of results_published_at on public.scholarships
for each row execute function private.notify_scholarship_results_published();
notify pgrst, 'reload schema';
commit;

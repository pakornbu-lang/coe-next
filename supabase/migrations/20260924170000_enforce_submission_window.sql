begin;

-- Check every submission, including saved drafts and requested revisions.
-- Draft edits remain possible; resubmission after the deadline needs reopening.
create or replace function private.check_application_submission_window()
returns trigger language plpgsql security definer set search_path = '' as $$
declare scholarship public.scholarships; checked_at timestamptz;
begin
  if new.status <> 'submitted' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status = new.status then return new; end if;
  end if;
  -- Serialize against staff closing or changing the scholarship's dates.
  select * into scholarship from public.scholarships
    where id = new.scholarship_id for share;
  checked_at := clock_timestamp();
  if scholarship.id is null or scholarship.status <> 'published'
     or checked_at < scholarship.opens_at or checked_at >= scholarship.closes_at then
    raise exception 'Scholarship is not open' using errcode = 'PT422';
  end if;
  return new;
end;
$$;
revoke all on function private.check_application_submission_window() from public, anon, authenticated;
create trigger check_application_submission_window
before insert or update of status on public.applications
for each row execute function private.check_application_submission_window();

notify pgrst, 'reload schema';
commit;

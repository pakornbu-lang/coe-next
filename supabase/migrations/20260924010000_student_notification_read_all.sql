-- Idempotent: compatible with installations that already have this RPC.
begin;
create or replace function public.mark_all_my_student_notifications_read()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.portal_profiles
    where id = (select auth.uid()) and active and role = 'student'
  ) then
    raise exception 'Active student required' using errcode = '42501';
  end if;
  update public.portal_notifications
    set read_at = now()
    where user_id = (select auth.uid()) and read_at is null;
end;
$$;
revoke all on function public.mark_all_my_student_notifications_read() from public, anon;
grant execute on function public.mark_all_my_student_notifications_read() to authenticated;
notify pgrst, 'reload schema';
commit;

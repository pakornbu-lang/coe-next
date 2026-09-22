-- M01: เก็บข้อมูลที่นักศึกษากรอกตอนสมัครสมาชิกลง portal_profiles
-- เพื่อให้ข้อมูลแสดงต่อในหน้าโปรไฟล์ของนักศึกษา

create or replace function private.portal_register_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n text := btrim(new.raw_user_meta_data->>'full_name');
  s text := btrim(new.raw_user_meta_data->>'student_id');
  p text := nullif(btrim(new.raw_user_meta_data->>'phone'), '');
  d text := nullif(btrim(new.raw_user_meta_data->>'department'), '');

  details jsonb := coalesce(
    new.raw_user_meta_data->'profile_details',
    '{}'::jsonb
  );

begin

  if n is null
     or char_length(n) not between 1 and 200
     or s is null
     or s !~ '^[0-9]{8,12}$'
  then
    raise exception
      'Valid full_name and student_id are required'
      using errcode = '22023';
  end if;

  insert into public.portal_profiles (
    id,
    full_name,
    student_id,
    email,
    role,
    active,
    phone,
    department,
    profile_details
  )
  values (
    new.id,
    n,
    s,
    new.email,
    'student',
    true,
    p,
    d,
    details
  )
  on conflict (id)
  do update set
    full_name = excluded.full_name,
    student_id = excluded.student_id,
    email = excluded.email,
    phone = excluded.phone,
    department = excluded.department,
    profile_details = excluded.profile_details,
    updated_at = now();

  insert into public.portal_audit_log (
    actor_id,
    actor_name,
    action,
    entity,
    target_id,
    after_data,
    reason
  )
  values (
    new.id,
    n,
    'register',
    'profile',
    new.id,
    jsonb_build_object(
      'full_name', n,
      'student_id', s,
      'role', 'student',
      'active', true
    ),
    'สมัครสมาชิก'
  );

  return new;
end;
$$;
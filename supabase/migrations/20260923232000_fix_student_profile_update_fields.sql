-- M01: Fix student profile update fields
-- Allow student profile editing to save all fields used by the profile form.

create or replace function private.portal_update_self_profile(
  p_version integer,
  p_phone text,
  p_department text,
  p_position text,
  p_expertise text,
  p_avatar_action text default 'keep',
  p_avatar_path text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row public.portal_profiles;
  new_row public.portal_profiles;
  next_avatar text;
begin

  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select *
  into old_row
  from public.portal_profiles
  where id = auth.uid()
  for update;

  if not found or not old_row.active then
    raise exception 'Active member required'
      using errcode = '42501';
  end if;

  if p_version is distinct from old_row.version then
    raise exception 'STALE_VERSION'
      using errcode = '40001';
  end if;

  if p_avatar_action is null
     or p_avatar_action not in ('keep', 'replace', 'remove')
  then
    raise exception 'Invalid avatar action'
      using errcode = '22023';
  end if;

  if old_row.role <> 'committee'
     and nullif(btrim(p_expertise), '') is not null
  then
    raise exception 'Expertise is committee-only'
      using errcode = '22023';
  end if;

  if p_details is null
     or jsonb_typeof(p_details) <> 'object'
  then
    raise exception 'Invalid details'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each(p_details) e
    where jsonb_typeof(e.value) <> 'string'
       or e.key not in (
         'address',
         'major',
         'education_level',
         'study_year',
         'gpa',
         'parent_status',
         'parent_status_other'
       )
  )
  then
    raise exception 'Invalid profile field'
      using errcode = '22023';
  end if;

  if old_row.role <> 'student'
     and (p_details - 'address') <> '{}'::jsonb
  then
    raise exception 'Student details are student-only'
      using errcode = '42501';
  end if;

  if char_length(p_details->>'address') > 500
     or char_length(p_details->>'major') > 150
     or char_length(p_details->>'education_level') > 50
     or char_length(p_details->>'parent_status_other') > 150
  then
    raise exception 'Profile field too long'
      using errcode = '22023';
  end if;

  if coalesce(p_details->>'study_year', '') <> ''
     and (p_details->>'study_year') !~ '^[1-8]$'
  then
    raise exception 'Invalid study year'
      using errcode = '22023';
  end if;

  if coalesce(p_details->>'gpa', '') <> '' then
    if (p_details->>'gpa') !~ '^[0-4](\.[0-9]{1,2})?$' then
      raise exception 'Invalid GPA'
        using errcode = '22023';
    end if;

    if (p_details->>'gpa')::numeric > 4 then
      raise exception 'Invalid GPA'
        using errcode = '22023';
    end if;
  end if;

  if coalesce(p_details->>'parent_status', '') <> ''
     and p_details->>'parent_status'
       not in (
         'อยู่ด้วยกัน',
         'แยกกันอยู่',
         'หย่า',
         'บิดาเสียชีวิต',
         'มารดาเสียชีวิต',
         'เสียชีวิตทั้งคู่',
         'other'
       )
  then
    raise exception 'Invalid parent status'
      using errcode = '22023';
  end if;

  if p_details->>'parent_status' = 'other'
     and nullif(
       btrim(
         coalesce(
           p_details->>'parent_status_other',
           ''
         )
       ),
       ''
     ) is null
  then
    raise exception 'Parent status detail required'
      using errcode = '22023';
  end if;

  if old_row.role = 'student'
     and nullif(btrim(p_position), '') is not null
  then
    raise exception 'Position is staff-only'
      using errcode = '22023';
  end if;

  next_avatar := old_row.avatar_path;

  if p_avatar_action = 'remove' then
    next_avatar := null;
  end if;

  if p_avatar_action = 'replace' then
    if p_avatar_path is null
       or p_avatar_path !~
          ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.webp$')
    then
      raise exception 'Invalid avatar owner'
        using errcode = '42501';
    end if;

    perform 1
    from storage.objects
    where bucket_id = 'portal-avatars'
      and name = p_avatar_path
    for key share;

    if not found then
      raise exception 'Avatar not uploaded'
        using errcode = '22023';
    end if;

    next_avatar := p_avatar_path;
  end if;

  update public.portal_profiles
  set
    phone = nullif(btrim(p_phone), ''),
    department = nullif(btrim(p_department), ''),

    position =
      case
        when old_row.role = 'student'
          then old_row.position
        else nullif(btrim(p_position), '')
      end,

    expertise =
      case
        when old_row.role = 'committee'
          then nullif(btrim(p_expertise), '')
        else old_row.expertise
      end,

    avatar_path = next_avatar,
    profile_details = profile_details || p_details,
    version = version + 1,
    updated_at = now()

  where id = auth.uid()

  returning *
  into new_row;

  insert into public.portal_audit_log (
    actor_id,
    actor_name,
    action,
    entity,
    target_id,
    before_data,
    after_data,
    reason
  )
  values (
    auth.uid(),
    old_row.full_name,
    'update_self_profile',
    'profile',
    auth.uid(),

    jsonb_build_object(
      'full_name', old_row.full_name,
      'phone', old_row.phone,
      'department', old_row.department,
      'position', old_row.position,
      'expertise', old_row.expertise,
      'avatar_path', old_row.avatar_path
    ) || old_row.profile_details,

    jsonb_build_object(
      'full_name', new_row.full_name,
      'phone', new_row.phone,
      'department', new_row.department,
      'position', new_row.position,
      'expertise', new_row.expertise,
      'avatar_path', new_row.avatar_path
    ) || new_row.profile_details,

    'เจ้าของบัญชีแก้ไขข้อมูลส่วนตัว'
  );

end;
$$;

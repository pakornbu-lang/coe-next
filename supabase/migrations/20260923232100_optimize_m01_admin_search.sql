-- M01: Optimize User & Student Management queries
-- Supports /admin member search, filtering and pagination.

create extension if not exists pg_trgm with schema extensions;

-- Search member name with ILIKE '%keyword%'
create index if not exists portal_profiles_full_name_trgm_idx
on public.portal_profiles
using gin (full_name extensions.gin_trgm_ops);

-- Search student ID with ILIKE '%keyword%'
create index if not exists portal_profiles_student_id_trgm_idx
on public.portal_profiles
using gin (student_id extensions.gin_trgm_ops);

-- Search email with ILIKE '%keyword%'
create index if not exists portal_profiles_email_trgm_idx
on public.portal_profiles
using gin (email extensions.gin_trgm_ops);

-- Default /admin member listing
-- ORDER BY created_at DESC, id
create index if not exists portal_profiles_created_id_idx
on public.portal_profiles (created_at desc, id);

-- Role filter + listing order
create index if not exists portal_profiles_role_created_id_idx
on public.portal_profiles (role, created_at desc, id);

-- Pending role requests are expected to be a small subset
create index if not exists portal_profiles_pending_created_id_idx
on public.portal_profiles (created_at desc, id)
where pending_role is not null;
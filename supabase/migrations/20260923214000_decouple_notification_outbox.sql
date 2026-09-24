-- Migration: Decouple notification outbox and update email queue statuses
-- Supports: 'pending', 'processing', 'sent', 'failed' (plus backward-compatible 'queued', 'sending')
-- Adds max_retries to prevent infinite retry loops.

alter table public.notification_email_outbox
  drop constraint if exists notification_email_outbox_status_check;

alter table public.notification_email_outbox
  add constraint notification_email_outbox_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'queued', 'sending'));

alter table public.notification_email_outbox
  alter column status set default 'pending';

alter table public.notification_email_outbox
  add column if not exists max_retries smallint not null default 5 check (max_retries between 1 and 20);

-- Migrate any existing legacy status rows
update public.notification_email_outbox
  set status = 'pending'
  where status = 'queued';

update public.notification_email_outbox
  set status = 'processing'
  where status = 'sending';

create index if not exists notification_email_outbox_pending_idx
  on public.notification_email_outbox(status, next_attempt_at, created_at)
  where status in ('pending', 'queued', 'failed');

-- Update portal_notify to queue with status 'pending'
create or replace function private.portal_notify(p_user_id uuid, p_kind text, p_title text, p_body text, p_href text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_notification public.portal_notifications;
  v_email text;
begin
  insert into public.portal_notifications(user_id, kind, title, body, href)
  values(p_user_id, p_kind, p_title, p_body, p_href)
  returning * into v_notification;

  select email into v_email from public.portal_profiles where id = p_user_id and active;
  if v_email is not null and char_length(v_email) between 3 and 254 and position('@' in v_email) > 1 then
    insert into public.notification_email_outbox(notification_id, to_email, subject, body, href, status, max_retries)
    values(v_notification.id, v_email, '[ระบบทุนการศึกษา] ' || v_notification.title, v_notification.body, v_notification.href, 'pending', 5);
  end if;
end;
$$;

revoke all on function private.portal_notify(uuid, text, text, text, text) from public, anon, authenticated;


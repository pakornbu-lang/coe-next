-- Atomic notification email queue.
-- One RPC claims up to 20 due emails using SKIP LOCKED.
-- One RPC finalizes the whole delivery batch.
--
-- pg_cron / pg_net were already enabled manually in the hosted project.
-- Keep these statements for reproducible environments.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.claim_notification_email_batch(
  p_limit integer default 20
)
returns table (
  id uuid,
  to_email text,
  subject text,
  body text,
  href text,
  attempts smallint,
  max_retries smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
begin
  -- Recover workers that crashed after claiming a row.
  update public.notification_email_outbox as o
  set
    status = 'failed',
    last_error = 'A previous dispatch did not complete',
    next_attempt_at = now(),
    updated_at = now()
  where o.status in ('processing', 'sending')
    and o.updated_at < now() - interval '10 minutes';

  return query
  with picked as (
    select o.id
    from public.notification_email_outbox as o
    where o.status in ('pending', 'queued', 'failed')
      and o.next_attempt_at <= now()
      and o.attempts < o.max_retries
    order by o.created_at asc
    for update skip locked
    limit v_limit
  )
  update public.notification_email_outbox as o
  set
    status = 'processing',
    attempts = o.attempts + 1,
    last_error = null,
    updated_at = now()
  from picked
  where o.id = picked.id
  returning
    o.id,
    o.to_email,
    o.subject,
    o.body,
    o.href,
    o.attempts,
    o.max_retries;
end;
$$;

revoke all on function public.claim_notification_email_batch(integer)
from public, anon, authenticated;

grant execute on function public.claim_notification_email_batch(integer)
to service_role;


create or replace function public.complete_notification_email_batch(
  p_results jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_updated integer;
  v_total integer := 0;
  v_error text;
begin
  if p_results is null
     or jsonb_typeof(p_results) <> 'array'
     or jsonb_array_length(p_results) > 20 then
    raise exception 'Invalid email delivery result batch'
      using errcode = '22023';
  end if;

  for r in
    select *
    from jsonb_to_recordset(p_results)
      as x(
        id uuid,
        delivered boolean,
        provider_id text,
        error text
      )
  loop
    if r.id is null or r.delivered is null then
      continue;
    end if;

    if r.delivered then
      update public.notification_email_outbox as o
      set
        status = 'sent',
        sent_at = now(),
        provider_id = nullif(r.provider_id, ''),
        last_error = null,
        updated_at = now()
      where o.id = r.id
        and o.status = 'processing';

    else
      v_error := left(
        coalesce(nullif(r.error, ''), 'Unable to send email'),
        1800
      );

      update public.notification_email_outbox as o
      set
        status = 'failed',
        provider_id = null,
        last_error =
          case
            when o.attempts >= o.max_retries
              then v_error || ' (Exceeded maximum retries)'
            else v_error
          end,
        next_attempt_at =
          case
            when o.attempts >= o.max_retries
              then now() + interval '365 days'
            when o.attempts <= 1
              then now() + interval '5 minutes'
            when o.attempts = 2
              then now() + interval '10 minutes'
            when o.attempts = 3
              then now() + interval '20 minutes'
            else now() + interval '40 minutes'
          end,
        updated_at = now()
      where o.id = r.id
        and o.status = 'processing';
    end if;

    get diagnostics v_updated = row_count;
    v_total := v_total + v_updated;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.complete_notification_email_batch(jsonb)
from public, anon, authenticated;

grant execute on function public.complete_notification_email_batch(jsonb)
to service_role;

-- Schedule the notification email worker every 5 minutes.
-- Requires Vault secret: notification_dispatcher_api_key

do $$
declare
  v_jobid bigint;
begin
  select jobid
    into v_jobid
  from cron.job
  where jobname = 'notification-email-dispatch-every-5-minutes'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'notification-email-dispatch-every-5-minutes',
    '*/5 * * * *',
    $cron$
    select net.http_post(
      url := 'https://urypadreydjjomjjubqc.supabase.co/functions/v1/notification-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey',
        (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'notification_dispatcher_api_key'
          limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 90000
    ) as request_id;
    $cron$
  );
end;
$$;

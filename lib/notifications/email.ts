import "server-only";

import { siteUrl } from "@/lib/auth/site-url";
import { appsScriptEmailConfigured, sendAppsScriptEmail } from "@/lib/notifications/apps-script";
import { notificationEmailHtml, notificationEmailText } from "@/lib/notifications/template";
import { createAdminClient } from "@/lib/supabase/admin";

export type OutboxStatus = "pending" | "processing" | "sent" | "failed" | "queued" | "sending";

type OutboxRow = {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  href: string;
  status: OutboxStatus;
  attempts: number;
  max_retries?: number | null;
  next_attempt_at: string;
};

const DEFAULT_BATCH_LIMIT = 20;
const DEFAULT_MAX_RETRIES = 5;

function configuration() {
  const admin = createAdminClient();
  if (!admin || !appsScriptEmailConfigured()) return null;
  return { admin };
}

export async function dispatchNotificationEmails({ limit = DEFAULT_BATCH_LIMIT }: { limit?: number } = {}) {
  const config = configuration();
  if (!config) return { processed: 0, sent: 0, configured: false };

  const timestamp = new Date().toISOString();

  // Reset any stale in-flight records that were stuck in processing/sending for > 10 minutes
  await config.admin
    .from("notification_email_outbox")
    .update({
      status: "failed",
      last_error: "A previous dispatch did not complete",
      next_attempt_at: timestamp,
      updated_at: timestamp,
    })
    .in("status", ["processing", "sending"])
    .lt("updated_at", new Date(Date.now() - 10 * 60_000).toISOString());

  // Fetch pending / queued / retryable failed rows (capped at batch limit, default 20)
  const batchSize = Math.min(Math.max(limit, 1), 20);
  const { data, error } = await config.admin.rpc("notification_email_batch", { p_limit: batchSize });

  if (error) return { processed: 0, sent: 0, configured: true, error: "Unable to load email queue" };

  const now = Date.now();
  const rows = ((data ?? []) as OutboxRow[]).filter((row) => {
    const maxRetries = row.max_retries ?? DEFAULT_MAX_RETRIES;
    const retryable = row.attempts < maxRetries;
    const due = new Date(row.next_attempt_at).getTime() <= now;
    return retryable && due;
  });

  let sent = 0;
  for (const row of rows) {
    const nextAttempts = row.attempts + 1;
    const maxRetries = row.max_retries ?? DEFAULT_MAX_RETRIES;

    // Atomically claim row by transitioning to 'processing'
    const { data: claimed } = await config.admin
      .from("notification_email_outbox")
      .update({
        status: "processing",
        attempts: nextAttempts,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", row.status)
      .eq("attempts", row.attempts)
      .select("id")
      .maybeSingle();

    if (!claimed) continue;

    let delivered = false;
    let providerId: string | null = null;
    let errorMessage = "";
    const actionUrl = new URL(row.href, siteUrl()).toString();

    const result = await sendAppsScriptEmail({
      to: row.to_email,
      subject: row.subject,
      text: notificationEmailText({ subject: row.subject, body: row.body, actionUrl }),
      html: notificationEmailHtml({ subject: row.subject, body: row.body, actionUrl }),
    });

    delivered = result.delivered;
    providerId = result.providerId;
    errorMessage = result.error;

    if (delivered) {
      await config.admin
        .from("notification_email_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_id: providerId,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      sent += 1;
    } else {
      const exceeded = nextAttempts >= maxRetries;
      const delayMinutes = Math.min(60, 5 * 2 ** Math.min(nextAttempts - 1, 3));
      await config.admin
        .from("notification_email_outbox")
        .update({
          status: "failed",
          last_error: exceeded
            ? (errorMessage ? `${errorMessage} (Exceeded max ${maxRetries} retries)` : `Exceeded maximum ${maxRetries} retries`)
            : (errorMessage || "Unable to send email"),
          next_attempt_at: exceeded
            ? new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString() // Do not retry further
            : new Date(Date.now() + delayMinutes * 60_000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }

  return { processed: rows.length, sent, failed: rows.length - sent, configured: true };
}

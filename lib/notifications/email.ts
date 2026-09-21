import "server-only";

import { siteUrl } from "@/lib/auth/site-url";
import { notificationEmailHtml, notificationEmailText } from "@/lib/notifications/template";
import { createAdminClient } from "@/lib/supabase/admin";

type OutboxRow = {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  href: string;
  status: "queued" | "failed";
  attempts: number;
  next_attempt_at: string;
};

function configuration() {
  const appsScriptUrl = process.env.NOTIFICATION_APPS_SCRIPT_URL;
  const appsScriptSecret = process.env.NOTIFICATION_APPS_SCRIPT_SECRET;
  const admin = createAdminClient();
  if (!appsScriptUrl || !appsScriptSecret || !admin) return null;
  try {
    const url = new URL(appsScriptUrl);
    if (url.protocol !== "https:" || !url.hostname.endsWith("script.google.com")) return null;
  } catch {
    return null;
  }
  return { appsScriptUrl, appsScriptSecret, admin };
}

export async function dispatchNotificationEmails({ limit = 20 }: { limit?: number } = {}) {
  const config = configuration();
  if (!config) return { processed: 0, sent: 0, configured: false };
  const timestamp = new Date().toISOString();
  await config.admin
    .from("notification_email_outbox")
    .update({
      status: "failed",
      last_error: "A previous dispatch did not complete",
      next_attempt_at: timestamp,
      updated_at: timestamp,
    })
    .eq("status", "sending")
    .lt("updated_at", new Date(Date.now() - 10 * 60_000).toISOString());
  const { data, error } = await config.admin
    .from("notification_email_outbox")
    .select("id,to_email,subject,body,href,status,attempts,next_attempt_at")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) return { processed: 0, sent: 0, configured: true };
  const now = Date.now();
  const rows = ((data ?? []) as OutboxRow[]).filter((row) => new Date(row.next_attempt_at).getTime() <= now);
  let sent = 0;
  for (const row of rows) {
    const { data: claimed } = await config.admin
      .from("notification_email_outbox")
      .update({ status: "sending", attempts: row.attempts + 1, last_error: null, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", row.status)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    let delivered = false;
    let providerId: string | null = null;
    let errorMessage = "";
    try {
      const actionUrl = new URL(row.href, siteUrl()).toString();
      const response = await fetch(config.appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: config.appsScriptSecret,
          message: {
            to: row.to_email,
            subject: row.subject,
            text: notificationEmailText({ subject: row.subject, body: row.body, actionUrl }),
            html: notificationEmailHtml({ subject: row.subject, body: row.body, actionUrl }),
          },
        }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string; requestId?: string } | null;
      if (!response.ok) errorMessage = `Apps Script returned ${response.status}`;
      else if (!payload?.ok) errorMessage = payload?.error || "Apps Script did not confirm delivery";
      else {
        delivered = true;
        providerId = payload.requestId ?? null;
      }
    } catch {
      errorMessage = "Unable to contact Google Apps Script";
    }
    if (delivered) {
      await config.admin.from("notification_email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), provider_id: providerId, last_error: null, updated_at: new Date().toISOString() }).eq("id", row.id);
      sent += 1;
    } else {
      const delayMinutes = Math.min(60, 5 * 2 ** Math.min(row.attempts, 3));
      await config.admin.from("notification_email_outbox").update({ status: "failed", last_error: errorMessage || "Unable to send email", next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id);
    }
  }
  return { processed: rows.length, sent, configured: true };
}

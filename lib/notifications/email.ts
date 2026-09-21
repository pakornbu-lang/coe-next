import "server-only";

import { siteUrl } from "@/lib/auth/site-url";
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function configuration() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  const admin = createAdminClient();
  if (!key || !from || !admin) return null;
  return { key, from, admin };
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
    let response: Response | null = null;
    let errorMessage = "";
    try {
      const actionUrl = new URL(row.href, siteUrl()).toString();
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: config.from,
          to: [row.to_email],
          subject: row.subject,
          text: `${row.body}\n\nเปิดในระบบ: ${actionUrl}`,
          html: `<main style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937"><h2>${escapeHtml(row.subject)}</h2><p>${escapeHtml(row.body).replace(/\n/g, "<br>")}</p><p><a href="${escapeHtml(actionUrl)}">เปิดรายการในระบบทุนการศึกษา</a></p></main>`,
        }),
      });
      if (!response.ok) errorMessage = `Email provider returned ${response.status}`;
    } catch {
      errorMessage = "Unable to contact email provider";
    }
    if (response?.ok) {
      const payload = await response.json().catch(() => null) as { id?: string } | null;
      await config.admin.from("notification_email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), provider_id: payload?.id ?? null, last_error: null, updated_at: new Date().toISOString() }).eq("id", row.id);
      sent += 1;
    } else {
      const delayMinutes = Math.min(60, 5 * 2 ** Math.min(row.attempts, 3));
      await config.admin.from("notification_email_outbox").update({ status: "failed", last_error: errorMessage || "Unable to send email", next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id);
    }
  }
  return { processed: rows.length, sent, configured: true };
}

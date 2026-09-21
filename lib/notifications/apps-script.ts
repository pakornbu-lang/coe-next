import "server-only";

type AppsScriptMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function appsScriptEmailConfigured() {
  const url = process.env.NOTIFICATION_APPS_SCRIPT_URL;
  const secret = process.env.NOTIFICATION_APPS_SCRIPT_SECRET;
  if (!url || !secret) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith("script.google.com");
  } catch {
    return false;
  }
}

export async function sendAppsScriptEmail(message: AppsScriptMessage) {
  const url = process.env.NOTIFICATION_APPS_SCRIPT_URL;
  const secret = process.env.NOTIFICATION_APPS_SCRIPT_SECRET;
  if (!url || !secret || !appsScriptEmailConfigured()) {
    return { delivered: false, providerId: null, error: "Apps Script email is not configured" };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, message }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; requestId?: string } | null;
    if (!response.ok) return { delivered: false, providerId: null, error: `Apps Script returned ${response.status}` };
    if (!payload?.ok) return { delivered: false, providerId: null, error: payload?.error || "Apps Script did not confirm delivery" };
    return { delivered: true, providerId: payload.requestId ?? null, error: "" };
  } catch {
    return { delivered: false, providerId: null, error: "Unable to contact Google Apps Script" };
  }
}

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NOTIFICATION_APPS_SCRIPT_URL",
  "NOTIFICATION_APPS_SCRIPT_SECRET",
  "NOTIFICATION_DISPATCH_SECRET",
];
for (const name of required) assert(process.env[name], `Missing ${name}`);

const recipient = process.argv[2];
assert(recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient), "Pass the test recipient email as the first argument");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const emailHash = createHmac("sha256", process.env.NOTIFICATION_DISPATCH_SECRET).update(recipient.toLowerCase()).digest("hex");

try {
  const { error: insertError } = await admin.from("password_reset_rate_limits").insert({ email_hash: emailHash });
  assert(!insertError, insertError?.message);
  const redirectTo = `${new URL(process.env.NEXT_PUBLIC_SITE_URL).origin}/auth/callback?next=%2Freset-password`;
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: recipient, options: { redirectTo } });
  assert(!error && data?.properties?.hashed_token, error?.message ?? "Recovery link was not generated");

  const recoveryUrl = new URL("/auth/callback", process.env.NEXT_PUBLIC_SITE_URL);
  recoveryUrl.searchParams.set("token_hash", data.properties.hashed_token);
  recoveryUrl.searchParams.set("type", "recovery");
  recoveryUrl.searchParams.set("next", "/reset-password");
  const actionUrl = recoveryUrl.toString();
  const response = await fetch(process.env.NOTIFICATION_APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.NOTIFICATION_APPS_SCRIPT_SECRET,
      message: {
        to: recipient,
        subject: "[ระบบทุนการศึกษา] ทดสอบลืมรหัสผ่าน",
        text: `ระบบติดตามทุนการศึกษา\n\nเปิดลิงก์เพื่อตั้งรหัสผ่านใหม่: ${actionUrl}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h1 style="color:#102447">ตั้งรหัสผ่านใหม่</h1><p>ระบบติดตามทุนการศึกษา</p><p><a style="display:block;background:#1677f1;color:white;padding:14px;text-align:center;text-decoration:none;border-radius:6px" href="${actionUrl}">ตั้งรหัสผ่านใหม่</a></p><p>หากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้</p></div>`,
      },
    }),
  });
  const payload = await response.json().catch(() => null);
  assert(response.ok && payload?.ok, payload?.error ?? `Apps Script returned ${response.status}`);
  console.log("PASS: recovery link generated and delivered through Apps Script");
} finally {
  await admin.from("password_reset_rate_limits").delete().eq("email_hash", emailHash);
}

// Exercise the real /register form against a running local server and Supabase.
// Uses a disposable @mail.wu.ac.th-shaped address; no email is sent.
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const base = process.env.AUTH_TEST_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const rateSecret = process.env.NOTIFICATION_DISPATCH_SECRET;
assert(url && key && rateSecret, "Missing local Supabase registration configuration");

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `codex-test-${randomBytes(8).toString("hex")}@mail.wu.ac.th`;
const studentId = String(randomInt(100_000_000_000, 999_999_999_999));
const password = `A${randomBytes(16).toString("base64url")}z9!`;
const emailHash = createHmac("sha256", rateSecret).update(`signup:email:${email}`).digest("hex");
let userId = null;

function decode(value) {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#39;/g, "'");
}

try {
  const page = await fetch(`${base}/register`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /@mail\.wu\.ac\.th/);
  const body = new FormData();
  for (const [tag] of html.matchAll(/<input\b[^>]*type="hidden"[^>]*>/g)) {
    const name = tag.match(/\bname="([^"]+)"/)?.[1];
    if (name?.startsWith("$ACTION_")) body.append(name, decode(tag.match(/\bvalue="([^"]*)"/)?.[1] ?? ""));
  }
  assert([...body.keys()].some((name) => name.startsWith("$ACTION_REF_")));
  for (const [name, value] of Object.entries({
    prefix: "นาย", first_name: "ทดสอบ", last_name: "ระบบ", student_id: studentId,
    email, password, confirm_password: password,
  })) body.append(name, value);

  const invalid = new FormData();
  for (const [name, value] of body) invalid.append(name, value);
  const otherDomain = email.replace("@mail.wu.ac.th", "@wu.ac.th");
  invalid.set("email", otherDomain);
  const rejected = await fetch(`${base}/register`, {
    method: "POST", body: invalid, redirect: "manual", headers: { Origin: base },
  });
  assert.notEqual(rejected.status, 303, "Other email domains must not register");
  const { data: rejectedProfile } = await admin.from("portal_profiles")
    .select("id").eq("email", otherDomain).maybeSingle();
  assert.equal(rejectedProfile, null);

  const response = await fetch(`${base}/register`, {
    method: "POST", body, redirect: "manual", headers: { Origin: base },
  });
  const { data: profile, error: profileError } = await admin.from("portal_profiles")
    .select("id,role,email").eq("email", email).maybeSingle();
  assert.ifError(profileError);
  userId = profile?.id ?? null;
  assert.equal(profile?.role, "student", "Registration must create a student profile");
  assert.equal(response.status, 303, `Registration did not redirect: ${response.status}`);
  assert.equal(new URL(response.headers.get("location"), base).pathname, "/dashboard");
  const cookies = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  assert(cookies, "Registration must set a session cookie");
  const dashboard = await fetch(`${base}/dashboard`, { headers: { Cookie: cookies }, redirect: "manual" });
  assert.equal(dashboard.status, 200, "New student session cannot open dashboard");
  console.log("PASS: other domains rejected; /register creates a Student account and immediately opens the dashboard");
} finally {
  if (!userId) {
    const { data } = await admin.from("portal_profiles").select("id").eq("email", email).maybeSingle();
    userId = data?.id ?? null;
  }
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
    await admin.from("portal_audit_log").delete().eq("target_id", userId).eq("action", "register");
  }
  await admin.from("registration_rate_limits").delete().eq("email_hash", emailHash);
}

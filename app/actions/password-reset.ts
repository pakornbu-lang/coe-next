"use server";

import { createHmac } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthConfigured } from "@/lib/supabase/config";
import { siteUrl } from "@/lib/auth/site-url";
import { appsScriptEmailConfigured, sendAppsScriptEmail } from "@/lib/notifications/apps-script";
import { passwordResetEmailHtml, passwordResetEmailText } from "@/lib/notifications/template";

export type PasswordResetState = { error: string; success: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const resetRequestedMessage = "รับคำขอแล้ว หากอีเมลนี้ตรงกับบัญชีที่ลงทะเบียน ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ กรุณาตรวจกล่องขาเข้า (Inbox) และจดหมายขยะ (Spam) หากไม่พบ ให้ตรวจว่าใช้อีเมลเดียวกับที่ลงทะเบียน";

async function sendPasswordResetWithAppsScript(email: string, redirectTo: string) {
  const admin = createAdminClient();
  const rateLimitKey = process.env.NOTIFICATION_DISPATCH_SECRET;
  if (!admin || !rateLimitKey || !appsScriptEmailConfigured()) return "unavailable" as const;

  const emailHash = createHmac("sha256", rateLimitKey).update(email).digest("hex");
  const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: recent, error: rateError } = await admin
    .from("password_reset_rate_limits")
    .select("requested_at")
    .eq("email_hash", emailHash)
    .gte("requested_at", oneHourAgo)
    .order("requested_at", { ascending: false })
    .limit(3);
  if (rateError) throw new Error("Recovery rate limit unavailable");
  const latest = recent?.[0]?.requested_at ? new Date(recent[0].requested_at).getTime() : 0;
  if ((recent?.length ?? 0) >= 3 || Date.now() - latest < 60_000) return "limited" as const;

  await admin.from("password_reset_rate_limits").delete().lt("requested_at", new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString());
  const { error: insertError } = await admin.from("password_reset_rate_limits").insert({ email_hash: emailHash });
  if (insertError) throw new Error("Recovery rate limit unavailable");

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
  const tokenHash = data?.properties?.hashed_token;
  if (error) {
    if (error.code === "user_not_found") return "accepted" as const;
    throw new Error("Unable to generate recovery link");
  }
  if (!tokenHash) throw new Error("Missing recovery token");
  const recoveryUrl = new URL("/auth/callback", siteUrl());
  recoveryUrl.searchParams.set("token_hash", tokenHash);
  recoveryUrl.searchParams.set("type", "recovery");
  recoveryUrl.searchParams.set("next", "/reset-password");
  const actionUrl = recoveryUrl.toString();


  const subject = "[ระบบทุนการศึกษา] ตั้งรหัสผ่านใหม่";
  const result = await sendAppsScriptEmail({
    to: email,
    subject,
    text: passwordResetEmailText(actionUrl),
    html: passwordResetEmailHtml(actionUrl),
  });
  if (!result.delivered) throw new Error("Unable to send recovery email");
  return "accepted" as const;
}

export async function requestPasswordReset(_previous: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailPattern.test(email) || email.length > 254) return { error: "กรุณากรอกอีเมลให้ถูกต้อง", success: "" };
  if (!isAuthConfigured()) return { error: "ระบบบัญชียังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล", success: "" };

  try {
    const redirectTo = `${siteUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const result = await sendPasswordResetWithAppsScript(email, redirectTo);
    if (result === "limited") return { error: "ส่งคำขอไปเมื่อไม่นานนี้ กรุณาตรวจ Inbox / Spam หรือรอแล้วลองใหม่", success: "" };
    if (result === "accepted") return { error: "", success: resetRequestedMessage };

    const client = await createClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error && error.status !== 429) return { error: "ส่งคำขอไม่สำเร็จ ระบบส่งอีเมลขัดข้อง กรุณาลองใหม่หรือติดต่อผู้ดูแล", success: "" };
    if (error?.status === 429) return { error: "มีการขอลิงก์หลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่", success: "" };
  } catch {
    return { error: "ไม่สามารถส่งคำขอได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่", success: "" };
  }
  return { error: "", success: resetRequestedMessage };
}

export async function completePasswordReset(_previous: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  if (password.length < 8 || password.length > 128) return { error: "รหัสผ่านต้องมีความยาว 8–128 ตัวอักษร", success: "" };
  if (password !== confirmPassword) return { error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน", success: "" };

  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { error: "ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่", success: "" };
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      if (error.code === "same_password") return { error: "รหัสผ่านใหม่ต้องต่างจากรหัสผ่านเดิม", success: "" };
      if (error.code === "weak_password") return { error: "รหัสผ่านนี้ไม่ปลอดภัยเพียงพอ กรุณาใช้รหัสผ่านที่คาดเดายากขึ้น", success: "" };
      return { error: "ตั้งรหัสผ่านใหม่ไม่สำเร็จ ลิงก์อาจหมดอายุ กรุณาขอลิงก์ใหม่", success: "" };
    }
    await client.auth.signOut({ scope: "global" });
  } catch {
    return { error: "ไม่สามารถตั้งรหัสผ่านใหม่ได้ กรุณาลองอีกครั้ง", success: "" };
  }
  redirect("/login?reset=success");
}

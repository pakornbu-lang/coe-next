"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import { siteUrl } from "@/lib/auth/site-url";

export type PasswordResetState = { error: string; success: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestPasswordReset(_previous: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailPattern.test(email) || email.length > 254) return { error: "กรุณากรอกอีเมลให้ถูกต้อง", success: "" };
  if (!isAuthConfigured()) return { error: "ระบบบัญชียังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล", success: "" };

  try {
    const client = await createClient();
    const redirectTo = `${siteUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error?.status === 429) return { error: "มีการขอลิงก์หลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่", success: "" };
  } catch {
    return { error: "ไม่สามารถส่งคำขอได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่", success: "" };
  }
  return { error: "", success: "หากอีเมลนี้มีบัญชีอยู่ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ กรุณาตรวจ Inbox และ Spam" };
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

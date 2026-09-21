"use server";
import { revalidatePath } from "next/cache";
import { requireViewer, readViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/auth/site-url";

export type EmailState = { error: string; success: string };
export async function changeMyEmail(_previous: EmailState, form: FormData): Promise<EmailState> {
  const viewer = await requireViewer();
  const email = String(form.get("new_email") ?? "").trim().toLowerCase();
  const password = String(form.get("current_password") ?? "");
  const fail = (error: string) => ({ error, success: "" });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("กรุณากรอกอีเมลใหม่ให้ถูกต้อง");
  if (email === viewer.email.toLowerCase()) return fail("อีเมลใหม่นี้ตรงกับอีเมลที่ใช้อยู่แล้ว");
  if (password.length < 8 || password.length > 128) return fail("กรุณากรอกรหัสผ่านปัจจุบันให้ถูกต้อง");
  try {
    const client = await createClient();
    // Reauthenticate the current account; never take a target user ID/email from the form.
    const { data: login, error: loginError } = await client.auth.signInWithPassword({ email: viewer.email, password });
    if (loginError || !login.user || login.user.id !== viewer.id) return fail(loginError?.status === 429 ? "มีคำขอหลายครั้ง กรุณารอสักครู่แล้วลองใหม่" : "รหัสผ่านปัจจุบันไม่ถูกต้อง หรือบัญชีไม่พร้อมใช้งาน");
    if (!await readViewer(client, login.user)) return fail("บัญชีนี้ไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล");
    const { data, error } = await client.auth.updateUser({ email }, { emailRedirectTo: siteUrl() + "/auth/callback" });
    if (error) return fail(error.status === 429 ? "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" : error.code === "email_address_not_authorized" || error.code === "unexpected_failure" ? "ระบบส่งอีเมลยืนยันยังไม่พร้อม กรุณาติดต่อผู้ดูแลเพื่อตรวจการตั้งค่า SMTP" : "ยังเปลี่ยนอีเมลไม่ได้ กรุณาตรวจอีเมลใหม่หรือติดต่อผู้ดูแล");
    revalidatePath("/", "layout");
    return { error: "", success: data.user?.email === email ? "เปลี่ยนอีเมลแล้ว ครั้งถัดไปให้เข้าสู่ระบบด้วยอีเมลใหม่" : "ส่งคำขอยืนยันแล้ว กรุณาตรวจอีเมลเดิมและอีเมลใหม่ รวมถึงสแปม และเปิดลิงก์ยืนยันในเบราว์เซอร์นี้ อีเมลเข้าสู่ระบบจะเปลี่ยนเมื่อยืนยันครบ" };
  } catch { return fail("เชื่อมต่อระบบบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"); }
}

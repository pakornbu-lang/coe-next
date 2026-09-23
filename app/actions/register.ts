"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthConfigured } from "@/lib/supabase/config";
import { readViewer } from "@/lib/auth/server";

export type RegisterState = { error: string; success: string };

const failedRegistration = "สมัครสมาชิกไม่สำเร็จ กรุณาตรวจสอบข้อมูล หากเคยสมัครแล้วให้เข้าสู่ระบบหรือติดต่อผู้ดูแล";

async function reserveRegistrationAttempt(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  email: string,
) {
  const secret = process.env.NOTIFICATION_DISPATCH_SECRET;
  if (!secret) throw new Error("Registration rate limit is not configured");
  const hash = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  const emailHash = hash(`signup:email:${email}`);
  const requestHeaders = await headers();
  const ip = (requestHeaders.get("x-vercel-forwarded-for") ?? requestHeaders.get("x-real-ip") ?? "")
    .split(",")[0].trim();
  const ipHash = ip ? hash(`signup:ip:${ip}`) : null;
  const since = new Date(Date.now() - 60 * 60_000).toISOString();

  const emailCount = admin.from("registration_rate_limits")
    .select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gte("requested_at", since);
  const ipCount = ipHash
    ? admin.from("registration_rate_limits")
      .select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("requested_at", since)
    : Promise.resolve({ count: 0, error: null });
  const totalCount = admin.from("registration_rate_limits")
    .select("id", { count: "exact", head: true }).gte("requested_at", since);
  const [byEmail, byIp, total] = await Promise.all([emailCount, ipCount, totalCount]);
  if (byEmail.error || byIp.error || total.error) throw new Error("Registration rate limit unavailable");
  if ((byEmail.count ?? 0) >= 3 || (byIp.count ?? 0) >= 20 || (total.count ?? 0) >= 100) return false;

  const { error } = await admin.from("registration_rate_limits")
    .insert({ email_hash: emailHash, ip_hash: ipHash });
  if (error) throw new Error("Registration rate limit unavailable");
  return true;
}

export async function registerStudent(_previous: RegisterState, form: FormData): Promise<RegisterState> {
  const prefix = String(form.get("prefix") ?? "").trim();
  const firstName = String(form.get("first_name") ?? "").trim();
  const lastName = String(form.get("last_name") ?? "").trim();
  const fullName = [prefix, firstName, lastName].filter(Boolean).join(" ");
  const studentId = String(form.get("student_id") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!["นาย", "นางสาว", "นาง"].includes(prefix) || !firstName || firstName.length > 100 ||
      !lastName || lastName.length > 100 || fullName.length > 200 ||
      !/^[0-9]{8,12}$/.test(studentId) ||
      !/^[^\s@]+@mail\.wu\.ac\.th$/.test(email) || email.length > 254) {
    return { error: "กรุณากรอกชื่อ นามสกุล รหัสนักศึกษา 8–12 หลัก และอีเมล @mail.wu.ac.th ให้ถูกต้อง", success: "" };
  }
  if (password.length < 8 || password.length > 128 || password !== String(form.get("confirm_password") ?? "")) {
    return { error: "รหัสผ่านต้องยาว 8–128 ตัวอักษร และทั้งสองช่องต้องตรงกัน", success: "" };
  }
  if (!isAuthConfigured()) return { error: "ระบบสมัครสมาชิกยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล", success: "" };

  try {
    const admin = createAdminClient();
    if (!admin) return { error: "ระบบสมัครสมาชิกยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล", success: "" };
    if (!await reserveRegistrationAttempt(admin, email)) {
      return { error: "มีการสมัครสมาชิกหลายครั้งเกินไป กรุณารอหนึ่งชั่วโมงแล้วลองใหม่", success: "" };
    }
    // Only this validated server action may auto-confirm a new student account.
    // The database trigger creates the student profile and never trusts role metadata.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, student_id: studentId, prefix, first_name: firstName, last_name: lastName },
    });
    if (error || !data.user) {
      return { error: error?.status === 429
        ? "มีการสมัครสมาชิกหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่"
        : error?.code === "weak_password"
          ? "รหัสผ่านไม่ผ่านข้อกำหนดความปลอดภัย กรุณาใช้รหัสผ่านที่เดายากขึ้น"
          : failedRegistration, success: "" };
    }

    const client = await createClient();
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.user) {
      return { error: "", success: "สร้างบัญชีแล้ว กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่เพิ่งตั้ง" };
    }
    const viewer = await readViewer(client, signIn.data.user);
    if (!viewer || viewer.role !== "student") {
      await client.auth.signOut({ scope: "local" });
      return { error: "สร้างบัญชีแล้ว แต่ยังเปิดหน้าใช้งานไม่ได้ กรุณาติดต่อผู้ดูแล", success: "" };
    }
  } catch {
    return { error: "ไม่สามารถเชื่อมต่อระบบสมัครสมาชิกได้ กรุณาลองใหม่หรือติดต่อผู้ดูแล", success: "" };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

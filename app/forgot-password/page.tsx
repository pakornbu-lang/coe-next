import { ForgotPasswordForm } from "@/components/auth/PasswordResetForms";

export const metadata = { title: "ลืมรหัสผ่าน" };

export default async function ForgotPasswordPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <ForgotPasswordForm initialError={
    error === "expired" ? "ลิงก์ตั้งรหัสผ่านหมดอายุ ถูกใช้แล้ว หรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่ และเปิดลิงก์ล่าสุดในเบราว์เซอร์ที่ใช้ส่งคำขอ" :
    error === "verification" ? "ตรวจสอบลิงก์ไม่สำเร็จ กรุณาลองใหม่หรือขอลิงก์ใหม่ด้านล่าง" : ""
  } />;
}

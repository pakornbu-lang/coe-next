import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "@/components/auth/PasswordResetForms";

export const metadata = { title: "ตั้งรหัสผ่านใหม่" };

export default async function ResetPasswordPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/forgot-password?error=expired");
  return <NewPasswordForm/>;
}

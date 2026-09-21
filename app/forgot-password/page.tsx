import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/server";
import { homeForRole } from "@/lib/auth/types";
import { ForgotPasswordForm } from "@/components/auth/PasswordResetForms";

export const metadata = { title: "ลืมรหัสผ่าน" };

export default async function ForgotPasswordPage() {
  const viewer = await getViewer();
  if (viewer) redirect(homeForRole(viewer.role));
  return <ForgotPasswordForm/>;
}

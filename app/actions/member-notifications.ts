"use server";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
export async function readMemberNotification(id?: string) {
  await requireRole(["staff", "committee", "admin"]);
  if (id !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return { error: "รหัสการแจ้งเตือนไม่ถูกต้อง" };
  const client = await createClient();
  const { error } = id === undefined
    ? await client.rpc("mark_all_my_notifications_read")
    : await client.rpc("mark_my_notification_read", { p_notification_id: id });
  if (error) return { error: "บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่" };
  revalidatePath("/", "layout");
  return { error: "" };
}
export async function retryNotificationEmail(form: FormData) {
  await requireRole(["admin"]);
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("รหัสรายการไม่ถูกต้อง");
  const client = await createClient();
  const { error } = await client.rpc("admin_retry_notification_email", { p_id: id });
  if (error) throw new Error("เข้าคิวใหม่ไม่สำเร็จ กรุณารีเฟรชและตรวจสถานะรายการ");
  revalidatePath("/admin/notifications");
}

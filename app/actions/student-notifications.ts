"use server";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function readStudentNotification(id?: string) {
  await requireRole(["student"]);
  if (id !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    return { error: "รหัสการแจ้งเตือนไม่ถูกต้อง" };
  const client = await createClient();
  const { error } = id === undefined
    ? await client.rpc("mark_all_my_student_notifications_read")
    : await client.rpc("mark_my_notification_read", { p_notification_id: id });
  if (error) return { error: "บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่" };
  revalidatePath("/", "layout");
  return { error: "" };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function markNotificationRead(notificationId: string) {
  await requireViewer();
  if (!uuid(notificationId)) return;
  const client = await createClient();
  const { error } = await client.rpc("mark_my_notification_read", { p_notification_id: notificationId });
  if (!error) revalidatePath("/", "layout");
}

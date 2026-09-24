import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/scholarships/types";

export async function getUnreadNotificationCount(userId: string) {
  const client = await createClient();
  const { count, error } = await client.from("portal_notifications")
    .select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  if (error) throw new Error("Notification count unavailable");
  return { unread: count ?? 0 };
}

export async function getStudentNotifications(userId: string, page: number, unreadOnly: boolean) {
  const client = await createClient();
  // Count separately so an out-of-range page still returns 200 with an empty list.
  const own = () => client.from("portal_notifications").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const [total, unread] = await Promise.all([own(), own().is("read_at", null)]);
  if (total.error || unread.error) throw new Error("Notification count unavailable");
  let query = client.from("portal_notifications")
    .select("id,title,body,href,read_at,created_at").eq("user_id", userId)
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (unreadOnly) query = query.is("read_at", null);
  const count = (unreadOnly ? unread.count : total.count) ?? 0;
  const offset = (page - 1) * 20;
  if (offset >= count) return { items: [] as Notification[], unread: unread.count ?? 0, total: count, page };
  const result = await query.range(offset, offset + 19);
  if (result.error) throw new Error("Notifications unavailable");
  return { items: (result.data ?? []) as Notification[], unread: unread.count ?? 0, total: count, page };
}

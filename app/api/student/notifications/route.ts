import { getViewer } from "@/lib/auth/server";
import { getStudentNotifications } from "@/lib/notifications/student";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});
export async function GET(request: Request) {
  try {
    const viewer = await getViewer();
    if (!viewer) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
    if (viewer.role !== "student") return json({ error: "สำหรับนักศึกษาเท่านั้น" }, 403);
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? "1");
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return json({ error: "เลขหน้าไม่ถูกต้อง" }, 400);
    return json(await getStudentNotifications(viewer.id, page, params.get("unread") === "true"));
  } catch {
    return json({ error: "โหลดการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่" }, 503);
  }
}

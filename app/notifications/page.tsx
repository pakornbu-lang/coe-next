import { requireViewer } from "@/lib/auth/server";
import { roleLabels } from "@/lib/auth/types";
import StudentNotifications from "@/components/portal/StudentNotifications";
export const metadata = { title: "การแจ้งเตือนของฉัน" };
export default async function NotificationsPage() {
  const viewer = await requireViewer();
  return <section><h1>การแจ้งเตือนของฉัน</h1>
    <p>การแจ้งเตือนสำหรับ{roleLabels[viewer.role]} · แสดงเฉพาะรายการที่ส่งถึงคุณ</p>
    <StudentNotifications key={viewer.id} audience={viewer.role === "student" ? "student" : "member"} />
  </section>;
}

import { requireRole } from "@/lib/auth/server";
import StudentNotifications from "@/components/portal/StudentNotifications";
export const metadata = { title: "การแจ้งเตือนของฉัน" };
export default async function NotificationsPage() {
  const viewer = await requireRole(["student"]);
  return <section><h1>การแจ้งเตือนของฉัน</h1>
    <p>ติดตามข่าวสารและความคืบหน้าของใบสมัครทุนการศึกษา</p>
    <StudentNotifications key={viewer.id} />
  </section>;
}

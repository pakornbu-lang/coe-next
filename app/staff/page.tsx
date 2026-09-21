import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { listStaffApplications, listStaffScholarships } from "@/lib/scholarships/server";
import { ApplicationStatusBadge } from "@/components/workflow/StatusBadge";

export const metadata = { title: "แดชบอร์ดเจ้าหน้าที่" };
export default async function StaffDashboardPage() {
  const viewer = await requireRole(["staff"]);
  const [applications, scholarships] = await Promise.all([listStaffApplications(), listStaffScholarships()]);
  const count = (statuses: string[]) => applications.filter((item) => statuses.includes(item.status)).length;
  return <div className="workflow-stack"><section className="panel workflow-heading"><div><span className="workflow-eyebrow">STAFF DASHBOARD</span><h1>สวัสดี {viewer.fullName}</h1><p>จัดการรอบทุน ตรวจเอกสาร มอบหมายกรรมการ และบันทึกผลจากพื้นที่เดียว</p></div><Link className="btn" href="/scholarships/new">สร้างทุนใหม่</Link></section><div className="workflow-stat-grid"><Link className="panel" href="/staff/scholarships"><strong>{scholarships.filter((item) => item.status === "published").length}</strong><span>ทุนที่เปิดรับ</span></Link><Link className="panel" href="/staff/review?status=submitted"><strong>{count(["submitted", "revision_requested"])}</strong><span>รอตรวจเอกสาร</span></Link><Link className="panel" href="/staff/review?status=committee_review"><strong>{count(["committee_review"])}</strong><span>รอผลกรรมการ</span></Link><Link className="panel" href="/staff/review?status=approved"><strong>{count(["approved"])}</strong><span>อนุมัติ / รอจ่าย</span></Link></div><section className="panel"><div className="workflow-section-title"><h2>ใบสมัครที่ต้องดำเนินการ</h2><Link href="/staff/review">ดูทั้งหมด</Link></div><div className="workflow-row-list">{applications.filter((item) => ["submitted", "revision_requested", "ready_for_review", "committee_review", "approved"].includes(item.status)).slice(0, 8).map((item) => <Link key={item.id} href={`/staff/review/${item.id}`}><span><strong>{item.student_name} · {item.scholarship?.title ?? "ทุนการศึกษา"}</strong><small>#{item.application_no}</small></span><ApplicationStatusBadge status={item.status}/></Link>)}</div></section></div>;
}

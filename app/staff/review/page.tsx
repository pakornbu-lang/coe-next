import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { listStaffApplications } from "@/lib/scholarships/server";
import { applicationStatusLabels } from "@/lib/scholarships/types";
import { ApplicationStatusBadge } from "@/components/workflow/StatusBadge";

export const metadata = { title: "ตรวจสอบใบสมัคร" };
export default async function StaffReviewListPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireRole(["staff"]);
  const { status = "", q = "" } = await searchParams;
  const applications = await listStaffApplications(status || undefined, q);
  return <div className="workflow-stack"><section className="panel workflow-heading"><div><span className="workflow-eyebrow">APPLICATION REVIEW</span><h1>ตรวจสอบใบสมัคร</h1><p>ตรวจเอกสาร มอบหมายกรรมการ และบันทึกผลการพิจารณา</p></div></section><form method="get" className="workflow-search"><label>ค้นหา<input name="q" defaultValue={q} maxLength={100} placeholder="ชื่อ รหัสนักศึกษา เลขใบสมัคร หรือชื่อทุน"/></label><label>สถานะ<select name="status" defaultValue={status}><option value="">ทุกสถานะ</option>{Object.entries(applicationStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="btn">ค้นหา</button></form><p className="workflow-count">พบ {applications.length} รายการ</p><div className="workflow-row-list workflow-list-large">{applications.map((item) => <Link key={item.id} href={`/staff/review/${item.id}`}><span><strong>{item.student_name} · {item.scholarship?.title ?? "ทุนการศึกษา"}</strong><small>ใบสมัคร #{item.application_no} · รหัสนักศึกษา {item.student_code}</small></span><ApplicationStatusBadge status={item.status}/></Link>)}</div>{!applications.length && <section className="panel workflow-empty">ไม่พบใบสมัครตามเงื่อนไขที่ค้นหา</section>}</div>;
}

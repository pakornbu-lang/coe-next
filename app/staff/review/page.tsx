import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { listStaffApplications } from "@/lib/scholarships/server";
import { applicationStatusLabels } from "@/lib/scholarships/types";
import { ApplicationStatusBadge } from "@/components/workflow/StatusBadge";

export const metadata = { title: "ตรวจสอบใบสมัคร" };
export default async function StaffReviewListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole(["staff"]);
  const { status = "" } = await searchParams;
  const applications = await listStaffApplications(status || undefined);
  return <div className="workflow-stack"><section className="panel workflow-heading"><div><span className="workflow-eyebrow">APPLICATION REVIEW</span><h1>ตรวจสอบใบสมัคร</h1><p>ตรวจเอกสาร มอบหมายกรรมการ และบันทึกผลการพิจารณา</p></div></section><form method="get" className="workflow-search"><label>สถานะ<select name="status" defaultValue={status}><option value="">ทุกสถานะ</option>{Object.entries(applicationStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="btn">กรองรายการ</button></form><div className="workflow-row-list workflow-list-large">{applications.map((item) => <Link key={item.id} href={`/staff/review/${item.id}`}><span><strong>{item.student_name} · {item.scholarship?.title ?? "ทุนการศึกษา"}</strong><small>ใบสมัคร #{item.application_no} · รหัสนักศึกษา {item.student_code}</small></span><ApplicationStatusBadge status={item.status}/></Link>)}</div>{!applications.length && <section className="panel workflow-empty">ไม่พบใบสมัครในสถานะนี้</section>}</div>;
}

import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { listStudentApplications } from "@/lib/scholarships/server";
import { thaiDate } from "@/lib/scholarships/types";
import { ApplicationStatusBadge } from "@/components/workflow/StatusBadge";

export const metadata = { title: "ใบสมัครของฉัน" };
export default async function ApplicationsPage() {
  await requireRole(["student"]);
  const applications = await listStudentApplications();
  return <div className="workflow-stack"><section className="panel workflow-heading"><div><span className="workflow-eyebrow">MY APPLICATIONS</span><h1>ใบสมัครของฉัน</h1><p>ดูสถานะ เอกสาร และผลการพิจารณาของทุกใบสมัคร</p></div><Link className="btn" href="/scholarships">ค้นหาทุน</Link></section>{applications.length ? <div className="workflow-row-list workflow-list-large">{applications.map((item) => <Link key={item.id} href={`/applications/${item.id}`}><span><strong>{item.scholarship?.title ?? "ทุนการศึกษา"}</strong><small>ใบสมัคร #{item.application_no} · อัปเดต {thaiDate(item.updated_at, true)}</small></span><ApplicationStatusBadge status={item.status}/></Link>)}</div> : <section className="panel workflow-empty">ยังไม่มีใบสมัคร <Link href="/scholarships">เริ่มค้นหาทุนที่เปิดรับ</Link></section>}</div>;
}

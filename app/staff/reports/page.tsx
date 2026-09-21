import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { listStaffApplications, listStaffScholarships } from "@/lib/scholarships/server";
import { applicationStatusLabels, money } from "@/lib/scholarships/types";
import ReportActions from "@/components/workflow/ReportActions";

export const metadata = { title: "รายงานทุนการศึกษา" };

export default async function StaffReportsPage() {
  await requireRole(["staff"]);
  const [applications, scholarships] = await Promise.all([listStaffApplications(), listStaffScholarships()]);
  const approved = applications.filter((item) => item.status === "approved");
  const totalApproved = approved.reduce((sum, item) => sum + Number(item.scholarship?.amount ?? 0), 0);
  const counts = Object.entries(applicationStatusLabels).map(([status, label]) => ({ status, label, count: applications.filter((item) => item.status === status).length }));
  return <div className="workflow-stack report-page"><section className="panel workflow-heading"><div><span className="workflow-eyebrow">REPORTS</span><h1>รายงานทุนการศึกษา</h1><p>สรุปใบสมัคร ผลการพิจารณา และงบประมาณสำหรับตรวจสอบหรือส่งต่อ</p></div><div className="workflow-actions no-print"><Link className="btn" href="/staff/reports/applications.csv">ดาวน์โหลดใบสมัคร CSV</Link><Link className="btn secondary" href="/staff/reports/disbursements.csv">ดาวน์โหลดการจ่ายเงิน CSV</Link><ReportActions/></div></section><div className="workflow-stat-grid"><section className="panel"><strong>{scholarships.length}</strong><span>รอบทุนทั้งหมด</span></section><section className="panel"><strong>{applications.length}</strong><span>ใบสมัครทั้งหมด</span></section><section className="panel"><strong>{approved.length}</strong><span>อนุมัติแล้ว</span></section><section className="panel"><strong>{money(totalApproved)}</strong><span>มูลค่าที่อนุมัติ (บาท)</span></section></div><section className="panel"><h2>สรุปตามสถานะ</h2><div className="report-status-grid">{counts.map((item) => <Link key={item.status} href={`/staff/review?status=${item.status}`}><span>{item.label}</span><strong>{item.count}</strong></Link>)}</div></section><section className="panel"><h2>สรุปแต่ละทุน</h2><div className="workflow-score-table"><table><thead><tr><th>ทุน</th><th>โควตา</th><th>ใบสมัคร</th><th>อนุมัติ</th><th>วงเงินสูงสุด</th></tr></thead><tbody>{scholarships.map((scholarship) => { const related = applications.filter((item) => item.scholarship_id === scholarship.id); const approvedCount = related.filter((item) => item.status === "approved").length; return <tr key={scholarship.id}><td>{scholarship.title}</td><td>{scholarship.quota}</td><td>{related.length}</td><td>{approvedCount}</td><td>{money(scholarship.amount * scholarship.quota)} บาท</td></tr>; })}</tbody></table></div></section></div>;
}

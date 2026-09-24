import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { listStaffApplications } from "@/lib/scholarships/server";
import { applicationStatusLabels, type ApplicationStatus } from "@/lib/scholarships/types";
import { ApplicationStatusBadge } from "@/components/workflow/StatusBadge";

export const metadata = { title: "จัดการใบสมัคร" };
const stages: { id: string; label: string; description: string; statuses: ApplicationStatus[] }[] = [
  { id: "documents", label: "ตรวจเอกสาร", description: "ตรวจความครบถ้วนของใบสมัครและเอกสาร หรือติดตามรายการที่ส่งกลับแก้ไข", statuses: ["submitted", "revision_requested"] },
  { id: "evaluation", label: "รอผลพิจารณา", description: "มอบหมายกรรมการ ติดตามคะแนน และบันทึกผลการพิจารณา", statuses: ["ready_for_review", "committee_review"] },
  { id: "payment", label: "การจ่ายทุน", description: "ใบสมัครที่อนุมัติแล้ว เปิดรายการเพื่อบันทึกหรือตรวจสอบการจ่ายเงินและหลักฐาน", statuses: ["approved"] },
  { id: "all", label: "ทั้งหมด", description: "ค้นหาใบสมัครทุกสถานะ รวมฉบับร่าง รายชื่อสำรอง และรายการที่ไม่อนุมัติ", statuses: [] },
];

export default async function StaffReviewListPage({ searchParams }: {
  searchParams: Promise<{ stage?: string; status?: string; q?: string; application?: string }>;
}) {
  await requireRole(["staff"]);
  const { stage: requestedStage, status: requestedStatus = "", q = "", application } = await searchParams;
  if (application && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(application)) {
    redirect(`/staff/review/${application}`);
  }
  const validStatus = Object.hasOwn(applicationStatusLabels, requestedStatus) ? requestedStatus as ApplicationStatus : undefined;
  // Keep existing dashboard/bookmark links with ?status= working.
  const legacyStage = validStatus ? stages.find(item => item.statuses.includes(validStatus)) ?? stages[3] : stages[0];
  const stage = stages.find(item => item.id === requestedStage) ?? legacyStage;
  const status = validStatus && (!stage.statuses.length || stage.statuses.includes(validStatus)) ? validStatus : "";
  const applications = await listStaffApplications(status || (stage.statuses.length ? stage.statuses : undefined), q);
  const statusOptions = stage.statuses.length ? stage.statuses : Object.keys(applicationStatusLabels) as ApplicationStatus[];

  return <div className="workflow-stack">
    <section className="panel workflow-heading"><div>
      <span className="workflow-eyebrow">APPLICATION MANAGEMENT</span>
      <h1>จัดการใบสมัคร</h1><p>ติดตามใบสมัครตั้งแต่ตรวจเอกสาร พิจารณาผล จนถึงการจ่ายทุน</p>
    </div></section>
    <nav className="application-stage-tabs" aria-label="ขั้นตอนจัดการใบสมัคร">
      {stages.map(item => {
        const params = new URLSearchParams({ stage: item.id });
        if (q) params.set("q", q);
        return <Link key={item.id} href={`/staff/review?${params}`} scroll={false}
          className={stage.id === item.id ? "active" : undefined}
          aria-current={stage.id === item.id ? "page" : undefined}>{item.label}</Link>;
      })}
    </nav>
    <p className="workflow-muted">{stage.description}</p>
    <form key={`${stage.id}:${status}:${q}`} method="get" action="/staff/review" className="workflow-search">
      <input type="hidden" name="stage" value={stage.id}/>
      <label>ค้นหา<input name="q" defaultValue={q} maxLength={100} placeholder="ชื่อ รหัสนักศึกษา เลขใบสมัคร หรือชื่อทุน"/></label>
      <label>สถานะ<select name="status" defaultValue={status}>
        <option value="">{stage.id === "all" ? "ทุกสถานะ" : "ทุกสถานะในขั้นตอนนี้"}</option>
        {statusOptions.map(key => <option key={key} value={key}>{applicationStatusLabels[key]}</option>)}
      </select></label><button className="btn">ค้นหา</button>
    </form>
    <p className="workflow-count">แสดง {applications.length} รายการ{applications.length === 200 ? " (สูงสุด 200 รายการล่าสุด กรุณาระบุเงื่อนไขเพิ่มเติม)" : ""}</p>
    <div className="workflow-row-list workflow-list-large">{applications.map(item =>
      <Link key={item.id} href={`/staff/review/${item.id}`}><span>
        <strong>{item.student_name} · {item.scholarship?.title ?? "ทุนการศึกษา"}</strong>
        <small>ใบสมัคร #{item.application_no} · รหัสนักศึกษา {item.student_code}</small>
      </span><ApplicationStatusBadge status={item.status}/></Link>
    )}</div>
    {!applications.length && <section className="panel workflow-empty">ไม่พบใบสมัครตามเงื่อนไขในขั้นตอนนี้</section>}
  </div>;
}

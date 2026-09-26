import { requireRole } from "@/lib/auth/server";
import Link from "next/link";
import { thaiDate } from "@/lib/scholarships/types";
import { listCommitteeAssignments } from "@/lib/scholarships/server";

export const metadata = { title: "พื้นที่กรรมการ" };
// หน้ารวมงานประเมิน /committee ใช้ listCommitteeAssignments ซึ่งอ่าน review_assignments ภายใต้ RLS
// แก้ข้อความและการ์ดงาน: หน้านี้ | เพิ่มข้อมูลที่แสดง: select ใน lib/scholarships/server.ts
// ลิงก์เริ่มประเมินส่ง id ของงานมอบหมายไป /staff/evaluation ไม่ใช่ id ใบสมัคร
export default async function CommitteePage() {
  const viewer = await requireRole(["committee"]) /* ข้อมูลผู้ใช้ที่ผ่านการตรวจสิทธิ์แล้ว */;
  const assignments = await listCommitteeAssignments() /* รายการงานมอบหมายกรรมการ */;
  return <div className="workflow-stack"><section className="panel workflow-heading"><div><span className="workflow-eyebrow">COMMITTEE WORKSPACE</span><h1>สวัสดี {viewer.fullName}</h1><p>ใบสมัครที่มอบหมายให้คุณจะปรากฏด้านล่าง ข้อมูลบัญชีรับเงินถูกซ่อนไว้จากกรรมการ</p></div></section><section className="panel"><h2>งานที่รอประเมิน</h2>{assignments.length ? <div className="workflow-row-list workflow-list-large">{assignments.map((item) => { const application = Array.isArray(item.application) ? item.application[0] : item.application /* ข้อมูลใบสมัคร */; const scholarship = application?.scholarship && (Array.isArray(application.scholarship) ? application.scholarship[0] : application.scholarship) /* ข้อมูลทุนที่ใบสมัครอ้างถึง */; return <Link key={item.id} href={`/staff/evaluation?assignment=${item.id}`}><span><strong>{application?.student_name ?? "ผู้สมัคร"} · {scholarship?.title ?? "ทุนการศึกษา"}</strong><small>ใบสมัคร #{application?.application_no ?? "—"} · {item.reason} · กำหนดส่ง {item.due_at ? thaiDate(item.due_at,true) : "ยังไม่กำหนด"}</small></span><span>เริ่มประเมิน ›</span></Link>; })}</div> : <div className="workflow-empty">ไม่มีงานประเมินที่รอคุณอยู่</div>}</section></div>;
}

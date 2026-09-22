import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { listPublishedScholarships, listStudentApplications } from "@/lib/scholarships/server";
import { createClient } from "@/lib/supabase/server";
import { missingStudentProfileFields } from "@/lib/account/profile-completion";
import { ApplicationStatusBadge } from "@/components/workflow/StatusBadge";

export const metadata = { title: "แดชบอร์ดนักศึกษา" };
export default async function StudentDashboardPage() {
  const viewer = await requireRole(["student"]);
  const client = await createClient();
  const [applications, scholarships, { data: profile, error: profileError }] = await Promise.all([
    listStudentApplications(),
    listPublishedScholarships(),
    client.from("portal_profiles").select("phone,department,profile_details").eq("id", viewer.id).single(),
  ]);
  if (profileError || !profile) throw new Error("โหลดข้อมูลโปรไฟล์ไม่สำเร็จ");
  const missing = missingStudentProfileFields(profile);
  const active = applications.filter((item) => !["approved", "reserve", "rejected"].includes(item.status));
  return <div className="workflow-stack">
    <section className="panel workflow-heading"><div><span className="workflow-eyebrow">STUDENT DASHBOARD</span><h1>สวัสดี {viewer.fullName}</h1><p>ติดตามทุนที่สนใจและสถานะใบสมัครของคุณได้จากหน้านี้</p></div></section>
    {missing.length > 0 && <section className="panel workflow-profile-prompt" aria-labelledby="profile-prompt-title">
      <div><span className="workflow-eyebrow">เตรียมพร้อมสมัครทุน</span><h2 id="profile-prompt-title">เติมโปรไฟล์เพื่อสมัครทุนได้เร็วขึ้น</h2>
        <p>ข้อมูลที่กรอกไว้จะถูกเติมในใบสมัครทุนเบื้องต้น คุณยังแก้ไขและตรวจทานได้ก่อนส่ง</p>
        <p className="workflow-profile-missing"><strong>ยังขาด {missing.length} รายการ:</strong> {missing.join(" · ")}</p>
      </div>
      <Link className="btn" href="/profile?edit=1#profile-editor">จัดการโปรไฟล์</Link>
    </section>}
    <div className="workflow-stat-grid"><Link className="panel" href="/scholarships"><strong>{scholarships.filter((item) => item.status === "published").length}</strong><span>ทุนที่เปิดรับ</span></Link><Link className="panel" href="/applications"><strong>{active.length}</strong><span>ใบสมัครที่กำลังดำเนินการ</span></Link><Link className="panel" href="/applications"><strong>{applications.filter((item) => item.status === "approved").length}</strong><span>ได้รับการอนุมัติ</span></Link></div>
    <section className="panel"><div className="workflow-section-title"><h2>ใบสมัครล่าสุด</h2><Link href="/applications">ดูทั้งหมด</Link></div>{applications.length ? <div className="workflow-row-list">{applications.slice(0, 5).map((item) => <Link href={`/applications/${item.id}`} key={item.id}><span><strong>{item.scholarship?.title ?? "ทุนการศึกษา"}</strong><small>ใบสมัคร #{item.application_no}</small></span><ApplicationStatusBadge status={item.status}/></Link>)}</div> : <div className="workflow-empty">คุณยังไม่มีใบสมัคร <Link href="/scholarships">ค้นหาทุนที่เปิดรับ</Link></div>}</section>
    <section className="panel"><div className="workflow-section-title"><h2>ทุนที่กำลังเปิดรับ</h2><Link href="/scholarships">ดูทั้งหมด</Link></div><div className="workflow-row-list">{scholarships.filter((item) => item.status === "published").slice(0, 4).map((item) => <Link key={item.id} href={`/scholarships/${item.id}`}><span><strong>{item.title}</strong><small>ปิดรับ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(item.closes_at))}</small></span><span>สมัคร ›</span></Link>)}</div></section>
  </div>;
}

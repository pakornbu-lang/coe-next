import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { getScholarship, listStaffScholarships } from "@/lib/scholarships/server";
import { createClient } from "@/lib/supabase/server";
import ScholarshipEditor from "@/components/workflow/ScholarshipEditor";
import { ScholarshipStatusBadge } from "@/components/workflow/StatusBadge";
import { money, thaiDate } from "@/lib/scholarships/types";

const programLabels: Record<string, string> = { academic: "ผลการเรียนดี", financial_need: "ขาดแคลนทุนทรัพย์", activity: "กิจกรรม", talent: "ความสามารถพิเศษ", research: "วิจัย", emergency: "ฉุกเฉิน", general: "ทั่วไป" };

export const metadata = { title: "จัดการทุนการศึกษา" };
export default async function StaffScholarshipsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireRole(["staff"]);
  const { edit } = await searchParams;
  const client = await createClient();
  const [scholarships, typesResult, selected] = await Promise.all([
    listStaffScholarships(),
    client.from("portal_reference_data").select("id,name").eq("kind", "scholarship_type").eq("active", true).order("name"),
    edit ? getScholarship(edit) : Promise.resolve(null),
  ]);
  return <div className="workflow-stack"><section className="panel workflow-heading"><div><span className="workflow-eyebrow">SCHOLARSHIP MANAGEMENT</span><h1>จัดการทุนการศึกษา</h1><p>สร้างทุนจากแม่แบบ กำหนดเงื่อนไข อัปโหลดภาพปก และติดตามรอบรับสมัครได้ในที่เดียว</p></div><Link className="btn" href="/scholarships/new">สร้างทุนใหม่</Link></section>{edit && selected ? <ScholarshipEditor scholarship={selected} types={typesResult.data ?? []}/> : <><section className="panel"><h2>รายการทุน</h2>{scholarships.length ? <div className="workflow-row-list workflow-list-large">{scholarships.map((item) => <article key={item.id}><span><strong>{item.title}</strong><small>{programLabels[item.program_kind] ?? "ทั่วไป"} · {money(item.amount)} บาท · {item.quota} คน · ปิดรับ {thaiDate(item.closes_at, true)}</small></span><span className="workflow-actions"><ScholarshipStatusBadge status={item.status}/><Link className="btn secondary" href={`/staff/scholarships?edit=${item.id}`}>แก้ไข</Link></span></article>)}</div> : <div className="workflow-empty">ยังไม่มีทุน <Link href="/scholarships/new">สร้างทุนแรก</Link></div>}</section></>}</div>;
}

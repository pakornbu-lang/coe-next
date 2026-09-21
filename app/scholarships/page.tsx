import Link from "next/link";
import { listPublishedScholarships } from "@/lib/scholarships/server";
import { money, thaiDate } from "@/lib/scholarships/types";
import { ScholarshipStatusBadge } from "@/components/workflow/StatusBadge";

export const metadata = { title: "ทุนการศึกษา" };

export default async function ScholarshipsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const items = await listPublishedScholarships();
  const search = q.trim().toLocaleLowerCase("th-TH");
  const filtered = search ? items.filter((item) => `${item.title} ${item.description} ${item.eligibility}`.toLocaleLowerCase("th-TH").includes(search)) : items;
  return <div className="workflow-stack"><section className="workflow-heading panel"><div><span className="workflow-eyebrow">SCHOLARSHIPS</span><h1>ค้นหาทุนการศึกษา</h1><p>เลือกทุนที่เหมาะกับคุณ และตรวจสอบคุณสมบัติก่อนเริ่มสมัคร</p></div></section><form className="workflow-search" method="get"><label>ค้นหาทุน<input name="q" defaultValue={q} maxLength={100} placeholder="ชื่อทุน คุณสมบัติ หรือคำสำคัญ"/></label><button className="btn">ค้นหา</button></form><p className="workflow-count">พบ {filtered.length} ทุน</p><div className="workflow-card-grid">{filtered.map((item) => <article className="panel workflow-scholarship-card" key={item.id}><div className="workflow-card-head"><ScholarshipStatusBadge status={item.status}/>{item.minimum_gpa !== null && <span>GPA ขั้นต่ำ {item.minimum_gpa.toFixed(2)}</span>}</div><h2>{item.title}</h2><p>{item.description || "ดูรายละเอียดคุณสมบัติและขั้นตอนสมัคร"}</p><dl><div><dt>จำนวนทุน</dt><dd>{item.quota} คน</dd></div><div><dt>มูลค่าต่อทุน</dt><dd>{money(item.amount)} บาท</dd></div><div><dt>ปิดรับสมัคร</dt><dd>{thaiDate(item.closes_at, true)}</dd></div></dl><div className="workflow-actions"><Link className="btn secondary" href={`/scholarships/${item.id}`}>ดูรายละเอียด</Link><Link className="btn" href={`/apply?scholarship=${item.id}`}>สมัครทุน</Link></div></article>)}</div>{!filtered.length && <section className="panel workflow-empty">ยังไม่พบทุนที่ตรงกับคำค้นหา</section>}</div>;
}

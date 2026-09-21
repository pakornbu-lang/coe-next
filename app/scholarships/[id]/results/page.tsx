import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getScholarship } from "@/lib/scholarships/server";
import { thaiDate } from "@/lib/scholarships/types";

const resultLabel: Record<string, string> = { approved: "ได้รับทุน", reserve: "รายชื่อสำรอง", rejected: "ไม่ได้รับทุน" };

export const metadata = { title: "ประกาศผลทุนการศึกษา" };
export default async function ScholarshipResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scholarship = await getScholarship(id);
  if (!scholarship) notFound();
  const client = await createClient();
  const { data, error } = await client.rpc("published_scholarship_results", { p_scholarship_id: id });
  const rows = error ? [] : (data ?? []) as { application_no: number; result: string; decided_at: string }[];
  const published = Boolean(scholarship.results_published_at) && !error;

  return <div className="workflow-stack">
    <section className="panel workflow-heading"><div><span className="workflow-eyebrow">SCHOLARSHIP RESULTS</span><h1>ประกาศผล {scholarship.title}</h1><p>{published ? `ประกาศเมื่อ ${thaiDate(scholarship.results_published_at!, true)}` : "ผลการพิจารณายังไม่เผยแพร่"}</p></div></section>
    <section className="panel">{published ? rows.length ? <div className="workflow-score-table"><table><thead><tr><th>เลขที่ใบสมัคร</th><th>ผลการพิจารณา</th></tr></thead><tbody>{rows.map((row) => <tr key={row.application_no}><td>#{row.application_no}</td><td><strong>{resultLabel[row.result] ?? row.result}</strong></td></tr>)}</tbody></table></div> : <p className="workflow-empty">ยังไม่มีผลการพิจารณาในรอบนี้</p> : <p className="workflow-empty">เจ้าหน้าที่ยังไม่ประกาศผล กรุณาตรวจสอบอีกครั้งภายหลัง</p>}</section>
    {published && scholarship.appeal_deadline && <section className="panel workflow-info">ผู้สมัครที่มีสิทธิ์อุทธรณ์สามารถส่งคำอุทธรณ์จากหน้าใบสมัครของตนได้ถึง {thaiDate(scholarship.appeal_deadline, true)}</section>}
    <div className="workflow-actions"><Link className="btn secondary" href={`/scholarships/${id}`}>กลับรายละเอียดทุน</Link></div>
  </div>;
}

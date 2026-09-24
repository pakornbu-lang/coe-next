import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { getCommitteeAssignment, getScholarship } from "@/lib/scholarships/server";
import { thaiDate } from "@/lib/scholarships/types";

export const metadata = { title: "สรุปผลประเมินของฉัน" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["committee"]);
  const { id } = await params;
  const detail = await getCommitteeAssignment(id);
  if (!detail) notFound();
  const evaluation = detail.evaluation as { scores: { criterion_id: string; score: number; comment: string }[]; submitted_at: string | null; total_score: number; recommendation: string; comment: string } | null;
  const scholarship = await getScholarship(detail.scholarship.id);
  if (!scholarship) notFound();
  return <div className="workflow-stack"><section className="panel"><h1>สรุปผลประเมินของฉัน</h1>
    <p>ใบสมัคร #{detail.application.application_no} · {detail.application.student_name}</p><p>{scholarship.title}</p></section>
    {evaluation?.submitted_at ? <section className="panel"><h2>ส่งผลประเมินเรียบร้อยแล้ว</h2>
      <p>ส่งเมื่อ {thaiDate(evaluation.submitted_at, true)} · ไม่สามารถแก้ไขคะแนนหลังส่ง</p>
      <div className="workflow-score-table"><table><thead><tr><th>เกณฑ์</th><th>คะแนนที่ให้ / คะแนนเต็ม</th><th>ความเห็น</th></tr></thead>
        <tbody>{scholarship.criteria.map(criterion => {
          const score = evaluation.scores.find(item => item.criterion_id === criterion.id);
          return <tr key={criterion.id}><td>{criterion.label}</td><td>{score?.score ?? "—"} / {criterion.max_score}</td><td>{score?.comment || "—"}</td></tr>;
        })}</tbody></table></div><p>คะแนนรวม <strong>{evaluation.total_score}</strong></p>
      <p>ข้อเสนอ: {({ approve: "เสนออนุมัติ", reserve: "เสนอรายชื่อสำรอง", reject: "ไม่เสนออนุมัติ" } as Record<string, string>)[evaluation.recommendation] ?? "—"}</p>
      <p className="workflow-preserve">{evaluation.comment || "ไม่มีความเห็นเพิ่มเติม"}</p>
      <p className="workflow-info">เจ้าหน้าที่จะรวบรวมผลประเมินและพิจารณาผลต่อไป ข้อเสนอของกรรมการยังไม่ใช่ผลประกาศให้นักศึกษา</p>
    </section> : <section className="panel"><p>ยังไม่ได้ส่งผลประเมิน</p><Link className="btn" href={`/staff/evaluation?assignment=${id}`}>กลับไปประเมิน</Link></section>}
    <Link className="btn secondary" href="/committee">กลับรายการงานของฉัน</Link></div>;
}

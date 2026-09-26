import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { getCommitteeAssignment, getScholarship } from "@/lib/scholarships/server";
import EvaluationPanel from "@/components/workflow/EvaluationPanel";

export const metadata = { title: "ประเมินทุนการศึกษา" };
// หน้ากรอกคะแนน /staff/evaluation?assignment=รหัสงาน ใช้สิทธิ์ committee แม้ URL ขึ้นต้นด้วย staff
// assignment คือ id ของ review_assignments ไม่ใช่ id ของ applications
// แก้ช่องคะแนน/ความคิดเห็น: components/workflow/EvaluationPanel.tsx
// แก้ข้อมูลที่โหลด: getCommitteeAssignment ใน lib/scholarships/server.ts
// แก้การส่งผล: saveEvaluation ใน app/actions/scholarships.ts และ RPC committee_save_evaluation
export default async function EvaluationPage({ searchParams }: { searchParams: Promise<{ assignment?: string /* งานที่มอบหมายให้กรรมการ */ }> }) {
  await requireRole(["committee"]);
  const { assignment } = await searchParams;
  if (!assignment) return <section className="panel workflow-empty"><h1>เลือกงานประเมิน</h1><p>เลือกใบสมัครที่ได้รับมอบหมายจากพื้นที่กรรมการ</p><Link className="btn" href="/committee">ไปพื้นที่กรรมการ</Link></section>;
  const detail = await getCommitteeAssignment(assignment);
  if (!detail) notFound();
// ผลที่ส่งแล้วจะไปหน้าอ่านสรุป หากต้องการให้แก้ผลย้อนหลัง ต้องออกแบบกฎ RPC/สิทธิ์ร่วมด้วย
  if (detail.evaluation?.submitted_at) redirect(`/committee/evaluations/${assignment}`);
  const scholarship = await getScholarship(detail.scholarship.id) /* ข้อมูลทุนที่ใบสมัครอ้างถึง */;
  if (!scholarship) notFound();
  return <EvaluationPanel assignment={detail.assignment} application={detail.application} scholarship={detail.scholarship} criteria={scholarship.criteria} documents={detail.documents} evaluation={detail.evaluation}/>;
}

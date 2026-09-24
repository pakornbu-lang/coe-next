import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { getCommitteeAssignment, getScholarship } from "@/lib/scholarships/server";
import EvaluationPanel from "@/components/workflow/EvaluationPanel";

export const metadata = { title: "ประเมินทุนการศึกษา" };
export default async function EvaluationPage({ searchParams }: { searchParams: Promise<{ assignment?: string }> }) {
  await requireRole(["committee"]);
  const { assignment } = await searchParams;
  if (!assignment) return <section className="panel workflow-empty"><h1>เลือกงานประเมิน</h1><p>เลือกใบสมัครที่ได้รับมอบหมายจากพื้นที่กรรมการ</p><Link className="btn" href="/committee">ไปพื้นที่กรรมการ</Link></section>;
  const detail = await getCommitteeAssignment(assignment);
  if (!detail) notFound();
  if (detail.evaluation?.submitted_at) redirect(`/committee/evaluations/${assignment}`);
  const scholarship = await getScholarship(detail.scholarship.id);
  if (!scholarship) notFound();
  return <EvaluationPanel assignment={detail.assignment} application={detail.application} scholarship={detail.scholarship} criteria={scholarship.criteria} documents={detail.documents} evaluation={detail.evaluation}/>;
}

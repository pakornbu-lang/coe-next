import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { getStaffApplicationDetail } from "@/lib/scholarships/server";
import StaffEvaluationSummary from "@/components/workflow/StaffEvaluationSummary";
import { ApplicationStatusBadge } from "@/components/workflow/StatusBadge";

export const metadata = { title: "สรุปผลประเมินกรรมการ" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["staff"]);
  const { id } = await params;
  const detail = await getStaffApplicationDetail(id);
  if (!detail) notFound();
  return <div className="workflow-stack"><section className="panel workflow-heading"><div>
    <span className="workflow-eyebrow">EVALUATION SUMMARY</span><h1>สรุปผลประเมิน #{detail.application.application_no}</h1>
    <p>{detail.application.student_name} · {detail.scholarship.title}</p></div><ApplicationStatusBadge status={detail.application.status}/></section>
    <StaffEvaluationSummary application={detail.application} assignments={detail.assignments} requiredReviewerCount={detail.scholarship.required_reviewer_count ?? 1}/>
  </div>;
}

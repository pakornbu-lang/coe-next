import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { getStaffApplicationDetail } from "@/lib/scholarships/server";
import StaffReviewPanel from "@/components/workflow/StaffReviewPanel";
import { AppealResolutionForm, InterviewForm } from "@/components/workflow/WorkflowExtensions";

export default async function StaffReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["staff"]);
  const { id } = await params;
  const detail = await getStaffApplicationDetail(id);
  if (!detail) notFound();
  return <div className="workflow-stack">
    <StaffReviewPanel application={{ ...detail.application, scholarship: detail.scholarship }} documents={detail.documents} documentVersions={detail.documentVersions} committees={detail.committees} assignments={detail.assignments} paymentAccount={detail.paymentAccount} disbursement={detail.disbursement} requiredReviewerCount={detail.scholarship.required_reviewer_count ?? 1}/>
    {["ready_for_review", "committee_review"].includes(detail.application.status) && <section className="panel"><h2>นัดสัมภาษณ์</h2><p className="workflow-muted">บันทึกหรือแก้ไขนัด แล้วระบบจะแจ้งนักศึกษาทั้งในเว็บและทางอีเมล</p><InterviewForm applicationId={detail.application.id} interview={detail.interview}/></section>}
    {detail.appeal && <section className="panel"><h2>คำอุทธรณ์ผลการพิจารณา</h2><AppealResolutionForm applicationId={detail.application.id} appeal={detail.appeal}/></section>}
  </div>;
}

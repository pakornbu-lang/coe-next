import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { getStaffApplicationDetail } from "@/lib/scholarships/server";
import StaffReviewPanel from "@/components/workflow/StaffReviewPanel";

export default async function StaffReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["staff"]);
  const { id } = await params;
  const detail = await getStaffApplicationDetail(id);
  if (!detail) notFound();
  return <StaffReviewPanel application={detail.application} documents={detail.documents} committees={detail.committees} assignments={detail.assignments} paymentAccount={detail.paymentAccount} disbursement={detail.disbursement}/>;
}

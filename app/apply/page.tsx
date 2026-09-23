import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { getScholarship, getStudentApplicationEditorData, getStudentProfileHints } from "@/lib/scholarships/server";
import StudentApplicationEditor from "@/components/workflow/StudentApplicationEditor";

export const metadata = { title: "สมัครทุน" };

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ scholarship?: string; application?: string }>;
}) {
  await requireRole(["student"]);
  const { scholarship: scholarshipId, application: applicationId } = await searchParams;

  if (!scholarshipId) {
    return (
      <section className="panel workflow-empty">
        <h1>เลือกทุนก่อนเริ่มสมัคร</h1>
        <p>เลือกหนึ่งทุนเพื่อสร้างใบสมัครสำหรับรอบรับสมัครนั้น</p>
        <Link className="btn" href="/scholarships">
          ไปหน้าค้นหาทุน
        </Link>
      </section>
    );
  }

  // Load scholarship, application editor data, and student profile in parallel
  const [scholarship, editorData, profile] = await Promise.all([
    getScholarship(scholarshipId),
    getStudentApplicationEditorData(scholarshipId, applicationId),
    getStudentProfileHints(),
  ]);

  if (!scholarship || scholarship.status !== "published") {
    return (
      <section className="panel workflow-empty">
        <h1>ไม่พบทุนที่เปิดรับสมัคร</h1>
        <Link className="btn" href="/scholarships">
          กลับรายการทุน
        </Link>
      </section>
    );
  }

  const { application, documents, paymentAccount } = editorData;

  return (
    <StudentApplicationEditor
      scholarship={scholarship}
      application={application}
      requirements={scholarship.requirements}
      documents={documents}
      paymentAccount={paymentAccount}
      profile={profile}
    />
  );
}

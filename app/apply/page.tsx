import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import {
  getScholarshipForApplication,
  getStudentApplicationEditorData,
  getStudentProfileHints,
} from "@/lib/scholarships/server";
import { isScholarshipOpen } from "@/lib/scholarships/types";
import StudentApplicationEditor from "@/components/workflow/StudentApplicationEditor";

export const metadata = { title: "สมัครทุน" };

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{
    scholarship?: string;
    scholarshipId?: string;
    application?: string;
    applicationId?: string;
  }>;
}) {
  await requireRole(["student"]);
  const params = await searchParams;
  const scholarshipId = params.scholarshipId || params.scholarship;
  const applicationId = params.applicationId || params.application;

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

  // Load lightweight scholarship and application editor data in parallel
  const [scholarship, editorData] = await Promise.all([
    getScholarshipForApplication(scholarshipId),
    getStudentApplicationEditorData(scholarshipId, applicationId),
  ]);

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  if (!scholarship || !isScholarshipOpen(scholarship, now)) {
    return (
      <section className="panel workflow-empty">
        <h1>ไม่พบทุนที่เปิดรับสมัคร</h1>
        <p>
          {!scholarship
            ? "ไม่พบข้อมูลทุนการศึกษานี้"
            : scholarship.status !== "published"
            ? "ทุนนี้ยังไม่ได้เปิดรับสมัครอย่างเป็นทางการ"
            : now < new Date(scholarship.opens_at).getTime()
            ? "ทุนนี้ยังไม่ถึงกำหนดเปิดรับสมัคร"
            : "ทุนนี้ปิดรับสมัครแล้ว"}
        </p>
        <Link className="btn" href="/scholarships">
          กลับรายการทุน
        </Link>
      </section>
    );
  }

  const { application, documents, paymentAccount } = editorData;
  const isEditable =
    !application ||
    ["draft", "revision_requested"].includes(application.status);

  // Requirement 9: หน้า Apply ไม่ควรเรียกข้อมูล SIS/Profile หากใบสมัครส่งแล้วและแก้ไขไม่ได้
  const profile = isEditable ? await getStudentProfileHints() : null;

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

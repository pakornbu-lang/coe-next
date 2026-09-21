import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { getScholarship, getStudentApplicationDetail, getStudentApplicationForScholarship, getStudentProfileHints, listPublishedScholarships } from "@/lib/scholarships/server";
import StudentApplicationEditor from "@/components/workflow/StudentApplicationEditor";

export const metadata = { title: "สมัครทุน" };
export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ scholarship?: string }> }) {
  await requireRole(["student"]);
  const { scholarship: scholarshipId } = await searchParams;
  if (!scholarshipId) {
    const scholarships = await listPublishedScholarships();
    return <section className="panel workflow-empty"><h1>เลือกทุนก่อนเริ่มสมัคร</h1><p>เลือกหนึ่งทุนเพื่อสร้างใบสมัครสำหรับรอบรับสมัครนั้น</p><Link className="btn" href="/scholarships">ไปหน้าค้นหาทุน</Link><ul className="workflow-links">{scholarships.filter((item) => item.status === "published").map((item) => <li key={item.id}><Link href={`/apply?scholarship=${item.id}`}>{item.title}</Link></li>)}</ul></section>;
  }
  const [scholarship, application, profile] = await Promise.all([getScholarship(scholarshipId), getStudentApplicationForScholarship(scholarshipId), getStudentProfileHints()]);
  if (!scholarship || scholarship.status !== "published") return <section className="panel workflow-empty"><h1>ไม่พบทุนที่เปิดรับสมัคร</h1><Link className="btn" href="/scholarships">กลับรายการทุน</Link></section>;
  const detail = application ? await getStudentApplicationDetail(application.id) : null;
  const documents = detail?.documents ?? [];
  return <StudentApplicationEditor scholarship={scholarship} application={application} requirements={scholarship.requirements} documents={documents} paymentAccount={detail?.paymentAccount ?? null} profile={profile}/>;
}

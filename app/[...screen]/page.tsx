import { notFound, redirect } from "next/navigation";
import AuthPage from "@/components/auth/LoginPage";
import { getViewer, requireRole } from "@/lib/auth/server";
import { homeForRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { applicationPrefill } from "@/lib/account/application-prefill";
import {
  Applications,
  Dashboard,
  DetailPage,
  SearchPage,
} from "@/components/portal/StudentPages";
import { ApplyForm } from "@/components/portal/Forms";
import {
  Evaluation,
  ManageScholarships,
  Review,
  StaffDashboard,
} from "@/components/portal/StaffPages";
import { scholarships, screens } from "@/lib/ui-data";
type Props = {
  params: Promise<{ screen: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ params }: Props) {
  const route = "/" + (await params).screen.join("/");
  return {
    title: screens.find(([url]) => url === route)?.[1] || "ทุนการศึกษา",
  };
}
export default async function Page({ params, searchParams }: Props) {
  const path = (await params).screen.join("/");
  if (path === "login" || path === "register") {
    const viewer = await getViewer();
    if (viewer) redirect(homeForRole(viewer.role));
  }
  const studentPages = ["dashboard", "applications", "apply"];
  const student = studentPages.includes(path) ? await requireRole(["student"]) : null;
  const staff = ["staff", "staff/scholarships", "staff/review"].includes(path)
    ? await requireRole(["staff"]) : null;
  if (path === "staff/evaluation") await requireRole(["committee"]);
  if (path === "register") return <AuthPage register />;
  if (path === "login") return <AuthPage />;
  if (path === "dashboard" && student) return <Dashboard viewer={student} />;
  if (path === "scholarships") return <SearchPage />;
  if (path === "applications" && student) return <Applications key={student.id} viewer={student} />;
  if (path === "staff" && staff) return <StaffDashboard viewer={staff} />;
  if (path === "staff/scholarships") return <ManageScholarships />;
  if (path === "staff/evaluation") return <Evaluation />;
  if (path === "staff/review") {
    const query = await searchParams;
    const n = Number(query.applicant || 0);
    return (
      <Review applicant={Number.isInteger(n) && n >= 0 && n < 6 ? n : 0} />
    );
  }
  if (path === "apply" && student) {
    const query = await searchParams;
    const client = await createClient();
    const { data: profile, error } = await client.from("portal_profiles")
      .select("phone,department,profile_details").eq("id", student.id).single();
    if (error || !profile) throw new Error("โหลดข้อมูลสำหรับสมัครทุนไม่สำเร็จ กรุณาลองใหม่");
    const scholarshipId = typeof query.scholarship === "string" ? query.scholarship : "academic";
    return (
      <ApplyForm
        key={`${student.id}:${scholarshipId}`}
        viewer={student}
        initialValues={applicationPrefill(student, profile)}
        currentDate={new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date())}
        scholarshipId={scholarshipId}
      />
    );
  }
  if (path.startsWith("scholarships/")) {
    const s = scholarships.find((s) => path === `scholarships/${s.id}`);
    if (s) return <DetailPage item={s} />;
  }
  notFound();
}

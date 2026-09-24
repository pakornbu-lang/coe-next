import { Landing } from "@/components/portal/PublicPages";
import { getViewer } from "@/lib/auth/server";
import { listLandingScholarships } from "@/lib/scholarships/server";
export default async function Page() {
  const [{ scholarships, total }, viewer] = await Promise.all([listLandingScholarships(), getViewer()]);
  const contact = {
    department: process.env.NEXT_PUBLIC_SUPPORT_DEPARTMENT || "งานทุนการศึกษา มหาวิทยาลัยวลัยลักษณ์",
    phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "",
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
    hours: process.env.NEXT_PUBLIC_SUPPORT_HOURS || "จันทร์ – ศุกร์ 08.30 – 16.30 น.",
  };
  return <Landing scholarships={scholarships} totalScholarships={total} viewer={viewer} contact={contact} />;
}

import { Landing } from "@/components/portal/PublicPages";
import { getViewer } from "@/lib/auth/server";
import { listPublishedScholarships } from "@/lib/scholarships/server";
export default async function Page() {
  const [scholarships, viewer] = await Promise.all([listPublishedScholarships(), getViewer()]);
  const contact = {
    department: process.env.NEXT_PUBLIC_SUPPORT_DEPARTMENT || "งานทุนการศึกษา มหาวิทยาลัยวลัยลักษณ์",
    phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "",
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
    hours: process.env.NEXT_PUBLIC_SUPPORT_HOURS || "จันทร์ – ศุกร์ 08.30 – 16.30 น.",
  };
  return <Landing scholarships={scholarships} viewer={viewer} contact={contact} />;
}

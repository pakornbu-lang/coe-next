import { Landing } from "@/components/portal/PublicPages";
import { getViewer } from "@/lib/auth/server";
import { listPublishedScholarships } from "@/lib/scholarships/server";
export default async function Page() {
  const [scholarships, viewer] = await Promise.all([listPublishedScholarships(), getViewer()]);
  return <Landing scholarships={scholarships} viewer={viewer} />;
}

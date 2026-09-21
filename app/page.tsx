import { Landing } from "@/components/portal/PublicPages";
import { listPublishedScholarships } from "@/lib/scholarships/server";
export default async function Page() {
  const scholarships = await listPublishedScholarships();
  return <Landing scholarships={scholarships} />;
}

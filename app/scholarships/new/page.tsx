import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { getAcademicOptions } from "@/lib/scholarships/server";
import ScholarshipEditor from "@/components/workflow/ScholarshipEditor";

export const metadata: Metadata = { title: "สร้างทุนการศึกษา" };

export default async function NewScholarshipPage() {
  await requireRole(["staff"]);
  const client = await createClient();
  const { data } = await client.from("portal_reference_data").select("id,name").eq("kind", "scholarship_type").eq("active", true).order("name");
  const academicOptions = await getAcademicOptions();
  return (
    <ScholarshipEditor academicOptions={academicOptions} types={data ?? []} />
  );
}

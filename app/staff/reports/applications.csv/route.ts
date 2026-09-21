import type { NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/server";
import { listStaffApplications } from "@/lib/scholarships/server";
import { applicationStatusLabels, money, thaiDate } from "@/lib/scholarships/types";
import { csvResponse } from "@/lib/reports/csv";

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  if (viewer.role !== "staff") return new Response("Forbidden", { status: 403 });
  const status = request.nextUrl.searchParams.get("status") || undefined;
  const applications = await listStaffApplications(status);
  const rows: unknown[][] = [["เลขใบสมัคร", "ชื่อผู้สมัคร", "รหัสนักศึกษา", "ทุน", "สถานะ", "GPA", "รายได้ครอบครัวต่อปี", "วันที่ส่ง"]];
  for (const item of applications) rows.push([item.application_no, item.student_name, item.student_code, item.scholarship?.title ?? "", applicationStatusLabels[item.status], item.application_data.gpa ?? "", item.application_data.income ? money(Number(item.application_data.income)) : "", item.submitted_at ? thaiDate(item.submitted_at, true) : ""]);
  return csvResponse(`scholarship-applications-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

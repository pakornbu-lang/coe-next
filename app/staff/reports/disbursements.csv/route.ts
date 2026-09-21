import { getViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { csvResponse } from "@/lib/reports/csv";
import { money, thaiDate } from "@/lib/scholarships/types";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  if (viewer.role !== "staff") return new Response("Forbidden", { status: 403 });
  const client = await createClient();
  const { data, error } = await client.from("disbursements").select("amount,status,transfer_date,transfer_reference,bank_name_snapshot,account_holder_snapshot,account_number_snapshot,application:applications(application_no,student_name,student_code,scholarship:scholarships(title))").order("updated_at", { ascending: false }).limit(5000);
  if (error) return new Response("Unable to export report", { status: 500 });
  const rows: unknown[][] = [["เลขใบสมัคร", "ชื่อผู้รับทุน", "รหัสนักศึกษา", "ทุน", "จำนวนเงิน", "สถานะ", "วันที่โอน", "เลขอ้างอิง", "ธนาคาร", "ชื่อบัญชี", "เลขบัญชี"]];
  for (const raw of data ?? []) {
    const application = Array.isArray(raw.application) ? raw.application[0] : raw.application;
    const scholarship = application && (Array.isArray(application.scholarship) ? application.scholarship[0] : application.scholarship);
    rows.push([application?.application_no ?? "", application?.student_name ?? "", application?.student_code ?? "", scholarship?.title ?? "", money(Number(raw.amount)), raw.status === "paid" ? "จ่ายแล้ว" : raw.status === "failed" ? "โอนไม่สำเร็จ" : "รอดำเนินการ", raw.transfer_date ? thaiDate(raw.transfer_date) : "", raw.transfer_reference ?? "", raw.bank_name_snapshot, raw.account_holder_snapshot, raw.account_number_snapshot]);
  }
  return csvResponse(`scholarship-disbursements-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  ApplicationDocument,
  ApplicationSummary,
  Criterion,
  Disbursement,
  Notification,
  PaymentAccount,
  Requirement,
  ScholarshipSummary,
} from "./types";

const fail = (message: string): never => {
  throw new Error(message);
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function normalizeApplication(row: Record<string, unknown>): ApplicationSummary {
  const scholarship = first(row.scholarship as ScholarshipSummary | ScholarshipSummary[] | null);
  return { ...(row as unknown as ApplicationSummary), scholarship };
}

export async function listPublishedScholarships(): Promise<ScholarshipSummary[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("scholarships")
    .select("id,title,description,eligibility,amount,quota,minimum_gpa,opens_at,closes_at,status,version,created_at")
    .in("status", ["published", "closed"])
    .order("closes_at", { ascending: true })
    .limit(100);
  if (error) fail("ไม่สามารถโหลดรายการทุนได้");
  return (data ?? []) as ScholarshipSummary[];
}

export async function getScholarship(id: string): Promise<(ScholarshipSummary & {
  requirements: Requirement[];
  criteria: Criterion[];
}) | null> {
  const client = await createClient();
  const { data: scholarship, error } = await client
    .from("scholarships")
    .select("id,title,description,eligibility,amount,quota,minimum_gpa,opens_at,closes_at,status,version,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("ไม่สามารถโหลดรายละเอียดทุนได้");
  if (!scholarship) return null;
  const [{ data: requirements, error: requirementError }, { data: criteria, error: criterionError }] = await Promise.all([
    client.from("scholarship_document_requirements").select("id,label,details,required,sort_order").eq("scholarship_id", id).order("sort_order"),
    client.from("scholarship_review_criteria").select("id,label,details,max_score,sort_order").eq("scholarship_id", id).order("sort_order"),
  ]);
  if (requirementError || criterionError) fail("ไม่สามารถโหลดเงื่อนไขทุนได้");
  return { ...(scholarship as ScholarshipSummary), requirements: (requirements ?? []) as Requirement[], criteria: (criteria ?? []) as Criterion[] };
}

export async function getStudentApplicationForScholarship(scholarshipId: string): Promise<ApplicationSummary | null> {
  const client = await createClient();
  const { data, error } = await client
    .from("applications")
    .select("id,application_no,scholarship_id,student_id,student_name,student_code,application_data,status,submitted_at,decision_reason,version,created_at,updated_at")
    .eq("scholarship_id", scholarshipId)
    .maybeSingle();
  if (error) fail("ไม่สามารถโหลดใบสมัครได้");
  return data as ApplicationSummary | null;
}

export async function getApplicationDocuments(applicationId: string): Promise<ApplicationDocument[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("application_documents")
    .select("id,application_id,requirement_id,file_name,file_size,mime_type,status,feedback,version,uploaded_at,requirement:scholarship_document_requirements(id,label,details,required,sort_order)")
    .eq("application_id", applicationId)
    .order("uploaded_at");
  if (error) fail("ไม่สามารถโหลดเอกสารได้");
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    ...(row as unknown as ApplicationDocument),
    requirement: first(row.requirement as Requirement | Requirement[] | null),
  }));
}

export async function getStudentApplicationDetail(id: string): Promise<{
  application: ApplicationSummary;
  scholarship: ScholarshipSummary & { requirements: Requirement[]; criteria: Criterion[] };
  requirements: Requirement[];
  documents: ApplicationDocument[];
  paymentAccount: PaymentAccount | null;
  disbursement: Disbursement | null;
  history: { id: number; from_status: string | null; to_status: string; reason: string; created_at: string }[];
} | null> {
  const client = await createClient();
  const { data: application, error } = await client
    .from("applications")
    .select("id,application_no,scholarship_id,student_id,student_name,student_code,application_data,status,submitted_at,decision_reason,version,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("ไม่สามารถโหลดใบสมัครได้");
  if (!application) return null;
  const [scholarship, documents, accountResult, disbursementResult, historyResult] = await Promise.all([
    getScholarship(application.scholarship_id),
    getApplicationDocuments(id),
    client.from("application_payment_accounts").select("bank_name,account_holder,account_number").eq("application_id", id).maybeSingle(),
    client.from("disbursements").select("id,amount,status,transfer_date,transfer_reference,proof_path,version,updated_at").eq("application_id", id).maybeSingle(),
    client.from("application_status_history").select("id,from_status,to_status,reason,created_at").eq("application_id", id).order("created_at"),
  ]);
  if (!scholarship) throw new Error("ไม่พบทุนการศึกษานี้");
  if (accountResult.error || disbursementResult.error || historyResult.error) fail("ไม่สามารถโหลดข้อมูลใบสมัครได้");
  return {
    application: application as ApplicationSummary,
    scholarship,
    requirements: scholarship.requirements,
    documents,
    paymentAccount: accountResult.data as PaymentAccount | null,
    disbursement: disbursementResult.data as Disbursement | null,
    history: historyResult.data ?? [],
  };
}

export async function listStudentApplications(): Promise<ApplicationSummary[]> {
  const client = await createClient();
  const { data: applications, error } = await client
    .from("applications")
    .select("id,application_no,scholarship_id,student_id,student_name,student_code,application_data,status,submitted_at,decision_reason,version,created_at,updated_at,scholarship:scholarships(id,title,scholarship_type_id,description,eligibility,amount,quota,minimum_gpa,opens_at,closes_at,status,version,created_at)")
    .order("updated_at", { ascending: false });
  if (error) fail("ไม่สามารถโหลดใบสมัครของคุณได้");
  return ((applications ?? []) as unknown as Record<string, unknown>[]).map(normalizeApplication);
}

export async function getStudentProfileHints() {
  const client = await createClient();
  const { data, error } = await client
    .from("portal_profiles")
    .select("phone,department,profile_details")
    .maybeSingle();
  if (error) fail("ไม่สามารถโหลดข้อมูลโปรไฟล์ได้");
  return data as { phone: string | null; department: string | null; profile_details: Record<string, string> | null } | null;
}

export async function listStaffApplications(status?: string): Promise<ApplicationSummary[]> {
  const client = await createClient();
  let query = client
    .from("applications")
    .select("id,application_no,scholarship_id,student_id,student_name,student_code,application_data,status,submitted_at,decision_reason,version,created_at,updated_at,scholarship:scholarships(id,title,scholarship_type_id,description,eligibility,amount,quota,minimum_gpa,opens_at,closes_at,status,version,created_at)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) fail("ไม่สามารถโหลดใบสมัครสำหรับเจ้าหน้าที่ได้");
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeApplication);
}

export async function getStaffApplicationDetail(id: string) {
  const client = await createClient();
  const detail = await getStudentApplicationDetail(id);
  if (!detail) return null;
  const [assignmentsResult, committeesResult] = await Promise.all([
    client.from("review_assignments").select("id,reviewer_id,assigned_by,status,reason,assigned_at,completed_at,reviewer:portal_profiles!review_assignments_reviewer_id_fkey(full_name,student_id),evaluation:evaluations(id,total_score,recommendation,comment,submitted_at,version)").eq("application_id", id).order("assigned_at"),
    client.from("portal_profiles").select("id,full_name,student_id,department,expertise").eq("role", "committee").eq("active", true).order("full_name").limit(100),
  ]);
  if (assignmentsResult.error || committeesResult.error) fail("ไม่สามารถโหลดข้อมูลการพิจารณาได้");
  const assignments = ((assignmentsResult.data ?? []) as unknown as Record<string, unknown>[]).map((row) => {
    const base = row as unknown as { id: string; reviewer_id: string; assigned_by: string; status: string; reason: string; assigned_at: string; completed_at: string | null };
    return {
      id: base.id,
      reviewer_id: base.reviewer_id,
      assigned_by: base.assigned_by,
      status: base.status,
      reason: base.reason,
      assigned_at: base.assigned_at,
      completed_at: base.completed_at,
      reviewer: first(row.reviewer as { full_name: string; student_id: string } | { full_name: string; student_id: string }[] | null),
      evaluation: first(row.evaluation as { id: string; total_score: number; recommendation: string; comment: string; submitted_at: string | null; version: number } | { id: string; total_score: number; recommendation: string; comment: string; submitted_at: string | null; version: number }[] | null),
    };
  });
  return { ...detail, assignments, committees: committeesResult.data ?? [] };
}

export async function listStaffScholarships(): Promise<(ScholarshipSummary & { requirements: Requirement[]; criteria: Criterion[] })[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("scholarships")
    .select("id,title,description,eligibility,amount,quota,minimum_gpa,opens_at,closes_at,status,version,created_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) fail("ไม่สามารถโหลดทุนได้");
  const scholarships = (data ?? []) as ScholarshipSummary[];
  const details = await Promise.all(scholarships.map((item) => getScholarship(item.id)));
  return details.filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function getCommitteeAssignment(id: string) {
  const client = await createClient();
  const { data: assignment, error } = await client
    .from("review_assignments")
    .select("id,application_id,reviewer_id,assigned_by,status,reason,assigned_at,completed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("ไม่สามารถโหลดงานประเมินได้");
  if (!assignment) return null;
  const detail = await getStudentApplicationDetail(assignment.application_id);
  if (!detail) return null;
  const { data: evaluation, error: evaluationError } = await client
    .from("evaluations")
    .select("id,scores,total_score,recommendation,comment,submitted_at,version")
    .eq("assignment_id", id)
    .maybeSingle();
  if (evaluationError) fail("ไม่สามารถโหลดผลประเมินได้");
  return { assignment, application: detail.application, scholarship: detail.scholarship, requirements: detail.requirements, documents: detail.documents, evaluation };
}

export async function listCommitteeAssignments() {
  const client = await createClient();
  const { data, error } = await client
    .from("review_assignments")
    .select("id,application_id,status,reason,assigned_at,application:applications(id,application_no,student_name,student_code,status,scholarship:scholarships(title))")
    .eq("status", "assigned")
    .order("assigned_at", { ascending: false });
  if (error) fail("ไม่สามารถโหลดรายการประเมินได้");
  return data ?? [];
}

export async function getNotifications(): Promise<Notification[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("portal_notifications")
    .select("id,title,body,href,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) return [];
  return (data ?? []) as Notification[];
}

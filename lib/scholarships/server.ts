import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/server";
import {
  isScholarshipOpen,
  type ApplicationDocument,
  type ApplicationAppeal,
  type ApplicationInterview,
  type ApplicationSummary,
  type Criterion,
  type Disbursement,
  type Notification,
  type PaymentAccount,
  type Requirement,
  type ScholarshipSummary,
} from "./types";
import { fetchSisStudentRecord } from "@/lib/integrations/sis";

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

type CachedScholarships = {
  data: ScholarshipSummary[];
  expiresAt: number;
};
let publishedScholarshipsCache: CachedScholarships | null = null;

export function invalidatePublishedScholarshipsCache() {
  publishedScholarshipsCache = null;
}

export async function listPublishedScholarships(): Promise<ScholarshipSummary[]> {
  const now = Date.now();
  if (publishedScholarshipsCache && publishedScholarshipsCache.expiresAt > now) {
    return publishedScholarshipsCache.data;
  }
  const client = await createClient();
  const { data, error } = await client
    .from("scholarships")
    .select("id,title,scholarship_type_id,program_kind,cover_path,description,eligibility,amount,quota,minimum_gpa,eligible_faculties,eligible_majors,opens_at,closes_at,status,version,created_at")
    .in("status", ["published", "closed"])
    .order("closes_at", { ascending: true })
    .limit(100);
  if (error) fail("ไม่สามารถโหลดรายการทุนได้");
  const list = (data ?? []) as ScholarshipSummary[];
  publishedScholarshipsCache = { data: list, expiresAt: now + 60_000 };
  return list;
}

export async function listOpenScholarships(): Promise<ScholarshipSummary[]> {
  const scholarships = await listPublishedScholarships();
  const now = Date.now();
  return scholarships.filter((item) => isScholarshipOpen(item, now));
}

export type ScholarshipWithRequirements = ScholarshipSummary & {
  requirements: Requirement[];
};

export async function getScholarshipForApplication(
  id: string
): Promise<ScholarshipWithRequirements | null> {
  const client = await createClient();
  const { data: scholarship, error } = await client
    .from("scholarships")
    .select("id,title,scholarship_type_id,program_kind,cover_path,description,eligibility,amount,quota,minimum_gpa,eligible_faculties,eligible_majors,opens_at,closes_at,status,version,created_at,required_reviewer_count,results_published_at,appeal_deadline")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("ไม่สามารถโหลดรายละเอียดทุนได้");
  if (!scholarship) return null;

  const { data: requirements, error: requirementError } = await client
    .from("scholarship_document_requirements")
    .select("id,label,details,required,sort_order")
    .eq("scholarship_id", id)
    .order("sort_order");

  if (requirementError) fail("ไม่สามารถโหลดเงื่อนไขเอกสารทุนได้");

  return {
    ...(scholarship as ScholarshipSummary),
    requirements: (requirements ?? []) as Requirement[],
  };
}

export async function getScholarship(id: string): Promise<(ScholarshipSummary & {
  requirements: Requirement[];
  criteria: Criterion[];
}) | null> {
  const client = await createClient();
  const { data: scholarship, error } = await client
    .from("scholarships")
    .select("id,title,scholarship_type_id,program_kind,cover_path,description,eligibility,amount,quota,minimum_gpa,eligible_faculties,eligible_majors,opens_at,closes_at,status,version,created_at,required_reviewer_count,results_published_at,appeal_deadline")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("ไม่สามารถโหลดรายละเอียดทุนได้");
  if (!scholarship) return null;
  const [{ data: requirements, error: requirementError }, { data: criteria, error: criterionError }] = await Promise.all([
    client.from("scholarship_document_requirements").select("id,label,details,required,sort_order").eq("scholarship_id", id).order("sort_order"),
    client.from("scholarship_review_criteria").select("id,label,details,max_score,sort_order").eq("scholarship_id", id).order("sort_order"),
  ]);
  if (requirementError || criterionError) fail("ไม่สามารถโหลดเงื่อนไขทุนได้");
  return {
    ...(scholarship as ScholarshipSummary),
    requirements: (requirements ?? []) as Requirement[],
    criteria: (criteria ?? []) as Criterion[],
  };
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

export type StudentApplicationEditorData = {
  application: ApplicationSummary | null;
  documents: ApplicationDocument[];
  paymentAccount: PaymentAccount | null;
};
export type ApplicationEditorData = StudentApplicationEditorData;

export async function getStudentApplicationEditorData(
  scholarshipId: string,
  applicationId?: string
): Promise<StudentApplicationEditorData> {
  const viewer = await requireRole(["student"]);
  const client = await createClient();
  let applicationQuery = client
    .from("applications")
    .select("id,application_no,scholarship_id,student_id,student_name,student_code,application_data,status,submitted_at,decision_reason,version,created_at,updated_at")
    .eq("student_id", viewer.id);

  if (applicationId) {
    applicationQuery = applicationQuery
      .eq("id", applicationId)
      .eq("scholarship_id", scholarshipId);
  } else {
    applicationQuery = applicationQuery.eq("scholarship_id", scholarshipId);
  }

  const { data: applicationData, error: appError } = await applicationQuery.maybeSingle();
  if (appError) fail("ไม่สามารถโหลดใบสมัครได้");

  const application = (applicationData as ApplicationSummary | null) ?? null;
  if (!application) {
    return { application: null, documents: [], paymentAccount: null };
  }

  if (application.scholarship_id !== scholarshipId || application.student_id !== viewer.id) {
    return { application: null, documents: [], paymentAccount: null };
  }

  const [documents, accountResult] = await Promise.all([
    getApplicationDocuments(application.id),
    client
      .from("application_payment_accounts")
      .select("bank_name,account_holder,account_number")
      .eq("application_id", application.id)
      .maybeSingle(),
  ]);

  if (accountResult.error) fail("ไม่สามารถโหลดข้อมูลบัญชีได้");

  return {
    application,
    documents,
    paymentAccount: (accountResult.data as PaymentAccount | null) ?? null,
  };
}

export const getApplicationEditorData = getStudentApplicationEditorData;

export async function getApplicationDocuments(applicationId: string): Promise<ApplicationDocument[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("application_documents")
    .select("id,application_id,requirement_id,file_name,file_size,mime_type,status,feedback,version,revision_no,uploaded_at,requirement:scholarship_document_requirements(id,label,details,required,sort_order)")
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
  scholarship: ScholarshipWithRequirements;
  requirements: Requirement[];
  documents: ApplicationDocument[];
  paymentAccount: PaymentAccount | null;
  disbursement: Disbursement | null;
  interview: ApplicationInterview | null;
  appeal: ApplicationAppeal | null;
  history: { id: number; from_status: string | null; to_status: string; reason: string; created_at: string }[];
} | null> {
  const viewer = await requireRole(["student"]);
  const client = await createClient();
  const { data: application, error } = await client
    .from("applications")
    .select("id,application_no,scholarship_id,student_id,student_name,student_code,application_data,status,submitted_at,decision_reason,version,created_at,updated_at")
    .eq("id", id)
    .eq("student_id", viewer.id)
    .maybeSingle();
  if (error) fail("ไม่สามารถโหลดใบสมัครได้");
  if (!application) return null;
  const [scholarship, documents, accountResult, disbursementResult, historyResult, interviewResult, appealResult] = await Promise.all([
    getScholarshipForApplication(application.scholarship_id),
    getApplicationDocuments(id),
    client.from("application_payment_accounts").select("bank_name,account_holder,account_number").eq("application_id", id).maybeSingle(),
    client.from("disbursements").select("id,amount,status,transfer_date,transfer_reference,proof_path,version,updated_at").eq("application_id", id).maybeSingle(),
    client.from("application_status_history").select("id,from_status,to_status,reason,created_at").eq("application_id", id).order("created_at"),
    client.from("application_interviews").select("id,scheduled_at,location,meeting_url,note,status,version").eq("application_id", id).maybeSingle(),
    client.from("application_appeals").select("id,reason,status,response,submitted_at,resolved_at,version").eq("application_id", id).maybeSingle(),
  ]);
  if (!scholarship) throw new Error("ไม่พบทุนการศึกษานี้");
  if (
    accountResult.error ||
    disbursementResult.error ||
    historyResult.error ||
    interviewResult.error ||
    appealResult.error
  ) {
    fail("ไม่สามารถโหลดข้อมูลใบสมัครได้");
  }
  return {
    application: application as ApplicationSummary,
    scholarship,
    requirements: scholarship.requirements,
    documents,
    paymentAccount: (accountResult.data as PaymentAccount | null) ?? null,
    disbursement: (disbursementResult.data as Disbursement | null) ?? null,
    interview: (interviewResult.data as ApplicationInterview | null) ?? null,
    appeal: (appealResult.data as ApplicationAppeal | null) ?? null,
    history: (historyResult.data ?? []) as { id: number; from_status: string | null; to_status: string; reason: string; created_at: string }[],
  };
}

export type PaginatedStudentApplications = {
  applications: ApplicationSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listStudentApplicationsPaginated({
  page = 1,
  pageSize = 10,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedStudentApplications> {
  const viewer = await requireRole(["student"]);
  const client = await createClient();
  const validPage = Math.max(1, page);
  const from = (validPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: applications, count, error } = await client
    .from("applications")
    .select("id,application_no,scholarship_id,student_id,student_name,student_code,application_data,status,submitted_at,decision_reason,version,created_at,updated_at,scholarship:scholarships(id,title)", { count: "exact" })
    .eq("student_id", viewer.id)
    .range(from, to)
    .order("updated_at", { ascending: false });

  if (error) fail("ไม่สามารถโหลดใบสมัครของคุณได้");
  const total = count ?? 0;
  const items = ((applications ?? []) as unknown as Record<string, unknown>[]).map(normalizeApplication);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    applications: items,
    total,
    page: validPage,
    pageSize,
    totalPages,
  };
}

export async function listStudentApplications(): Promise<ApplicationSummary[]> {
  const { applications } = await listStudentApplicationsPaginated({ page: 1, pageSize: 100 });
  return applications;
}

export async function getStudentProfileHints() {
  const client = await createClient();
  const { data, error } = await client
    .from("portal_profiles")
    .select("student_id,phone,department,profile_details")
    .maybeSingle();
  if (error) fail("ไม่สามารถโหลดข้อมูลโปรไฟล์ได้");
  if (!data) return null;
  const sis = await fetchSisStudentRecord(data.student_id ?? "");
  const details = (data.profile_details ?? {}) as Record<string, string>;
  return {
    phone: data.phone,
    department: sis?.faculty || data.department,
    profile_details: sis && sis.active ? { ...details, major: sis.major || details.major, education_level: sis.education_level || details.education_level, study_year: sis.study_year || details.study_year, gpa: sis.gpa || details.gpa } : details,
    sis_verified: Boolean(sis?.active),
  };
}

export async function listStaffApplications(status?: string | readonly string[], search?: string): Promise<ApplicationSummary[]> {
  const client = await createClient();
  let query = client
    .from("applications")
    .select("id,application_no,scholarship_id,student_id,student_name,student_code,application_data,status,submitted_at,decision_reason,version,created_at,updated_at,scholarship:scholarships(id,title,scholarship_type_id,program_kind,cover_path,description,eligibility,amount,quota,minimum_gpa,opens_at,closes_at,status,version,created_at)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (typeof status === "string" && status) query = query.eq("status", status);
  else if (Array.isArray(status) && status.length) query = query.in("status", status);
  const { data, error } = await query;
  if (error) fail("ไม่สามารถโหลดใบสมัครสำหรับเจ้าหน้าที่ได้");
  const applications = ((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeApplication);
  const term = search?.trim().toLocaleLowerCase("th") ?? "";
  if (!term) return applications;
  return applications.filter((item) => [item.student_name, item.student_code, String(item.application_no), item.scholarship?.title ?? ""].some((value) => value.toLocaleLowerCase("th").includes(term)));
}

export async function getStaffApplicationDetail(id: string) {
  const client = await createClient();
  const { data: application, error: appError } = await client
    .from("applications")
    .select("id,application_no,scholarship_id,student_id,student_name,student_code,application_data,status,submitted_at,decision_reason,version,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (appError) fail("ไม่สามารถโหลดใบสมัครได้");
  if (!application) return null;

  const [
    scholarship,
    documents,
    accountResult,
    disbursementResult,
    interviewResult,
    appealResult,
    assignmentsResult,
    committeesResult,
  ] = await Promise.all([
    getScholarship(application.scholarship_id),
    getApplicationDocuments(id),
    client.from("application_payment_accounts").select("bank_name,account_holder,account_number").eq("application_id", id).maybeSingle(),
    client.from("disbursements").select("id,amount,status,transfer_date,transfer_reference,proof_path,version,updated_at").eq("application_id", id).maybeSingle(),
    client.from("application_interviews").select("id,scheduled_at,location,meeting_url,note,status,version").eq("application_id", id).maybeSingle(),
    client.from("application_appeals").select("id,reason,status,response,submitted_at,resolved_at,version").eq("application_id", id).maybeSingle(),
    client.from("review_assignments").select("id,reviewer_id,assigned_by,status,reason,assigned_at,completed_at,conflict_status,conflict_note,reviewer:portal_profiles!review_assignments_reviewer_id_fkey(full_name,student_id),evaluation:evaluations(id,total_score,recommendation,comment,submitted_at,version)").eq("application_id", id).order("assigned_at"),
    client.from("portal_profiles").select("id,full_name,student_id,department,expertise").eq("role", "committee").eq("active", true).order("full_name").limit(100),
  ]);

  if (!scholarship) throw new Error("ไม่พบทุนการศึกษานี้");
  if (accountResult.error || disbursementResult.error || assignmentsResult.error || committeesResult.error) {
    fail("ไม่สามารถโหลดข้อมูลการพิจารณาได้");
  }

  const assignments = ((assignmentsResult.data ?? []) as unknown as Record<string, unknown>[]).map((row) => {
    const base = row as unknown as {
      id: string;
      reviewer_id: string;
      assigned_by: string;
      status: string;
      reason: string;
      assigned_at: string;
      completed_at: string | null;
      conflict_status?: string;
      conflict_note?: string | null;
    };
    return {
      id: base.id,
      reviewer_id: base.reviewer_id,
      assigned_by: base.assigned_by,
      status: base.status,
      reason: base.reason,
      assigned_at: base.assigned_at,
      completed_at: base.completed_at,
      conflict_status: base.conflict_status,
      conflict_note: base.conflict_note,
      reviewer: first(row.reviewer as { full_name: string; student_id: string } | { full_name: string; student_id: string }[] | null),
      evaluation: first(row.evaluation as { id: string; total_score: number; recommendation: string; comment: string; submitted_at: string | null; version: number } | { id: string; total_score: number; recommendation: string; comment: string; submitted_at: string | null; version: number }[] | null),
    };
  });

  return {
    application: application as ApplicationSummary,
    scholarship,
    requirements: scholarship.requirements,
    documents,
    paymentAccount: (accountResult.data as PaymentAccount | null) ?? null,
    disbursement: (disbursementResult.data as Disbursement | null) ?? null,
    interview: interviewResult.error ? null : (interviewResult.data as ApplicationInterview | null) ?? null,
    appeal: appealResult.error ? null : (appealResult.data as ApplicationAppeal | null) ?? null,
    assignments,
    committees: committeesResult.data ?? [],
  };
}

export async function listStaffScholarships(): Promise<ScholarshipSummary[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("scholarships")
    .select("id,title,scholarship_type_id,program_kind,cover_path,description,eligibility,amount,quota,minimum_gpa,eligible_faculties,eligible_majors,opens_at,closes_at,status,version,created_at,required_reviewer_count,results_published_at,appeal_deadline")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) fail("ไม่สามารถโหลดทุนได้");
  return (data ?? []) as ScholarshipSummary[];
}

export async function getCommitteeAssignment(id: string) {
  const client = await createClient();
  const { data: assignment, error } = await client
    .from("review_assignments")
    .select("id,application_id,reviewer_id,assigned_by,status,reason,assigned_at,completed_at,conflict_status,conflict_note")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("ไม่สามารถโหลดงานประเมินได้");
  if (!assignment) return null;

  const [appResult, evaluationResult] = await Promise.all([
    client
      .from("applications")
      .select("id,application_no,scholarship_id,student_id,student_name,student_code,application_data,status,submitted_at,decision_reason,version,created_at,updated_at")
      .eq("id", assignment.application_id)
      .maybeSingle(),
    client
      .from("evaluations")
      .select("id,scores,total_score,recommendation,comment,submitted_at,version")
      .eq("assignment_id", id)
      .maybeSingle(),
  ]);

  if (appResult.error || !appResult.data) fail("ไม่สามารถโหลดใบสมัครได้");
  if (evaluationResult.error) fail("ไม่สามารถโหลดผลประเมินได้");

  const application = appResult.data as ApplicationSummary;
  const [scholarship, documents] = await Promise.all([
    getScholarship(application.scholarship_id),
    getApplicationDocuments(application.id),
  ]);

  if (!scholarship) throw new Error("ไม่พบทุนการศึกษานี้");

  return {
    assignment,
    application,
    scholarship,
    requirements: scholarship.requirements,
    documents,
    evaluation: evaluationResult.data ?? null,
  };
}

export async function listCommitteeAssignments() {
  const client = await createClient();
  const { data, error } = await client
    .from("review_assignments")
    .select("id,application_id,status,reason,assigned_at,due_at,application:applications(id,application_no,student_name,student_code,status,scholarship:scholarships(title))")
    .eq("status", "assigned")
    .order("assigned_at", { ascending: false });
  if (error) fail("ไม่สามารถโหลดรายการประเมินได้");
  return data ?? [];
}

type CachedNotifications = {
  data: Notification[];
  expiresAt: number;
};
const notificationsCache = new Map<string, CachedNotifications>();

export function invalidateNotificationsCache(userId?: string) {
  if (userId) {
    notificationsCache.delete(userId);
  } else {
    notificationsCache.clear();
  }
}

export const getNotifications = cache(async (userId?: string): Promise<Notification[]> => {
  const now = Date.now();
  if (userId) {
    const cached = notificationsCache.get(userId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  const client = await createClient();
  const { data, error } = await client
    .from("portal_notifications")
    .select("id,title,body,href,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) return [];
  const list = (data ?? []) as Notification[];
  if (userId) {
    notificationsCache.set(userId, { data: list, expiresAt: now + 30_000 });
  }
  return list;
});

export async function getAcademicOptions() {
 const client = await createClient();
 const { data, error } = await client.from("portal_reference_data").select("name,kind").in("kind", ["faculty", "major", "document_type"]).eq("active", true).order("name");
 if (error) throw new Error("โหลดรายชื่อสำนักวิชาและสาขาไม่ได้");
 return { faculties: data.filter(item => item.kind === "faculty").map(item => item.name), majors: data.filter(item => item.kind === "major").map(item => item.name), documentTypes: data.filter(item => item.kind === "document_type").map(item => item.name) };
}

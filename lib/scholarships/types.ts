export type ScholarshipStatus = "draft" | "published" | "closed" | "archived";
export type ScholarshipProgramKind = "academic" | "financial_need" | "activity" | "talent" | "research" | "emergency" | "general";
export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "revision_requested"
  | "ready_for_review"
  | "committee_review"
  | "approved"
  | "reserve"
  | "rejected";

export const scholarshipStatusLabels: Record<ScholarshipStatus, string> = {
  draft: "ฉบับร่าง",
  published: "เปิดรับสมัคร",
  closed: "ปิดรับสมัคร",
  archived: "เก็บถาวร",
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  draft: "ร่างใบสมัคร",
  submitted: "รอตรวจเอกสาร",
  revision_requested: "ขอแก้ไขเอกสาร",
  ready_for_review: "พร้อมมอบหมายกรรมการ",
  committee_review: "อยู่ระหว่างพิจารณา",
  approved: "อนุมัติแล้ว",
  reserve: "รายชื่อสำรอง",
  rejected: "ไม่อนุมัติ",
};

export type ScholarshipSummary = {
  id: string;
  title: string;
  scholarship_type_id: string | null;
  program_kind: ScholarshipProgramKind;
  cover_path: string | null;
  description: string;
  eligibility: string;
  amount: number;
  quota: number;
  minimum_gpa: number | null;
  eligible_faculties?: string[];
  eligible_majors?: string[];
  opens_at: string;
  closes_at: string;
  status: ScholarshipStatus;
  version: number;
  created_at: string;
  required_reviewer_count?: number;
  results_published_at?: string | null;
  appeal_deadline?: string | null;
};

export type Requirement = {
  id: string;
  label: string;
  details: string;
  required: boolean;
  sort_order: number;
};

export type Criterion = {
  id: string;
  label: string;
  details: string;
  max_score: number;
  sort_order: number;
};

export type ApplicationDocument = {
  id: string;
  application_id: string;
  requirement_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: "pending" | "verified" | "revision_required";
  feedback: string | null;
  version: number;
  revision_no: number;
  uploaded_at: string;
  requirement?: Requirement | null;
};

export type ApplicationDocumentVersion = {
  id: string;
  document_id: string;
  revision_no: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: ApplicationDocument["status"];
  feedback: string | null;
  uploaded_at: string;
  checked_at: string | null;
};

export type ApplicationSummary = {
  id: string;
  application_no: number;
  scholarship_id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  application_data: Record<string, string>;
  status: ApplicationStatus;
  submitted_at: string | null;
  decision_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  scholarship?: ScholarshipSummary | null;
};

export type PaymentAccount = {
  bank_name: string;
  account_holder: string;
  account_number: string;
};

export type Disbursement = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  transfer_date: string | null;
  transfer_reference: string | null;
  proof_path: string | null;
  version: number;
  updated_at: string;
};

export type ApplicationInterview = {
  id: string;
  scheduled_at: string;
  location: string;
  meeting_url: string | null;
  note: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  version: number;
};

export type ApplicationAppeal = {
  id: string;
  reason: string;
  status: "pending" | "upheld" | "rejected";
  response: string | null;
  submitted_at: string;
  resolved_at: string | null;
  version: number;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

export const money = (amount: number) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(amount);

export const scholarshipCoverUrl = (path: string | null | undefined) => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return null;
  return `${base}/storage/v1/object/public/scholarship-covers/${path.split("/").map(encodeURIComponent).join("/")}`;
};

export const thaiDate = (value: string, withTime = false) =>
  new Intl.DateTimeFormat("th-TH", {
    dateStyle: "long",
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));

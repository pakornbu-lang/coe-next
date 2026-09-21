"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export type WorkflowState = {
  error: string;
  success: string;
  applicationId?: string;
  scholarshipId?: string;
};

const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const failure = (code?: string): WorkflowState => ({
  error:
    code === "40001"
      ? "ข้อมูลนี้ถูกเปลี่ยนโดยผู้ใช้อื่น กรุณารีเฟรชหน้าแล้วลองอีกครั้ง"
      : code === "42501"
        ? "คุณไม่มีสิทธิ์ทำรายการนี้ หรือบัญชีไม่พร้อมใช้งาน"
        : code === "23505"
          ? "มีข้อมูลนี้ในระบบแล้ว กรุณาตรวจสอบและลองใหม่"
          : "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่",
  success: "",
});

function toBangkokTimestamp(raw: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function applicationData(form: FormData) {
  const limits: Record<string, number> = {
    faculty: 150,
    major: 150,
    gpa: 4,
    phone: 25,
    address: 500,
    study_year: 1,
    education_level: 50,
    income: 30,
    family_members: 3,
    reason: 5000,
    activities: 5000,
    emergency_name: 200,
    emergency_phone: 25,
  };
  const data: Record<string, string> = {};
  for (const [key, limit] of Object.entries(limits)) {
    const item = value(form, key);
    if (item.length > limit) throw new Error("INPUT_TOO_LONG");
    data[key] = item;
  }
  return data;
}

export async function saveApplication(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["student"]);
  try {
    const scholarshipId = value(form, "scholarship_id");
    const applicationId = value(form, "application_id");
    const version = applicationId ? Number(value(form, "version")) : null;
    const mode = value(form, "mode");
    if (!uuid(scholarshipId) || (applicationId && !uuid(applicationId)) || (applicationId && (!Number.isSafeInteger(version) || version! < 1)) || !["draft", "submit"].includes(mode)) {
      return failure("22023");
    }
    const data = applicationData(form);
    const bankName = value(form, "bank_name");
    const accountHolder = value(form, "account_holder");
    const accountNumber = value(form, "account_number");
    if (mode === "submit" && (!bankName || !accountHolder || !accountNumber)) {
      return { error: "กรุณากรอกข้อมูลบัญชีรับเงินให้ครบก่อนส่งใบสมัคร", success: "", applicationId: applicationId || undefined };
    }
    const client = await createClient();
    const { data: savedId, error } = await client.rpc("student_save_application", {
      p_application_id: applicationId || null,
      p_version: version,
      p_scholarship_id: scholarshipId,
      p_data: data,
      p_bank_name: bankName || null,
      p_account_holder: accountHolder || null,
      p_account_number: accountNumber || null,
      p_submit: mode === "submit",
    });
    if (error || !savedId) return failure(error?.code);
    revalidatePath("/dashboard");
    revalidatePath("/applications");
    revalidatePath(`/applications/${savedId}`);
    return {
      error: "",
      success: mode === "submit" ? "ส่งใบสมัครแล้ว เจ้าหน้าที่จะตรวจสอบเอกสารตามลำดับ" : "บันทึกร่างแล้ว ตอนนี้คุณสามารถอัปโหลดเอกสารประกอบได้",
      applicationId: savedId,
    };
  } catch (error) {
    return error instanceof Error && error.message === "INPUT_TOO_LONG" ? { error: "ข้อมูลบางช่องยาวเกินกำหนด", success: "" } : failure();
  }
}

const documentTypes: Record<string, { mime: string; extension: string }> = {
  "application/pdf": { mime: "application/pdf", extension: "pdf" },
  "image/jpeg": { mime: "image/jpeg", extension: "jpg" },
  "image/png": { mime: "image/png", extension: "png" },
  "application/msword": { mime: "application/msword", extension: "doc" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" },
};

export async function uploadApplicationDocument(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  const viewer = await requireRole(["student"]);
  const applicationId = value(form, "application_id");
  const requirementId = value(form, "requirement_id");
  const file = form.get("document");
  if (!uuid(applicationId) || !uuid(requirementId) || !(file instanceof File) || !file.size) return failure("22023");
  const type = documentTypes[file.type];
  if (!type || file.size > 10 * 1024 * 1024 || file.name.length > 255) {
    return { error: "รองรับ PDF, JPG, PNG, DOC และ DOCX ขนาดไม่เกิน 10 MB", success: "", applicationId };
  }
  const path = `${viewer.id}/${applicationId}/${randomUUID()}.${type.extension}`;
  const client = await createClient();
  const { error: uploadError } = await client.storage.from("scholarship-documents").upload(path, file, { contentType: type.mime, upsert: false });
  if (uploadError) return { error: "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่", success: "", applicationId };
  const { data: previousPath, error } = await client.rpc("student_replace_application_document", {
    p_application_id: applicationId,
    p_requirement_id: requirementId,
    p_file_path: path,
    p_file_name: file.name,
    p_mime_type: type.mime,
    p_file_size: file.size,
  });
  if (error) {
    await client.storage.from("scholarship-documents").remove([path]);
    return failure(error.code);
  }
  if (previousPath) await client.storage.from("scholarship-documents").remove([previousPath]);
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/apply");
  return { error: "", success: `อัปโหลด ${file.name} แล้ว`, applicationId };
}

function parseRequirements(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, details = ""] = line.split("|").map((part) => part.trim());
      return { label, details, required: true, sort_order: index + 1 };
    });
}

function parseCriteria(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, rawScore, details = ""] = line.split("|").map((part) => part.trim());
      return { label, details, max_score: Number(rawScore), sort_order: index + 1 };
    });
}

export async function saveScholarship(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["staff"]);
  const id = value(form, "id");
  const version = id ? Number(value(form, "version")) : null;
  const opensAt = toBangkokTimestamp(value(form, "opens_at"));
  const closesAt = toBangkokTimestamp(value(form, "closes_at"));
  const requirements = parseRequirements(value(form, "requirements"));
  const criteria = parseCriteria(value(form, "criteria"));
  const amount = Number(value(form, "amount"));
  const quota = Number(value(form, "quota"));
  const minimumGpa = value(form, "minimum_gpa");
  if ((id && (!uuid(id) || !Number.isSafeInteger(version) || version! < 1)) || !opensAt || !closesAt || !Number.isFinite(amount) || !Number.isSafeInteger(quota) || !requirements.length || !criteria.length) {
    return { error: "กรุณากรอกข้อมูลทุน รายการเอกสาร และเกณฑ์คะแนนให้ครบ", success: "" };
  }
  const client = await createClient();
  const { data, error } = await client.rpc("staff_save_scholarship", {
    p_id: id || null,
    p_version: version,
    p_title: value(form, "title"),
    p_type_id: value(form, "scholarship_type_id") || null,
    p_description: value(form, "description"),
    p_eligibility: value(form, "eligibility"),
    p_amount: amount,
    p_quota: quota,
    p_minimum_gpa: minimumGpa ? Number(minimumGpa) : null,
    p_opens_at: opensAt,
    p_closes_at: closesAt,
    p_status: value(form, "status"),
    p_requirements: requirements,
    p_criteria: criteria,
    p_reason: value(form, "reason"),
  });
  if (error || !data) return failure(error?.code);
  revalidatePath("/scholarships");
  revalidatePath("/staff");
  revalidatePath("/staff/scholarships");
  return { error: "", success: "บันทึกทุนและเงื่อนไขแล้ว", scholarshipId: data };
}

export async function reviewApplicationDocuments(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["staff"]);
  const applicationId = value(form, "application_id");
  const version = Number(value(form, "version"));
  const action = value(form, "action");
  let documents: unknown;
  try { documents = JSON.parse(value(form, "documents")); } catch { return failure("22023"); }
  if (!uuid(applicationId) || !Number.isSafeInteger(version) || version < 1 || !["verify", "request_revision"].includes(action) || !Array.isArray(documents)) return failure("22023");
  const client = await createClient();
  const { error } = await client.rpc("staff_review_application_documents", {
    p_application_id: applicationId,
    p_version: version,
    p_documents: documents,
    p_action: action,
    p_reason: value(form, "reason"),
  });
  if (error) return failure(error.code);
  revalidatePath(`/staff/review/${applicationId}`);
  revalidatePath("/staff/review");
  return { error: "", success: action === "verify" ? "ยืนยันการตรวจเอกสารแล้ว พร้อมมอบหมายกรรมการ" : "ส่งคำขอแก้ไขเอกสารให้นักศึกษาแล้ว" };
}

export async function assignReviewer(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["staff"]);
  const applicationId = value(form, "application_id");
  const reviewerId = value(form, "reviewer_id");
  if (!uuid(applicationId) || !uuid(reviewerId)) return failure("22023");
  const client = await createClient();
  const { error } = await client.rpc("staff_assign_reviewer", { p_application_id: applicationId, p_reviewer_id: reviewerId, p_reason: value(form, "reason") });
  if (error) return failure(error.code);
  revalidatePath(`/staff/review/${applicationId}`);
  revalidatePath("/staff/review");
  return { error: "", success: "มอบหมายกรรมการแล้ว" };
}

export async function saveEvaluation(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["committee"]);
  const assignmentId = value(form, "assignment_id");
  const version = value(form, "version") ? Number(value(form, "version")) : null;
  let scores: unknown;
  try { scores = JSON.parse(value(form, "scores")); } catch { return failure("22023"); }
  if (!uuid(assignmentId) || (version !== null && (!Number.isSafeInteger(version) || version < 1)) || !Array.isArray(scores)) return failure("22023");
  const client = await createClient();
  const { error } = await client.rpc("committee_save_evaluation", {
    p_assignment_id: assignmentId,
    p_version: version,
    p_scores: scores,
    p_recommendation: value(form, "recommendation"),
    p_comment: value(form, "comment"),
    p_submit: value(form, "mode") === "submit",
  });
  if (error) return failure(error.code);
  revalidatePath("/committee");
  revalidatePath(`/staff/evaluation?assignment=${assignmentId}`);
  return { error: "", success: value(form, "mode") === "submit" ? "ส่งผลประเมินให้เจ้าหน้าที่แล้ว" : "บันทึกร่างผลประเมินแล้ว" };
}

export async function decideApplication(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["staff"]);
  const applicationId = value(form, "application_id");
  const version = Number(value(form, "version"));
  if (!uuid(applicationId) || !Number.isSafeInteger(version) || version < 1) return failure("22023");
  const client = await createClient();
  const { error } = await client.rpc("staff_decide_application", {
    p_application_id: applicationId,
    p_version: version,
    p_decision: value(form, "decision"),
    p_reason: value(form, "reason"),
  });
  if (error) return failure(error.code);
  revalidatePath(`/staff/review/${applicationId}`);
  revalidatePath("/staff/review");
  return { error: "", success: "บันทึกผลการพิจารณาและแจ้งนักศึกษาแล้ว" };
}

const proofTypes: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export async function recordDisbursement(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["staff"]);
  const applicationId = value(form, "application_id");
  const version = value(form, "version") ? Number(value(form, "version")) : null;
  const amount = Number(value(form, "amount"));
  if (!uuid(applicationId) || (version !== null && (!Number.isSafeInteger(version) || version < 1)) || !Number.isFinite(amount) || amount <= 0) return failure("22023");
  const client = await createClient();
  const proof = form.get("proof");
  const existingPath = value(form, "current_proof") || null;
  let path = existingPath;
  if (proof instanceof File && proof.size) {
    const extension = proofTypes[proof.type];
    if (!extension || proof.size > 5 * 1024 * 1024) return { error: "หลักฐานการโอนต้องเป็น PDF, JPG หรือ PNG ขนาดไม่เกิน 5 MB", success: "" };
    path = `${applicationId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage.from("scholarship-payment-proofs").upload(path, proof, { contentType: proof.type, upsert: false });
    if (uploadError) return { error: "อัปโหลดหลักฐานการโอนไม่สำเร็จ", success: "" };
  }
  const transferDate = value(form, "transfer_date");
  const { error } = await client.rpc("staff_record_disbursement", {
    p_application_id: applicationId,
    p_version: version,
    p_amount: amount,
    p_status: value(form, "status"),
    p_transfer_date: transferDate || null,
    p_transfer_reference: value(form, "transfer_reference") || null,
    p_proof_path: path,
    p_reason: value(form, "reason"),
  });
  if (error) {
    if (path && path !== existingPath) await client.storage.from("scholarship-payment-proofs").remove([path]);
    return failure(error.code);
  }
  if (existingPath && path !== existingPath) await client.storage.from("scholarship-payment-proofs").remove([existingPath]);
  revalidatePath(`/staff/review/${applicationId}`);
  revalidatePath("/staff");
  return { error: "", success: "บันทึกข้อมูลการจ่ายทุนแล้ว" };
}

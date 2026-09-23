"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { dispatchNotificationEmails } from "@/lib/notifications/email";
import type { WorkflowState } from "./scholarships";

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const failed = (message = "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่"): WorkflowState => ({ error: message, success: "" });

function timestamp(raw: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function declareReviewConflict(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["committee"]);
  const assignmentId = value(form, "assignment_id");
  const hasConflict = value(form, "conflict") === "yes";
  const note = value(form, "note");
  if (!uuid(assignmentId) || (hasConflict && note.length < 5) || note.length > 1000) return failed("กรุณาระบุข้อมูลผลประโยชน์ทับซ้อนให้ครบ");
  const client = await createClient();
  const { error } = await client.rpc("committee_declare_conflict", { p_assignment_id: assignmentId, p_has_conflict: hasConflict, p_note: note || null });
  if (error) return failed(error.code === "42501" ? "งานนี้ไม่พร้อมให้ยืนยันแล้ว" : undefined);
  revalidatePath(`/staff/evaluation?assignment=${assignmentId}`);
  revalidatePath("/committee");
  await dispatchNotificationEmails();
  return { error: "", success: hasConflict ? "แจ้งเจ้าหน้าที่แล้ว งานนี้ถูกถอนจากรายการประเมินของคุณ" : "ยืนยันแล้วว่าไม่มีผลประโยชน์ทับซ้อน" };
}

export async function setScholarshipProcess(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["staff"]);
  const scholarshipId = value(form, "scholarship_id");
  const reviewers = Number(value(form, "required_reviewers"));
  const publish = value(form, "publish_results") === "on";
  const deadlineRaw = value(form, "appeal_deadline");
  const deadline = deadlineRaw ? timestamp(deadlineRaw) : null;
  if (!uuid(scholarshipId) || !Number.isSafeInteger(reviewers) || reviewers < 1 || reviewers > 10 || (deadlineRaw && !deadline)) return failed("กรุณาตรวจจำนวนกรรมการและกำหนดเวลาอุทธรณ์");
  const client = await createClient();
  const { error } = await client.rpc("staff_set_scholarship_process", { p_scholarship_id: scholarshipId, p_required_reviewers: reviewers, p_publish_results: publish, p_appeal_deadline: deadline, p_reason: value(form, "reason") });
  if (error) return failed(error.message === "No final results are available" ? "ยังไม่มีผลการพิจารณาสำหรับประกาศ" : undefined);
  revalidatePath("/staff/scholarships");
  revalidatePath(`/scholarships/${scholarshipId}/results`);
  return { error: "", success: publish ? "เผยแพร่ผลและกำหนดช่วงอุทธรณ์แล้ว" : "บันทึกจำนวนกรรมการและซ่อนผลประกาศแล้ว" };
}

export async function scheduleInterview(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["staff"]);
  const applicationId = value(form, "application_id");
  const scheduledAt = timestamp(value(form, "scheduled_at"));
  const status = value(form, "status");
  if (!uuid(applicationId) || !scheduledAt || !["scheduled", "completed", "cancelled", "no_show"].includes(status)) return failed("กรุณากรอกวัน เวลา สถานที่ และสถานะนัดสัมภาษณ์");
  const client = await createClient();
  const { error } = await client.rpc("staff_schedule_interview", { p_application_id: applicationId, p_scheduled_at: scheduledAt, p_location: value(form, "location"), p_meeting_url: value(form, "meeting_url") || null, p_note: value(form, "note"), p_status: status });
  if (error) return failed();
  revalidatePath(`/staff/review/${applicationId}`);
  revalidatePath(`/applications/${applicationId}`);
  await dispatchNotificationEmails();
  return { error: "", success: "บันทึกนัดสัมภาษณ์และแจ้งนักศึกษาแล้ว" };
}

export async function submitAppeal(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["student"]);
  const applicationId = value(form, "application_id");
  const reason = value(form, "reason");
  if (!uuid(applicationId) || reason.length < 20 || reason.length > 5000) return failed("กรุณาระบุเหตุผลอุทธรณ์อย่างน้อย 20 ตัวอักษร");
  const client = await createClient();
  const { error } = await client.rpc("student_submit_appeal", { p_application_id: applicationId, p_reason: reason });
  if (error) return failed(error.code === "23505" ? "คุณส่งคำอุทธรณ์สำหรับใบสมัครนี้แล้ว" : error.message === "Appeal period is closed" ? "ขณะนี้ไม่อยู่ในช่วงเวลารับอุทธรณ์" : undefined);
  revalidatePath(`/applications/${applicationId}`);
  await dispatchNotificationEmails();
  return { error: "", success: "ส่งคำอุทธรณ์แล้ว เจ้าหน้าที่จะพิจารณาและแจ้งผลผ่านระบบ" };
}

export async function resolveAppeal(_previous: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["staff"]);
  const appealId = value(form, "appeal_id");
  const applicationId = value(form, "application_id");
  const version = Number(value(form, "version"));
  const status = value(form, "status");
  const response = value(form, "response");
  if (!uuid(appealId) || !uuid(applicationId) || !Number.isSafeInteger(version) || !["upheld", "rejected"].includes(status) || response.length < 10) return failed("กรุณาเลือกผลและอธิบายคำวินิจฉัย");
  const client = await createClient();
  const { error } = await client.rpc("staff_resolve_appeal", { p_appeal_id: appealId, p_version: version, p_status: status, p_response: response });
  if (error) return failed((error.code === "40001" || (error.code === "P0001" && error.message === "Appeal is not available or changed")) ? "คำอุทธรณ์นี้ถูกเปลี่ยนแล้ว กรุณารีเฟรชหน้า" : undefined);
  revalidatePath(`/staff/review/${applicationId}`);
  revalidatePath(`/applications/${applicationId}`);
  await dispatchNotificationEmails();
  return { error: "", success: "บันทึกและแจ้งผลคำอุทธรณ์แล้ว" };
}

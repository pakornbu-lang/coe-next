"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { WorkflowState } from "./scholarships";

export async function removeDraftDocument(_: WorkflowState, form: FormData): Promise<WorkflowState> {
  await requireRole(["student"]);
  const applicationId = String(form.get("application_id") ?? "");
  const documentId = String(form.get("document_id") ?? "");
  const version = Number(form.get("version"));
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(applicationId) || !uuid.test(documentId) || !Number.isSafeInteger(version) || version < 1) {
    return { error: "ข้อมูลเอกสารไม่ถูกต้อง กรุณารีเฟรชหน้า", success: "" };
  }
  const client = await createClient();
  const { error } = await client.rpc("student_remove_draft_document", {
    p_application_id: applicationId, p_document_id: documentId, p_version: version,
  });
  if (error) return { error: error.code === "PT409" ? "เอกสารถูกเปลี่ยนแล้ว กรุณารีเฟรชหน้า" : "ลบไม่สำเร็จ ลบได้เฉพาะเอกสารในใบสมัครร่างของคุณที่ยังไม่เคยส่ง", success: "" };
  revalidatePath("/apply");
  revalidatePath(`/applications/${applicationId}`);
  return { error: "", success: "นำเอกสารออกจากใบสมัครแล้ว ระบบยังเก็บหลักฐานตามนโยบายการเก็บข้อมูล" };
}

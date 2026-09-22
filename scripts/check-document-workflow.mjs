import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && publicKey && secretKey, "Load the target environment and apply the document versions migration first");

const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const password = `Qa!${crypto.randomUUID()}Aa1`;
const users = [];
const paths = [];
let scholarshipId;

async function account(role) {
  const email = `qa-document-${role}-${users.length}-${suffix}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: `QA ${role}`, student_id: `99${String(Date.now()).slice(-6)}${users.length}`, prefix: "นาย", first_name: "ทดสอบ", last_name: role },
  });
  assert.equal(error, null, `create ${role}: ${error?.message}`);
  users.push({ id: data.user.id, email });
  const { error: roleError } = await admin.from("portal_profiles").update({ role, active: true }).eq("id", data.user.id);
  assert.equal(roleError, null, `set ${role} role`);
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: loginError } = await client.auth.signInWithPassword({ email, password });
  assert.equal(loginError, null, `sign in ${role}`);
  return { client, id: data.user.id };
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  assert.equal(error, null, `${name}: ${error?.message}`);
  return data;
}

async function uploadPdf(studentId, applicationId, marker) {
  const path = `${studentId}/${applicationId}/${crypto.randomUUID()}.pdf`;
  const file = Buffer.from(`%PDF-1.7\n${marker}\n%%EOF\n`);
  const { error } = await admin.storage.from("scholarship-documents").upload(path, file, { contentType: "application/pdf" });
  assert.equal(error, null, `upload ${marker}: ${error?.message}`);
  paths.push(path);
  return { path, file };
}

try {
  const staff = await account("staff");
  const committee = await account("committee");
  const student = await account("student");
  const outsider = await account("student");
  const now = Date.now();
  scholarshipId = await rpc(staff.client, "staff_save_scholarship", {
    p_id: null, p_version: null, p_title: `ทุนทดสอบเอกสาร ${suffix}`, p_type_id: null,
    p_description: "ทดสอบประวัติเอกสารชั่วคราว", p_eligibility: "ข้อมูลทดสอบจะถูกลบ",
    p_amount: 1000, p_quota: 1, p_minimum_gpa: 2,
    p_opens_at: new Date(now - 60_000).toISOString(), p_closes_at: new Date(now + 86_400_000).toISOString(),
    p_status: "published", p_requirements: [{ label: "หนังสือรับรอง", details: "ไฟล์ PDF", required: true, sort_order: 1 }],
    p_criteria: [{ label: "ความเหมาะสม", details: "เกณฑ์ทดสอบ", max_score: 100, sort_order: 1 }],
    p_reason: "ทดสอบระบบเอกสาร", p_program_kind: "general", p_cover_path: null,
  });
  const { data: requirement, error: requirementError } = await admin.from("scholarship_document_requirements").select("id").eq("scholarship_id", scholarshipId).single();
  assert.equal(requirementError, null);
  const applicationData = {
    faculty: "สำนักวิชาทดสอบ", major: "สาขาทดสอบ", education_level: "ปริญญาตรี", study_year: "3",
    gpa: "3.50", phone: "0812345678", address: "ที่อยู่สำหรับทดสอบระบบเท่านั้น", income: "120000",
    family_members: "4", parent_status: "อยู่ด้วยกัน", reason: "เหตุผลการสมัครทุนสำหรับทดสอบระบบเอกสารให้ครบทุกขั้นตอน",
  };
  const applicationId = await rpc(student.client, "student_save_application", {
    p_application_id: null, p_version: null, p_scholarship_id: scholarshipId, p_data: applicationData,
    p_bank_name: "ธนาคารทดสอบ", p_account_holder: "นาย ทดสอบ student", p_account_number: "1234567890", p_submit: false,
  });
  const first = await uploadPdf(student.id, applicationId, "first version");
  const directPath = `${student.id}/${applicationId}/${crypto.randomUUID()}.pdf`;
  const directUpload = await student.client.storage.from("scholarship-documents")
    .upload(directPath, first.file, { contentType: "application/pdf" });
  if (!directUpload.error) paths.push(directPath);
  assert(directUpload.error, "direct student Storage upload should be denied");
  await rpc(student.client, "student_replace_application_document", {
    p_application_id: applicationId, p_requirement_id: requirement.id, p_file_path: first.path,
    p_file_name: "first.pdf", p_mime_type: "application/pdf", p_file_size: first.file.length,
  });
  let { data: document, error: documentError } = await admin.from("application_documents")
    .select("id,version,revision_no,status").eq("application_id", applicationId).single();
  assert.equal(documentError, null);
  assert.equal(document.revision_no, 1);
  let { data: application } = await admin.from("applications").select("version,status").eq("id", applicationId).single();
  await rpc(student.client, "student_save_application", {
    p_application_id: applicationId, p_version: application.version, p_scholarship_id: scholarshipId, p_data: applicationData,
    p_bank_name: "ธนาคารทดสอบ", p_account_holder: "นาย ทดสอบ student", p_account_number: "1234567890", p_submit: true,
  });
  ({ data: application } = await admin.from("applications").select("version,status").eq("id", applicationId).single());
  const invalid = await staff.client.rpc("staff_review_application_documents", {
    p_application_id: applicationId, p_version: application.version,
    p_documents: [{ id: document.id, version: document.version, status: "revision_required", feedback: "" }],
    p_action: "request_revision", p_reason: "เอกสารต้องแก้ไข",
  });
  assert(invalid.error, "per-document feedback must be required");
  await rpc(staff.client, "staff_review_application_documents", {
    p_application_id: applicationId, p_version: application.version,
    p_documents: [{ id: document.id, version: document.version, status: "revision_required", feedback: "ภาพไม่ชัดเจน" }],
    p_action: "request_revision", p_reason: "กรุณาส่งหนังสือรับรองที่อ่านได้ชัดเจน",
  });
  ({ data: application } = await admin.from("applications").select("version,status").eq("id", applicationId).single());
  const second = await uploadPdf(student.id, applicationId, "second version");
  await rpc(student.client, "student_replace_application_document", {
    p_application_id: applicationId, p_requirement_id: requirement.id, p_file_path: second.path,
    p_file_name: "second.pdf", p_mime_type: "application/pdf", p_file_size: second.file.length,
  });
  ({ data: document, error: documentError } = await admin.from("application_documents")
    .select("id,version,revision_no,status").eq("application_id", applicationId).single());
  assert.equal(documentError, null);
  assert.equal(document.revision_no, 2);
  const { data: versions, error: versionsError } = await admin.from("application_document_versions")
    .select("revision_no,status,feedback,file_path").eq("document_id", document.id).order("revision_no");
  assert.equal(versionsError, null);
  assert.deepEqual(versions.map((version) => version.revision_no), [1, 2]);
  assert.equal(versions[0].status, "revision_required");
  assert.equal(versions[0].feedback, "ภาพไม่ชัดเจน");
  assert.equal(versions[1].status, "pending");
  const stale = await staff.client.rpc("staff_review_application_documents", {
    p_application_id: applicationId, p_version: application.version,
    p_documents: [{ id: document.id, version: document.version - 1, status: "verified", feedback: "" }],
    p_action: "verify", p_reason: "ตรวจเอกสารแล้ว",
  });
  assert(stale.error, "stale review must be rejected");
  const { data: studentVersions, error: studentVersionError } = await student.client.from("application_document_versions").select("id").eq("document_id", document.id);
  assert.equal(studentVersionError, null);
  assert.equal(studentVersions.length, 2);
  const { data: outsiderVersions, error: outsiderVersionError } = await outsider.client.from("application_document_versions").select("id").eq("document_id", document.id);
  assert.equal(outsiderVersionError, null);
  assert.equal(outsiderVersions.length, 0);
  const ownerOldFile = await student.client.storage.from("scholarship-documents").createSignedUrl(first.path, 60);
  const outsiderOldFile = await outsider.client.storage.from("scholarship-documents").createSignedUrl(first.path, 60);
  assert.equal(ownerOldFile.error, null);
  assert(outsiderOldFile.error);
  await rpc(student.client, "student_save_application", {
    p_application_id: applicationId, p_version: application.version, p_scholarship_id: scholarshipId, p_data: applicationData,
    p_bank_name: "ธนาคารทดสอบ", p_account_holder: "นาย ทดสอบ student", p_account_number: "1234567890", p_submit: true,
  });
  ({ data: application } = await admin.from("applications").select("version,status").eq("id", applicationId).single());
  await rpc(staff.client, "staff_review_application_documents", {
    p_application_id: applicationId, p_version: application.version,
    p_documents: [{ id: document.id, version: document.version, status: "verified", feedback: "" }],
    p_action: "verify", p_reason: "เอกสารฉบับใหม่ผ่านการตรวจแล้ว",
  });
  await rpc(staff.client, "staff_assign_reviewer", {
    p_application_id: applicationId, p_reviewer_id: committee.id, p_reason: "มอบหมายเพื่อทดสอบสิทธิ์เอกสาร",
  });
  const committeeCurrent = await committee.client.storage.from("scholarship-documents").createSignedUrl(second.path, 60);
  const committeeOld = await committee.client.storage.from("scholarship-documents").createSignedUrl(first.path, 60);
  assert.equal(committeeCurrent.error, null);
  assert(committeeOld.error, "committee must not open previous file versions");
  const { data: committeeVersions } = await committee.client.from("application_document_versions").select("id").eq("document_id", document.id);
  assert.equal(committeeVersions.length, 0);
  console.log("PASS: upload, revision, version history, review, stale-write protection, and role-scoped access");
} finally {
  if (paths.length) {
    const { error } = await admin.storage.from("scholarship-documents").remove(paths);
    assert.equal(error, null, `cleanup files: ${error?.message}`);
  }
  const ids = users.map((user) => user.id);
  const emails = users.map((user) => user.email);
  if (ids.length) {
    for (const operation of [
      admin.from("notification_email_outbox").delete().in("to_email", emails),
      admin.from("portal_notifications").delete().in("user_id", ids),
      admin.from("applications").delete().in("student_id", ids),
      admin.from("scholarships").delete().in("created_by", ids),
    ]) {
      const { error } = await operation;
      assert.equal(error, null, `cleanup data: ${error?.message}`);
    }
    const { error } = await admin.from("portal_profiles").delete().in("id", ids);
    assert.equal(error, null, `cleanup profiles: ${error?.message}`);
    for (const user of users) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      assert.equal(deleteError, null, `cleanup account: ${deleteError?.message}`);
    }
  }
  console.log("PASS: temporary document test records and files cleaned up");
}

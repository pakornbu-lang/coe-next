import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
assert(url && publicKey && secretKey, "Load .env.local before running this check");

const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const password = `Qa!${crypto.randomUUID()}Aa1`;
const users = [];
let scholarshipId = null;

async function purgeAccounts(items) {
  if (!items.length) return;
  const ids = items.map((item) => item.id);
  const emails = items.map((item) => item.email);
  const operations = [
    admin.from("notification_email_outbox").delete().in("to_email", emails),
    admin.from("portal_notifications").delete().in("user_id", ids),
    admin.from("review_assignments").delete().in("reviewer_id", ids),
    admin.from("applications").delete().in("student_id", ids),
    admin.from("scholarships").delete().in("created_by", ids),
  ];
  for (const operation of operations) {
    const { error } = await operation;
    assert.equal(error, null, `cleanup workflow rows: ${error?.message ?? "unknown error"}`);
  }
  const { error: profileDeleteError } = await admin.from("portal_profiles").delete().in("id", ids);
  assert.equal(profileDeleteError, null, `cleanup profiles: ${profileDeleteError?.message ?? "unknown error"}`);
  for (const item of items) {
    const { error } = await admin.auth.admin.deleteUser(item.id);
    assert.equal(error, null, `cleanup auth user: ${error?.message ?? "unknown error"}`);
  }
}

// Remove only stale rows created by an interrupted run of this QA script.
const { data: staleProfiles, error: staleProfileError } = await admin.from("portal_profiles").select("id,email").like("email", "qa-%@example.com");
assert.equal(staleProfileError, null);
await purgeAccounts(staleProfiles ?? []);

const account = (role) => ({
  role,
  email: `qa-${role}-${suffix}@example.com`,
  studentId: `99${String(Date.now()).slice(-6)}${role.length}`,
});

async function createAccount(item) {
  const { data, error } = await admin.auth.admin.createUser({
    email: item.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `QA ${item.role}`, student_id: item.studentId, prefix: "นาย", first_name: "ทดสอบ", last_name: item.role },
  });
  assert.equal(error, null, `create ${item.role}`);
  item.id = data.user.id;
  users.push(item);
  const { error: roleError } = await admin.from("portal_profiles").update({ role: item.role, active: true }).eq("id", item.id);
  assert.equal(roleError, null, `set ${item.role} role`);
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email: item.email, password });
  assert.equal(signInError, null, `sign in ${item.role}`);
  return client;
}

async function rpc(client, name, args, message) {
  const result = await client.rpc(name, args);
  assert.equal(result.error, null, `${message}: ${result.error?.message ?? "unknown error"}`);
  return result.data;
}

try {
  const staffAccount = account("staff");
  const committeeAccount = account("committee");
  const studentAccount = account("student");
  const [staff, committee, student] = await Promise.all([
    createAccount(staffAccount), createAccount(committeeAccount), createAccount(studentAccount),
  ]);
  console.log("PASS: temporary role accounts created and authenticated");

  const now = Date.now();
  scholarshipId = await rpc(staff, "staff_save_scholarship", {
    p_id: null,
    p_version: null,
    p_title: `ทุนทดสอบระบบ ${suffix}`,
    p_type_id: null,
    p_description: "ทุนชั่วคราวสำหรับทดสอบวงจรระบบอัตโนมัติ",
    p_eligibility: "ข้อมูลนี้จะถูกลบหลังทดสอบ",
    p_amount: 1000,
    p_quota: 1,
    p_minimum_gpa: 2,
    p_opens_at: new Date(now - 60_000).toISOString(),
    p_closes_at: new Date(now + 86_400_000).toISOString(),
    p_status: "published",
    p_requirements: [],
    p_criteria: [{ label: "ความเหมาะสม", details: "เกณฑ์ทดสอบ", max_score: 100, sort_order: 1 }],
    p_reason: "ทดสอบระบบอัตโนมัติ",
    p_program_kind: "general",
    p_cover_path: null,
  }, "create scholarship");
  assert.match(scholarshipId, /^[0-9a-f-]{36}$/i);

  const applicationId = await rpc(student, "student_save_application", {
    p_application_id: null,
    p_version: null,
    p_scholarship_id: scholarshipId,
    p_data: {
      faculty: "สำนักวิชาทดสอบ", major: "สาขาทดสอบ", education_level: "ปริญญาตรี", study_year: "3",
      gpa: "3.50", phone: "0812345678", address: "ที่อยู่สำหรับทดสอบระบบเท่านั้น", income: "120000",
      family_members: "4", parent_status: "อยู่ด้วยกัน", reason: "เหตุผลการสมัครทุนสำหรับทดสอบระบบให้ครบทุกขั้นตอน",
    },
    p_bank_name: "ธนาคารทดสอบ",
    p_account_holder: "นาย ทดสอบ student",
    p_account_number: "1234567890",
    p_submit: true,
  }, "submit application");
  let { data: application } = await admin.from("applications").select("version,status,application_no").eq("id", applicationId).single();
  assert.equal(application.status, "submitted");

  await rpc(staff, "staff_review_application_documents", {
    p_application_id: applicationId, p_version: application.version, p_documents: [], p_action: "verify", p_reason: "เอกสารครบสำหรับการทดสอบ",
  }, "verify documents");
  ({ data: application } = await admin.from("applications").select("version,status,application_no").eq("id", applicationId).single());
  assert.equal(application.status, "ready_for_review");

  await rpc(staff, "staff_schedule_interview", {
    p_application_id: applicationId,
    p_scheduled_at: new Date(now + 3_600_000).toISOString(),
    p_location: "ห้องสัมภาษณ์ทดสอบ",
    p_meeting_url: "https://example.com/interview",
    p_note: "นัดทดสอบอัตโนมัติ",
    p_status: "scheduled",
  }, "schedule interview");
  const studentInterview = await student.from("application_interviews").select("status,location").eq("application_id", applicationId).single();
  assert.equal(studentInterview.error, null);
  assert.equal(studentInterview.data.status, "scheduled");

  await rpc(staff, "staff_set_scholarship_process", {
    p_scholarship_id: scholarshipId, p_required_reviewers: 2, p_publish_results: false, p_appeal_deadline: null, p_reason: "ทดสอบจำนวนกรรมการขั้นต่ำ",
  }, "set reviewer quorum");
  const assignmentId = await rpc(staff, "staff_assign_reviewer", {
    p_application_id: applicationId, p_reviewer_id: committeeAccount.id, p_reason: "มอบหมายเพื่อทดสอบระบบ",
  }, "assign reviewer");
  const committeeInterview = await committee.from("application_interviews").select("status").eq("application_id", applicationId).single();
  assert.equal(committeeInterview.error, null);

  const { data: criterion } = await admin.from("scholarship_review_criteria").select("id").eq("scholarship_id", scholarshipId).single();
  const blockedEvaluation = await committee.rpc("committee_save_evaluation", {
    p_assignment_id: assignmentId, p_version: null, p_scores: [{ criterion_id: criterion.id, score: "80", comment: "" }], p_recommendation: "approve", p_comment: "", p_submit: true,
  });
  assert(blockedEvaluation.error, "evaluation must require conflict disclosure");
  await rpc(committee, "committee_declare_conflict", { p_assignment_id: assignmentId, p_has_conflict: false, p_note: null }, "clear conflict disclosure");
  await rpc(committee, "committee_save_evaluation", {
    p_assignment_id: assignmentId, p_version: null, p_scores: [{ criterion_id: criterion.id, score: "", comment: "" }], p_recommendation: "approve", p_comment: "ร่างยังไม่ครบ", p_submit: false,
  }, "save incomplete evaluation draft");
  const { data: evaluation } = await admin.from("evaluations").select("version").eq("assignment_id", assignmentId).single();
  await rpc(committee, "committee_save_evaluation", {
    p_assignment_id: assignmentId, p_version: evaluation.version, p_scores: [{ criterion_id: criterion.id, score: "80", comment: "ผ่านเกณฑ์" }], p_recommendation: "approve", p_comment: "ผลทดสอบ", p_submit: true,
  }, "submit evaluation");

  ({ data: application } = await admin.from("applications").select("version,status,application_no").eq("id", applicationId).single());
  const blockedDecision = await staff.rpc("staff_decide_application", { p_application_id: applicationId, p_version: application.version, p_decision: "rejected", p_reason: "ทดสอบ quorum" });
  assert(blockedDecision.error, "decision must be blocked before reviewer quorum");
  await rpc(staff, "staff_set_scholarship_process", {
    p_scholarship_id: scholarshipId, p_required_reviewers: 1, p_publish_results: false, p_appeal_deadline: null, p_reason: "ปรับจำนวนกรรมการหลังทดสอบ quorum",
  }, "lower reviewer quorum");
  await rpc(staff, "staff_decide_application", { p_application_id: applicationId, p_version: application.version, p_decision: "rejected", p_reason: "ผลทดสอบการพิจารณา" }, "final decision");

  const appealDeadline = new Date(now + 86_400_000).toISOString();
  await rpc(staff, "staff_set_scholarship_process", {
    p_scholarship_id: scholarshipId, p_required_reviewers: 1, p_publish_results: true, p_appeal_deadline: appealDeadline, p_reason: "ทดสอบประกาศผลและรับอุทธรณ์",
  }, "publish results");
  const anonymous = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const publicResults = await anonymous.rpc("published_scholarship_results", { p_scholarship_id: scholarshipId });
  assert.equal(publicResults.error, null);
  assert(publicResults.data.some((row) => Number(row.application_no) === Number(application.application_no) && row.result === "rejected"));
  const anonymousInterview = await anonymous.from("application_interviews").select("id");
  assert(anonymousInterview.error, "anonymous users must not read interviews directly");

  const appealId = await rpc(student, "student_submit_appeal", { p_application_id: applicationId, p_reason: "ขออุทธรณ์ผลการพิจารณาเนื่องจากมีข้อมูลเพิ่มเติมสำหรับการทดสอบ" }, "submit appeal");
  const { data: appeal } = await admin.from("application_appeals").select("version,status").eq("id", appealId).single();
  assert.equal(appeal.status, "pending");
  await rpc(staff, "staff_resolve_appeal", { p_appeal_id: appealId, p_version: appeal.version, p_status: "upheld", p_response: "ตรวจสอบข้อมูลเพิ่มเติมแล้ว รับอุทธรณ์และเปิดพิจารณาใหม่" }, "resolve appeal");
  const { data: resolvedAppeal } = await admin.from("application_appeals").select("status,resolved_at").eq("id", appealId).single();
  assert.equal(resolvedAppeal.status, "upheld");
  assert(resolvedAppeal.resolved_at);
  const { data: reopenedApplication } = await admin.from("applications").select("status,decided_at").eq("id", applicationId).single();
  assert.equal(reopenedApplication.status, "committee_review");
  assert.equal(reopenedApplication.decided_at, null);

  console.log("PASS: application, interview, conflict disclosure, draft scoring, quorum, results and appeal flow");
} finally {
  const testEmails = users.map((item) => item.email);
  await purgeAccounts(users);
  const [{ data: remainingProfiles, error: profileCleanupError }, { data: remainingOutbox, error: outboxCleanupError }] = await Promise.all([
    admin.from("portal_profiles").select("id").in("email", testEmails),
    admin.from("notification_email_outbox").select("id").in("to_email", testEmails),
  ]);
  assert.equal(profileCleanupError, null);
  assert.equal(outboxCleanupError, null);
  assert.equal(remainingProfiles?.length ?? 0, 0);
  assert.equal(remainingOutbox?.length ?? 0, 0);
  console.log("PASS: temporary workflow data cleaned up");
}

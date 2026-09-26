"use client";

import { useActionState } from "react";
import { declareReviewConflict, resolveAppeal, setScholarshipProcess, submitAppeal } from "@/app/actions/extended-workflow";
import type { WorkflowState } from "@/app/actions/scholarships";

const empty: WorkflowState = { error: "", success: "" };
const Result = ({ state }: { state: WorkflowState }) => <>{state.error && <p className="workflow-error" role="alert">{state.error}</p>}{state.success && <p className="workflow-success" role="status"><span className="action-success-mark" aria-hidden="true">✓</span>{state.success}</p>}</>;

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).reduce<Record<string, string>>((all, part) => ({ ...all, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function ConflictDisclosure({ assignmentId, status }: { assignmentId: string; status?: string }) {
  const [state, action, pending] = useActionState(declareReviewConflict, empty);
  if (status === "clear") return <p className="workflow-success">ยืนยันแล้วว่าไม่มีผลประโยชน์ทับซ้อน</p>;
  if (status === "declared") return <p className="workflow-info">คุณแจ้งผลประโยชน์ทับซ้อนแล้ว เจ้าหน้าที่จะมอบหมายกรรมการคนใหม่</p>;
  return <form action={action} className="workflow-form"><input type="hidden" name="assignment_id" value={assignmentId}/><section className="panel"><h2>ยืนยันผลประโยชน์ทับซ้อน</h2><p>ก่อนเริ่มให้คะแนน กรุณายืนยันว่าคุณไม่มีความสัมพันธ์หรือผลประโยชน์ที่อาจกระทบความเป็นกลาง</p><label>สถานะ *<select name="conflict" required defaultValue=""><option value="" disabled>เลือกสถานะ</option><option value="no">ไม่มีผลประโยชน์ทับซ้อน</option><option value="yes">มีหรืออาจมีผลประโยชน์ทับซ้อน</option></select></label><label>รายละเอียดกรณีมีผลประโยชน์ทับซ้อน<textarea name="note" maxLength={1000} rows={3}/></label><button className="btn" disabled={pending} aria-busy={pending}>{pending && <span className="action-spinner" aria-hidden="true"/>}{pending ? "กำลังบันทึก…" : "ยืนยันสถานะ"}</button><Result state={state}/></section></form>;
}

// ตั้งจำนวนกรรมการขั้นต่ำรายทุนและการเผยแพร่ผล; เปลี่ยนช่วงค่าที่กรอกต้องตรวจ RPC staff_set_scholarship_process ด้วย
export function ScholarshipProcessForm({ scholarship }: { scholarship: { id: string; required_reviewer_count?: number; results_published_at?: string | null; appeal_deadline?: string | null } }) {
  const [state, action, pending] = useActionState(setScholarshipProcess, empty);
  return <details className="workflow-process"><summary>ตั้งค่ากระบวนการ / ประกาศผล</summary><form action={action} className="workflow-form"><input type="hidden" name="scholarship_id" value={scholarship.id}/><div className="workflow-grid"><label>จำนวนกรรมการขั้นต่ำ *<input name="required_reviewers" type="number" required min="1" max="10" step="1" defaultValue={scholarship.required_reviewer_count ?? 1}/></label><label className="structure-check"><input name="publish_results" type="checkbox" defaultChecked={Boolean(scholarship.results_published_at)}/> เผยแพร่ผลให้ผู้สมัครตรวจสอบ</label><label>ปิดรับอุทธรณ์<input name="appeal_deadline" type="datetime-local" defaultValue={localDateTime(scholarship.appeal_deadline)}/></label><label className="workflow-wide">เหตุผลการเปลี่ยนแปลง *<textarea name="reason" required minLength={3} maxLength={500} rows={2}/></label></div><button className="btn" disabled={pending} aria-busy={pending}>{pending && <span className="action-spinner" aria-hidden="true"/>}{pending ? "กำลังบันทึก…" : "บันทึกกระบวนการ"}</button><Result state={state}/></form></details>;
}

// ส่วนนี้เป็นลิงก์ไปหน้าจัดการสัมภาษณ์ ไม่ใช่ฟอร์มบันทึกนัด
// ต้องการเพิ่มช่องวันเวลา/ผลสัมภาษณ์ ให้แก้ InterviewControl ใน OperationsForms.tsx
export function InterviewForm({ applicationId }: { applicationId: string; interview?: unknown }) {
  return <p>จัดการเวลา กรรมการ และผลสัมภาษณ์ได้ที่ <a className="btn secondary" href={"/staff/interviews?application="+applicationId}>ตารางสัมภาษณ์</a></p>;
}
export function StudentAppealForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(submitAppeal, empty);
  return <form action={action} className="workflow-form"><input type="hidden" name="application_id" value={applicationId}/><label>เหตุผลอุทธรณ์ *<textarea name="reason" required minLength={20} maxLength={5000} rows={5} placeholder="ระบุข้อเท็จจริงหรือข้อมูลที่ต้องการให้ทบทวน"/></label><button className="btn" disabled={pending} aria-busy={pending}>{pending && <span className="action-spinner" aria-hidden="true"/>}{pending ? "กำลังส่ง…" : "ส่งคำอุทธรณ์"}</button><Result state={state}/></form>;
}

export function AppealResolutionForm({ applicationId, appeal }: { applicationId: string; appeal: { id: string; version: number; reason: string; status: string; response: string | null } }) {
  const [state, action, pending] = useActionState(resolveAppeal, empty);
  if (appeal.status !== "pending") return <div className="workflow-info"><strong>ผลอุทธรณ์: {appeal.status === "upheld" ? "รับอุทธรณ์" : "ยกคำอุทธรณ์"}</strong><p>{appeal.response}</p></div>;
  return <form action={action} className="workflow-form"><input type="hidden" name="application_id" value={applicationId}/><input type="hidden" name="appeal_id" value={appeal.id}/><input type="hidden" name="version" value={appeal.version}/><p className="workflow-preserve"><strong>เหตุผลจากนักศึกษา:</strong><br/>{appeal.reason}</p><label>ผลพิจารณา *<select name="status" required defaultValue=""><option value="" disabled>เลือกผล</option><option value="upheld">รับอุทธรณ์</option><option value="rejected">ยกคำอุทธรณ์</option></select></label><label>คำวินิจฉัย *<textarea name="response" required minLength={10} maxLength={5000} rows={4}/></label><button className="btn" disabled={pending} aria-busy={pending}>{pending && <span className="action-spinner" aria-hidden="true"/>}{pending ? "กำลังบันทึก…" : "บันทึกและแจ้งผลอุทธรณ์"}</button><Result state={state}/></form>;
}

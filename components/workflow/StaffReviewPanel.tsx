"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assignReviewer, decideApplication, recordDisbursement, type WorkflowState } from "@/app/actions/scholarships";
import type { ApplicationDocument, ApplicationDocumentVersion, ApplicationSummary, Disbursement, PaymentAccount } from "@/lib/scholarships/types";
import { ApplicationStatusBadge } from "./StatusBadge";
import StaffDocumentReview from "./StaffDocumentReview";
import MoneyInput from "@/components/forms/MoneyInput";

const empty: WorkflowState = { error: "", success: "" };
type Assignment = {
  id: string;
  reviewer_id: string;
  status: string;
  reason: string;
  assigned_at: string;
  completed_at: string | null;
  conflict_status?: string;
  conflict_note?: string | null;
  reviewer: { full_name: string; student_id: string } | null;
  evaluation: { id: string; total_score: number; recommendation: string; comment: string; submitted_at: string | null; version: number } | null;
};
type Committee = { id: string; full_name: string; student_id: string; department: string | null; expertise: string | null };

function Result({ state }: { state: WorkflowState }) {
  return <>{state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.success && <p role="status" className="workflow-success">{state.success}</p>}</>;
}

export default function StaffReviewPanel({ application, documents, documentVersions, committees, assignments, paymentAccount, disbursement, requiredReviewerCount = 1 }: {
  application: ApplicationSummary;
  documents: ApplicationDocument[];
  documentVersions: ApplicationDocumentVersion[];
  committees: Committee[];
  assignments: Assignment[];
  paymentAccount: PaymentAccount | null;
  disbursement: Disbursement | null;
  requiredReviewerCount?: number;
}) {
  const router = useRouter();
  const [assignmentState, assignmentAction, assignmentPending] = useActionState(assignReviewer, empty);
  const [decisionState, decisionAction, decisionPending] = useActionState(decideApplication, empty);
  const [paymentState, paymentAction, paymentPending] = useActionState(recordDisbursement, empty);
  useEffect(() => { if (assignmentState.success || decisionState.success || paymentState.success) router.refresh(); }, [assignmentState.success, decisionState.success, paymentState.success, router]);
  const scores = assignments.filter((item) => item.evaluation?.submitted_at).map((item) => item.evaluation?.total_score ?? 0);
  const average = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
  const canAssign = ["ready_for_review", "committee_review"].includes(application.status);
  return <div className="workflow-stack">
    <section className="panel workflow-heading"><div><span className="workflow-eyebrow">STAFF REVIEW</span><h1>ตรวจสอบใบสมัคร #{application.application_no}</h1><p>{application.student_name} · รหัสนักศึกษา {application.student_code}</p></div><ApplicationStatusBadge status={application.status}/></section>
    <section className="panel"><h2>ข้อมูลผู้สมัคร</h2><div className="workflow-facts"><div><span>ทุน</span><strong>{application.scholarship?.title ?? "—"}</strong></div><div><span>คณะ / สาขา</span><strong>{application.application_data.faculty || "—"} · {application.application_data.major || "—"}</strong></div><div><span>GPA</span><strong>{application.application_data.gpa || "—"}</strong></div><div><span>รายได้ครอบครัว</span><strong>{application.application_data.income || "—"}</strong></div></div><h3>เหตุผลในการสมัคร</h3><p className="workflow-preserve">{application.application_data.reason || "ไม่ได้ระบุ"}</p>{application.application_data.activities && <><h3>กิจกรรมและผลงาน</h3><p className="workflow-preserve">{application.application_data.activities}</p></>}</section>
    <StaffDocumentReview key={documents.map((document) => `${document.id}:${document.version}`).join("|")} application={application} documents={documents} versions={documentVersions}/>
    <section className="panel"><h2>มอบหมายกรรมการ</h2><p className="workflow-muted">ทุนนี้ต้องมีผลประเมินอย่างน้อย {requiredReviewerCount} คนก่อนตัดสินผล</p>{assignments.length ? <div className="workflow-assignment-list">{assignments.map((item) => <article key={item.id}><strong>{item.reviewer?.full_name ?? "กรรมการ"}</strong><p>{item.reviewer?.student_id} · {item.status === "completed" ? "ส่งผลประเมินแล้ว" : item.status === "revoked" ? "ถอนงานแล้ว" : "รอผลประเมิน"}</p>{item.conflict_status === "declared" && <p className="workflow-error">แจ้งผลประโยชน์ทับซ้อน{item.conflict_note ? `: ${item.conflict_note}` : ""}</p>}{item.evaluation?.submitted_at && <p>คะแนน {item.evaluation.total_score} · {item.evaluation.recommendation === "approve" ? "เสนออนุมัติ" : item.evaluation.recommendation === "reserve" ? "เสนอสำรอง" : "ไม่เสนออนุมัติ"}</p>}</article>)}</div> : <p>ยังไม่ได้มอบหมายกรรมการ</p>}{canAssign && <form action={assignmentAction} className="workflow-form workflow-inline-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}><input type="hidden" name="application_id" value={application.id}/><label>กรรมการ<select name="reviewer_id" required defaultValue=""><option value="" disabled>เลือกกรรมการ</option>{committees.map((member) => <option key={member.id} value={member.id}>{member.full_name} · {member.department || "ไม่ระบุหน่วยงาน"}</option>)}</select></label><label>เหตุผลการมอบหมาย *<input name="reason" required minLength={3} maxLength={500} placeholder="เช่น ความเชี่ยวชาญสอดคล้องกับประเภททุน"/></label><button className="btn" disabled={assignmentPending}>{assignmentPending ? "กำลังมอบหมาย…" : "มอบหมายกรรมการ"}</button><Result state={assignmentState}/></form>}</section>
    <section className="panel"><h2>สรุปผลประเมินและตัดสินผล</h2>{average === null ? <p>ต้องมีผลประเมินจากกรรมการอย่างน้อย {requiredReviewerCount} คนก่อนตัดสินผล</p> : <><p>ได้รับผลประเมิน {scores.length}/{requiredReviewerCount} รายการ · คะแนนเฉลี่ย <strong>{average.toFixed(2)}</strong></p>{application.status === "committee_review" && scores.length >= requiredReviewerCount && <form action={decisionAction} className="workflow-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}><input type="hidden" name="application_id" value={application.id}/><input type="hidden" name="version" value={application.version}/><label>ผลการพิจารณา<select name="decision" required defaultValue=""><option value="" disabled>เลือกผลการพิจารณา</option><option value="approved">อนุมัติ</option><option value="reserve">รายชื่อสำรอง</option><option value="rejected">ไม่อนุมัติ</option></select></label><label>เหตุผล / ข้อความแจ้งนักศึกษา *<textarea name="reason" required minLength={3} maxLength={2000} rows={4}/></label><button className="btn" disabled={decisionPending}>{decisionPending ? "กำลังบันทึก…" : "ยืนยันผลการพิจารณา"}</button><Result state={decisionState}/></form>}</>}</section>
    {application.status === "approved" && <section className="panel"><h2>บันทึกการจ่ายทุน</h2>{paymentAccount && <p className="workflow-info">บัญชีผู้รับ: {paymentAccount.bank_name} · {paymentAccount.account_holder} · {paymentAccount.account_number}</p>}<form action={paymentAction} className="workflow-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}><input type="hidden" name="application_id" value={application.id}/><input type="hidden" name="version" value={disbursement?.version ?? ""}/><input type="hidden" name="current_proof" value={disbursement?.proof_path ?? ""}/><div className="workflow-grid"><label>จำนวนเงิน (บาท) *<MoneyInput name="amount" required defaultValue={disbursement?.amount ?? application.scholarship?.amount ?? ""}/></label><label>สถานะ<select name="status" defaultValue={disbursement?.status ?? "pending"}><option value="pending">รอดำเนินการ</option><option value="paid">จ่ายแล้ว</option><option value="failed">โอนไม่สำเร็จ</option></select></label><label>วันที่โอน<input name="transfer_date" type="date" defaultValue={disbursement?.transfer_date ?? ""}/></label><label>เลขอ้างอิงการโอน<input name="transfer_reference" maxLength={120} defaultValue={disbursement?.transfer_reference ?? ""}/></label><label>หลักฐานการโอน<input name="proof" type="file" accept="application/pdf,image/jpeg,image/png"/>{disbursement?.proof_path && <small>มีหลักฐานเดิมในระบบ</small>}</label><label className="workflow-wide">เหตุผลการบันทึก *<textarea name="reason" required minLength={3} maxLength={500} rows={3}/></label></div><button className="btn" disabled={paymentPending}>{paymentPending ? "กำลังบันทึก…" : "บันทึกการจ่ายทุน"}</button><Result state={paymentState}/></form></section>}
  </div>;
}

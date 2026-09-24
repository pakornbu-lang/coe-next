"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ApplicantDetails from "./ApplicantDetails";
import { assignReviewer, recordDisbursement, type WorkflowState } from "@/app/actions/scholarships";
import type { ApplicationDocument, ApplicationSummary, Disbursement, PaymentAccount } from "@/lib/scholarships/types";
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
  return <>{state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.success && <p role="status" className="workflow-success"><span className="action-success-mark" aria-hidden="true">✓</span>{state.success}</p>}</>;
}

export default function StaffReviewPanel({ application, documents, committees, assignments, paymentAccount, disbursement, requiredReviewerCount = 1 }: {
  application: ApplicationSummary;
  documents: ApplicationDocument[];
  committees: Committee[];
  assignments: Assignment[];
  paymentAccount: PaymentAccount | null;
  disbursement: Disbursement | null;
  requiredReviewerCount?: number;
}) {
  const router = useRouter();
  const [assignmentState, assignmentAction, assignmentPending] = useActionState(assignReviewer, empty);
  const [paymentState, paymentAction, paymentPending] = useActionState(recordDisbursement, empty);
  useEffect(() => { if (assignmentState.success || paymentState.success) router.refresh(); }, [assignmentState.success, paymentState.success, router]);
  const canAssign = ["ready_for_review", "committee_review"].includes(application.status);
  return <div className="workflow-stack">
    <section className="panel workflow-heading"><div><span className="workflow-eyebrow">STAFF REVIEW</span><h1>ตรวจสอบใบสมัคร #{application.application_no}</h1><p>{application.student_name} · รหัสนักศึกษา {application.student_code}</p></div><ApplicationStatusBadge status={application.status}/></section>
    <ApplicantDetails key={application.id} application={application}/>
    <StaffDocumentReview key={documents.map((document) => `${document.id}:${document.version}`).join("|")} application={application} documents={documents}/>
    <section className="panel"><h2>มอบหมายกรรมการ</h2><p className="workflow-muted">ทุนนี้ต้องมีผลประเมินอย่างน้อย {requiredReviewerCount} คนก่อนตัดสินผล</p>{assignments.length ? <div className="workflow-assignment-list">{assignments.map((item) => <article key={item.id}><strong>{item.reviewer?.full_name ?? "กรรมการ"}</strong><p>{item.reviewer?.student_id} · {item.status === "completed" ? "ส่งผลประเมินแล้ว" : item.status === "revoked" ? "ถอนงานแล้ว" : "รอผลประเมิน"}</p>{item.conflict_status === "declared" && <p className="workflow-error">แจ้งผลประโยชน์ทับซ้อน{item.conflict_note ? `: ${item.conflict_note}` : ""}</p>}{item.evaluation?.submitted_at && <p>คะแนน {item.evaluation.total_score} · {item.evaluation.recommendation === "approve" ? "เสนออนุมัติ" : item.evaluation.recommendation === "reserve" ? "เสนอสำรอง" : "ไม่เสนออนุมัติ"}</p>}</article>)}</div> : <p>ยังไม่ได้มอบหมายกรรมการ</p>}{canAssign && <form action={assignmentAction} className="workflow-form workflow-inline-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}><input type="hidden" name="application_id" value={application.id}/><label>กรรมการ<select name="reviewer_id" required defaultValue=""><option value="" disabled>เลือกกรรมการ</option>{committees.map((member) => <option key={member.id} value={member.id}>{member.full_name} · {member.department || "ไม่ระบุหน่วยงาน"}</option>)}</select></label><label>เหตุผลการมอบหมาย *<input name="reason" required minLength={3} maxLength={500} placeholder="เช่น ความเชี่ยวชาญสอดคล้องกับประเภททุน"/></label><button className="btn" disabled={assignmentPending} aria-busy={assignmentPending}>{assignmentPending && <span className="action-spinner" aria-hidden="true"/>}{assignmentPending ? "กำลังมอบหมาย…" : "มอบหมายกรรมการ"}</button><Result state={assignmentState}/></form>}</section>
    <section className="panel"><h2>สรุปผลประเมิน</h2><p>ดูคะแนนและความเห็นของกรรมการ พร้อมตัดสินผลในหน้าสรุปแยกต่างหาก</p><Link className="btn" href={`/staff/evaluations/${application.id}`}>เปิดหน้าสรุปผลประเมิน</Link></section>
    {application.status === "approved" && <section className="panel"><h2>บันทึกการจ่ายทุน</h2>{paymentAccount && <p className="workflow-info">บัญชีผู้รับ: {paymentAccount.bank_name} · {paymentAccount.account_holder} · {paymentAccount.account_number}</p>}<form action={paymentAction} className="workflow-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}><input type="hidden" name="application_id" value={application.id}/><input type="hidden" name="version" value={disbursement?.version ?? ""}/><input type="hidden" name="current_proof" value={disbursement?.proof_path ?? ""}/><div className="workflow-grid"><label>จำนวนเงิน (บาท) *<MoneyInput name="amount" required defaultValue={disbursement?.amount ?? application.scholarship?.amount ?? ""}/></label><label>สถานะ<select name="status" defaultValue={disbursement?.status ?? "pending"}><option value="pending">รอดำเนินการ</option><option value="paid">จ่ายแล้ว</option><option value="failed">โอนไม่สำเร็จ</option></select></label><label>วันที่โอน<input name="transfer_date" type="date" defaultValue={disbursement?.transfer_date ?? ""}/></label><label>เลขอ้างอิงการโอน<input name="transfer_reference" maxLength={120} defaultValue={disbursement?.transfer_reference ?? ""}/></label><label>หลักฐานการโอน<input name="proof" type="file" accept="application/pdf,image/jpeg,image/png"/>{disbursement?.proof_path && <small>มีหลักฐานเดิมในระบบ</small>}</label><label className="workflow-wide">เหตุผลการบันทึก *<textarea name="reason" required minLength={3} maxLength={500} rows={3}/></label></div><button className="btn" disabled={paymentPending} aria-busy={paymentPending}>{paymentPending && <span className="action-spinner" aria-hidden="true"/>}{paymentPending ? "กำลังบันทึก…" : "บันทึกการจ่ายทุน"}</button><Result state={paymentState}/></form></section>}
  </div>;
}

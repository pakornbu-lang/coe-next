"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { decideApplication, type WorkflowState } from "@/app/actions/scholarships";
import type { ApplicationSummary } from "@/lib/scholarships/types";
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
const empty: WorkflowState = { error: "", success: "" };
function Result({state}: {state: WorkflowState}) { return <>{state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.success && <p role="status" className="workflow-success"><span className="action-success-mark" aria-hidden="true">✓</span>{state.success}</p>}</>; }
export default function StaffEvaluationSummary({application, assignments, requiredReviewerCount}: { application: ApplicationSummary; assignments: Assignment[]; requiredReviewerCount: number }) {
const router=useRouter();
const [decisionState,decisionAction,decisionPending]=useActionState(decideApplication,empty);
useEffect(()=>{if(decisionState.success)router.refresh();},[decisionState.success,router]);
const submitted=assignments.filter(item=>item.status==="completed" && item.conflict_status!=="declared" && item.evaluation?.submitted_at);
const scores=submitted.map(item=>Number(item.evaluation!.total_score));
const average=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;
return <div className="workflow-stack">
<section className="panel"><h2>ผลประเมินที่ส่งแล้ว</h2><p>นับเฉพาะงานที่เสร็จสมบูรณ์และไม่มีผลประโยชน์ทับซ้อน ไม่รวมฉบับร่างและงานที่ถอน</p>{submitted.map(item=><article className="evaluation-result" key={item.id}><h3>{item.reviewer?.full_name ?? "กรรมการ"}</h3><p>คะแนน {item.evaluation!.total_score} · {{approve:"เสนออนุมัติ",reserve:"เสนอสำรอง",reject:"ไม่เสนออนุมัติ"}[item.evaluation!.recommendation] ?? "—"}</p><p className="workflow-preserve">{item.evaluation!.comment || "ไม่มีความเห็นเพิ่มเติม"}</p></article>)}{!submitted.length && <p>ยังไม่มีผลประเมินที่ส่งแล้ว</p>}</section>
    <section className="panel"><h2>สรุปผลประเมินและตัดสินผล</h2>{average === null ? <p>ต้องมีผลประเมินจากกรรมการอย่างน้อย {requiredReviewerCount} คนก่อนตัดสินผล</p> : <><p>ได้รับผลประเมิน {scores.length}/{requiredReviewerCount} รายการ · คะแนนเฉลี่ย <strong>{average.toFixed(2)}</strong></p>{application.status === "committee_review" && scores.length >= requiredReviewerCount && <form action={decisionAction} className="workflow-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}><input type="hidden" name="application_id" value={application.id}/><input type="hidden" name="version" value={application.version}/><label>ผลการพิจารณา<select name="decision" required defaultValue=""><option value="" disabled>เลือกผลการพิจารณา</option><option value="approved">อนุมัติ</option><option value="reserve">รายชื่อสำรอง</option><option value="rejected">ไม่อนุมัติ</option></select></label><label>เหตุผล / ข้อความแจ้งนักศึกษา *<textarea name="reason" required minLength={3} maxLength={2000} rows={4}/></label><button className="btn" disabled={decisionPending} aria-busy={decisionPending}>{decisionPending && <span className="action-spinner" aria-hidden="true"/>}{decisionPending ? "กำลังบันทึก…" : "ยืนยันผลการพิจารณา"}</button><Result state={decisionState}/></form>}</>}</section>
<section className="panel"><h2>ขั้นตอนถัดไป</h2><p>การตัดสินผลไม่ปิดหน้าจัดการสัมภาษณ์ เจ้าหน้าที่ยังเพิ่มหรือแก้ไขนัดได้</p><div className="workflow-actions"><Link className="btn secondary" href={`/staff/review/${application.id}`}>กลับใบสมัคร</Link><Link className="btn" href={`/staff/interviews?application=${application.id}`}>จัดการนัดสัมภาษณ์</Link></div>{application.decision_reason && <p>เหตุผลการพิจารณา: {application.decision_reason}</p>}</section></div>;
}

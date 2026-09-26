"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { decideApplication, type WorkflowState } from "@/app/actions/scholarships";
import type { ApplicationSummary } from "@/lib/scholarships/types";
type Assignment = {
  id: string; /* รหัสเฉพาะของรายการนี้ ใช้อ้างอิงตอนอ่านหรือแก้ข้อมูล */
  reviewer_id: string; /* รหัสบัญชีกรรมการผู้ประเมิน */
  status: string;
  reason: string;
  assigned_at: string; /* วันเวลาที่มอบหมายงาน */
  completed_at: string | null; /* วันเวลาที่งานประเมินเสร็จ */
  conflict_status?: string; /* สถานะการแจ้งผลประโยชน์ทับซ้อน */
  conflict_note?: string | null; /* เหตุผลประกอบการแจ้งผลประโยชน์ทับซ้อน */
  reviewer: { full_name: string; /* ชื่อเต็มของบัญชีที่นำมาแสดง */ student_id: string } | null;
  evaluation: { id: string; /* รหัสเฉพาะของรายการนี้ ใช้อ้างอิงตอนอ่านหรือแก้ข้อมูล */ total_score: number; /* คะแนนรวมของผลประเมิน */ recommendation: string; /* ข้อเสนอจากกรรมการ ยังไม่ใช่ผลตัดสินสุดท้าย */ comment: string; /* ความคิดเห็นประกอบผลประเมิน */ submitted_at: string | null; /* วันเวลาส่งผลจริง; null คือยังไม่ส่ง */ version: number /* รุ่นข้อมูล ใช้ป้องกันการบันทึกจากหน้าเก่าทับข้อมูลใหม่ */ } | null; /* ผลประเมินเดิมสำหรับอ่านหรือเติมฟอร์ม */
};
const empty: WorkflowState = { error: "", success: "" } /* สถานะเริ่มต้นของฟอร์ม ยังไม่มีข้อความสำเร็จหรือผิดพลาด */;
function Result({state}: {state: WorkflowState}) { return <>{state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.success && <p role="status" className="workflow-success"><span className="action-success-mark" aria-hidden="true">✓</span>{state.success}</p>}</>; }
// สรุปผลรายใบสมัครและแบบฟอร์มตัดสินผลสำหรับเจ้าหน้าที่
// แก้การแสดงคะแนน/ตัวเลือกตัดสิน/ข้อความเหตุผล: JSX ด้านล่าง
// เปลี่ยนจำนวนขั้นต่ำรายทุนผ่าน ScholarshipProcessForm ใน WorkflowExtensions.tsx
// กฎอนุมัติจริงอยู่ใน decideApplication -> RPC staff_decide_application ซึ่งตรวจจำนวนกรรมการและโควตาซ้ำ
export default function StaffEvaluationSummary /* สรุปคะแนนรายใบสมัครและแสดงฟอร์มตัดสินผล */({application, assignments, requiredReviewerCount}: { application: ApplicationSummary; /* ข้อมูลใบสมัคร */ assignments: Assignment[]; /* รายการงานมอบหมายกรรมการ */ requiredReviewerCount: number /* จำนวนผลประเมินขั้นต่ำที่ต้องมีเพื่อให้หน้าจอเปิดส่วนตัดสินผล */ }) {
const router=useRouter() /* ตัวควบคุมการเปลี่ยนหน้าและโหลดข้อมูลเซิร์ฟเวอร์ใหม่ */;
const [decisionState,decisionAction,decisionPending]=useActionState(decideApplication,empty) /* ผลบันทึกคำตัดสิน, action ของฟอร์ม, และสถานะกำลังบันทึก */;
useEffect(()=>{if(decisionState.success)router.refresh();},[decisionState.success,router]);
// คัดเฉพาะงาน completed ที่ส่งผลแล้วและไม่ได้ประกาศผลประโยชน์ทับซ้อน
// หากเปลี่ยนวิธีคำนวณ ให้ตรวจหน้ารวม app/staff/evaluations/page.tsx ให้สอดคล้องด้วย
const submitted=assignments.filter(item=>item.status==="completed" && item.conflict_status!=="declared" && item.evaluation?.submitted_at) /* ผลประเมินที่ผ่านเงื่อนไขการส่งแล้วสำหรับใช้สรุป */;
const scores=submitted.map(item=>Number(item.evaluation!.total_score)) /* ชุดคะแนนรายเกณฑ์ แต่ละรายการมีรหัสเกณฑ์และคะแนน */;
const average=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null /* ค่าเฉลี่ยคะแนนที่นำมาสรุป; null เมื่อยังไม่มีคะแนน */;
return <div className="workflow-stack">
<section className="panel"><h2>ผลประเมินที่ส่งแล้ว</h2><p>นับเฉพาะงานที่เสร็จสมบูรณ์และไม่มีผลประโยชน์ทับซ้อน ไม่รวมฉบับร่างและงานที่ถอน</p>{submitted.map(item=><article className="evaluation-result" key={item.id}><h3>{item.reviewer?.full_name ?? "กรรมการ"}</h3><p>คะแนน {item.evaluation!.total_score} · {{approve:"เสนออนุมัติ",reserve:"เสนอสำรอง",reject:"ไม่เสนออนุมัติ"}[item.evaluation!.recommendation] ?? "—"}</p><p className="workflow-preserve">{item.evaluation!.comment || "ไม่มีความเห็นเพิ่มเติม"}</p></article>)}{!submitted.length && <p>ยังไม่มีผลประเมินที่ส่งแล้ว</p>}</section>
    <section className="panel"><h2>สรุปผลประเมินและตัดสินผล</h2>{average === null ? <p>ต้องมีผลประเมินจากกรรมการอย่างน้อย {requiredReviewerCount} คนก่อนตัดสินผล</p> : <><p>ได้รับผลประเมิน {scores.length}/{requiredReviewerCount} รายการ · คะแนนเฉลี่ย <strong>{average.toFixed(2)}</strong></p>{application.status === "committee_review" && scores.length >= requiredReviewerCount && <form action={decisionAction} className="workflow-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}><input type="hidden" name="application_id" value={application.id}/><input type="hidden" name="version" value={application.version}/><label>ผลการพิจารณา<select name="decision" required defaultValue=""><option value="" disabled>เลือกผลการพิจารณา</option><option value="approved">อนุมัติ</option><option value="reserve">รายชื่อสำรอง</option><option value="rejected">ไม่อนุมัติ</option></select></label><label>เหตุผล / ข้อความแจ้งนักศึกษา *<textarea name="reason" required minLength={3} maxLength={2000} rows={4}/></label><button className="btn" disabled={decisionPending} aria-busy={decisionPending}>{decisionPending && <span className="action-spinner" aria-hidden="true"/>}{decisionPending ? "กำลังบันทึก…" : "ยืนยันผลการพิจารณา"}</button><Result state={decisionState}/></form>}</>}</section>
<section className="panel"><h2>ขั้นตอนถัดไป</h2><p>การตัดสินผลไม่ปิดหน้าจัดการสัมภาษณ์ เจ้าหน้าที่ยังเพิ่มหรือแก้ไขนัดได้</p><div className="workflow-actions"><Link className="btn secondary" href={`/staff/review/${application.id}`}>กลับใบสมัคร</Link><Link className="btn" href={`/staff/interviews?application=${application.id}`}>จัดการนัดสัมภาษณ์</Link></div>{application.decision_reason && <p>เหตุผลการพิจารณา: {application.decision_reason}</p>}</section></div>;
}

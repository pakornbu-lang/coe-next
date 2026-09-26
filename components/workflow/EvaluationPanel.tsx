"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import ScoreInput from "@/components/forms/ScoreInput";
import { useRouter } from "next/navigation";
import { saveEvaluation, type WorkflowState } from "@/app/actions/scholarships";
import type { ApplicationDocument, ApplicationSummary, Criterion, ScholarshipSummary } from "@/lib/scholarships/types";
import { ConflictDisclosure } from "./WorkflowExtensions";

// ฟอร์มคะแนนกรรมการ: evaluations เก็บผล ส่วน review_assignments เก็บงานมอบหมาย
// แก้ชื่อ/คะแนนเต็มของเกณฑ์ทุน: ScholarshipStructureEditor.tsx และ scholarship_review_criteria
// แก้ช่องกรอก/ข้อเสนอแนะ/ความคิดเห็น: JSX ในไฟล์นี้ | แก้ปุ่มปรับคะแนน: components/forms/ScoreInput.tsx
// เปลี่ยนรูปแบบ scores หรือวิธีคิดคะแนนจริง: saveEvaluation และ RPC committee_save_evaluation ต้องรองรับด้วย
const empty: WorkflowState = { error: "", success: "" };
type Evaluation = { scores: { criterion_id: string; score: string; comment: string }[]; total_score: number; recommendation: string; comment: string; submitted_at: string | null; version: number } | null;

export default function EvaluationPanel({ assignment, application, scholarship, criteria, documents, evaluation }: {
  assignment: { id: string; status: string; reason: string; conflict_status?: string };
  application: ApplicationSummary;
  scholarship: ScholarshipSummary;
  criteria: Criterion[];
  documents: ApplicationDocument[];
  evaluation: Evaluation;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveEvaluation, empty);
// สร้างช่องคะแนนจากเกณฑ์ของทุน แล้วเติมคะแนนเดิมโดยจับคู่ criterion_id
// อย่าจับคู่คะแนนด้วยลำดับแถวอย่างเดียว เพราะเกณฑ์อาจมีการจัดลำดับใหม่
  const [scores, setScores] = useState(() => criteria.map((criterion) => {
    const previous = evaluation?.scores.find((item) => item.criterion_id === criterion.id);
    return { criterion_id: criterion.id, score: previous?.score ?? "", comment: previous?.comment ?? "" };
  }));
  useEffect(() => { if (state.success) router.refresh(); }, [router, state.success]);
// total เป็นยอดรวมเพื่อแสดงบนหน้าจอ; ไม่ควรเชื่อยอดจาก browser เป็นคะแนนจริงโดยไม่ตรวจใน RPC
  const total = scores.reduce((sum, item) => sum + (Number(item.score) || 0), 0);
// ล็อกการให้คะแนนหากยังไม่ยืนยันว่าไม่มีผลประโยชน์ทับซ้อน
// เปลี่ยนกฎการล็อก/เปิดแก้ผลที่ส่งแล้ว ต้องตรวจ trigger และ RPC ด้วย ไม่ใช่ปลด disabled อย่างเดียว
  const conflictPending = assignment.conflict_status !== undefined && assignment.conflict_status !== "clear";
  const locked = Boolean(evaluation?.submitted_at) || assignment.status !== "assigned" || conflictPending;

  return <div className="workflow-stack">
    <section className="panel workflow-heading"><div><span className="workflow-eyebrow">COMMITTEE EVALUATION</span><h1>ประเมินใบสมัคร #{application.application_no}</h1><p>{application.student_name} · {scholarship.title}</p></div></section>
    <section className="panel">
      <h2>ข้อมูลประกอบการพิจารณา</h2>
      <div className="workflow-facts"><div><span>คณะ / สาขา</span><strong>{application.application_data.faculty || "—"} · {application.application_data.major || "—"}</strong></div><div><span>GPA</span><strong>{application.application_data.gpa || "—"}</strong></div><div><span>รายได้ครอบครัว</span><strong>{application.application_data.income || "—"}</strong></div></div>
      <h3>เหตุผลในการสมัคร</h3><p className="workflow-preserve">{application.application_data.reason || "ไม่ได้ระบุ"}</p>
      <h3>เอกสารประกอบ</h3><ul className="workflow-links">{documents.map((item) => <li key={item.id}><Link href={`/documents/${item.id}`}>{item.requirement?.label ?? "เอกสาร"}: {item.file_name}</Link></li>)}</ul>
    </section>
    <ConflictDisclosure assignmentId={assignment.id} status={assignment.conflict_status}/>
    <form action={action} className="workflow-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}>
      <input type="hidden" name="assignment_id" value={assignment.id}/><input type="hidden" name="version" value={evaluation?.version ?? ""}/><input type="hidden" name="scores" value={JSON.stringify(scores)}/>
      <section className="panel">
        <h2>คะแนนประเมิน</h2><p className="workflow-muted">ปุ่ม + / − ปรับครั้งละ 0.5 คะแนน หรือพิมพ์คะแนนเองได้</p>
        <div className="workflow-score-table"><table><thead><tr><th>เกณฑ์</th><th>คะแนนเต็ม</th><th>คะแนนที่ให้</th><th>ความเห็น</th></tr></thead><tbody>{criteria.map((criterion, index) => <tr key={criterion.id}><td><strong>{criterion.label}</strong>{criterion.details && <small>{criterion.details}</small>}</td><td>{criterion.max_score}</td><td><ScoreInput label={criterion.label} disabled={locked} max={criterion.max_score} value={scores[index].score} onChange={value => setScores(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, score: value } : item))}/></td><td><input disabled={locked} maxLength={1000} value={scores[index].comment} onChange={(event) => setScores((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, comment: event.target.value } : item))}/></td></tr>)}</tbody><tfoot><tr><th colSpan={2}>รวม</th><th>{total.toFixed(2)}</th><th/></tr></tfoot></table></div>
      </section>
      <section className="panel">
        <label>ข้อเสนอแนะ<select name="recommendation" disabled={locked} defaultValue={evaluation?.recommendation ?? "approve"}><option value="approve">เสนออนุมัติ</option><option value="reserve">เสนอรายชื่อสำรอง</option><option value="reject">ไม่เสนออนุมัติ</option></select></label>
        <label>ความเห็นเพิ่มเติม<textarea name="comment" disabled={locked} maxLength={2000} rows={5} defaultValue={evaluation?.comment ?? ""}/></label>
        {!locked && <div className="workflow-actions"><button className="btn secondary" name="mode" value="draft" formNoValidate disabled={pending} aria-busy={pending}>{pending && <span className="action-spinner" aria-hidden="true"/>}{pending ? "กำลังบันทึก…" : "บันทึกร่าง"}</button><button className="btn" name="mode" value="submit" disabled={pending} onClick={(event) => event.currentTarget.form?.classList.add("form-validated")} aria-busy={pending}>{pending && <span className="action-spinner" aria-hidden="true"/>}{pending ? "กำลังส่ง…" : "ส่งผลประเมิน"}</button></div>}
        {locked && !conflictPending && <p className="workflow-info">ส่งผลประเมินแล้ว จึงไม่สามารถแก้ไขได้</p>}
        {conflictPending && <p className="workflow-info">กรุณายืนยันสถานะผลประโยชน์ทับซ้อนก่อนเริ่มให้คะแนน</p>}
        {state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.success && <p role="status" className="workflow-success"><span className="action-success-mark" aria-hidden="true">✓</span>{state.success}</p>}
      </section>
    </form>
  </div>;
}

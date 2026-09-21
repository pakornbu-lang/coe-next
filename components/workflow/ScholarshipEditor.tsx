"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveScholarship, type WorkflowState } from "@/app/actions/scholarships";
import type { Criterion, Requirement, ScholarshipStatus, ScholarshipSummary } from "@/lib/scholarships/types";
import { ScholarshipStatusBadge } from "./StatusBadge";

const empty: WorkflowState = { error: "", success: "" };
function toDateTimeLocal(value?: string) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).reduce<Record<string, string>>((all, part) => ({ ...all, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
const defaultRequirements = "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\nเอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน";
const defaultCriteria = "ผลการเรียน | 30 | ผลการเรียนและพัฒนาการ\nความจำเป็น / ความเหมาะสม | 30 | ฐานะทางการเงินและเหตุผลสมัคร\nกิจกรรมและผลงาน | 20 | การมีส่วนร่วมและผลงาน\nสัมภาษณ์ / ภาพรวม | 20 | ศักยภาพและความเหมาะสม";

export default function ScholarshipEditor({ scholarship, types }: { scholarship?: ScholarshipSummary & { requirements: Requirement[]; criteria: Criterion[] }; types: { id: string; name: string }[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveScholarship, empty);
  useEffect(() => { if (state.success) router.push("/staff/scholarships"); }, [router, state.success]);
  const requirementText = scholarship?.requirements.map((item) => `${item.label}${item.details ? ` | ${item.details}` : ""}`).join("\n") ?? defaultRequirements;
  const criteriaText = scholarship?.criteria.map((item) => `${item.label} | ${item.max_score}${item.details ? ` | ${item.details}` : ""}`).join("\n") ?? defaultCriteria;
  return <form action={action} className="workflow-form">
    <input type="hidden" name="id" value={scholarship?.id ?? ""}/><input type="hidden" name="version" value={scholarship?.version ?? ""}/>
    <section className="panel workflow-heading"><div><span className="workflow-eyebrow">SCHOLARSHIP MANAGEMENT</span><h1>{scholarship ? "แก้ไขทุนการศึกษา" : "สร้างทุนการศึกษา"}</h1><p>หนึ่งรายการทุนคือหนึ่งรอบรับสมัคร เพื่อป้องกันการสมัครซ้ำและติดตามผลได้ชัดเจน</p></div>{scholarship && <ScholarshipStatusBadge status={scholarship.status}/>}</section>
    <section className="panel"><h2>รายละเอียดทุน</h2><div className="workflow-grid"><label className="workflow-wide">ชื่อทุน *<input name="title" required minLength={3} maxLength={200} defaultValue={scholarship?.title ?? ""}/></label><label>ประเภททุน<select name="scholarship_type_id" defaultValue={scholarship?.scholarship_type_id ?? ""}><option value="">ไม่ระบุ</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label>สถานะ<select name="status" defaultValue={(scholarship?.status ?? "draft") as ScholarshipStatus}><option value="draft">ฉบับร่าง</option><option value="published">เปิดรับสมัคร</option><option value="closed">ปิดรับสมัคร</option><option value="archived">เก็บถาวร</option></select></label><label>จำนวนเงินต่อคน (บาท) *<input name="amount" type="number" required min="1" step="0.01" defaultValue={scholarship?.amount ?? ""}/></label><label>จำนวนโควตา (คน) *<input name="quota" type="number" required min="1" step="1" defaultValue={scholarship?.quota ?? ""}/></label><label>GPA ขั้นต่ำ<input name="minimum_gpa" type="number" min="0" max="4" step="0.01" defaultValue={scholarship?.minimum_gpa ?? ""}/></label><label>เปิดรับสมัคร *<input name="opens_at" type="datetime-local" required defaultValue={toDateTimeLocal(scholarship?.opens_at)}/></label><label>ปิดรับสมัคร *<input name="closes_at" type="datetime-local" required defaultValue={toDateTimeLocal(scholarship?.closes_at)}/></label><label className="workflow-wide">รายละเอียดทุน *<textarea name="description" required maxLength={5000} rows={5} defaultValue={scholarship?.description ?? ""}/></label><label className="workflow-wide">คุณสมบัติและเงื่อนไข<textarea name="eligibility" maxLength={5000} rows={5} defaultValue={scholarship?.eligibility ?? ""}/></label></div></section>
    <section className="panel"><h2>เอกสารที่ต้องใช้</h2><p className="workflow-muted">หนึ่งบรรทัดต่อหนึ่งรายการ: ชื่อเอกสาร | คำอธิบาย รายการทั้งหมดในฟอร์มนี้เป็นเอกสารบังคับ</p><textarea name="requirements" required rows={6} defaultValue={requirementText}/></section>
    <section className="panel"><h2>เกณฑ์ให้คะแนน</h2><p className="workflow-muted">หนึ่งบรรทัดต่อหนึ่งเกณฑ์: ชื่อเกณฑ์ | คะแนนเต็ม | คำอธิบาย</p><textarea name="criteria" required rows={7} defaultValue={criteriaText}/></section>
    <section className="panel"><label>เหตุผลในการสร้างหรือแก้ไข *<textarea name="reason" required minLength={3} maxLength={500} rows={3} placeholder="เช่น เปิดรับสมัครประจำปีการศึกษา 2569"/></label></section>
    <div className="workflow-actions"><Link className="btn secondary" href="/staff/scholarships">ยกเลิก</Link><button className="btn" disabled={pending}>{pending ? "กำลังบันทึก…" : scholarship ? "บันทึกการแก้ไข" : "สร้างทุน"}</button></div>{state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.success && <p role="status" className="workflow-success">{state.success}</p>}
  </form>;
}

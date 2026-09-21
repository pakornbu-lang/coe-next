"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveScholarship, type WorkflowState } from "@/app/actions/scholarships";
import type { Criterion, Requirement, ScholarshipProgramKind, ScholarshipStatus, ScholarshipSummary } from "@/lib/scholarships/types";
import { ScholarshipStatusBadge } from "./StatusBadge";
import MoneyInput from "@/components/forms/MoneyInput";
import { CriterionEditor, RequirementEditor, parseCriterionRows, parseRequirementRows } from "./ScholarshipStructureEditor";

const empty: WorkflowState = { error: "", success: "" };
function toDateTimeLocal(value?: string, fallbackOffset = 60 * 60 * 1000) {
  const date = value ? new Date(value) : new Date(Date.now() + fallbackOffset);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).reduce<Record<string, string>>((all, part) => ({ ...all, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
const defaultRequirements = "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\nเอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน";
const defaultCriteria = "ผลการเรียน | 30 | ผลการเรียนและพัฒนาการ\nความจำเป็น / ความเหมาะสม | 30 | ฐานะทางการเงินและเหตุผลสมัคร\nกิจกรรมและผลงาน | 20 | การมีส่วนร่วมและผลงาน\nสัมภาษณ์ / ภาพรวม | 20 | ศักยภาพและความเหมาะสม";
const programs: { value: ScholarshipProgramKind; label: string; requirements: string; criteria: string; eligibility: string }[] = [
  { value: "academic", label: "ทุนผลการเรียนดี", requirements: "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\nเอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน", criteria: "ผลการเรียน | 60 | GPA และผลการเรียน\nกิจกรรมและผลงาน | 20 | ผลงานหรือกิจกรรมที่เกี่ยวข้อง\nความเหมาะสม | 20 | คุณสมบัติตามประกาศ", eligibility: "มีผลการเรียนตรงตามเกณฑ์ที่กำหนดในประกาศ" },
  { value: "financial_need", label: "ทุนขาดแคลนทุนทรัพย์", requirements: "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\nเอกสารรับรองรายได้ครอบครัว | เอกสารยืนยันฐานะการเงิน\nเอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน", criteria: "ความจำเป็นทางการเงิน | 50 | รายได้และภาระครอบครัว\nผลการเรียน | 25 | GPA และความต่อเนื่องทางการศึกษา\nเหตุผลในการสมัคร | 25 | ความชัดเจนและความเหมาะสม", eligibility: "เป็นนักศึกษาปัจจุบันและมีความจำเป็นด้านทุนทรัพย์" },
  { value: "activity", label: "ทุนกิจกรรมและความเป็นผู้นำ", requirements: "ใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\nหลักฐานกิจกรรม / เกียรติบัตร | เอกสารหรือภาพผลงาน\nเอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน", criteria: "ผลงานกิจกรรม | 45 | บทบาทและผลลัพธ์ของกิจกรรม\nภาวะผู้นำ | 30 | ประสบการณ์และความรับผิดชอบ\nผลการเรียน | 25 | GPA และความต่อเนื่อง", eligibility: "มีผลงานกิจกรรมหรือบทบาทผู้นำที่ตรวจสอบได้" },
  { value: "talent", label: "ทุนความสามารถพิเศษ", requirements: "หลักฐานความสามารถพิเศษ | เกียรติบัตร ผลงาน หรือแฟ้มสะสมงาน\nใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\nเอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน", criteria: "ความสามารถและผลงาน | 60 | คุณภาพ ระดับ และความต่อเนื่องของผลงาน\nศักยภาพพัฒนา | 25 | แผนการต่อยอดความสามารถ\nผลการเรียน | 15 | GPA และความต่อเนื่อง", eligibility: "มีความสามารถพิเศษและหลักฐานผลงานตามประกาศ" },
  { value: "research", label: "ทุนวิจัยและนวัตกรรม", requirements: "ข้อเสนอโครงการ | วัตถุประสงค์ วิธีดำเนินงาน และงบประมาณ\nหนังสือรับรองอาจารย์ที่ปรึกษา | ลงนามโดยอาจารย์ที่ปรึกษา\nใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด", criteria: "คุณภาพข้อเสนอโครงการ | 45 | ความชัดเจนและความเป็นไปได้\nผลกระทบและนวัตกรรม | 30 | ประโยชน์และความใหม่\nความพร้อมของผู้สมัคร | 25 | ผลงานและแผนดำเนินงาน", eligibility: "มีโครงการวิจัยหรือนวัตกรรมที่ได้รับการรับรองจากอาจารย์ที่ปรึกษา" },
  { value: "emergency", label: "ทุนฉุกเฉิน", requirements: "เอกสารยืนยันเหตุฉุกเฉิน | เอกสารประกอบเหตุการณ์หรือค่าใช้จ่าย\nใบแสดงผลการศึกษา (Transcript) | เอกสารผลการเรียนฉบับล่าสุด\nเอกสารยืนยันตัวตน | บัตรนักศึกษาหรือบัตรประชาชน", criteria: "ความเร่งด่วน | 50 | ผลกระทบต่อการศึกษา\nความจำเป็นทางการเงิน | 35 | ภาระและทรัพยากรที่มี\nแผนการศึกษา | 15 | ความต่อเนื่องในการเรียน", eligibility: "ประสบเหตุจำเป็นเร่งด่วนที่กระทบต่อการศึกษา" },
  { value: "general", label: "ทุนทั่วไป", requirements: defaultRequirements, criteria: defaultCriteria, eligibility: "เป็นนักศึกษาปัจจุบันและมีคุณสมบัติตามประกาศ" },
];

export default function ScholarshipEditor({ scholarship, types }: { scholarship?: ScholarshipSummary & { requirements: Requirement[]; criteria: Criterion[] }; types: { id: string; name: string }[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveScholarship, empty);
  const [programKind, setProgramKind] = useState<ScholarshipProgramKind>(scholarship?.program_kind ?? "general");
  const eligibilityRef = useRef<HTMLTextAreaElement>(null);
  const [requirementRows, setRequirementRows] = useState(() => scholarship?.requirements.map((item) => ({ label: item.label, details: item.details, required: item.required })) ?? parseRequirementRows(defaultRequirements));
  const [criterionRows, setCriterionRows] = useState(() => scholarship?.criteria.map((item) => ({ label: item.label, details: item.details, maxScore: String(item.max_score) })) ?? parseCriterionRows(defaultCriteria));
  useEffect(() => { if (state.success) router.push("/staff/scholarships"); }, [router, state.success]);
  const applyTemplate = (template: typeof programs[number]) => {
    setProgramKind(template.value);
    setRequirementRows(parseRequirementRows(template.requirements));
    setCriterionRows(parseCriterionRows(template.criteria));
    if (eligibilityRef.current && !eligibilityRef.current.value.trim()) eligibilityRef.current.value = template.eligibility;
  };
  return <form action={action} className="workflow-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}>
    <input type="hidden" name="id" value={scholarship?.id ?? ""}/><input type="hidden" name="version" value={scholarship?.version ?? ""}/><input type="hidden" name="current_cover_path" value={scholarship?.cover_path ?? ""}/>
    <section className="panel workflow-heading"><div><span className="workflow-eyebrow">SCHOLARSHIP MANAGEMENT</span><h1>{scholarship ? "แก้ไขทุนการศึกษา" : "สร้างทุนการศึกษา"}</h1><p>หนึ่งรายการทุนคือหนึ่งรอบรับสมัคร เพื่อป้องกันการสมัครซ้ำและติดตามผลได้ชัดเจน</p></div>{scholarship && <ScholarshipStatusBadge status={scholarship.status}/>}</section>
    <section className="panel"><h2>รูปแบบทุนและแม่แบบ</h2><p className="workflow-muted">เลือกแม่แบบเพื่อเติมเอกสารและเกณฑ์คะแนนตามประเภททุน แล้วแก้ไขรายละเอียดให้ตรงกับประกาศจริงได้</p><div className="workflow-template-list">{programs.map((template) => <button type="button" key={template.value} className={`btn secondary ${programKind === template.value ? "selected" : ""}`} onClick={() => applyTemplate(template)}>{template.label}</button>)}</div></section>
    <section className="panel"><h2>รายละเอียดทุน</h2><div className="workflow-grid"><label className="workflow-wide">ชื่อทุน *<input name="title" required minLength={3} maxLength={200} defaultValue={scholarship?.title ?? ""}/></label><label>รูปแบบทุน *<select name="program_kind" required value={programKind} onChange={(event) => setProgramKind(event.target.value as ScholarshipProgramKind)}>{programs.map((program) => <option key={program.value} value={program.value}>{program.label}</option>)}</select></label><label>ประเภททุน (ข้อมูลอ้างอิง)<select name="scholarship_type_id" defaultValue={scholarship?.scholarship_type_id ?? ""}><option value="">ไม่ระบุ</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label>สถานะ *<select name="status" required defaultValue={(scholarship?.status ?? "draft") as ScholarshipStatus}><option value="draft">ฉบับร่าง</option><option value="published">เปิดรับสมัคร</option><option value="closed">ปิดรับสมัคร</option><option value="archived">เก็บถาวร</option></select></label><label>จำนวนเงินต่อคน (บาท) *<MoneyInput name="amount" required defaultValue={scholarship?.amount ?? ""}/></label><label>จำนวนโควตา (คน) *<input name="quota" type="number" required min="1" step="1" defaultValue={scholarship?.quota ?? ""}/></label><label>GPA ขั้นต่ำ<input name="minimum_gpa" type="number" min="0" max="4" step="0.01" defaultValue={scholarship?.minimum_gpa ?? ""}/></label><label>เปิดรับสมัคร *<input name="opens_at" type="datetime-local" required defaultValue={toDateTimeLocal(scholarship?.opens_at)}/></label><label>ปิดรับสมัคร *<input name="closes_at" type="datetime-local" required defaultValue={toDateTimeLocal(scholarship?.closes_at, 30 * 24 * 60 * 60 * 1000)}/></label><label className="workflow-wide">ภาพปกทุน (JPG, PNG หรือ WebP ไม่เกิน 5 MB)<input name="cover" type="file" accept="image/jpeg,image/png,image/webp"/>{scholarship?.cover_path && <small className="workflow-muted">มีภาพปกเดิมอยู่แล้ว เลือกไฟล์ใหม่เมื่อต้องการแทนที่</small>}</label><label className="workflow-wide">รายละเอียดทุน *<textarea name="description" required maxLength={5000} rows={5} defaultValue={scholarship?.description ?? ""}/></label><label className="workflow-wide">คุณสมบัติและเงื่อนไข<textarea ref={eligibilityRef} name="eligibility" maxLength={5000} rows={5} defaultValue={scholarship?.eligibility ?? ""}/></label></div></section>
    <section className="panel"><h2>เอกสารที่ต้องใช้</h2><p className="workflow-muted">เพิ่ม ลบ เรียงลำดับ และกำหนดว่าเอกสารใดบังคับได้จากตารางนี้</p><RequirementEditor rows={requirementRows} onChange={setRequirementRows}/></section>
    <section className="panel"><h2>เกณฑ์ให้คะแนน</h2><p className="workflow-muted">กำหนดชื่อเกณฑ์ คะแนนเต็ม และคำอธิบาย ระบบจะแสดงคะแนนรวมให้อัตโนมัติ</p><CriterionEditor rows={criterionRows} onChange={setCriterionRows}/></section>
    <section className="panel"><label>เหตุผลในการสร้างหรือแก้ไข *<textarea name="reason" required minLength={3} maxLength={500} rows={3} placeholder="เช่น เปิดรับสมัครประจำปีการศึกษา 2569"/></label></section>
    <div className="workflow-actions"><Link className="btn secondary" href="/staff/scholarships">ยกเลิก</Link><button className="btn" disabled={pending} onClick={(event) => event.currentTarget.form?.classList.add("form-validated")}>{pending ? "กำลังบันทึก…" : scholarship ? "บันทึกการแก้ไข" : "สร้างทุน"}</button></div>{state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.success && <p role="status" className="workflow-success">{state.success}</p>}
  </form>;
}

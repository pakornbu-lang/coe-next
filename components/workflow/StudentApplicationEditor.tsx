"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveApplication, uploadApplicationDocument, type WorkflowState } from "@/app/actions/scholarships";
import type { ApplicationDocument, ApplicationSummary, PaymentAccount, Requirement, ScholarshipSummary } from "@/lib/scholarships/types";
import { ApplicationStatusBadge } from "./StatusBadge";
import MoneyInput from "@/components/forms/MoneyInput";

const empty: WorkflowState = { error: "", success: "" };
const banks = ["ธนาคารกรุงเทพ", "ธนาคารกรุงไทย", "ธนาคารกรุงศรีอยุธยา", "ธนาคารกสิกรไทย", "ธนาคารไทยพาณิชย์", "ธนาคารทหารไทยธนชาต", "ธนาคารออมสิน", "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร"];
const parentStatuses = ["อยู่ด้วยกัน", "แยกกันอยู่", "หย่า", "บิดาเสียชีวิต", "มารดาเสียชีวิต", "เสียชีวิตทั้งคู่"];

function DocumentUpload({ applicationId, requirement, document }: { applicationId: string; requirement: Requirement; document?: ApplicationDocument }) {
  const [state, action, pending] = useActionState(uploadApplicationDocument, empty);
  return <article className="workflow-document">
    <div><strong>{requirement.label}</strong>{requirement.required && <span className="required-mark">จำเป็น</span>}<p>{requirement.details || "อัปโหลดเอกสาร PDF, JPG, PNG, DOC หรือ DOCX ขนาดไม่เกิน 10 MB"}</p>{document && <p>ไฟล์ปัจจุบัน: <Link href={`/documents/${document.id}`}>{document.file_name}</Link> · <span className={`document-state ${document.status}`}>{document.status === "verified" ? "ผ่านการตรวจ" : document.status === "revision_required" ? "ขอแก้ไข" : "รอตรวจ"}</span>{document.feedback && <> · {document.feedback}</>}</p>}</div>
    <form action={action} className="workflow-upload-form">
      <input type="hidden" name="application_id" value={applicationId}/><input type="hidden" name="requirement_id" value={requirement.id}/>
      <input name="document" type="file" required accept="application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"/>
      <button className="btn secondary" disabled={pending}>{pending ? "กำลังอัปโหลด…" : document ? "แทนที่ไฟล์" : "อัปโหลด"}</button>
      {state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.success && <p role="status" className="workflow-success">{state.success}</p>}
    </form>
  </article>;
}

export default function StudentApplicationEditor({ scholarship, application, requirements, documents, paymentAccount, profile }: {
  scholarship: ScholarshipSummary;
  application: ApplicationSummary | null;
  requirements: Requirement[];
  documents: ApplicationDocument[];
  paymentAccount: PaymentAccount | null;
  profile: { phone: string | null; department: string | null; profile_details: Record<string, string> | null } | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveApplication, empty);
  const data = application?.application_data ?? {};
  const details = profile?.profile_details ?? {};
  const initialBank = paymentAccount?.bank_name ?? "";
  const [bankChoice, setBankChoice] = useState(() => banks.includes(initialBank) ? initialBank : initialBank ? "other" : "");
  const [customBank, setCustomBank] = useState(() => banks.includes(initialBank) ? "" : initialBank);
  const [parentStatus, setParentStatus] = useState(data.parent_status ?? details.parent_status ?? "");
  useEffect(() => {
    if (state.applicationId && state.applicationId !== application?.id) router.replace(`/apply?scholarship=${scholarship.id}&application=${state.applicationId}`);
    if (state.success && state.applicationId === application?.id) router.refresh();
  }, [application?.id, router, scholarship.id, state.applicationId, state.success]);
  const editable = !application || application.status === "draft" || application.status === "revision_requested";
  if (!editable) return <section className="panel workflow-message"><h1>ใบสมัครนี้ส่งแล้ว</h1><p>หากต้องการดูสถานะ เอกสาร และผลการพิจารณา ให้เปิดหน้ารายละเอียดใบสมัคร</p><Link className="btn" href={`/applications/${application.id}`}>ดูใบสมัครของฉัน</Link></section>;
  return <div className="workflow-stack">
    <section className="panel workflow-heading"><div><span className="workflow-eyebrow">APPLICATION</span><h1>{application ? "แก้ไขใบสมัคร" : "เริ่มสมัครทุน"}</h1><p>{scholarship.title}</p></div>{application && <ApplicationStatusBadge status={application.status}/>}</section>
    <section className="panel workflow-info"><strong>ขั้นตอนที่แนะนำ:</strong> บันทึกร่างข้อมูล → อัปโหลดเอกสาร → ส่งใบสมัคร หากเจ้าหน้าที่ขอแก้ไข คุณสามารถกลับมาแก้ไขและส่งใหม่ได้</section>
    <form action={action} className="workflow-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}>
      <input type="hidden" name="scholarship_id" value={scholarship.id}/><input type="hidden" name="application_id" value={application?.id ?? ""}/><input type="hidden" name="version" value={application?.version ?? ""}/>
      <section className="panel"><h2>ข้อมูลการศึกษาและการติดต่อ</h2><div className="workflow-grid">
        <label>คณะ / สำนักวิชา *<input name="faculty" required maxLength={150} defaultValue={data.faculty ?? profile?.department ?? ""}/></label>
        <label>สาขาวิชา *<input name="major" required maxLength={150} defaultValue={data.major ?? details.major ?? ""}/></label>
        <label>ระดับการศึกษา *<select name="education_level" required defaultValue={data.education_level ?? details.education_level ?? "ปริญญาตรี"}><option value="">เลือกระดับการศึกษา</option><option>ปริญญาตรี</option><option>ปริญญาโท</option><option>ปริญญาเอก</option><option>อื่น ๆ</option></select></label>
        <label>ชั้นปี *<input name="study_year" type="number" required min="1" max="8" defaultValue={data.study_year ?? details.study_year ?? ""}/></label>
        <label>เกรดเฉลี่ยสะสม (GPA) *<input name="gpa" type="number" min="0" max="4" step="0.01" required defaultValue={data.gpa ?? details.gpa ?? ""}/></label>
        <label>เบอร์โทรศัพท์ *<input name="phone" type="tel" required pattern="[0-9+ ()-]{7,25}" maxLength={25} defaultValue={data.phone ?? profile?.phone ?? ""}/></label>
        <label className="workflow-wide">ที่อยู่ติดต่อ *<textarea name="address" required minLength={5} maxLength={500} rows={3} defaultValue={data.address ?? details.address ?? ""}/></label>
        <label>รายได้ครอบครัวต่อปี (บาท) *<MoneyInput name="income" required defaultValue={data.income ?? ""}/></label>
        <label>จำนวนสมาชิกในครอบครัว *<input name="family_members" type="number" required min="1" max="99" step="1" defaultValue={data.family_members ?? ""}/></label>
        <label>สถานะบิดามารดา *<select name="parent_status" required value={parentStatus} onChange={(event) => setParentStatus(event.target.value)}><option value="">เลือกสถานะ</option>{parentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}<option value="other">อื่น ๆ</option></select></label>
        {parentStatus === "other" && <label>โปรดระบุสถานะบิดามารดา *<input name="parent_status_other" required maxLength={150} defaultValue={data.parent_status_other ?? details.parent_status_other ?? ""}/></label>}
        <label>ชื่อผู้ติดต่อฉุกเฉิน<input name="emergency_name" maxLength={200} defaultValue={data.emergency_name ?? ""}/></label>
        <label>โทรศัพท์ฉุกเฉิน<input name="emergency_phone" type="tel" maxLength={25} defaultValue={data.emergency_phone ?? ""}/></label>
      </div></section>
      <section className="panel"><h2>เหตุผลในการสมัคร</h2><div className="workflow-grid"><label className="workflow-wide">เหตุผลและความจำเป็นในการสมัคร *<textarea name="reason" required minLength={20} maxLength={5000} rows={6} defaultValue={data.reason ?? ""}/></label><label className="workflow-wide">กิจกรรมและผลงานที่ผ่านมา<textarea name="activities" maxLength={5000} rows={5} defaultValue={data.activities ?? ""}/></label></div></section>
      <section className="panel"><h2>บัญชีรับเงิน</h2><p className="workflow-muted">ข้อมูลส่วนนี้เห็นได้เฉพาะนักศึกษาและเจ้าหน้าที่ผู้รับผิดชอบการจ่ายทุน</p><div className="workflow-grid"><input type="hidden" name="bank_name" value={bankChoice === "other" ? customBank : bankChoice}/><label>ธนาคาร *<select name="bank_choice" required value={bankChoice} onChange={(event) => setBankChoice(event.target.value)}><option value="">เลือกธนาคาร</option>{banks.map((bank) => <option key={bank} value={bank}>{bank}</option>)}<option value="other">อื่น ๆ</option></select></label>{bankChoice === "other" && <label>ระบุธนาคาร *<input name="bank_name_other" required maxLength={150} value={customBank} onChange={(event) => setCustomBank(event.target.value)}/></label>}<label>ชื่อบัญชี *<input name="account_holder" required maxLength={200} defaultValue={paymentAccount?.account_holder ?? ""}/></label><label>เลขบัญชี *<input name="account_number" required inputMode="numeric" pattern="[0-9 -]{8,30}" maxLength={30} defaultValue={paymentAccount?.account_number ?? ""}/></label></div></section>
      <div className="workflow-actions"><Link className="btn secondary" href={`/scholarships/${scholarship.id}`}>กลับรายละเอียดทุน</Link><button className="btn secondary" name="mode" value="draft" formNoValidate disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกร่าง"}</button><button className="btn" name="mode" value="submit" disabled={pending}>{pending ? "กำลังส่ง…" : "ส่งใบสมัคร"}</button></div>
      {state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.success && <p role="status" className="workflow-success">{state.success}</p>}
    </form>
    {application ? <section className="panel"><h2>เอกสารประกอบ</h2><p className="workflow-muted">อัปโหลดให้ครบทุกเอกสารที่ระบุว่า “จำเป็น” ก่อนกดส่งใบสมัคร ไฟล์เก็บในพื้นที่ส่วนตัวของระบบ</p><div className="workflow-document-list">{requirements.map((requirement) => <DocumentUpload key={requirement.id} applicationId={application.id} requirement={requirement} document={documents.find((item) => item.requirement_id === requirement.id)}/>)}</div></section> : <section className="panel workflow-info">บันทึกร่างก่อน แล้วระบบจะแสดงพื้นที่อัปโหลดเอกสารสำหรับทุนนี้</section>}
  </div>;
}

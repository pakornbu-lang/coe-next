"use client";
import { personNamePattern } from "@/lib/forms/person-name";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveApplication, uploadApplicationDocument, type WorkflowState } from "@/app/actions/scholarships";
import { money, type ApplicationDocument, type ApplicationSummary, type PaymentAccount, type Requirement, type ScholarshipSummary } from "@/lib/scholarships/types";
import { removeDraftDocument } from "@/app/actions/remove-document";
import { ApplicationStatusBadge } from "./StatusBadge";
import MoneyInput from "@/components/forms/MoneyInput";
import DigitsInput from "@/components/forms/DigitsInput";

const empty: WorkflowState = { error: "", success: "" };
const banks = ["ธนาคารกรุงเทพ", "ธนาคารกรุงไทย", "ธนาคารกรุงศรีอยุธยา", "ธนาคารกสิกรไทย", "ธนาคารไทยพาณิชย์", "ธนาคารทหารไทยธนชาต", "ธนาคารออมสิน", "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร"];
const parentStatuses = ["อยู่ด้วยกัน", "แยกกันอยู่", "หย่า", "บิดาเสียชีวิต", "มารดาเสียชีวิต", "เสียชีวิตทั้งคู่"];
const steps = ["ข้อมูลการศึกษา", "ครอบครัวและเหตุผล", "บัญชีรับเงิน", "เอกสาร", "ตรวจทาน"];

function DocumentUpload({ applicationId, requirement, document, canRemove }: { canRemove: boolean; applicationId: string; requirement: Requirement; document?: ApplicationDocument }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadApplicationDocument, empty);
  const [removed, removeAction, removing] = useActionState(removeDraftDocument, empty);
  useEffect(() => { if (removed.success) router.refresh(); }, [router, removed.success]);
  useEffect(() => { if (state.success) router.refresh(); }, [router, state.success]);
  return <article className="workflow-document">
    <div><strong>{requirement.label}</strong>{requirement.required && <span className="required-mark">จำเป็น</span>}<p>{requirement.details || "อัปโหลดเอกสาร PDF, JPG, PNG, DOC หรือ DOCX ขนาดไม่เกิน 10 MB"}</p>{document && <p>ไฟล์ปัจจุบัน: <Link href={`/documents/${document.id}`}>{document.file_name}</Link> · <span className={`document-state ${document.status}`}>{document.status === "verified" ? "ผ่านการตรวจ" : document.status === "revision_required" ? "ขอแก้ไข" : "รอตรวจ"}</span>{document.feedback && <> · {document.feedback}</>} · <Link href={`/applications/${applicationId}#document-history`}>ดูประวัติเวอร์ชัน</Link></p>}</div>
    <form action={action} className="workflow-upload-form">
      <input type="hidden" name="application_id" value={applicationId}/><input type="hidden" name="requirement_id" value={requirement.id}/>
      <input name="document" type="file" required accept="application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"/>
      <button className="btn secondary" disabled={pending || removing}>{pending ? "กำลังอัปโหลด…" : document ? "แทนที่ไฟล์" : "อัปโหลด"}</button>
      {state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.success && <p role="status" className="workflow-success">{state.success}</p>}
    </form>
    {canRemove && document && <form action={removeAction} className="workflow-upload-form" onSubmit={event => { if (!window.confirm("นำเอกสารนี้ออกจากใบสมัคร? หากเป็นเอกสารจำเป็นต้องอัปโหลดใหม่ก่อนส่ง")) event.preventDefault(); }}>
      <input type="hidden" name="application_id" value={applicationId}/><input type="hidden" name="document_id" value={document.id}/><input type="hidden" name="version" value={document.version}/>
      <button className="btn secondary" disabled={pending || removing}>{removing ? "กำลังลบ…" : "ลบออกจากใบสมัคร"}</button>
      {removed.error && <p role="alert" className="workflow-error">{removed.error}</p>}
    </form>}
    {removed.success && <p role="status" className="workflow-success">{removed.success}</p>}
  </article>;
}

export default function StudentApplicationEditor({ scholarship, application, requirements, documents, paymentAccount, profile }: {
  scholarship: ScholarshipSummary;
  application: ApplicationSummary | null;
  requirements: Requirement[];
  documents: ApplicationDocument[];
  paymentAccount: PaymentAccount | null;
  profile: { phone: string | null; department: string | null; profile_details: Record<string, string> | null; sis_verified?: boolean } | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(saveApplication, empty);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState("");
  const [reviewData, setReviewData] = useState<Record<string, string>>({});
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

  const validateCurrentStep = () => {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const invalid = section?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(":invalid");
    if (invalid) {
      formRef.current?.classList.add("form-validated");
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    return true;
  };
  const nextStep = () => {
    setStepError("");
    if (step <= 2 && !validateCurrentStep()) return;
    if (step === 3) {
      const missing = requirements.filter((requirement) => requirement.required && !documents.some((document) => document.requirement_id === requirement.id));
      if (missing.length) {
        setStepError(`ยังขาดเอกสารจำเป็น ${missing.length} รายการ: ${missing.map((item) => item.label).join(", ")}`);
        return;
      }
    }
    if (step === 3 && formRef.current) {
      const values = Object.fromEntries([...new FormData(formRef.current).entries()].filter(([, value]) => typeof value === "string")) as Record<string, string>;
      setReviewData(values);
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <div className="workflow-stack">
    <section className="panel workflow-heading"><div><span className="workflow-eyebrow">APPLICATION</span><h1>{application ? "แก้ไขใบสมัคร" : "เริ่มสมัครทุน"}</h1><p>{scholarship.title}</p></div>{application && <ApplicationStatusBadge status={application.status}/>}</section>
    <nav className="workflow-stepper" aria-label="ขั้นตอนการสมัคร">{steps.map((label, index) => <button key={label} type="button" className={index === step ? "current" : index < step ? "complete" : ""} onClick={() => index < step && setStep(index)} aria-current={index === step ? "step" : undefined}><span>{index + 1}</span>{label}</button>)}</nav>
    <form id="student-application-form" ref={formRef} action={action} className="workflow-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}>
      <input type="hidden" name="scholarship_id" value={scholarship.id}/><input type="hidden" name="application_id" value={application?.id ?? ""}/><input type="hidden" name="version" value={application?.version ?? ""}/>
      <section className="panel" data-step="0" hidden={step !== 0}><h2>ข้อมูลการศึกษาและการติดต่อ</h2><p className="workflow-muted">{profile?.sis_verified ? "ตรวจสอบและเติมข้อมูลจากระบบทะเบียนแล้ว" : "ข้อมูลจากโปรไฟล์ถูกเติมให้เบื้องต้น"} กรุณาตรวจสอบก่อนดำเนินการต่อ</p><div className="workflow-grid">
        <label>คณะ / สำนักวิชา *<input name="faculty" required maxLength={150} defaultValue={data.faculty ?? profile?.department ?? ""}/></label>
        <label>สาขาวิชา *<input name="major" required maxLength={150} defaultValue={data.major ?? details.major ?? ""}/></label>
        <label>ระดับการศึกษา *<select name="education_level" required defaultValue={data.education_level ?? details.education_level ?? "ปริญญาตรี"}><option value="">เลือกระดับการศึกษา</option><option>ปริญญาตรี</option><option>ปริญญาโท</option><option>ปริญญาเอก</option><option>อื่น ๆ</option></select></label>
        <label>ชั้นปี *<DigitsInput name="study_year" required minLength={1} maxLength={1} defaultValue={data.study_year ?? details.study_year ?? ""}/></label>
        <label>เกรดเฉลี่ยสะสม (GPA) *<input name="gpa" type="number" min="0" max="4" step="0.01" required defaultValue={data.gpa ?? details.gpa ?? ""}/></label>
        <label>เบอร์โทรศัพท์ *<DigitsInput name="phone" required minLength={10} maxLength={10} title="กรุณากรอกหมายเลขโทรศัพท์ 10 หลัก" defaultValue={data.phone ?? profile?.phone ?? ""}/></label>
        <label className="workflow-wide">ที่อยู่ติดต่อ *<textarea name="address" required minLength={5} maxLength={500} rows={3} defaultValue={data.address ?? details.address ?? ""}/></label>
      </div></section>
      <section className="panel" data-step="1" hidden={step !== 1}><h2>ข้อมูลครอบครัวและเหตุผลสมัคร</h2><div className="workflow-grid">
        <label>รายได้ครอบครัวต่อปี (บาท) *<MoneyInput name="income" required defaultValue={data.income ?? ""}/></label>
        <label>จำนวนสมาชิกในครอบครัว *<DigitsInput name="family_members" required minLength={1} maxLength={2} defaultValue={data.family_members ?? ""}/></label>
        <label>สถานะบิดามารดา *<select name="parent_status" required value={parentStatus} onChange={(event) => setParentStatus(event.target.value)}><option value="">เลือกสถานะ</option>{parentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}<option value="other">อื่น ๆ</option></select></label>
        {parentStatus === "other" && <label>โปรดระบุสถานะบิดามารดา *<input name="parent_status_other" required maxLength={150} defaultValue={data.parent_status_other ?? details.parent_status_other ?? ""}/></label>}
        <label>ชื่อผู้ติดต่อฉุกเฉิน<input name="emergency_name" pattern={personNamePattern} title="กรอกชื่อด้วยตัวอักษร เว้นวรรค จุด หรือขีดกลางเท่านั้น ห้ามใช้ตัวเลข" maxLength={200} defaultValue={data.emergency_name ?? ""}/></label>
        <label>โทรศัพท์ฉุกเฉิน<DigitsInput name="emergency_phone" minLength={10} maxLength={10} title="กรุณากรอกหมายเลขโทรศัพท์ 10 หลัก" defaultValue={data.emergency_phone ?? ""}/></label>
        <label className="workflow-wide">เหตุผลและความจำเป็นในการสมัคร *<textarea name="reason" required minLength={20} maxLength={5000} rows={6} defaultValue={data.reason ?? ""}/></label>
        <label className="workflow-wide">กิจกรรมและผลงานที่ผ่านมา<textarea name="activities" maxLength={5000} rows={5} defaultValue={data.activities ?? ""}/></label>
      </div></section>
      <section className="panel" data-step="2" hidden={step !== 2}><h2>บัญชีรับเงิน</h2><p className="workflow-muted">ข้อมูลส่วนนี้เห็นได้เฉพาะนักศึกษาและเจ้าหน้าที่ผู้รับผิดชอบการจ่ายทุน เลขบัญชีใช้ตัวเลข 10–15 หลัก</p><div className="workflow-grid"><input type="hidden" name="bank_name" value={bankChoice === "other" ? customBank : bankChoice}/><label>ธนาคาร *<select name="bank_choice" required value={bankChoice} onChange={(event) => setBankChoice(event.target.value)}><option value="">เลือกธนาคาร</option>{banks.map((bank) => <option key={bank} value={bank}>{bank}</option>)}<option value="other">อื่น ๆ</option></select></label>{bankChoice === "other" && <label>ระบุธนาคาร *<input name="bank_name_other" required maxLength={150} value={customBank} onChange={(event) => setCustomBank(event.target.value)}/></label>}<label>ชื่อบัญชี *<input name="account_holder" required maxLength={200} defaultValue={paymentAccount?.account_holder ?? ""}/></label><label>เลขบัญชี *<DigitsInput name="account_number" required minLength={10} maxLength={15} title="กรุณากรอกเลขบัญชีเป็นตัวเลข 10–15 หลัก" defaultValue={paymentAccount?.account_number ?? ""}/></label></div></section>
      <section className="panel" data-step="3" hidden={step !== 3}><h2>เอกสารประกอบ</h2><p>{application ? "อัปโหลดเอกสารจำเป็นให้ครบก่อนตรวจทานใบสมัคร" : "กรุณาบันทึกร่างก่อน ระบบจึงจะสร้างพื้นที่ส่วนตัวสำหรับอัปโหลดเอกสาร"}</p></section>
      <section className="panel" data-step="4" hidden={step !== 4}><h2>ตรวจทานก่อนส่ง</h2><p className="workflow-info">เมื่อส่งแล้วจะแก้ไขไม่ได้จนกว่าเจ้าหน้าที่จะส่งกลับมาให้แก้ไข กรุณาตรวจสอบข้อมูลต่อไปนี้</p><div className="workflow-review-grid"><div><span>คณะ / สาขา</span><strong>{reviewData.faculty} · {reviewData.major}</strong></div><div><span>ระดับ / ชั้นปี</span><strong>{reviewData.education_level} · ปี {reviewData.study_year}</strong></div><div><span>GPA</span><strong>{reviewData.gpa}</strong></div><div><span>โทรศัพท์</span><strong>{reviewData.phone}</strong></div><div><span>รายได้ครอบครัว</span><strong>{reviewData.income ? `${money(Number(reviewData.income))} บาท` : "—"}</strong></div><div><span>สถานะบิดามารดา</span><strong>{reviewData.parent_status === "other" ? reviewData.parent_status_other : reviewData.parent_status}</strong></div><div><span>บัญชีรับเงิน</span><strong>{reviewData.bank_name} · {reviewData.account_holder} · {reviewData.account_number}</strong></div><div className="workflow-wide"><span>เหตุผลสมัคร</span><strong>{reviewData.reason}</strong></div><div><span>เอกสาร</span><strong>{documents.length}/{requirements.filter((item) => item.required).length} รายการจำเป็น</strong></div></div></section>
      
    </form>
    {step === 3 && application && <section className="panel"><div className="workflow-document-list">{requirements.map((requirement) => <DocumentUpload canRemove={application.status === "draft" && !application.submitted_at} key={requirement.id} applicationId={application.id} requirement={requirement} document={documents.find((item) => item.requirement_id === requirement.id)}/>)}</div></section>}
    {state.error && <p role="alert" className="workflow-error">{state.error}</p>}{state.success && <p role="status" className="workflow-success">{state.success}</p>}
    {stepError && <p role="alert" className="workflow-error">{stepError}</p>}
    <div className="workflow-actions workflow-step-actions">{step === 0 ? <Link className="btn secondary" href={`/scholarships/${scholarship.id}`}>กลับรายละเอียดทุน</Link> : <button className="btn secondary" type="button" onClick={() => { setStepError(""); setStep((current) => current - 1); }}>ย้อนกลับ</button>}<button className="btn secondary" form="student-application-form" name="mode" value="draft" formNoValidate disabled={pending}>{pending ? "กำลังบันทึก…" : application ? "บันทึกร่าง" : "บันทึกร่างและไปต่อ"}</button>{step < steps.length - 1 && (step !== 2 || application) && <button className="btn" type="button" onClick={nextStep}>ถัดไป</button>}{step === steps.length - 1 && <button className="btn" form="student-application-form" name="mode" value="submit" disabled={pending} onClick={(event) => event.currentTarget.form?.classList.add("form-validated")}>{pending ? "กำลังส่ง…" : "ยืนยันและส่งใบสมัคร"}</button>}</div>
  </div>;
}

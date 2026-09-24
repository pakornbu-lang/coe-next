"use client";
import Image from "next/image";
import { useState } from "react";
import type { ApplicationSummary } from "@/lib/scholarships/types";

const groups = [
  { title: "การศึกษา", fields: [["faculty", "คณะ / สำนักวิชา"], ["major", "สาขาวิชา"], ["education_level", "ระดับการศึกษา"], ["study_year", "ชั้นปี"], ["gpa", "เกรดเฉลี่ย (GPA)"]] },
  { title: "ข้อมูลติดต่อ", fields: [["phone", "เบอร์โทรศัพท์"], ["address", "ที่อยู่"], ["emergency_name", "ชื่อผู้ติดต่อฉุกเฉิน"], ["emergency_phone", "เบอร์ผู้ติดต่อฉุกเฉิน"]] },
  { title: "ข้อมูลครอบครัว", fields: [["income", "รายได้ครอบครัว (บาท / ปี)"], ["family_members", "จำนวนสมาชิกครอบครัว"], ["parent_status", "สถานะบิดามารดา"], ["parent_status_other", "รายละเอียดเพิ่มเติม"]] },
];
export default function ApplicantDetails({ application }: { application: ApplicationSummary }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const data = application.application_data;
  return <section className="panel">
    <div className="applicant-heading">
      {photoFailed ? <span className="applicant-photo-placeholder" aria-label="ไม่มีรูปโปรไฟล์">{application.student_name.slice(0, 1)}</span> :
        <Image className="applicant-photo" src={`/staff/review/${application.id}/avatar`} alt={`รูปโปรไฟล์ ${application.student_name}`}
          width={96} height={96} unoptimized onError={() => setPhotoFailed(true)}/>}
      <div><h2>ข้อมูลผู้สมัคร</h2><strong>{application.student_name}</strong><p>รหัสนักศึกษา {application.student_code}</p>
        <p>ทุน: {application.scholarship?.title ?? "—"}</p></div>
    </div>
    <p className="workflow-muted">ข้อมูลจากใบสมัครที่ส่งไว้ · รูปภาพใช้รูปโปรไฟล์ปัจจุบัน</p>
    {groups.map(group => <section key={group.title} className="applicant-detail-group"><h3>{group.title}</h3>
      <dl className="workflow-facts">{group.fields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{data[key] || "ไม่ได้ระบุ"}</dd></div>)}</dl>
    </section>)}
    <h3>เหตุผลในการสมัคร</h3><p className="workflow-preserve">{data.reason || "ไม่ได้ระบุ"}</p>
    <h3>กิจกรรมและผลงาน</h3><p className="workflow-preserve">{data.activities || "ไม่ได้ระบุ"}</p>
  </section>;
}

"use client";
import { useState } from "react";
import Avatar from "./Avatar";
import ProfileForm from "./ProfileForm";
import type { PersonalProfile } from "@/lib/account/types";
import { roleLabels, type Viewer } from "@/lib/auth/types";

export default function ProfileOverview({ viewer, profile, initialEditing = false }: { viewer: Viewer; profile: PersonalProfile; initialEditing?: boolean }) {
  const [editing, setEditing] = useState(initialEditing);
  const [saved, setSaved] = useState(false);
  const details = profile.profile_details;
  const student = viewer.role === "student";
  const sections: { title: string; items: [string, string | null | undefined][] }[] = [
    {title:"ข้อมูลส่วนตัวและการติดต่อ",items:[["ชื่อ–นามสกุล",viewer.fullName],[student?"รหัสนักศึกษา":"รหัสประจำตัว",viewer.studentId],["อีเมลเข้าสู่ระบบ",viewer.email],["เบอร์โทรศัพท์",profile.phone],["ที่อยู่ติดต่อ",details.address]]},
    student ? {title:"ข้อมูลการศึกษา",items:[["คณะ / สำนักวิชา",profile.department],["สาขาวิชา",details.major],["ระดับการศึกษา",details.education_level],["ชั้นปี",details.study_year],["เกรดเฉลี่ย",details.gpa]]}
      : {title:"ข้อมูลการทำงาน",items:[["หน่วยงาน / คณะ / สำนักวิชา",profile.department],["ตำแหน่งงาน",profile.position],...(viewer.role === "committee" ? [["ความเชี่ยวชาญ",profile.expertise] as [string,string|null]] : [])]},
    ...(student ? [{title:"ข้อมูลครอบครัว",items:[["สถานะบิดามารดา",details.parent_status === "other" ? details.parent_status_other : details.parent_status]] as [string,string|null|undefined][]}] : []),
  ];
  function edit() { setSaved(false); setEditing(true); }
  return <>
    <section className="profile-heading profile-banner profile-unified">
      <header className="profile-unified-heading"><div><span className="profile-eyebrow">MY PROFILE</span><h1>โปรไฟล์ของฉัน</h1></div><span className="profile-role-chip"><span aria-hidden="true"/>{roleLabels[viewer.role]}</span></header>
      <div className="profile-unified-account">
        <div className="profile-unified-avatar"><Avatar version={viewer.avatarVersion} name={viewer.fullName} size={104}/></div>
        <div className="profile-summary-text"><span className="profile-name-label">ชื่อ–นามสกุล</span><h2>{viewer.fullName}</h2><p>จัดการข้อมูลส่วนตัวและข้อมูลติดต่อของคุณ</p></div>
        <button className="btn profile-edit-button" onClick={edit} aria-expanded={editing} aria-controls="profile-editor"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5L8 21H3v-5L16 3ZM13 6l5 5"/></svg>แก้ไขโปรไฟล์</button>
      </div>
      <dl className="profile-banner-details">
        <div><dt>{student ? "รหัสนักศึกษา" : "รหัสประจำตัว"}</dt><dd>{viewer.studentId}</dd></div>
        <div><dt>อีเมลเข้าสู่ระบบ</dt><dd>{viewer.email}</dd></div>
        <div><dt>เบอร์โทรศัพท์</dt><dd>{profile.phone || "ยังไม่ระบุ"}</dd></div>
      </dl>
    </section>
    {saved && <p className="profile-success" role="status">บันทึกโปรไฟล์แล้ว</p>}
    {editing && <section id="profile-editor" className="panel profile-editor"><ProfileForm profile={profile} role={viewer.role} onSaved={() => { setEditing(false); setSaved(true); }} onCancel={() => setEditing(false)} /></section>}
    <div className="profile-overview-grid">{sections.map(section => <section className="panel" key={section.title}><header className="profile-card-heading"><h2>{section.title}</h2><button className="text-button" onClick={edit}>แก้ไข ›</button></header><dl className="profile-facts">{section.items.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value || "ยังไม่ระบุ"}</dd></div>)}</dl>{student && section.title === "ข้อมูลการศึกษา" && <p className="profile-hint">ข้อมูลที่คุณกรอกเอง ยังไม่ผ่านการตรวจสอบคุณสมบัติทุน</p>}</section>)}</div>
    <p className="profile-hint">ชื่อ รหัสประจำตัว บทบาท และสถานะบัญชีดูแลโดย Admin · เปลี่ยนอีเมลได้ที่ส่วนอีเมลเข้าสู่ระบบด้านล่าง</p>
  </>;
}

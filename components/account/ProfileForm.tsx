"use client";
import { useActionState, useState } from "react";
import { updateMyProfile } from "@/app/actions/profile";
import type { PersonalProfile, ProfileState } from "@/lib/account/types";
import type { PortalRole } from "@/lib/auth/types";

export default function ProfileForm({ profile, role, onSaved, onCancel }: { profile: PersonalProfile; role: PortalRole; onSaved?: () => void; onCancel?: () => void }) {
  const committee = role === "committee", student = role === "student";
  const [state, action, pending] = useActionState<ProfileState, FormData>(async (previous, form) => {
    const result = await updateMyProfile(previous, form);
    if (result.success) onSaved?.();
    return result;
  }, { error: "", success: "", version: profile.version });
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [department, setDepartment] = useState(profile.department ?? "");
  const [position, setPosition] = useState(profile.position ?? "");
  const [expertise, setExpertise] = useState(profile.expertise ?? "");
  const [details, setDetails] = useState(profile.profile_details ?? {});
  const detail = (key: string, value: string) => setDetails(current => ({ ...current, [key]: value }));
  return <form action={action} className="profile-form">
    <input type="hidden" name="version" value={state.version ?? profile.version} />
    <fieldset disabled={pending}>
      <legend>แก้ไขโปรไฟล์</legend>
      <p className="profile-hint">ข้อมูลส่วนนี้ไม่บังคับกรอก เว้นว่างเพื่อล้างข้อมูลเดิมได้</p>
      <label htmlFor="avatar">รูปโปรไฟล์</label>
      <input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="avatar-help" />
      <p id="avatar-help" className="profile-hint">JPG, PNG หรือ WebP ไม่เกิน 2 MB ระบบจะจัดรูปเป็นสี่เหลี่ยมจัตุรัส</p>
      {profile.avatar_path && <label className="profile-checkbox"><input name="remove_avatar" type="checkbox" /> ลบรูปโปรไฟล์ปัจจุบัน</label>}
      <div className="profile-fields">
        <label>เบอร์โทรศัพท์<input name="phone" type="text" inputMode="numeric" autoComplete="tel" pattern="[0-9]{10}" maxLength={10} title="กรุณากรอกหมายเลขโทรศัพท์ 10 หลัก" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="เช่น 0812345678" /></label>
        <label className="profile-wide">ที่อยู่ติดต่อ<textarea name="address" maxLength={500} rows={3} autoComplete="street-address" value={details.address ?? ""} onChange={e => detail("address",e.target.value)} /></label>
      </div>
      <h2 className="profile-section-title">{student ? "ข้อมูลการศึกษา" : "ข้อมูลการทำงาน"}</h2>
       {student && <p className="profile-hint">ข้อมูลการศึกษาที่คุณกรอกเอง ยังไม่ใช่ผลการตรวจสอบคุณสมบัติทุน</p>}
      <div className="profile-fields">
        <label>{student ? "คณะ / สำนักวิชา" : "หน่วยงาน / คณะ / สำนักวิชา"}<input name="department" maxLength={150} value={department} onChange={e => setDepartment(e.target.value)} autoComplete="organization" /></label>
        {student ? <>
          <label>สาขาวิชา<input name="major" maxLength={150} value={details.major ?? ""} onChange={e => detail("major",e.target.value)} /></label>
          <label>ระดับการศึกษา<select name="education_level" value={details.education_level ?? ""} onChange={e => detail("education_level",e.target.value)}><option value="">ยังไม่ระบุ</option><option>ปริญญาตรี</option><option>ปริญญาโท</option><option>ปริญญาเอก</option><option>อื่น ๆ</option></select></label>
          <label>ชั้นปี<input name="study_year" type="text" inputMode="numeric" pattern="[1-8]" maxLength={1} value={details.study_year ?? ""} onChange={e => detail("study_year",e.target.value.replace(/\D/g, "").slice(0, 1))} /></label>
           <label>เกรดเฉลี่ย (GPA)<input name="gpa" type="number" min="0" max="4" step="0.01" value={details.gpa ?? ""} onChange={e => detail("gpa",e.target.value)} /></label>
           <label>สถานะบิดามารดา<select name="parent_status" value={details.parent_status ?? ""} onChange={e => detail("parent_status",e.target.value)}><option value="">ยังไม่ระบุ</option><option>อยู่ด้วยกัน</option><option>แยกกันอยู่</option><option>หย่า</option><option>บิดาเสียชีวิต</option><option>มารดาเสียชีวิต</option><option>เสียชีวิตทั้งคู่</option><option value="other">อื่น ๆ</option></select></label>
           {details.parent_status === "other" && <label>ระบุสถานะบิดามารดา<input name="parent_status_other" maxLength={150} value={details.parent_status_other ?? ""} onChange={e => detail("parent_status_other",e.target.value)} /></label>}
        </> : <label>ตำแหน่งงาน<input name="position" maxLength={150} value={position} onChange={e => setPosition(e.target.value)} autoComplete="organization-title" /></label>}
        {committee && <label className="profile-wide">ความเชี่ยวชาญ<textarea name="expertise" maxLength={500} rows={4} value={expertise} onChange={e => setExpertise(e.target.value)} placeholder="ระบุสาขาหรือประสบการณ์ที่เกี่ยวข้องกับการพิจารณาทุน" /><span className="profile-hint">ไม่เกิน 500 ตัวอักษร</span></label>}
      </div>
      <button className="profile-submit" type="submit" aria-busy={pending}>{pending && <span className="action-spinner" aria-hidden="true"/>}{pending ? "กำลังบันทึก…" : "บันทึกโปรไฟล์"}</button>
      {onCancel && <button type="button" className="btn secondary profile-cancel" onClick={onCancel}>ยกเลิก</button>}
    </fieldset>
    {state.error && <p className="profile-error" role="alert">{state.error}</p>}
    {state.success && <p className="profile-success" role="status"><span className="action-success-mark" aria-hidden="true">✓</span>{state.success}</p>}
  </form>;
}

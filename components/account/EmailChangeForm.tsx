"use client";
import { useActionState } from "react";
import { changeMyEmail } from "@/app/actions/change-email";

export default function EmailChangeForm({ email, pendingEmail }: { email: string; pendingEmail?: string }) {
  const [state, action, pending] = useActionState(changeMyEmail, {error:"",success:""});
  return <section className="panel profile-security"><h2>อีเมลเข้าสู่ระบบ</h2><p>อีเมลปัจจุบัน: <strong>{email}</strong></p>
    {pendingEmail && pendingEmail !== email && <p className="profile-success">รอยืนยันการเปลี่ยนเป็น {pendingEmail} กรุณาตรวจกล่องจดหมายทั้งสองอีเมล</p>}
    <details className="email-change-details"><summary className="text-button">เปลี่ยนอีเมล</summary><form action={action} className="profile-form" onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}><fieldset disabled={pending}><p>ใช้อีเมลที่คุณเข้าถึงได้ และยืนยันผ่านลิงก์ที่ส่งไปยังอีเมลเดิมและอีเมลใหม่ก่อนใช้งาน</p><div className="profile-fields"><label>อีเมลใหม่ *<input name="new_email" type="email" required maxLength={254} autoComplete="email" placeholder="name@example.com" /></label><label>รหัสผ่านปัจจุบัน *<input name="current_password" type="password" required minLength={8} maxLength={128} autoComplete="current-password" /></label></div><button className="profile-submit" type="submit" onClick={(event) => event.currentTarget.form?.classList.add("form-validated")}>{pending?"กำลังส่งคำขอ…":"ส่งลิงก์ยืนยันการเปลี่ยนอีเมล"}</button></fieldset>{state.error && <p role="alert" className="profile-error">{state.error}</p>}{state.success && <p role="status" className="profile-success">{state.success}</p>}</form></details>
  </section>;
}

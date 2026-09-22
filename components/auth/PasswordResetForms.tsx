"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { completePasswordReset, requestPasswordReset, type PasswordResetState } from "@/app/actions/password-reset";
import { Brand, Panel } from "@/components/portal/Shared";

const empty: PasswordResetState = { error: "", success: "" };

function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="auth-page"><aside className="auth-art"><Brand/><div className="auth-story"><h1>ดูแลบัญชีของคุณ<br/>เพื่อเข้าถึงโอกาสทางการศึกษา</h1><p>ใช้อีเมลที่ลงทะเบียนเพื่อรับลิงก์และตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p><span className="short-line"/></div></aside><div className="auth-right"><Panel><h1>{title}</h1><h2>ระบบติดตามทุนการศึกษา</h2>{children}</Panel><Link href="/login">← กลับหน้าเข้าสู่ระบบ</Link></div></div>;
}

export function ForgotPasswordForm({ initialError = "" }: { initialError?: string }) {
  const [state, action, pending] = useActionState(requestPasswordReset, { error: initialError, success: "" });
  return <AuthFrame title="ลืมรหัสผ่าน"><form action={action} onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}><p>กรอกอีเมลเดียวกับที่ใช้ลงทะเบียนบัญชีระบบทุนการศึกษา หากเคยเปลี่ยนอีเมล ให้ใช้อีเมลล่าสุดของบัญชี</p><label htmlFor="recovery-email">อีเมลที่ลงทะเบียน *</label><input id="recovery-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="อีเมลที่ใช้สมัครบัญชี"/><button className="btn" disabled={pending} onClick={(event) => event.currentTarget.form?.classList.add("form-validated")}>{pending ? "กำลังส่ง…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}</button>{state.error && <p className="soft-box" role="alert">{state.error}</p>}{state.success && <div className="soft-box" role="status" aria-live="polite"><strong>ตรวจสอบอีเมลของคุณ</strong><p>{state.success}</p><p>เปิดอีเมลหัวข้อ “ตั้งรหัสผ่านใหม่” แล้วกดลิงก์ล่าสุด หากทดสอบเว็บ localhost ให้เปิดลิงก์บนเครื่องที่รันเว็บอยู่</p></div>}</form></AuthFrame>;
}

export function NewPasswordForm() {
  const [visible, setVisible] = useState(false);
  const [state, action, pending] = useActionState(completePasswordReset, empty);
  return <AuthFrame title="ตั้งรหัสผ่านใหม่"><form action={action} onInvalidCapture={(event) => event.currentTarget.classList.add("form-validated")}><p>ใช้รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษรและไม่ควรซ้ำกับรหัสผ่านเดิม</p><label htmlFor="new-password">รหัสผ่านใหม่ *</label><span className="password-field"><input id="new-password" name="password" type={visible ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password"/><button type="button" onClick={() => setVisible(current => !current)}>{visible ? "ซ่อน" : "แสดง"}</button></span><label htmlFor="confirm-new-password">ยืนยันรหัสผ่านใหม่ *</label><input id="confirm-new-password" name="confirm_password" type={visible ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password"/><button className="btn" disabled={pending} onClick={(event) => event.currentTarget.form?.classList.add("form-validated")}>{pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>{state.error && <p className="soft-box" role="alert">{state.error}</p>}</form></AuthFrame>;
}

"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import RegisterForm from "./RegisterForm";
import { login } from "@/app/actions/auth";
import { Brand, Icon, Panel } from "@/components/portal/Shared";

export default function LoginPage({ register = false, resetComplete = false }: { register?: boolean; resetComplete?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [state, action, pending] = useActionState(login, { error: "" });
  return (
    <div className="auth-page">
      <aside className="auth-art">
        <Brand />
        <div className="auth-story">
          <h1>โอกาสที่ใช่<br />สร้างอนาคตที่ดีกว่าเสมอ</h1>
          <p>ระบบติดตามทุนการศึกษาภายในมหาวิทยาลัย<br />เข้าสู่ระบบเพื่อใช้พื้นที่ตามบทบาทของคุณ</p>
          <span className="short-line" />
          {[
            ["search", "นักศึกษา", "ค้นหาทุน จัดการโปรไฟล์ และติดตามใบสมัคร"],
            ["file", "เจ้าหน้าที่ทุน", "จัดการทุนการศึกษาและตรวจสอบเอกสาร"],
            ["people", "กรรมการ", "พิจารณาและประเมินใบสมัครทุนการศึกษา"],
          ].map(([icon, title, text]) => (
            <div className="auth-feature" key={title}>
              <span><Icon name={icon} size={36} /></span>
              <div><h3>{title}</h3><p>{text}</p></div>
            </div>
          ))}
        </div>
        <blockquote>การศึกษา คือโอกาสในการเติบโต</blockquote>
      </aside>
      <div className="auth-right">
        <p className="auth-motto">เพื่อการเติบโตของทุกคน ในรั้วมหาวิทยาลัย <span>A Brighter Tomorrow Together</span></p>
        <Panel>
          <h1>{register ? "สมัครสมาชิกนักศึกษา" : "เข้าสู่ระบบ"}</h1>
          <h2>ระบบติดตามทุนการศึกษา</h2>
          {register ? (
            <RegisterForm />
          ) : (
            <form action={action}>
              {resetComplete && <p className="soft-box" role="status">ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง</p>}
              <label htmlFor="login-email">อีเมลมหาวิทยาลัย <b>*</b></label>
              <input id="login-email" name="email" type="email" required maxLength={254}
                placeholder="name@mail.wu.ac.th" autoComplete="username" />
              <label htmlFor="login-password">รหัสผ่าน <b>*</b></label>
              <span className="password-field">
                <input id="login-password" name="password" type={visible ? "text" : "password"}
                  required minLength={8} maxLength={128} placeholder="กรอกรหัสผ่าน"
                  autoComplete="current-password" />
                <button type="button" onClick={() => setVisible(!visible)}
                  aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                  {visible ? "ซ่อน" : "แสดง"}
                </button>
              </span>
              <Link className="text-button forgot" href="/forgot-password">ลืมรหัสผ่าน?</Link>
              <button className="btn" type="submit" disabled={pending}>
                {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}<Icon name="arrow" />
              </button>
              {state.error && <p className="soft-box" role="alert">{state.error}</p>}
              <p className="auth-switch">ยังไม่มีบัญชี? <Link href="/register">สมัครสมาชิก</Link></p>
            </form>
          )}
        </Panel>
        <Link href="/">← กลับหน้าแรก</Link>
      </div>
    </div>
  );
}

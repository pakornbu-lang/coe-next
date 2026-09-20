"use client";
import Link from "next/link";
import {useActionState} from "react";
import {registerStudent} from "@/app/actions/register";
export default function RegisterForm(){
 const [state,action,pending]=useActionState(registerStudent,{error:"",success:""});
 return <form action={action}>
 <p>สมัครเพื่อใช้งานในบทบาท <strong>นักศึกษา (Student)</strong> สิทธิ์เจ้าหน้าที่และกรรมการต้องได้รับอนุมัติจากผู้ดูแล</p>
 <label htmlFor="register-title">คำนำหน้าชื่อ *</label>
 <select id="register-title" name="title" autoComplete="honorific-prefix" defaultValue="" required disabled={pending}>
 <option value="" disabled>เลือกคำนำหน้าชื่อ</option>
 <option value="นาย">นาย</option>
 <option value="นาง">นาง</option>
 <option value="นางสาว">นางสาว</option>
 </select>
 <label htmlFor="register-name">ชื่อ–นามสกุล *</label><input id="register-name" name="full_name" autoComplete="name" placeholder="ชื่อและนามสกุล โดยไม่ต้องใส่คำนำหน้า" required maxLength={193}/>
 <label htmlFor="register-id">รหัสนักศึกษา *</label><input id="register-id" name="student_id" inputMode="numeric" pattern="[0-9]{8,12}" minLength={8} maxLength={12} required/>
 <label htmlFor="register-email">อีเมลมหาวิทยาลัย *</label><input id="register-email" name="email" type="email" autoComplete="email" placeholder="name@mail.wu.ac.th" required maxLength={254}/>
 <label htmlFor="register-password">รหัสผ่าน *</label><input id="register-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/>
 <label htmlFor="register-confirm">ยืนยันรหัสผ่าน *</label><input id="register-confirm" name="confirm_password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/>
 <p>ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร และตรวจสอบอีเมลให้ถูกต้องก่อนสมัคร</p>
 <button className="btn" disabled={pending}>{pending?"กำลังสมัครสมาชิก…":"สมัครสมาชิกนักศึกษา"}</button>
 {state.error&&<p className="soft-box" role="alert">{state.error}</p>}
 {state.success&&<p className="soft-box" role="status">{state.success}</p>}
 <p className="auth-switch">มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link></p>
 </form>;
}

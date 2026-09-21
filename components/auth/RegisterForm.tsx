"use client";
import Link from "next/link";
import {useActionState, useState} from "react";
import {registerStudent} from "@/app/actions/register";
export default function RegisterForm(){
 const [state,action,pending]=useActionState(registerStudent,{error:"",success:""});
 const [prefix,setPrefix]=useState("นาย");
 return <form action={action} onInvalidCapture={event=>event.currentTarget.classList.add("form-validated")}>
 <p>สมัครเพื่อใช้งานในบทบาท <strong>นักศึกษา (Student)</strong> สิทธิ์เจ้าหน้าที่และกรรมการต้องได้รับอนุมัติจากผู้ดูแล</p>
 <label htmlFor="register-prefix">คำนำหน้าชื่อ *</label><select id="register-prefix" name="prefix" required value={prefix} onChange={event=>setPrefix(event.target.value)}><option>นาย</option><option>นาง</option><option>นางสาว</option><option>ดร.</option><option>ผศ.</option><option>รศ.</option><option>ศ.</option><option value="other">อื่น ๆ</option></select>
 {prefix==="other"&&<><label htmlFor="register-prefix-other">ระบุคำนำหน้าชื่อ *</label><input id="register-prefix-other" name="prefix_other" required maxLength={30}/></>}
 <label htmlFor="register-first-name">ชื่อ *</label><input id="register-first-name" name="first_name" autoComplete="given-name" required maxLength={100}/>
 <label htmlFor="register-last-name">นามสกุล *</label><input id="register-last-name" name="last_name" autoComplete="family-name" required maxLength={100}/>
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

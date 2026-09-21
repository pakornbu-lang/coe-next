"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {isAuthConfigured} from "@/lib/supabase/config";
import {siteUrl} from "@/lib/auth/site-url";
export type RegisterState={error:string;success:string};
export async function registerStudent(_previous:RegisterState,form:FormData):Promise<RegisterState>{
 const prefix=String(form.get("prefix")??"").trim();
 const firstName=String(form.get("first_name")??"").trim();
 const lastName=String(form.get("last_name")??"").trim();
 const allowedPrefixes=["นาย","นางสาว","นาง"];
 const actualPrefix=prefix;
 const fullName=[actualPrefix,firstName,lastName].filter(Boolean).join(" ");
 const studentId=String(form.get("student_id")??"").trim();
 const email=String(form.get("email")??"").trim().toLowerCase();
 const password=String(form.get("password")??"");
 if(!allowedPrefixes.includes(prefix)||!firstName||firstName.length>100||!lastName||lastName.length>100||!fullName||fullName.length>200||!/^[0-9]{8,12}$/.test(studentId)||!/^([^\s@]+)@(mail\.)?wu\.ac\.th$/.test(email)||email.length>254)
   return {error:"กรุณากรอกคำนำหน้า ชื่อ นามสกุล รหัสประจำตัว 8–12 หลัก และอีเมลมหาวิทยาลัยให้ถูกต้อง",success:""};
 if(password.length<8||password.length>128||password!==String(form.get("confirm_password")??""))
   return {error:"รหัสผ่านต้องยาว 8–128 ตัวอักษร และทั้งสองช่องต้องตรงกัน",success:""};
 if(!isAuthConfigured())return {error:"ระบบสมัครสมาชิกยังไม่พร้อมใช้งาน",success:""};
 let signedIn=false;
 try {
   const client=await createClient();
   // Never accept a role from the form. The database independently forces student.
   const {data,error}=await client.auth.signUp({email,password,options:{
     data:{full_name:fullName,student_id:studentId,prefix:actualPrefix,first_name:firstName,last_name:lastName},emailRedirectTo:siteUrl()+"/auth/callback"
   }});
   if(error){
     const message=error.status===429?"มีคำขอมากเกินไป กรุณารอสักครู่ก่อนลองอีกครั้ง":
       error.code==="email_address_not_authorized"?"ระบบส่งอีเมลยังไม่รองรับผู้สมัครทั่วไป กรุณาติดต่อผู้ดูแลเพื่อตั้งค่า SMTP":
       error.code==="weak_password"?"รหัสผ่านไม่ผ่านข้อกำหนดความปลอดภัย กรุณาใช้รหัสผ่านที่เดายากขึ้น":
       "สมัครสมาชิกไม่สำเร็จ กรุณาตรวจสอบข้อมูล หากเคยสมัครแล้วให้ลองเข้าสู่ระบบ หรือติดต่อผู้ดูแล";
     return {error:message,success:""};
   }
   signedIn=Boolean(data.session);
 } catch {return {error:"ไม่สามารถเชื่อมต่อระบบสมัครสมาชิกได้ กรุณาลองใหม่หรือติดต่อผู้ดูแล",success:""};}
 if(signedIn){revalidatePath("/","layout");redirect("/dashboard");}
 return {error:"",success:"หากข้อมูลสามารถใช้สมัครได้ ระบบจะส่งลิงก์ยืนยันไปยังอีเมลของคุณ โปรดตรวจกล่องจดหมายและสแปม แล้วเปิดลิงก์ในเบราว์เซอร์เดียวกัน หากมีบัญชีแล้วให้เข้าสู่ระบบได้เลย"};
}

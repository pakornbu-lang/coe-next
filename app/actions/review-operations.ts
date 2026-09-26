"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
// Server Actions รับฟอร์มจาก OperationsForms.tsx และบันทึกด้วยสิทธิ์ผู้ใช้ปัจจุบัน
// เปลี่ยนข้อความสำเร็จ/ผิดพลาดได้ใน return ของแต่ละ action
// เพิ่มฟิลด์ต้องแก้ input name -> value(f, key) -> p_* ของ RPC -> ตาราง/validation ใน migration ใหม่
export type OperationState={error:string;success:string};
const value=(f:FormData,k:string)=>String(f.get(k)??"").trim();
// ช่องวันเวลาจากฟอร์มไม่มีเขตเวลา จึงตีความเป็นเวลาไทย +07:00 ก่อนส่งฐานข้อมูล
const time=(s:string)=>s?new Date(s+":00+07:00").toISOString():null;
// จัดการงานเดิม: id=รหัสงาน, version=รุ่นข้อมูล, due_at=กำหนดส่ง
// replacement=กรรมการใหม่ หรือ revoke=ถอนงาน; กฎห้ามทำพร้อมกันอยู่ใน staff_manage_review
// กฎต้นทางอ่านได้ใน migration 20260923090000_review_operations.sql และต้องดู migration ที่แก้ต่อภายหลัง
export async function manageReview(_:OperationState,f:FormData):Promise<OperationState>{
 await requireRole(["staff"]);
 try{
 const c=await createClient();const {error}=await c.rpc("staff_manage_review",{p_id:value(f,"id"),p_version:Number(value(f,"version")),p_due_at:time(value(f,"due_at")),p_replacement:value(f,"replacement")||null,p_revoke:value(f,"revoke")==="on",p_reason:value(f,"reason")});
 if(error)return {error:(error.code==="PT409"||error.code==="40001"||(error.code==="P0001"&&error.message==="STALE_VERSION"))?"ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรช":error.code==="23505"?"กรรมการนี้มีงานในใบสมัครเดียวกันแล้ว":"ตรวจสอบกำหนดส่ง เหตุผล และสถานะงาน",success:""};
// หลังบันทึก ทำให้หน้าจัดการงานและหน้ากรรมการอ่านข้อมูลใหม่
// ถ้าเพิ่มหน้าที่แสดงข้อมูลชุดนี้ ให้พิจารณาเพิ่ม revalidatePath ของหน้านั้นด้วย
 revalidatePath("/staff/assignments");revalidatePath("/committee");
 return {error:"",success:"บันทึกและสร้างการแจ้งเตือนในระบบแล้ว"};
 }catch{return {error:"บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูล",success:""};}
}
// บันทึกนัดผ่าน staff_schedule_interview_v2: ผูกด้วย application_id และตรวจ version ของนัดเดิม
// start/end เป็นวันเวลา; interviewer คือ id บัญชีกรรมการ; outcome คือผลสัมภาษณ์
// แก้กฎเวลาชน/สถานะ/สิทธิ์ให้สร้าง migration ใหม่สำหรับ RPC และ trigger guard_interview_time
// รหัส 23P01 แสดงข้อความนัดซ้อน ส่วน STALE_VERSION ให้ผู้ใช้โหลดข้อมูลล่าสุดก่อนบันทึกใหม่
export async function saveInterview(_:OperationState,f:FormData):Promise<OperationState>{
 await requireRole(["staff"]);
 try{
 const c=await createClient();const {error}=await c.rpc("staff_schedule_interview_v2",{p_application_id:value(f,"application_id"),p_version:value(f,"version")?Number(value(f,"version")):null,p_start:time(value(f,"start")),p_end:time(value(f,"end")),p_interviewer:value(f,"interviewer"),p_location:value(f,"location"),p_url:value(f,"url"),p_note:value(f,"note"),p_status:value(f,"status"),p_outcome:value(f,"outcome")});
 if(error)return {error:error.code==="23P01"?"เวลาซ้อนกับนัดของกรรมการ นักศึกษา หรือสถานที่":(error.code==="PT409"||error.code==="40001"||(error.code==="P0001"&&error.message==="STALE_VERSION"))?"นัดถูกแก้ไขแล้ว กรุณารีเฟรช":"ตรวจสอบเวลา กรรมการ และผลสัมภาษณ์",success:""};
 revalidatePath(`/staff/review/${value(f,"application_id")}`);revalidatePath(`/staff/evaluations/${value(f,"application_id")}`);
 revalidatePath("/staff/interviews");revalidatePath("/committee/interviews");revalidatePath("/applications");
 return {error:"",success:"บันทึกนัดและสร้างการแจ้งเตือนในระบบแล้ว"};
 }catch{return {error:"บันทึกไม่สำเร็จ กรุณาตรวจวันเวลา",success:""};}
}

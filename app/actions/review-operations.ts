"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { dispatchNotificationEmails } from "@/lib/notifications/email";
export type OperationState={error:string;success:string};
const value=(f:FormData,k:string)=>String(f.get(k)??"").trim();
const time=(s:string)=>s?new Date(s+":00+07:00").toISOString():null;
export async function manageReview(_:OperationState,f:FormData):Promise<OperationState>{
 await requireRole(["staff"]);
 try{
 const c=await createClient();const {error}=await c.rpc("staff_manage_review",{p_id:value(f,"id"),p_version:Number(value(f,"version")),p_due_at:time(value(f,"due_at")),p_replacement:value(f,"replacement")||null,p_revoke:value(f,"revoke")==="on",p_reason:value(f,"reason")});
 if(error)return {error:(error.code==="40001"||(error.code==="P0001"&&error.message==="STALE_VERSION"))?"ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรช":error.code==="23505"?"กรรมการนี้มีงานในใบสมัครเดียวกันแล้ว":"ตรวจสอบกำหนดส่ง เหตุผล และสถานะงาน",success:""};
 revalidatePath("/staff/assignments");revalidatePath("/committee");await dispatchNotificationEmails();
 return {error:"",success:"บันทึกและสร้างการแจ้งเตือนในระบบแล้ว"};
 }catch{return {error:"บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูล",success:""};}
}
export async function saveInterview(_:OperationState,f:FormData):Promise<OperationState>{
 await requireRole(["staff"]);
 try{
 const c=await createClient();const {error}=await c.rpc("staff_schedule_interview_v2",{p_application_id:value(f,"application_id"),p_version:value(f,"version")?Number(value(f,"version")):null,p_start:time(value(f,"start")),p_end:time(value(f,"end")),p_interviewer:value(f,"interviewer"),p_location:value(f,"location"),p_url:value(f,"url"),p_note:value(f,"note"),p_status:value(f,"status"),p_outcome:value(f,"outcome")});
 if(error)return {error:error.code==="23P01"?"เวลาซ้อนกับนัดของกรรมการ นักศึกษา หรือสถานที่":(error.code==="40001"||(error.code==="P0001"&&error.message==="STALE_VERSION"))?"นัดถูกแก้ไขแล้ว กรุณารีเฟรช":"ตรวจสอบเวลา กรรมการ และผลสัมภาษณ์",success:""};
 revalidatePath("/staff/interviews");revalidatePath("/committee/interviews");revalidatePath("/applications");await dispatchNotificationEmails();
 return {error:"",success:"บันทึกนัดและสร้างการแจ้งเตือนในระบบแล้ว"};
 }catch{return {error:"บันทึกไม่สำเร็จ กรุณาตรวจวันเวลา",success:""};}
}

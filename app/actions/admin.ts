"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { MutationState } from "@/lib/admin/types";

const text = (form:FormData,key:string) => String(form.get(key)??"").trim();
function failure(code:string):MutationState {
  return { success:"",error:(code === "PT409" || code === "40001") ? "ข้อมูลถูกแก้ไขแล้ว กรุณารีเฟรชหน้าก่อนลองใหม่" :
    code==="23505" ? "รหัสนักศึกษาหรือชื่อข้อมูลนี้มีอยู่แล้ว" :
    code==="42501" ? "ไม่มีสิทธิ์ทำรายการนี้ หรือบัญชีถูกระงับ" :
    "บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลและลองอีกครั้ง" };
}
export async function updateMember(_previous:MutationState,form:FormData):Promise<MutationState>{
  await requireRole(["admin"]);
  const reason=text(form,"reason");
  if(reason.length<3||reason.length>500) return {error:"กรุณาระบุเหตุผล 3–500 ตัวอักษร",success:""};
  const version=Number(text(form,"version"));
  if(!Number.isSafeInteger(version)||version<1) return failure("22023");
  const operation=text(form,"action");
  const role=text(form,"value");
  if(!["set_role","edit_identity","activate","suspend"].includes(operation)) return failure("22023");
  if(operation==="set_role"&&!["student","staff","committee"].includes(role)) return failure("22023");
  const client=await createClient();
  const {error}=await client.rpc("admin_update_member",{
    p_id:text(form,"id"),p_version:version,p_action:operation,
    p_value:role||null,p_reason:reason,
    p_full_name:text(form,"full_name")||null,p_student_id:text(form,"student_id")||null
  });
  if(error) return failure(error.code);
  revalidatePath("/","layout");
  return {error:"",success:operation==="set_role"?"เปลี่ยนบทบาทและอนุมัติแล้ว พร้อมเก็บประวัติการแก้ไข":"บันทึกแล้ว พร้อมเก็บประวัติการแก้ไข"};
}
export async function saveReference(_previous:MutationState,form:FormData):Promise<MutationState>{
  await requireRole(["admin"]);
  const reason=text(form,"reason"),name=text(form,"name"),id=text(form,"id");
  if(reason.length<3||reason.length>500||!name||name.length>150) return failure("22023");
  const client=await createClient();
  const {error}=await client.rpc("admin_save_reference",{
    p_id:id||null,p_version:id?Number(text(form,"version")):null,
    p_kind:text(form,"kind"),p_name:name,p_active:text(form,"active")==="true",p_reason:reason
  });
  if(error) return failure(error.code);
  revalidatePath("/admin/reference");
  revalidatePath("/admin/audit");
  return {error:"",success:"บันทึกข้อมูลพื้นฐานแล้ว"};
}

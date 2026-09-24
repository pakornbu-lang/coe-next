import type { PortalRole } from "@/lib/auth/types";
export type Member = { id:string; full_name:string; student_id:string; email:string|null; role:PortalRole; active:boolean; pending_role:"staff"|"committee"|null; version:number; created_at:string };
export type ReferenceItem = { id:string; kind:string; name:string; active:boolean; version:number };
export const referenceLabels: Record<string,string> = { scholarship_type:"ประเภททุน", faculty:"คณะ / สำนักวิชา", major:"สาขาวิชา", document_type:"ประเภทเอกสาร" };
export const actionLabels: Record<string,string> = { update_self_profile:"เจ้าของบัญชีแก้ไขโปรไฟล์", set_role:"กำหนดบทบาทและอนุมัติ", register:"สมัครสมาชิก", bootstrap_admin:"เปิดบัญชี Admin", request_role:"เสนอเปลี่ยนบทบาท", approve_role:"อนุมัติบทบาท", reject_role:"ไม่อนุมัติบทบาท", set_student:"กำหนดเป็นนักศึกษา", activate:"เปิดใช้งาน", suspend:"ระงับบัญชี", edit_identity:"แก้ไขข้อมูลสมาชิก", create_reference:"เพิ่มข้อมูลพื้นฐาน", update_reference:"แก้ไขข้อมูลพื้นฐาน", email_changed:"เปลี่ยนอีเมล" };

export type MutationState = { error:string; success:string };

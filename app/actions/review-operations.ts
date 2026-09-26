"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
// Server Actions รับฟอร์มจาก OperationsForms.tsx และบันทึกด้วยสิทธิ์ผู้ใช้ปัจจุบัน
// เปลี่ยนข้อความสำเร็จ/ผิดพลาดได้ใน return ของแต่ละ action
// เพิ่มฟิลด์ต้องแก้ input name -> value(f, key) -> p_* ของ RPC -> ตาราง/validation ใน migration ใหม่
export type OperationState = { error: string; success: string };
const value = (f: FormData /* ข้อมูลทุกช่องที่ form ส่งมา */, k: string) =>
  String(
    f.get(k) ?? "",
  ).trim(); /* อ่านค่าจาก FormData แปลงเป็นข้อความและตัดช่องว่างหัวท้าย */
// ช่องวันเวลาจากฟอร์มไม่มีเขตเวลา จึงตีความเป็นเวลาไทย +07:00 ก่อนส่งฐานข้อมูล
const time = (s: string) =>
  s
    ? new Date(s + ":00+07:00").toISOString()
    : null; /* แปลงข้อความวันเวลาจากฟอร์มไทย UTC+7 เป็น ISO เพื่อบันทึก */
// จัดการงานเดิม: id=รหัสงาน, version=รุ่นข้อมูล, due_at=กำหนดส่ง
// replacement=กรรมการใหม่ หรือ revoke=ถอนงาน; กฎห้ามทำพร้อมกันอยู่ใน staff_manage_review
// กฎต้นทางอ่านได้ใน migration 20260923090000_review_operations.sql และต้องดู migration ที่แก้ต่อภายหลัง
export async function manageReview /* รับคำขอปรับกำหนดส่ง เปลี่ยนกรรมการ หรือถอนงาน */(
  _: OperationState /* ผลก่อนหน้าใน useActionState; ฟังก์ชันนี้ไม่ได้ใช้ค่าเดิม */,
  f: FormData /* ข้อมูลทุกช่องที่ form ส่งมา */,
): Promise<OperationState> {
  await requireRole(["staff"]);
  try {
    const c =
      await createClient(); /* Supabase client สำหรับเรียกฐานข้อมูลด้วยสิทธิ์ผู้ใช้ปัจจุบัน */
    const { error } = await c.rpc("staff_manage_review", {
      p_id: value(f, "id") /* รหัสรายการที่ต้องแก้ไข */,
      p_version: Number(
        value(f, "version"),
      ) /* ส่งรุ่นข้อมูลเดิมให้ฐานข้อมูลตรวจว่ามีใครแก้ไปแล้วหรือไม่ */,
      p_due_at: time(
        value(f, "due_at"),
      ) /* กำหนดส่งที่แปลงเป็น ISO แล้ว; null หมายถึงไม่กำหนด */,
      p_replacement:
        value(f, "replacement") ||
        null /* รหัสกรรมการใหม่; null หมายถึงไม่เปลี่ยนคน */,
      p_revoke: value(f, "revoke") === "on" /* true เมื่อผู้ใช้เลือกถอนงาน */,
      p_reason: value(f, "reason") /* เหตุผลประกอบการทำรายการ */,
    });
    if (error)
      return {
        error:
          error.code === "PT409" ||
          error.code === "40001" ||
          (error.code === "P0001" && error.message === "STALE_VERSION")
            ? "ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรช"
            : error.code === "23505"
              ? "กรรมการนี้มีงานในใบสมัครเดียวกันแล้ว"
              : "ตรวจสอบกำหนดส่ง เหตุผล และสถานะงาน",
        success: "",
      };
    // หลังบันทึก ทำให้หน้าจัดการงานและหน้ากรรมการอ่านข้อมูลใหม่
    // ถ้าเพิ่มหน้าที่แสดงข้อมูลชุดนี้ ให้พิจารณาเพิ่ม revalidatePath ของหน้านั้นด้วย
    revalidatePath(
      "/staff/assignments",
    ); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */
    revalidatePath(
      "/committee",
    ); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */
    return { error: "", success: "บันทึกและสร้างการแจ้งเตือนในระบบแล้ว" };
  } catch {
    return { error: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูล", success: "" };
  }
}
// บันทึกนัดผ่าน staff_schedule_interview_v2: ผูกด้วย application_id และตรวจ version ของนัดเดิม
// start/end เป็นวันเวลา; interviewer คือ id บัญชีกรรมการ; outcome คือผลสัมภาษณ์
// แก้กฎเวลาชน/สถานะ/สิทธิ์ให้สร้าง migration ใหม่สำหรับ RPC และ trigger guard_interview_time
// รหัส 23P01 แสดงข้อความนัดซ้อน ส่วน STALE_VERSION ให้ผู้ใช้โหลดข้อมูลล่าสุดก่อนบันทึกใหม่
export async function saveInterview /* รับคำขอสร้างหรือแก้นัด แล้วเรียก staff_schedule_interview_v2 */(
  _: OperationState /* ผลก่อนหน้าใน useActionState; ฟังก์ชันนี้ไม่ได้ใช้ค่าเดิม */,
  f: FormData /* ข้อมูลทุกช่องที่ form ส่งมา */,
): Promise<OperationState> {
  await requireRole(["staff"]);
  try {
    const c =
      await createClient(); /* Supabase client สำหรับเรียกฐานข้อมูลด้วยสิทธิ์ผู้ใช้ปัจจุบัน */
    const { error } = await c.rpc("staff_schedule_interview_v2", {
      p_application_id: value(f, "application_id") /* รหัสใบสมัครเป้าหมาย */,
      p_version: value(f, "version")
        ? Number(value(f, "version"))
        : null /* ส่งรุ่นข้อมูลเดิมให้ฐานข้อมูลตรวจว่ามีใครแก้ไปแล้วหรือไม่ */,
      p_start: time(
        value(f, "start"),
      ) /* วันเวลาเริ่มสัมภาษณ์หลังแปลงจากเวลาไทย */,
      p_end: time(
        value(f, "end"),
      ) /* วันเวลาสิ้นสุดสัมภาษณ์หลังแปลงจากเวลาไทย */,
      p_interviewer: value(f, "interviewer") /* รหัสกรรมการที่จะสัมภาษณ์ */,
      p_location: value(f, "location") /* สถานที่สัมภาษณ์ที่ส่งเข้า RPC */,
      p_url: value(f, "url") /* ลิงก์สัมภาษณ์ออนไลน์ */,
      p_note: value(f, "note") /* หมายเหตุที่จะบันทึก */,
      p_status: value(f, "status") /* สถานะนัดที่เลือกจากฟอร์ม */,
      p_outcome: value(f, "outcome") /* ผลสัมภาษณ์ที่กรอก */,
    });
    if (error)
      return {
        error:
          error.code === "23P01"
            ? "เวลาซ้อนกับนัดของกรรมการ นักศึกษา หรือสถานที่"
            : error.code === "PT409" ||
                error.code === "40001" ||
                (error.code === "P0001" && error.message === "STALE_VERSION")
              ? "นัดถูกแก้ไขแล้ว กรุณารีเฟรช"
              : "ตรวจสอบเวลา กรรมการ และผลสัมภาษณ์",
        success: "",
      };
    revalidatePath(
      `/staff/review/${value(f, "application_id")}`,
    ); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */
    revalidatePath(
      `/staff/evaluations/${value(f, "application_id")}`,
    ); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */
    revalidatePath(
      "/staff/interviews",
    ); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */
    revalidatePath(
      "/committee/interviews",
    ); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */
    revalidatePath(
      "/applications",
    ); /* ทำให้เส้นทางนี้โหลดข้อมูลใหม่หลังบันทึกสำเร็จ */
    return { error: "", success: "บันทึกนัดและสร้างการแจ้งเตือนในระบบแล้ว" };
  } catch {
    return { error: "บันทึกไม่สำเร็จ กรุณาตรวจวันเวลา", success: "" };
  }
}
